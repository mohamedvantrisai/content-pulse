import { z } from 'zod';
import { getAnalyticsOverview } from '../../services/analytics.service.js';
import type { GraphQLContext } from '../context.js';
import { validateArgs, requireAuth } from '../validation.js';

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

export const analyticsResolvers = {
    Query: {
        analyticsOverview: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
            requireAuth(ctx);
            return getAnalyticsOverview();
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
