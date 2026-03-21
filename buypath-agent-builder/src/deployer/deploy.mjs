import { writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = join(__dirname, '../../agents');
const HISTORY_PATH = join(__dirname, '../state/history.json');

/**
 * Save a validated agent script and update history.
 * @param {string} script - The validated script source code
 * @param {object} opportunity - The opportunity spec
 * @param {object} testResult - The validation result
 * @returns {object} Deployment summary
 */
export async function deployAgent(script, opportunity, testResult) {
  if (!testResult.passed) {
    logger.warn('Deploy skipped — script did not pass validation');
    return { deployed: false, reason: `Score ${testResult.score}/100 is below threshold of 60` };
  }

  try {
    const filename = generateFilename(opportunity);
    const filepath = join(AGENTS_DIR, filename);

    await writeFile(filepath, script, 'utf8');
    logger.success(`Agent saved to agents/${filename}`);

    const entry = {
      title: opportunity.title,
      description: opportunity.description,
      trigger: opportunity.trigger,
      timeSaved: opportunity.timeSaved,
      frequency: opportunity.frequency,
      filename,
      lineCount: script.split('\n').length,
      status: 'deployed',
      score: testResult.score,
      autoFixed: testResult.autoFixed || false,
      date: new Date().toLocaleDateString('en-GB'),
      dateISO: new Date().toISOString(),
    };

    await updateHistory(entry);
    logger.success(`History updated with entry: "${opportunity.title}"`);

    return {
      deployed: true,
      filename,
      filepath,
      entry,
    };
  } catch (err) {
    logger.error(`Deployment failed: ${err.message}`);
    throw err;
  }
}

/**
 * Record a failed build in history so it won't be retried.
 * @param {object} opportunity
 * @param {object} testResult
 */
export async function recordFailure(opportunity, testResult) {
  try {
    const entry = {
      title: opportunity.title,
      description: opportunity.description,
      trigger: opportunity.trigger,
      timeSaved: opportunity.timeSaved,
      frequency: opportunity.frequency,
      filename: null,
      lineCount: 0,
      status: 'failed',
      score: testResult.score,
      issues: testResult.issues,
      date: new Date().toLocaleDateString('en-GB'),
      dateISO: new Date().toISOString(),
    };
    await updateHistory(entry);
    logger.warn(`Failure recorded in history for: "${opportunity.title}"`);
  } catch (err) {
    logger.error(`Failed to record failure in history: ${err.message}`);
  }
}

function generateFilename(opportunity) {
  const suggested = opportunity.suggestedFilename;
  if (suggested && /^agent-[\w-]+\.mjs$/.test(suggested)) return suggested;

  const slug = (opportunity.title || 'unnamed')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);

  return `agent-${slug}.mjs`;
}

async function updateHistory(entry) {
  let history = [];
  try {
    const raw = await readFile(HISTORY_PATH, 'utf8');
    history = JSON.parse(raw);
  } catch {
    // File doesn't exist yet — start fresh
  }

  // Replace existing entry with same title if present
  const idx = history.findIndex((h) => h.title === entry.title);
  if (idx >= 0) {
    history[idx] = entry;
  } else {
    history.push(entry);
  }

  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf8');
}

export default deployAgent;
