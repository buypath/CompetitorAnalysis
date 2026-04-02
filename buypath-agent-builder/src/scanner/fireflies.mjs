import { callMCP } from '../utils/mcp-client.mjs';
import logger from '../utils/logger.mjs';

const MCP_URL = 'https://api.fireflies.ai/mcp';
const MCP_NAME = 'fireflies';

/**
 * Scan Fireflies meeting transcripts from the last 7 days.
 * @returns {{ meetings: object[], count: number, scannedAt: string }}
 */
export async function scanFireflies() {
  logger.info('Scanning Fireflies meeting transcripts (last 7 days)...');

  try {
    const raw = await callMCP(
      `Please retrieve all meetings from the last 7 days using the Fireflies API.
For each meeting, extract and return a JSON array with objects containing:
- title: meeting title
- date: meeting date (DD/MM/YYYY)
- duration: duration in minutes
- summary: brief summary of what was discussed
- actionItems: array of action items identified
- keywords: array of key topics/themes

Return ONLY valid JSON array. If no meetings found, return [].`,
      MCP_URL,
      MCP_NAME
    );

    const meetings = parseJSON(raw, []);
    logger.success(`Fireflies: found ${meetings.length} meeting(s) in the last 7 days`);

    return {
      meetings,
      count: meetings.length,
      scannedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error(`Fireflies scan failed: ${err.message}`);
    return { meetings: [], count: 0, scannedAt: new Date().toISOString(), error: err.message };
  }
}

function parseJSON(raw, fallback) {
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export default scanFireflies;
