import { z } from 'zod';
import { getOverview } from '../../services/analytics.service.js';
import type { GraphQLContext } from '../context.js';
import { validateArgs, requireAuth } from '../validation.js';
import { strictIsoDate } from '../../utils/date-validation.js';

const channelAnalyticsInput = z.object({
    channelId: z.string().min(1, 'channelId is required'),
    period: z.enum(['daily', 'weekly', 'monthly'], {
        errorMap: () => ({ message: 'period must be daily, weekly, or monthly' }),
    }),
});

const timeSeriesInput = z.object({
    metric: z.string().min(1, 'metric is required'),
    from: z.string().optional(),
    to: z.string().optional(),
});

const analyticsOverviewInput = z
    .object({
        start: strictIsoDate(),
        end: strictIsoDate(),
    })
    .refine((q) => q.end >= q.start, {
        message: 'end must be greater than or equal to start',
        path: ['end'],
    });

export const analyticsResolvers = {
    Query: {
        analyticsOverview: async (
            _parent: unknown,
            args: { start?: string; end?: string },
            ctx: GraphQLContext,
        ) => {
            requireAuth(ctx);
            const today = new Date().toISOString().slice(0, 10);
            const start = args.start ?? today;
            const end = args.end ?? today;
            validateArgs(analyticsOverviewInput, { start, end });
            return getOverview(ctx.user!.id, start, end);
        },

        channelAnalytics: (
            _parent: unknown,
            args: { channelId: string; period: string },
            ctx: GraphQLContext,
        ) => {
            requireAuth(ctx);
            validateArgs(channelAnalyticsInput, args);
            return [];
        },

        platformBreakdown: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
            requireAuth(ctx);
            return [];
        },

        timeSeries: (
            _parent: unknown,
            args: { metric: string; from?: string; to?: string },
            ctx: GraphQLContext,
        ) => {
            requireAuth(ctx);
            validateArgs(timeSeriesInput, args);
            return [];
        },
    },
};
