import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../../middleware/validate.js';
import { successResponse } from '../../../utils/response.js';
import { getAnalyticsOverview } from '../../../services/analytics.service.js';

const router: Router = Router();

const getOverviewSchema = z.object({
    query: z.object({
        from: z.string().optional(),
        to: z.string().optional(),
    }),
    body: z.unknown(),
    params: z.unknown(),
});

router.get('/overview', validate(getOverviewSchema), (_req, res) => {
    const data = getAnalyticsOverview();
    res.json(successResponse(data));
});

export default router;
