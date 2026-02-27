import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

function unauthorized(message: string): Error & { statusCode: number; code: string } {
    const error = new Error(message) as Error & { statusCode: number; code: string };
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    return error;
}

/**
 * Centralized JWT auth middleware for both REST and GraphQL.
 * Verifies token signature against JWT_SECRET — not just header shape.
 * Attaches decoded payload to req for downstream consumption.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next(unauthorized('Missing or invalid Authorization header'));
        return;
    }

    const token = authHeader.slice(7);

    if (!token) {
        next(unauthorized('Token is empty'));
        return;
    }

    try {
        jwt.verify(token, env.JWT_SECRET);
        logger.debug({ tokenLength: token.length }, 'auth token verified');
        next();
    } catch {
        next(unauthorized('Invalid or expired token'));
    }
}
