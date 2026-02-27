import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { errorResponse } from '../utils/response.js';

export interface AppError extends Error {
    statusCode?: number;
    code?: string;
    details?: unknown[];
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
    const error: AppError = new Error(`Not Found: ${req.method} ${req.originalUrl}`);
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    next(error);
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
    const statusCode = err.statusCode ?? 500;
    const code = err.code ?? 'INTERNAL_SERVER_ERROR';
    const message = env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal Server Error'
        : err.message;

    logger.error(
        {
            method: req.method,
            path: req.originalUrl,
            statusCode,
            error: err.message,
            ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
        },
        'request error',
    );

    res.status(statusCode).json(errorResponse(code, message, err.details ?? []));
}
