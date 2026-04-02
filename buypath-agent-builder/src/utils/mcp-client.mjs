import https from 'node:https';
import http from 'node:http';
import logger from './logger.mjs';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const DELAYS = [1000, 2000, 4000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * Call Claude API with an MCP server configured, extract all useful text.
 * @param {string} userMsg - User message / instruction for Claude
 * @param {string} mcpUrl - URL of the MCP server
 * @param {string} mcpName - Name identifier for the MCP server
 * @returns {string} Combined text from all content blocks
 */
export async function callMCP(userMsg, mcpUrl, mcpName) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const body = {
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: userMsg }],
    mcp_servers: [
      {
        type: 'url',
        url: mcpUrl,
        name: mcpName,
      },
    ],
  };

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
        const wait = parseInt(res.headers['retry-after'] || '5', 10) * 1000;
        await sleep(wait);
        continue;
      }

      if (res.status < 200 || res.status >= 300) {
        throw new Error(`MCP API error ${res.status}: ${res.body}`);
      }

      const data = JSON.parse(res.body);
      return extractAllText(data.content);
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        logger.warn(`MCP call to ${mcpName} attempt ${attempt + 1} failed: ${err.message}`);
        await sleep(DELAYS[attempt]);
      }
    }
  }

  logger.error(`MCP call to ${mcpName} failed after 3 attempts: ${lastError?.message}`);
  return '';
}

function extractAllText(content) {
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const block of content) {
    if (block.type === 'text') {
      parts.push(block.text);
    } else if (block.type === 'mcp_tool_result') {
      if (Array.isArray(block.content)) {
        for (const inner of block.content) {
          if (inner.type === 'text') parts.push(inner.text);
        }
      } else if (typeof block.content === 'string') {
        parts.push(block.content);
      }
    }
  }
  return parts.join('\n');
}

export default callMCP;
