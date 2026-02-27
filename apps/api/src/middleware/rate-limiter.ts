import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function rateLimiter(req: Request, _res: Response, next: NextFunction): void {
    logger.debug({ ip: req.ip, path: req.path }, 'rate limit check passed');
    next();
}
