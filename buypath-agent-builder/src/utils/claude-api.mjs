import https from 'node:https';
import http from 'node:http';
import logger from './logger.mjs';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const DELAYS = [1000, 2000, 4000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make an HTTPS request, routing through the https_proxy env var if set.
 * Node 22 native fetch does not respect https_proxy, so we use node:https.
 */
function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const requestHeaders = {
      ...headers,
      'Content-Length': Buffer.byteLength(bodyStr),
    };

    const proxyStr =
      process.env.https_proxy ||
      process.env.HTTPS_PROXY ||
      process.env.GLOBAL_AGENT_HTTP_PROXY ||
      process.env.npm_config_proxy ||
      '';

    function doRequest(socket) {
      const opts = {
        host: target.hostname,
        port: target.port || 443,
        path: target.pathname + (target.search || ''),
        method: 'POST',
        headers: requestHeaders,
        ...(socket ? { socket, agent: false } : {}),
      };

      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      });
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    }

    if (!proxyStr) {
      doRequest(null);
      return;
    }

    // CONNECT tunnel through proxy
    const proxyUrl = new URL(proxyStr.startsWith('http') ? proxyStr : 'http://' + proxyStr);
    const connectHeaders = {};
    if (proxyUrl.username) {
      const creds = Buffer.from(
        `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`
      ).toString('base64');
      connectHeaders['Proxy-Authorization'] = `Basic ${creds}`;
    }

    const connectReq = http.request({
      host: proxyUrl.hostname,
      port: proxyUrl.port || 80,
      method: 'CONNECT',
      path: `${target.hostname}:${target.port || 443}`,
      headers: connectHeaders,
    });

    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
        return;
      }
      doRequest(socket);
    });
    connectReq.on('error', reject);
    connectReq.end();
  });
}

/**
 * Call the Anthropic Claude API with retry logic.
 * @param {string} system - System prompt
 * @param {string} userMsg - User message
 * @param {object} options - { maxTokens, tools, mcpServers }
 * @returns {string} Text response from Claude
 */
export async function callClaude(system, userMsg, options = {}) {
  const { maxTokens = 4096, tools, mcpServers } = options;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }

  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMsg }],
  };

  if (tools) body.tools = tools;
  if (mcpServers) body.mcp_servers = mcpServers;

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'mcp-client-2025-04-04',
  };

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await httpsPost(API_URL, headers, body);

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers['retry-after'] || '5', 10) * 1000;
        logger.warn(`Rate limited. Waiting ${retryAfter / 1000}s before retry...`);
        await sleep(retryAfter);
        continue;
      }

      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Claude API error ${res.status}: ${res.body}`);
      }

      const data = JSON.parse(res.body);
      return extractText(data.content);
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        logger.warn(`Claude API attempt ${attempt + 1} failed: ${err.message}. Retrying...`);
        await sleep(DELAYS[attempt]);
      }
    }
  }

  throw lastError;
}

function extractText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

export default callClaude;
