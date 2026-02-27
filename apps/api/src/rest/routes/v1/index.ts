import { Router, type Router as RouterType } from 'express';
import analyticsRouter from './analytics.routes.js';
import channelsRouter from './channels.routes.js';
import strategistRouter from './strategist.routes.js';
import apikeysRouter from './apikeys.routes.js';
import { successResponse } from '../../../utils/response.js';

const router: RouterType = Router();

router.get('/status', (_req, res) => {
    res.json(successResponse({ api: 'v1', status: 'operational' }));
});

router.use('/analytics', analyticsRouter);
router.use('/channels', channelsRouter);
router.use('/strategist', strategistRouter);
router.use('/apikeys', apikeysRouter);

export default router;
