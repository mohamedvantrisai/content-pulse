import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface AuthenticatedUser {
    id: string;
    email?: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

function unauthorized(message: string): Error & { statusCode: number; code: string } {
    const error = new Error(message) as Error & { statusCode: number; code: string };
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    return error;
}

function tryDecodeToken(req: Request): void {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return;

    const token = authHeader.slice(7);
    if (!token) return;

    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    const subject = (decoded['sub'] as string) ?? (decoded['id'] as string);
    if (!subject || !mongoose.Types.ObjectId.isValid(subject)) return;

    req.user = {
        id: subject,
        ...(decoded['email'] && { email: decoded['email'] as string }),
    };
    logger.debug({ tokenLength: token.length, userId: subject }, 'auth token verified');
}

/**
 * Strict JWT auth middleware — rejects requests without a valid token.
 * Verifies token signature against JWT_SECRET.
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
        const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
        const subject = (decoded['sub'] as string) ?? (decoded['id'] as string);
        if (!subject) {
            next(unauthorized('Token missing subject identifier'));
            return;
        }
        if (!mongoose.Types.ObjectId.isValid(subject)) {
            next(unauthorized('Invalid token subject'));
            return;
        }
        req.user = {
            id: subject,
            ...(decoded['email'] && { email: decoded['email'] as string }),
        };
        logger.debug({ tokenLength: token.length, userId: subject }, 'auth token verified');
        next();
    } catch {
        next(unauthorized('Invalid or expired token'));
    }
}

/**
 * Optional auth middleware — attaches req.user when a valid token is present,
 * but allows the request to proceed without authentication.
 * Used for endpoints that work with or without auth (e.g. channel listing in dev).
 */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
    try {
        tryDecodeToken(req);
    } catch {
        // Token invalid or missing — proceed without auth
    }
    next();
}
