import pino from 'pino';

/**
 * Logger estruturado para Revolution X
 * pino: JSON em produção, pretty em dev.
 *
 * Interfaces compatíveis:
 *   info(message, context?)           — healthMonitor
 *   error(message, context?)          — healthMonitor
 *   error(message, err, context?)     — auth.ts (Error como 2º argumento)
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  base: undefined, // remove pid/hostname
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:mm:ss', ignore: 'pid,hostname' },
      }
    : undefined,
});

// Overload para suportar ambas as formas:
//   info(message, context?)       ou   info(message, err, context?)
export function info(this: void, message: string, context?: Record<string, unknown>): void;
export function info(this: void, message: string, err: Error | unknown, context?: Record<string, unknown>): void;
export function info(this: void, message: string, arg2?: Record<string, unknown> | Error | unknown, arg3?: Record<string, unknown>) {
  if (arg2 === undefined) {
    logger.info(message);
  } else if (arg2 instanceof Error || typeof arg2 === 'object' && arg2 !== null) {
    const err = arg2 instanceof Error ? arg2 : undefined;
    const context = arg3 ?? {};
    if (err) {
      logger.info({ err: { message: err.message, name: err.name }, ...context }, message);
    } else {
      logger.info(context, message);
    }
  } else {
    logger.info(arg2 as Record<string, unknown>, message);
  }
}

export function warn(this: void, message: string, context?: Record<string, unknown>): void {
  logger.warn(message);
}

export function debug(this: void, message: string, context?: Record<string, unknown>): void {
  logger.debug(context ?? {}, message);
}

export function error(this: void, message: string, context?: Record<string, unknown>): void;
export function error(this: void, message: string, err: Error | unknown, context?: Record<string, unknown>): void;
export function error(this: void, message: string, arg2?: Record<string, unknown> | Error | unknown, arg3?: Record<string, unknown>) {
  if (arg2 === undefined) {
    logger.error(message);
  } else if (arg2 instanceof Error || (typeof arg2 === 'object' && arg2 !== null && !('error' in arg2))) {
    const err = arg2 instanceof Error ? arg2 : undefined;
    const context = arg3 ?? {};
    if (err) {
      logger.error({ err: { message: err.message, name: err.name }, ...context }, message);
    } else {
      logger.error(context, message);
    }
  } else {
    // arg2 é um objeto com contexto (geralmente com 'error' dentro)
    logger.error(arg2 as Record<string, unknown>, message);
  }
}

export default logger;