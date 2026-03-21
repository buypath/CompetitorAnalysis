import logger from './logger.mjs';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const DELAYS = [1000, 2000, 4000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        const wait = parseInt(res.headers.get('retry-after') || '5', 10) * 1000;
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`MCP API error ${res.status}: ${text}`);
      }

      const data = await res.json();
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
