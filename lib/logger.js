import fs from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const logPath = resolve('./temp/hatsune.log');
mkdirSync(dirname(logPath), { recursive: true });

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const color = {
  error: '\u001b[31m',
  warn: '\u001b[33m',
  info: '\u001b[36m',
  debug: '\u001b[35m',
  reset: '\u001b[0m',
};

const logToFile = (level, message, context, details) => {
  try {
    const line = JSON.stringify({
      level,
      message,
      context: context ?? 'system',
      details: details ?? null,
      timestamp: new Date().toISOString(),
    });
    fs.appendFileSync(logPath, `${line}\n`);
  } catch {
    // Intentionally silent to avoid loops.
  }
};

const logger = {
  log(level, message, context, details) {
    const currentLevel = levels[process.env.LOG_LEVEL || 'info'] ?? levels.info;
    if ((levels[level] ?? levels.info) > currentLevel) return;
    const text = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${context ?? 'system'}: ${message}`;
    const prefix = color[level] ?? color.info;
    console.log(`${prefix}${text}${color.reset}`);
    logToFile(level, message, context, details);
  },
  error(message, context, details) {
    this.log('error', message, context, details);
  },
  warn(message, context, details) {
    this.log('warn', message, context, details);
  },
  info(message, context, details) {
    this.log('info', message, context, details);
  },
  debug(message, context, details) {
    this.log('debug', message, context, details);
  },
};

export default logger;
