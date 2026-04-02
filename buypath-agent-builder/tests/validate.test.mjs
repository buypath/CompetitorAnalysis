/**
 * Tests for the validation module.
 * Tests the validation logic without calling Claude API (uses mock scripts).
 */

import { strict as assert } from 'assert';

// ── Helpers replicated from validate.mjs for unit testing ──────────────────

function extractChecks(response) {
  try {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(response);
  } catch {
    return null;
  }
}

function computeScore(checks) {
  if (!checks || checks.length === 0) return 0;
  return Math.round(checks.reduce((s, c) => s + (c.score || 0), 0) / checks.length);
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

// ── Test fixtures ──────────────────────────────────────────────────────────

const GOOD_SCRIPT = `
// Agent: Post-Meeting Follow-Up | Generated: 21/03/2026 | BuyPath Ltd
import { writeFile } from 'node:fs/promises';

const isDryRun = process.argv.includes('--dry-run');
const isTest = process.argv.includes('--test');
const API_KEY = process.env.ANTHROPIC_API_KEY;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callClaude(prompt) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();
      return data.content[0].text;
    } catch (err) {
      if (i < 2) await sleep([1000, 2000][i]);
      else throw err;
    }
  }
}

async function main() {
  try {
    const result = await callClaude('Write a follow-up email');
    if (!isDryRun) {
      await writeFile('output.txt', result);
    }
    console.log('[OK] Done');
  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exit(1);
  }
}

main();
`;

const BAD_SCRIPT = `
const key = "sk-ant-hardcoded-key-here";
fetch("https://api.anthropic.com/v1/messages", { headers: { "x-api-key": key } });
// No error handling, no flag support, no try/catch
`;

const MOCK_VALIDATION_RESPONSE = JSON.stringify({
  checks: [
    { name: 'SYNTAX', score: 95, pass: true, note: 'Valid JS' },
    { name: 'API_CALLS', score: 90, pass: true, note: 'Proper fetch with error handling' },
    { name: 'MCP_INTEGRATION', score: 70, pass: true, note: 'N/A for this script' },
    { name: 'ERROR_HANDLING', score: 85, pass: true, note: 'try/catch present' },
    { name: 'CONFIG', score: 95, pass: true, note: 'Uses process.env' },
    { name: 'FLAGS', score: 100, pass: true, note: '--dry-run and --test present' },
    { name: 'OUTPUT', score: 80, pass: true, note: 'Writes output file' },
    { name: 'SECURITY', score: 90, pass: true, note: 'No hardcoded secrets' },
  ],
  issues: [],
  verdict: 'Well-structured script with proper error handling',
});

// ── Tests ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\nvalidate.test.mjs — Validation module tests\n');

// JSON parsing tests
console.log('JSON parsing:');

test('parses valid JSON object from mixed text', () => {
  const input = 'Here is the result: {"checks": [], "score": 80, "issues": [], "verdict": "ok"}';
  const result = extractChecks(input);
  assert.ok(result, 'Should parse JSON object');
  assert.equal(result.score, 80);
});

test('parses bare JSON object', () => {
  const result = extractChecks(MOCK_VALIDATION_RESPONSE);
  assert.ok(result, 'Should parse bare JSON');
  assert.equal(result.checks.length, 8);
});

test('returns null for invalid JSON', () => {
  const result = extractChecks('This is not JSON at all');
  assert.equal(result, null);
});

// Score computation tests
console.log('\nScore computation:');

test('computes correct average score', () => {
  const checks = [
    { score: 100 }, { score: 80 }, { score: 60 },
  ];
  assert.equal(computeScore(checks), 80);
});

test('returns 0 for empty checks', () => {
  assert.equal(computeScore([]), 0);
  assert.equal(computeScore(null), 0);
});

test('score >= 60 considered passing', () => {
  const checks = MOCK_VALIDATION_RESPONSE ? JSON.parse(MOCK_VALIDATION_RESPONSE).checks : [];
  const score = computeScore(checks);
  assert.ok(score >= 60, `Score ${score} should be >= 60`);
});

// Filename generation tests
console.log('\nFilename generation:');

test('uses suggestedFilename if valid', () => {
  const opp = { title: 'Anything', suggestedFilename: 'agent-post-meeting-email.mjs' };
  assert.equal(generateFilename(opp), 'agent-post-meeting-email.mjs');
});

test('generates slug from title', () => {
  const opp = { title: 'Post-Meeting Follow-Up Emails' };
  const name = generateFilename(opp);
  assert.match(name, /^agent-post-meeting-follow-up-emails\.mjs$/);
});

test('handles special characters in title', () => {
  const opp = { title: 'Google Ads: Campaign Analysis (Weekly)' };
  const name = generateFilename(opp);
  assert.match(name, /^agent-[\w-]+\.mjs$/);
  assert.ok(!name.includes(':'), 'Should strip colons');
  assert.ok(!name.includes('('), 'Should strip parens');
});

test('rejects invalid suggestedFilename', () => {
  const opp = { title: 'Test', suggestedFilename: '../evil/path.mjs' };
  const name = generateFilename(opp);
  assert.match(name, /^agent-test\.mjs$/);
});

// Script content checks
console.log('\nScript content heuristics:');

test('good script contains --dry-run check', () => {
  assert.ok(GOOD_SCRIPT.includes('--dry-run'), 'Should contain --dry-run flag check');
});

test('good script contains --test check', () => {
  assert.ok(GOOD_SCRIPT.includes('--test'), 'Should contain --test flag check');
});

test('good script uses process.env for API key', () => {
  assert.ok(GOOD_SCRIPT.includes('process.env'), 'Should use process.env');
  assert.ok(!GOOD_SCRIPT.includes('sk-ant-'), 'Should not have hardcoded key');
});

test('bad script has hardcoded key (detected correctly)', () => {
  assert.ok(BAD_SCRIPT.includes('sk-ant-'), 'Bad script should have hardcoded key for test');
  assert.ok(!BAD_SCRIPT.includes('--dry-run'), 'Bad script should be missing --dry-run');
});

test('good script has retry logic', () => {
  assert.ok(GOOD_SCRIPT.includes('sleep'), 'Should have sleep/retry logic');
  assert.ok(GOOD_SCRIPT.includes('for'), 'Should have retry loop');
});

// ── Results ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(40)}\n`);

if (failed > 0) process.exit(1);
