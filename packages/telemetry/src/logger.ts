import pino, { type Logger as PinoLogger } from 'pino';

export type Logger = PinoLogger;

export interface LoggerOptions {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  pretty?: boolean;
  name?: string;
}

const REDACT_PATHS = [
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.api_key',
  '*.card',
  '*.card.*',
  '*.payment_method.*',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
];

export function createLogger(opts: LoggerOptions = {}): Logger {
  const level = opts.level ?? (process.env.LOG_LEVEL as LoggerOptions['level']) ?? 'info';
  const pretty = opts.pretty ?? process.env.NODE_ENV !== 'production';

  return pino({
    name: opts.name ?? 'claudeshop',
    level,
    redact: { paths: REDACT_PATHS, remove: true },
    base: {
      service: opts.name ?? 'claudeshop',
      env: process.env.NODE_ENV ?? 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname,service,env',
              messageFormat: '{msg}',
            },
          },
        }
      : {}),
  });
}
