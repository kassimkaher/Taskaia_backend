import morgan from 'morgan';

export const httpLogger = morgan('dev');

export const logger = {
  info: (msg: string, ...args: unknown[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: unknown, ...args: unknown[]) => console.error('[ERROR]', msg, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[WARN] ${msg}`, ...args),
};
