// ClockMate Pro - Production Logger
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.log('[ClockMate]', ...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info('[ClockMate]', ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn('[ClockMate]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[ClockMate]', ...args);
    // In production, send to error tracking service
  },
};
