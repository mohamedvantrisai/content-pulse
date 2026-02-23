import pino from 'pino';
import type { Logger } from 'pino';
import { env } from './env.js';

function createLogger(): Logger {
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

export const logger = createLogger();
