import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../../middleware/validate.js';
import { successResponse } from '../../../utils/response.js';
import { listChannels } from '../../../services/channels.service.js';

const router: Router = Router();

const listChannelsSchema = z.object({
    query: z.object({
        platform: z.string().optional(),
    }),
    body: z.unknown(),
    params: z.unknown(),
});

router.get('/', validate(listChannelsSchema), (_req, res) => {
    const data = listChannels();
    res.json(successResponse(data));
});

export default router;
