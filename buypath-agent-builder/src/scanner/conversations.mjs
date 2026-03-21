import { callClaude } from '../utils/claude-api.mjs';
import logger from '../utils/logger.mjs';

const KNOWN_PATTERNS = [
  'Weekly Gamma presentations for clients',
  'Google Ads campaign analysis',
  'Post-meeting follow-up emails',
  'Proposal generation from discovery calls',
  'PPC/SEO audit documents',
  'Mailchimp email automation setup',
  'LinkedIn post drafting',
  'Meeting prep briefs',
  'Branded document generation (docx/PDF)',
  'Data formatting and analysis',
  'Client onboarding packs',
  'Competitor analysis reports',
];

/**
 * Analyse Claude conversation patterns to identify unautomated tasks.
 * @param {object[]} history - Build history array from history.json
 * @returns {{ opportunities: object[], scannedAt: string }}
 */
export async function scanConversations(history = []) {
  logger.info('Analysing conversation patterns for automation opportunities...');

  try {
    const alreadyBuilt = history
      .filter((h) => h.status === 'deployed')
      .map((h) => h.title);

    const prompt = `You are analysing the work patterns of Mike Jessop, who runs BuyPath Ltd — a fractional digital marketing consultancy based in South Cave, East Yorkshire.

Mike regularly performs these 12 types of tasks:
${KNOWN_PATTERNS.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Tasks already automated (do NOT suggest these):
${alreadyBuilt.length > 0 ? alreadyBuilt.map((t) => `- ${t}`).join('\n') : '- None yet'}

For each UNAUTOMATED task, score it on:
- frequency: how often does Mike likely do this? (times per week, e.g. 3)
- timePerOccurrence: minutes saved per occurrence if automated (e.g. 45)
- feasibility: how easy to automate with Node.js + available APIs? (1-10, 10=easiest)

Return a JSON array of the TOP 3 unautomated opportunities, sorted by (frequency × timePerOccurrence × feasibility) descending.

Format:
[
  {
    "title": "Task name",
    "description": "What Mike currently does manually and what automation would do",
    "frequency": 3,
    "timePerOccurrence": 45,
    "feasibility": 8,
    "score": 1080,
    "requiredAPIs": ["gmail", "fireflies"],
    "rationale": "Why this is the highest value"
  }
]

Return ONLY valid JSON.`;

    const raw = await callClaude(
      'You are an automation opportunity analyst for a digital marketing consultancy.',
      prompt
    );

    const opportunities = parseJSON(raw, []);
    logger.success(`Conversations: identified ${opportunities.length} automation opportunity/ies`);

    return {
      opportunities,
      scannedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error(`Conversations scan failed: ${err.message}`);
    return { opportunities: [], scannedAt: new Date().toISOString(), error: err.message };
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

export default scanConversations;
