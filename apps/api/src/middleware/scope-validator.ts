import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function scopeValidator(req: Request, _res: Response, next: NextFunction): void {
    logger.debug({ path: req.path }, 'scope validation passed');
    next();
}
