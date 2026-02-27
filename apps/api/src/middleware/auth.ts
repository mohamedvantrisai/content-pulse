import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error = new Error('Missing or invalid Authorization header') as Error & {
            statusCode: number;
            code: string;
        };
        error.statusCode = 401;
        error.code = 'UNAUTHORIZED';
        next(error);
        return;
    }

    const token = authHeader.slice(7);

    if (!token) {
        const error = new Error('Token is empty') as Error & {
            statusCode: number;
            code: string;
        };
        error.statusCode = 401;
        error.code = 'UNAUTHORIZED';
        next(error);
        return;
    }

    logger.debug({ tokenLength: token.length }, 'auth token received');
    next();
}
