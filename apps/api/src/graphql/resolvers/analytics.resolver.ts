import { z } from 'zod';
import {
    getOverview,
    resolveOverviewUserId,
    getChannelTimeSeries,
    getContentTypeBreakdown,
    getBestPostingTimes,
    compareChannels,
} from '../../services/analytics.service.js';
import { resolveChannelsUserId } from '../../services/channels.service.js';
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

const channelTimeSeriesInput = z.object({
    channelId: z.string().min(1, 'channelId is required'),
    start: strictIsoDate(),
    end: strictIsoDate(),
    granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

const contentBreakdownInput = z.object({
    channelId: z.string().min(1, 'channelId is required'),
    start: strictIsoDate(),
    end: strictIsoDate(),
});

const bestPostingTimesInput = z.object({
    channelId: z.string().min(1, 'channelId is required'),
    start: strictIsoDate(),
    end: strictIsoDate(),
});

const compareChannelsInput = z.object({
    channelIds: z.array(z.string().min(1)).min(2, 'At least 2 channel IDs required'),
    start: strictIsoDate(),
    end: strictIsoDate(),
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
            const userId = await resolveOverviewUserId(ctx.user?.id);
            return getOverview(userId, start, end);
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

        // ── US-301: Per-Channel Time Series ──

        channelTimeSeries: async (
            _parent: unknown,
            args: { channelId: string; start: string; end: string; granularity?: string },
            ctx: GraphQLContext,
        ) => {
            requireAuth(ctx);
            const validated = validateArgs(channelTimeSeriesInput, {
                channelId: args.channelId,
                start: args.start,
                end: args.end,
                granularity: args.granularity ?? 'daily',
            });
            const userId = await resolveChannelsUserId(ctx.user?.id);
            return getChannelTimeSeries(
                userId,
                validated.channelId,
                validated.start,
                validated.end,
                validated.granularity as 'daily' | 'weekly' | 'monthly',
            );
        },

        // ── US-302: Content Type Breakdown ──

        contentTypeBreakdown: async (
            _parent: unknown,
            args: { channelId: string; start: string; end: string },
            ctx: GraphQLContext,
        ) => {
            requireAuth(ctx);
            const validated = validateArgs(contentBreakdownInput, args);
            const userId = await resolveChannelsUserId(ctx.user?.id);
            return getContentTypeBreakdown(userId, validated.channelId, validated.start, validated.end);
        },

        // ── US-303: Best Posting Times ──

        bestPostingTimes: async (
            _parent: unknown,
            args: { channelId: string; start: string; end: string },
            ctx: GraphQLContext,
        ) => {
            requireAuth(ctx);
            const validated = validateArgs(bestPostingTimesInput, args);
            const userId = await resolveChannelsUserId(ctx.user?.id);
            return getBestPostingTimes(userId, validated.channelId, validated.start, validated.end);
        },

        // ── US-304: Channel Comparison ──

        compareChannels: async (
            _parent: unknown,
            args: { channelIds: string[]; start: string; end: string },
            ctx: GraphQLContext,
        ) => {
            requireAuth(ctx);
            const validated = validateArgs(compareChannelsInput, args);
            const userId = await resolveChannelsUserId(ctx.user?.id);
            return compareChannels(userId, validated.channelIds, validated.start, validated.end);
        },
    },
};
