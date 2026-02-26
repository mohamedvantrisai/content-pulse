import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncLocalStorage, type RequestContext } from '../lib/async-context.js';

const HEADER = 'x-request-id';

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers[HEADER] as string) || uuidv4();

    res.setHeader(HEADER, correlationId);

    const context: RequestContext = {
        correlationId,
        startTime: Date.now(),
    };

    asyncLocalStorage.run(context, () => {
        next();
    });
}
