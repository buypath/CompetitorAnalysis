import { callMCP } from '../utils/mcp-client.mjs';
import logger from '../utils/logger.mjs';

const MCP_URL = 'https://mcp.windsor.ai';
const MCP_NAME = 'windsor';

const AD_ACCOUNTS = [
  { client: 'Eden Mobility', id: '497-056-5925', platform: 'Google Ads' },
  { client: 'Zyber', id: '190-741-5899', platform: 'Google Ads' },
  { client: 'Alan Wood & Partners', id: '335-191-2447', platform: 'Google Ads' },
];

const GA4_PROPERTIES = [
  { client: 'Eden Mobility', id: '358880167' },
  { client: 'Zyber', id: '426037815' },
  { client: 'Alan Wood & Partners', id: '352908124' },
  { client: 'Master Replicas', id: '511170816' },
  { client: 'Eltherington Group', id: '280072576' },
];

const GSC_SITES = [
  { client: 'Alan Wood & Partners', url: 'https://www.alanwood.co.uk/' },
  { client: 'Eden Mobility', url: 'https://eden-mobility.co.uk/' },
  { client: 'Zyber', url: 'https://www.zyberltd.co.uk/' },
];

/**
 * Pull Windsor.ai performance data and identify anomalies.
 * @returns {{ adData: object, ga4Data: object, gscData: object, anomalies: string[], scannedAt: string }}
 */
export async function scanWindsor() {
  logger.info('Pulling Windsor.ai performance data (last 7 days)...');

  try {
    const prompt = `Using Windsor.ai, please retrieve 7-day performance data for BuyPath Ltd's clients.

GOOGLE ADS ACCOUNTS (last 7 days):
${AD_ACCOUNTS.map((a) => `- ${a.client}: Account ID ${a.id}`).join('\n')}

GA4 PROPERTIES (last 7 days):
${GA4_PROPERTIES.map((p) => `- ${p.client}: Property ID ${p.id}`).join('\n')}

SEARCH CONSOLE SITES (last 7 days):
${GSC_SITES.map((s) => `- ${s.client}: ${s.url}`).join('\n')}

For each data source, return:
1. Key metrics (impressions, clicks, spend, conversions, CTR where applicable)
2. Week-over-week change (if available)
3. Any anomalies you identify (e.g. sudden spend changes >20%, conversion drops >30%, tracking issues)

Return a structured JSON object:
{
  "adData": { "accounts": [...], "summary": "..." },
  "ga4Data": { "properties": [...], "summary": "..." },
  "gscData": { "sites": [...], "summary": "..." },
  "anomalies": ["Anomaly 1 description", "Anomaly 2 description"]
}

Return ONLY valid JSON.`;

    const raw = await callMCP(prompt, MCP_URL, MCP_NAME);
    const data = parseJSON(raw, {
      adData: { accounts: [], summary: 'No data retrieved' },
      ga4Data: { properties: [], summary: 'No data retrieved' },
      gscData: { sites: [], summary: 'No data retrieved' },
      anomalies: [],
    });

    const anomalyCount = (data.anomalies || []).length;
    logger.success(`Windsor: data retrieved, ${anomalyCount} anomaly/ies identified`);

    return { ...data, scannedAt: new Date().toISOString() };
  } catch (err) {
    logger.error(`Windsor scan failed: ${err.message}`);
    return {
      adData: { accounts: [], summary: 'Scan failed' },
      ga4Data: { properties: [], summary: 'Scan failed' },
      gscData: { sites: [], summary: 'Scan failed' },
      anomalies: [],
      scannedAt: new Date().toISOString(),
      error: err.message,
    };
  }
}

function parseJSON(raw, fallback) {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export default scanWindsor;
