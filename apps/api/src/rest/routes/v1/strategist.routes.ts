import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../../middleware/validate.js';
import { successResponse } from '../../../utils/response.js';
import { getStrategyBrief } from '../../../services/strategist.service.js';

const router: Router = Router();

const getBriefSchema = z.object({
    query: z.unknown(),
    body: z.unknown(),
    params: z.unknown(),
});

router.get('/brief', validate(getBriefSchema), (_req, res) => {
    const data = getStrategyBrief();
    res.json(successResponse(data));
});

export default router;
