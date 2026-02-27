import { GraphQLError } from 'graphql';
import { z } from 'zod';
import { getAnalyticsOverview } from '../../services/analytics.service.js';
import type { GraphQLContext } from '../context.js';

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
        analyticsOverview: (_parent: unknown, _args: unknown, _ctx: GraphQLContext) => {
            return getAnalyticsOverview();
        },

        channelAnalytics: (
            _parent: unknown,
            args: { channelId: string; period: string },
            _ctx: GraphQLContext,
        ) => {
            const result = channelAnalyticsInput.safeParse(args);
            if (!result.success) {
                throw new GraphQLError('Invalid input', {
                    extensions: {
                        code: 'VALIDATION_ERROR',
                        validationErrors: result.error.issues.map((i) => ({
                            path: i.path.join('.'),
                            message: i.message,
                        })),
                    },
                });
            }
            return [];
        },

        platformBreakdown: (_parent: unknown, _args: unknown, _ctx: GraphQLContext) => {
            return [];
        },

        timeSeries: (
            _parent: unknown,
            args: { metric: string; from?: string; to?: string },
            _ctx: GraphQLContext,
        ) => {
            const result = timeSeriesInput.safeParse(args);
            if (!result.success) {
                throw new GraphQLError('Invalid input', {
                    extensions: {
                        code: 'VALIDATION_ERROR',
                        validationErrors: result.error.issues.map((i) => ({
                            path: i.path.join('.'),
                            message: i.message,
                        })),
                    },
                });
            }
            return [];
        },
    },
};
