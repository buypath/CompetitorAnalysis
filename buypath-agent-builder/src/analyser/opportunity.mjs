import { callClaude } from '../utils/claude-api.mjs';
import logger from '../utils/logger.mjs';

/**
 * Analyse all scanner outputs and select the single best automation opportunity.
 * @param {object} meetingData - Output from scanFireflies()
 * @param {object} conversationData - Output from scanConversations()
 * @param {object} windsorData - Output from scanWindsor()
 * @param {object[]} history - Build history array
 * @returns {object} Selected opportunity spec
 */
export async function analyseOpportunity(meetingData, conversationData, windsorData, history = []) {
  logger.info('Analysing all data to identify highest-value automation opportunity...');

  try {
    const alreadyBuilt = history
      .filter((h) => h.status === 'deployed')
      .map((h) => h.title);

    const prompt = `You are selecting the single best automation opportunity for Mike Jessop at BuyPath Ltd.

## MEETING DATA (last 7 days)
Meetings scanned: ${meetingData.count || 0}
${JSON.stringify(meetingData.meetings || [], null, 2)}

## CONVERSATION PATTERN ANALYSIS
Top unautomated opportunities identified:
${JSON.stringify(conversationData.opportunities || [], null, 2)}

## WINDSOR.AI PERFORMANCE DATA
Ad accounts summary: ${windsorData.adData?.summary || 'N/A'}
GA4 summary: ${windsorData.ga4Data?.summary || 'N/A'}
Search Console summary: ${windsorData.gscData?.summary || 'N/A'}
Anomalies: ${JSON.stringify(windsorData.anomalies || [], null, 2)}

## ALREADY AUTOMATED (do NOT select these)
${alreadyBuilt.length > 0 ? alreadyBuilt.map((t) => `- ${t}`).join('\n') : '- None yet'}

## YOUR TASK
Select ONE automation opportunity that:
1. Has NOT already been built (check above list)
2. Can be fully implemented as a single standalone Node.js script
3. Has clear input → process → output flow
4. Saves measurable time (ideally 1+ hours per occurrence)
5. Can be tested with real data from available MCP APIs
6. Uses available tools: Fireflies MCP, Windsor.ai MCP, Gmail MCP, Google Calendar MCP, Gamma MCP, Claude API

Consider:
- Meeting action items that are always the same type of task
- Recurring data pulls that could be automated
- Report generation that follows a template
- Email follow-ups with predictable structure
- Performance anomalies that trigger a standard response

Return a single JSON object (no markdown, no explanation outside JSON):
{
  "title": "Descriptive title of the automation",
  "description": "What this script will do — from trigger to output",
  "trigger": "What event/schedule triggers this (e.g. After every client meeting, Every Friday 8am)",
  "inputs": ["List of data inputs the script needs"],
  "outputs": ["List of outputs the script produces"],
  "timeSaved": 90,
  "frequency": 3,
  "mcpServers": ["fireflies", "gmail"],
  "testPlan": "How to test this script with --test flag",
  "rationale": "Why this is the best opportunity right now",
  "suggestedFilename": "agent-[kebab-case-name].mjs"
}`;

    const raw = await callClaude(
      'You are an expert automation analyst for a digital marketing consultancy. Select the single highest-value automation opportunity.',
      prompt,
      { maxTokens: 2048 }
    );

    const opportunity = parseJSON(raw);
    if (!opportunity?.title) throw new Error('Analyser returned invalid opportunity object');

    logger.success(`Selected opportunity: "${opportunity.title}" (${opportunity.timeSaved} min/occurrence, ${opportunity.frequency}x/week)`);
    return opportunity;
  } catch (err) {
    logger.error(`Opportunity analysis failed: ${err.message}`);
    throw err;
  }
}

function parseJSON(raw) {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default analyseOpportunity;
