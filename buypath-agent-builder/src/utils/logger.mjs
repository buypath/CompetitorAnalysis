import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, '../../logs');

const LEVELS = { info: 'INFO', success: 'SUCCESS', warn: 'WARN', error: 'ERROR', phase: 'PHASE' };

const COLOURS = {
  info: '\x1b[37m',
  success: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  phase: '\x1b[36m',
  reset: '\x1b[0m',
};

function ukDate(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

function runTimestamp() {
  const d = new Date();
  return d.toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '');
}

let _stream = null;
let _verbose = false;

async function ensureStream() {
  if (_stream) return;
  await mkdir(LOGS_DIR, { recursive: true });
  const filename = `run-${runTimestamp()}.log`;
  _stream = createWriteStream(join(LOGS_DIR, filename), { flags: 'a' });
}

export function setVerbose(v) {
  _verbose = v;
}

function write(level, msg) {
  const ts = ukDate();
  const label = LEVELS[level] || 'INFO';
  const plain = `[${ts}] [${label}] ${msg}`;
  const coloured = `${COLOURS[level] || ''}[${ts}] [${label}] ${msg}${COLOURS.reset}`;

  if (level !== 'info' || _verbose) {
    console.log(coloured);
  } else {
    console.log(coloured);
  }

  ensureStream().then(() => {
    _stream?.write(plain + '\n');
  });
}

export const logger = {
  info: (msg) => write('info', msg),
  success: (msg) => write('success', msg),
  warn: (msg) => write('warn', msg),
  error: (msg) => write('error', msg),
  phase: (msg) => write('phase', `\n=== ${msg} ===`),
};

export default logger;
