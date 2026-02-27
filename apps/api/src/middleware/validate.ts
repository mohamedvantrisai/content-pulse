import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';
import { errorResponse } from '../utils/response.js';

export function validate(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        if (!result.success) {
            const details = result.error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
            }));

            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request data', details));
            return;
        }

        next();
    };
}

export { ZodError };
