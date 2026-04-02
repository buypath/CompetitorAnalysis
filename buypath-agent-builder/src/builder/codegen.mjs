import { callClaude } from '../utils/claude-api.mjs';
import logger from '../utils/logger.mjs';

const MCP_SERVERS = {
  fireflies: 'https://api.fireflies.ai/mcp',
  windsor: 'https://mcp.windsor.ai',
  gamma: 'https://mcp.gamma.app/mcp',
  gmail: 'https://gmail.mcp.claude.com/mcp',
  gcal: 'https://gcal.mcp.claude.com/mcp',
};

const CLIENT_CONTEXT = `
BuyPath client accounts:
- Eden Mobility: Google Ads 497-056-5925, GA4 358880167, GSC https://eden-mobility.co.uk/
- Zyber: Google Ads 190-741-5899, GA4 426037815, GSC https://www.zyberltd.co.uk/, Shopify zyberltd.myshopify.com
- Alan Wood & Partners: Google Ads 335-191-2447, GA4 352908124, GSC https://www.alanwood.co.uk/
- Master Replicas: GA4 511170816
- Eltherington Group: GA4 280072576
- BuyPath Gamma theme ID: lidxusmu8c3gp8i
- Contact: mike@buypath.co.uk
`;

/**
 * Generate a complete Node.js automation script for the given opportunity.
 * @param {object} opportunity - The opportunity spec from analyseOpportunity()
 * @returns {string} Complete Node.js script as a string
 */
export async function buildAgent(opportunity) {
  logger.info(`Building agent script for: "${opportunity.title}"...`);

  const mcpUrls = (opportunity.mcpServers || [])
    .map((name) => `- ${name}: ${MCP_SERVERS[name] || 'unknown'}`)
    .join('\n');

  const prompt = `Generate a complete, production-ready Node.js automation script for BuyPath Ltd.

## OPPORTUNITY SPEC
Title: ${opportunity.title}
Description: ${opportunity.description}
Trigger: ${opportunity.trigger}
Inputs: ${JSON.stringify(opportunity.inputs)}
Outputs: ${JSON.stringify(opportunity.outputs)}
Time saved per run: ${opportunity.timeSaved} minutes
MCP servers needed: ${JSON.stringify(opportunity.mcpServers)}
Test plan: ${opportunity.testPlan}

## MCP SERVER URLS
${mcpUrls || 'None required — use Claude API directly'}

## CLIENT CONTEXT
${CLIENT_CONTEXT}

## MANDATORY REQUIREMENTS
The script MUST:
1. Use ES modules (import/export syntax, .mjs compatible)
2. Call the Anthropic API at https://api.anthropic.com/v1/messages using fetch() — no SDK
3. Use model: claude-sonnet-4-20250514
4. Use mcp_servers parameter when calling MCP tools (not separate fetch calls to MCP)
5. Include --dry-run flag: performs all reads/analysis but skips writes/sends
6. Include --test flag: runs with minimal real data to verify the script works
7. Have try/catch on EVERY async operation
8. Implement retry logic (3 attempts, 1s/2s/4s backoff) for all API calls
9. Load secrets from process.env (ANTHROPIC_API_KEY etc) — never hardcode
10. Log to console with timestamps in DD/MM/YYYY format
11. Output a clear summary at the end (what was done, what was saved/sent/created)
12. Be completely standalone — no imports from the parent buypath-agent-builder project
13. Include a top comment block: // Agent: [title] | Generated: ${new Date().toLocaleDateString('en-GB')} | BuyPath Ltd

## SCRIPT STRUCTURE
\`\`\`
// Agent: [title] | Generated: DD/MM/YYYY | BuyPath Ltd
// [Brief description]
// Usage: node [filename].mjs [--dry-run] [--test]

import { ... } from 'node:...'  // only Node built-ins

const isDryRun = process.argv.includes('--dry-run');
const isTest = process.argv.includes('--test');

// Config — all from env
const API_KEY = process.env.ANTHROPIC_API_KEY;
// ... other config

// Helper: sleep
// Helper: callClaude (with retry, using mcp_servers if needed)
// Helper: any domain-specific helpers

// Main function
async function main() {
  // 1. Fetch/collect inputs
  // 2. Process/analyse
  // 3. Generate outputs
  // 4. If !isDryRun: write/send outputs
  // 5. Print summary
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
\`\`\`

Return ONLY the complete JavaScript code. No explanation, no markdown code fences, just the raw .mjs file content.`;

  try {
    const script = await callClaude(
      'You are an expert Node.js developer building automation scripts for a digital marketing consultancy. Write complete, production-ready code.',
      prompt,
      { maxTokens: 8192 }
    );

    // Strip any accidental markdown fences
    const cleaned = script
      .replace(/^```(?:javascript|js|mjs)?\n/m, '')
      .replace(/\n```\s*$/m, '')
      .trim();

    logger.success(`Agent script generated: ${cleaned.split('\n').length} lines`);
    return cleaned;
  } catch (err) {
    logger.error(`Code generation failed: ${err.message}`);
    throw err;
  }
}

export default buildAgent;
