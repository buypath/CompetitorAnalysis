import { callClaude } from '../utils/claude-api.mjs';
import logger from '../utils/logger.mjs';

const PASS_THRESHOLD = 60;

/**
 * Validate a generated agent script against 8 quality checks.
 * Attempts one auto-fix cycle if score < 60.
 * @param {string} script - The generated script source code
 * @param {object} opportunity - The opportunity spec
 * @returns {{ passed: boolean, score: number, checks: object[], issues: string[], verdict: string, script: string }}
 */
export async function validateAgent(script, opportunity) {
  logger.info('Running validation checks on generated script...');

  const result = await runValidation(script, opportunity);

  if (!result.passed) {
    logger.warn(`Initial score: ${result.score}/100. Attempting auto-fix...`);
    const fixedScript = await attemptFix(script, result.issues, opportunity);
    if (fixedScript && fixedScript !== script) {
      logger.info('Re-validating fixed script...');
      const fixedResult = await runValidation(fixedScript, opportunity);
      fixedResult.script = fixedScript;
      fixedResult.autoFixed = true;
      if (fixedResult.passed) {
        logger.success(`Auto-fix succeeded! Score: ${fixedResult.score}/100`);
      } else {
        logger.warn(`Auto-fix insufficient. Final score: ${fixedResult.score}/100`);
      }
      return fixedResult;
    }
    logger.warn('Auto-fix produced no changes.');
  } else {
    logger.success(`Validation passed! Score: ${result.score}/100`);
  }

  result.script = script;
  return result;
}

async function runValidation(script, opportunity) {
  const prompt = `You are a code quality auditor. Validate this Node.js automation script against 8 checks.

## SCRIPT TO VALIDATE
\`\`\`javascript
${script}
\`\`\`

## OPPORTUNITY SPEC
Title: ${opportunity.title}
Expected inputs: ${JSON.stringify(opportunity.inputs)}
Expected outputs: ${JSON.stringify(opportunity.outputs)}
Test plan: ${opportunity.testPlan}

## 8 VALIDATION CHECKS (score each 0-100, then average for total score)

1. **SYNTAX** — Is the JavaScript syntactically valid? No obvious parse errors?
2. **API_CALLS** — Are fetch() calls properly structured with error handling and status checks?
3. **MCP_INTEGRATION** — Are MCP server URLs correct? Is mcp_servers parameter used properly in Claude API calls?
4. **ERROR_HANDLING** — Does every async operation have try/catch? Are errors handled gracefully?
5. **CONFIG** — Are ALL sensitive values (API keys, account IDs as variables) loaded from process.env?
6. **FLAGS** — Does the script support both --dry-run and --test flags and respect them?
7. **OUTPUT** — Does the script produce the specified outputs from the opportunity spec?
8. **SECURITY** — No hardcoded credentials, no command injection risks, no exposed secrets?

Return ONLY valid JSON:
{
  "checks": [
    { "name": "SYNTAX", "score": 90, "pass": true, "note": "..." },
    { "name": "API_CALLS", "score": 80, "pass": true, "note": "..." },
    { "name": "MCP_INTEGRATION", "score": 70, "pass": true, "note": "..." },
    { "name": "ERROR_HANDLING", "score": 85, "pass": true, "note": "..." },
    { "name": "CONFIG", "score": 95, "pass": true, "note": "..." },
    { "name": "FLAGS", "score": 100, "pass": true, "note": "..." },
    { "name": "OUTPUT", "score": 75, "pass": true, "note": "..." },
    { "name": "SECURITY", "score": 90, "pass": true, "note": "..." }
  ],
  "score": 85,
  "issues": ["List of specific issues found that need fixing"],
  "verdict": "One sentence summary of overall quality"
}`;

  try {
    const raw = await callClaude(
      'You are a strict code quality auditor. Be thorough and honest in your assessment.',
      prompt,
      { maxTokens: 2048 }
    );

    const parsed = parseJSON(raw);
    if (!parsed?.checks) throw new Error('Invalid validation response structure');

    const score = Math.round(
      parsed.checks.reduce((sum, c) => sum + (c.score || 0), 0) / parsed.checks.length
    );

    return {
      passed: score >= PASS_THRESHOLD,
      score,
      checks: parsed.checks,
      issues: parsed.issues || [],
      verdict: parsed.verdict || '',
    };
  } catch (err) {
    logger.error(`Validation check failed: ${err.message}`);
    return {
      passed: false,
      score: 0,
      checks: [],
      issues: [`Validation system error: ${err.message}`],
      verdict: 'Validation could not be completed',
    };
  }
}

async function attemptFix(script, issues, opportunity) {
  if (!issues || issues.length === 0) return script;

  const prompt = `Fix the following issues in this Node.js script.

## ISSUES TO FIX
${issues.map((i, n) => `${n + 1}. ${i}`).join('\n')}

## ORIGINAL SCRIPT
\`\`\`javascript
${script}
\`\`\`

## REQUIREMENTS (must still be satisfied after fix)
- ES modules (import/export)
- --dry-run and --test flags supported
- All secrets from process.env
- try/catch on all async operations
- retry logic (3 attempts, exponential backoff)
- Completely standalone (no imports from parent project)

Return ONLY the fixed JavaScript code. No markdown, no explanation.`;

  try {
    const fixed = await callClaude(
      'You are an expert Node.js developer fixing code quality issues.',
      prompt,
      { maxTokens: 8192 }
    );

    return fixed
      .replace(/^```(?:javascript|js|mjs)?\n/m, '')
      .replace(/\n```\s*$/m, '')
      .trim();
  } catch (err) {
    logger.error(`Auto-fix failed: ${err.message}`);
    return script;
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

export default validateAgent;
