import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';
import { getRequestContext } from '../lib/async-context.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    logger.info({ method: req.method, path: req.originalUrl }, 'request started');

    res.on('finish', () => {
        const context = getRequestContext();
        const durationMs = context ? Date.now() - context.startTime : undefined;

        logger.info(
            {
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs,
            },
            'request completed',
        );
    });

    next();
}
