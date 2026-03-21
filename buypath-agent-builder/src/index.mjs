/**
 * BuyPath Agent Builder — Main Orchestrator
 * Runs the full autonomous cycle: scan → analyse → build → test → deploy
 *
 * Usage:
 *   node src/index.mjs [--dry-run] [--verbose] [--force-scan=fireflies,windsor]
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import logger, { setVerbose } from './utils/logger.mjs';
import { scanFireflies } from './scanner/fireflies.mjs';
import { scanConversations } from './scanner/conversations.mjs';
import { scanWindsor } from './scanner/windsor.mjs';
import { analyseOpportunity } from './analyser/opportunity.mjs';
import { buildAgent } from './builder/codegen.mjs';
import { validateAgent } from './tester/validate.mjs';
import { deployAgent, recordFailure } from './deployer/deploy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = join(__dirname, 'state/history.json');

// ── CLI flags ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const forceScanArg = args.find((a) => a.startsWith('--force-scan='));
const forceScan = forceScanArg ? forceScanArg.split('=')[1].split(',') : null;

if (isVerbose) setVerbose(true);

// ── Helpers ────────────────────────────────────────────────────────────────

async function loadHistory() {
  try {
    const raw = await readFile(HISTORY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Smart scan decision — decides which sources to scan based on history.
 * Rotates sources to avoid always hitting the same APIs.
 * Always includes conversations (no external API cost).
 */
function decideSources(history) {
  if (forceScan) {
    logger.info(`Force-scan override: ${forceScan.join(', ')}`);
    return forceScan;
  }

  const deployedCount = history.filter((h) => h.status === 'deployed').length;
  const sources = ['conversations'];

  // Scan Fireflies every run (meetings are time-sensitive)
  sources.push('fireflies');

  // Scan Windsor every other run (data doesn't change that fast)
  if (deployedCount % 2 === 0) {
    sources.push('windsor');
  }

  logger.info(`Smart scan decision: ${sources.join(', ')}`);
  return sources;
}

function ukDate() {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Main cycle ─────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  logger.phase(`BuyPath Agent Builder — ${ukDate()}`);

  if (isDryRun) logger.warn('DRY-RUN mode enabled — will not build or deploy');

  // 1. Load history
  logger.phase('STEP 1: Loading history');
  const history = await loadHistory();
  logger.info(`History: ${history.length} previous agent(s) — ${history.filter((h) => h.status === 'deployed').length} deployed`);

  // 2. Decide which sources to scan
  logger.phase('STEP 2: Smart scan decision');
  const sources = decideSources(history);

  // 3. Scan sources in parallel where possible
  logger.phase('STEP 3: Scanning data sources');

  const scanPromises = {
    fireflies: sources.includes('fireflies')
      ? scanFireflies()
      : Promise.resolve({ meetings: [], count: 0, skipped: true }),
    conversations: sources.includes('conversations')
      ? scanConversations(history)
      : Promise.resolve({ opportunities: [], skipped: true }),
    windsor: sources.includes('windsor')
      ? scanWindsor()
      : Promise.resolve({ adData: {}, ga4Data: {}, gscData: {}, anomalies: [], skipped: true }),
  };

  const [meetingData, conversationData, windsorData] = await Promise.all([
    scanPromises.fireflies,
    scanPromises.conversations,
    scanPromises.windsor,
  ]);

  if (isVerbose) {
    logger.info(`Meetings: ${meetingData.count || 0}`);
    logger.info(`Conversation opportunities: ${(conversationData.opportunities || []).length}`);
    logger.info(`Windsor anomalies: ${(windsorData.anomalies || []).length}`);
  }

  // 4. Analyse — pick best opportunity
  logger.phase('STEP 4: Analysing opportunities');
  let opportunity;
  try {
    opportunity = await analyseOpportunity(meetingData, conversationData, windsorData, history);
  } catch (err) {
    logger.error(`Analysis failed: ${err.message}`);
    process.exit(1);
  }

  logger.success(`Selected: "${opportunity.title}"`);
  logger.info(`  Trigger: ${opportunity.trigger}`);
  logger.info(`  Time saved: ${opportunity.timeSaved} min × ${opportunity.frequency}x/week`);
  logger.info(`  MCP servers: ${(opportunity.mcpServers || []).join(', ') || 'none'}`);

  if (isDryRun) {
    logger.phase('DRY-RUN COMPLETE');
    logger.info('Scan and analysis complete. Skipping build/test/deploy (--dry-run).');
    printSummary({ startTime, isDryRun: true, opportunity });
    return;
  }

  // 5. Build
  logger.phase('STEP 5: Building agent script');
  let script;
  try {
    script = await buildAgent(opportunity);
  } catch (err) {
    logger.error(`Build failed: ${err.message}`);
    process.exit(1);
  }

  if (isVerbose) logger.info(`Script length: ${script.split('\n').length} lines`);

  // 6. Test
  logger.phase('STEP 6: Validating script');
  let testResult;
  try {
    testResult = await validateAgent(script, opportunity);
    // validateAgent may return a fixed script
    if (testResult.script) script = testResult.script;
  } catch (err) {
    logger.error(`Validation failed: ${err.message}`);
    process.exit(1);
  }

  logger.info(`Validation score: ${testResult.score}/100`);
  if (isVerbose) {
    for (const check of testResult.checks) {
      const icon = check.pass ? '✓' : '✗';
      logger.info(`  ${icon} ${check.name}: ${check.score}/100 — ${check.note}`);
    }
  }

  // 7. Deploy or record failure
  logger.phase('STEP 7: Deploy');
  let deployResult;

  if (testResult.passed) {
    try {
      deployResult = await deployAgent(script, opportunity, testResult);
      logger.success(`Deployed: agents/${deployResult.filename}`);
    } catch (err) {
      logger.error(`Deployment write failed: ${err.message}`);
      process.exit(1);
    }
  } else {
    logger.warn(`Script failed validation (${testResult.score}/100). Recording as failed.`);
    await recordFailure(opportunity, testResult);
    deployResult = { deployed: false, reason: testResult.verdict };
  }

  printSummary({ startTime, isDryRun: false, opportunity, testResult, deployResult });
}

function printSummary({ startTime, isDryRun, opportunity, testResult, deployResult }) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.phase('SUMMARY');
  logger.info(`Run date: ${ukDate()}`);
  logger.info(`Elapsed: ${elapsed}s`);
  logger.info(`Opportunity: "${opportunity?.title || 'N/A'}"`);

  if (isDryRun) {
    logger.info('Mode: DRY-RUN (no build/deploy)');
    return;
  }

  if (testResult) {
    logger.info(`Validation: ${testResult.score}/100 — ${testResult.verdict}`);
  }

  if (deployResult?.deployed) {
    logger.success(`Status: DEPLOYED → agents/${deployResult.filename}`);
    logger.info(`Time saved: ~${opportunity.timeSaved} min × ${opportunity.frequency}x/week = ${Math.round(opportunity.timeSaved * opportunity.frequency / 60)} hr/week`);
  } else {
    logger.warn(`Status: NOT DEPLOYED — ${deployResult?.reason || 'unknown reason'}`);
  }
}

main().catch((err) => {
  logger.error(`Fatal error: ${err.message}`);
  if (isVerbose) console.error(err);
  process.exit(1);
});
