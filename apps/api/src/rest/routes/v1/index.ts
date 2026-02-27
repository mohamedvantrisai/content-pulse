import { Router, type Router as RouterType } from 'express';

const router: RouterType = Router();

router.get('/status', (_req, res) => {
    res.json({ data: { api: 'v1', status: 'operational' } });
});

export default router;
