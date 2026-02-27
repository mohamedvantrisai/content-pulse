import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../../middleware/validate.js';
import { successResponse } from '../../../utils/response.js';
import { listApiKeys } from '../../../services/apikeys.service.js';

const router: Router = Router();

const listKeysSchema = z.object({
    query: z.unknown(),
    body: z.unknown(),
    params: z.unknown(),
});

router.get('/', validate(listKeysSchema), (_req, res) => {
    const data = listApiKeys();
    res.json(successResponse(data));
});

export default router;
