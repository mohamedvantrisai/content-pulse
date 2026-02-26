import pino from 'pino';
import type { Logger, LogFn } from 'pino';
import { env } from '../config/env.js';
import { getCorrelationId } from './async-context.js';

type LogMethod = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LOG_METHODS: LogMethod[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

function createBaseLogger(): Logger {
    const isDev = env.NODE_ENV === 'development';

    return pino({
        level: env.LOG_LEVEL,
        ...(isDev && {
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname',
                },
            },
        }),
    });
}

function wrapLogMethod(base: Logger, method: LogMethod): LogFn {
    const original = base[method].bind(base) as LogFn;

    return function wrappedLog(this: Logger, ...args: Parameters<LogFn>): void {
        const correlationId = getCorrelationId();

        if (!correlationId) {
            original.apply(this, args);
            return;
        }

        if (typeof args[0] === 'object' && args[0] !== null) {
            args[0] = { correlationId, ...args[0] };
            original.apply(this, args);
        } else if (typeof args[0] === 'string') {
            const rest = args.slice(1) as Parameters<LogFn>;
            (original as Function).call(this, { correlationId }, args[0], ...rest);
        } else {
            original.apply(this, args);
        }
    } as LogFn;
}

function createLogger(): Logger {
    const base = createBaseLogger();

    for (const method of LOG_METHODS) {
        (base[method] as LogFn) = wrapLogMethod(base, method);
    }

    return base;
}

export const logger = createLogger();
