import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { validate } from '../../../middleware/validate.js';
import { optionalAuthMiddleware } from '../../../middleware/auth.js';
import { successResponse, errorResponse } from '../../../utils/response.js';
import {
    getOverview,
    resolveOverviewUserId,
    getChannelTimeSeries,
    getContentTypeBreakdown,
    getBestPostingTimes,
    compareChannels,
} from '../../../services/analytics.service.js';
import { resolveChannelsUserId } from '../../../services/channels.service.js';
import { logger } from '../../../lib/logger.js';
import { strictIsoDate } from '../../../utils/date-validation.js';

const router: Router = Router();

// ── GET /analytics/overview ─────────────────────────────────

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
        const userId = await resolveOverviewUserId(req.user?.id);
        const { start, end } = req.query as { start: string; end: string };
        const data = await getOverview(userId, start, end);
        res.json(successResponse(data, { dateRange: `${start}/${end}` }));
    } catch (err) {
        logger.error({ err }, 'analytics overview failed');
        next(err);
    }
});

// ── US-301: GET /analytics/channels/:id ─────────────────────

const channelIdParam = z.object({
    id: z.string().refine(
        (v) => mongoose.Types.ObjectId.isValid(v),
        'Invalid channel ID',
    ),
});

const channelTimeSeriesSchema = z.object({
    params: channelIdParam,
    query: z
        .object({
            start: strictIsoDate('start is required'),
            end: strictIsoDate('end is required'),
            granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
        })
        .refine((q) => q.end >= q.start, {
            message: 'end must be greater than or equal to start',
            path: ['end'],
        }),
    body: z.unknown(),
});

router.get(
    '/channels/:id',
    optionalAuthMiddleware,
    validate(channelTimeSeriesSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = await resolveChannelsUserId(req.user?.id);
            const channelId = req.params['id'] as string;
            const { start, end, granularity } = req.query as {
                start: string;
                end: string;
                granularity: 'daily' | 'weekly' | 'monthly';
            };

            const data = await getChannelTimeSeries(userId, channelId, start, end, granularity);
            res.json(successResponse(data, { dateRange: `${start}/${end}` }));
        } catch (err) {
            next(err);
        }
    },
);

// ── US-302: GET /analytics/channels/:id/content-breakdown ───

const contentBreakdownSchema = z.object({
    params: channelIdParam,
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
});

router.get(
    '/channels/:id/content-breakdown',
    optionalAuthMiddleware,
    validate(contentBreakdownSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = await resolveChannelsUserId(req.user?.id);
            const channelId = req.params['id'] as string;
            const { start, end } = req.query as { start: string; end: string };

            const data = await getContentTypeBreakdown(userId, channelId, start, end);
            res.json(successResponse(data, { dateRange: `${start}/${end}` }));
        } catch (err) {
            next(err);
        }
    },
);

// ── US-303: GET /analytics/channels/:id/posting-times ───────

const postingTimesSchema = z.object({
    params: channelIdParam,
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
});

router.get(
    '/channels/:id/posting-times',
    optionalAuthMiddleware,
    validate(postingTimesSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = await resolveChannelsUserId(req.user?.id);
            const channelId = req.params['id'] as string;
            const { start, end } = req.query as { start: string; end: string };

            const data = await getBestPostingTimes(userId, channelId, start, end);
            res.json(successResponse(data, { dateRange: `${start}/${end}` }));
        } catch (err) {
            next(err);
        }
    },
);

// ── US-304: GET /analytics/compare ──────────────────────────

const compareSchema = z.object({
    query: z
        .object({
            channel_ids: z.string().min(1, 'channel_ids is required'),
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

router.get(
    '/compare',
    optionalAuthMiddleware,
    validate(compareSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = await resolveChannelsUserId(req.user?.id);
            const { channel_ids, start, end } = req.query as {
                channel_ids: string;
                start: string;
                end: string;
            };

            const channelIds = channel_ids.split(',').map((id) => id.trim()).filter(Boolean);

            const data = await compareChannels(userId, channelIds, start, end);
            res.json(successResponse(data, { dateRange: `${start}/${end}` }));
        } catch (err) {
            next(err);
        }
    },
);

export default router;
