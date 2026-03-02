import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../../middleware/validate.js';
import { successResponse, errorResponse } from '../../../utils/response.js';
import { getOverview } from '../../../services/analytics.service.js';
import { logger } from '../../../lib/logger.js';
import { strictIsoDate } from '../../../utils/date-validation.js';

const router: Router = Router();

const getOverviewSchema = z.object({
    query: z
        .object({
            start: strictIsoDate('start is required'),
            end: strictIsoDate('end is required'),
        })
        .refine((q) => q.end >= q.start, {
            message: 'end must be greater than or equal to start',
            path: ['end'],
        }),
    body: z.unknown(),
    params: z.unknown(),
});

router.get('/overview', validate(getOverviewSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json(errorResponse('UNAUTHORIZED', 'Missing user context'));
            return;
        }

        const { start, end } = req.query as { start: string; end: string };
        const data = await getOverview(userId, start, end);
        res.json(successResponse(data, { dateRange: `${start}/${end}` }));
    } catch (err) {
        logger.error({ err }, 'analytics overview failed');
        next(err);
    }
});

export default router;
