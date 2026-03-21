import logger from './logger.mjs';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const DELAYS = [1000, 2000, 4000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'mcp-client-2025-04-04',
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10) * 1000;
        logger.warn(`Rate limited. Waiting ${retryAfter / 1000}s before retry...`);
        await sleep(retryAfter);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Claude API error ${res.status}: ${text}`);
      }

      const data = await res.json();
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
