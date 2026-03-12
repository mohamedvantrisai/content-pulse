import { logger } from '../lib/logger.js';
import { Post } from '../models/Post.js';
import { Channel } from '../models/Channel.js';
import mongoose from 'mongoose';
import type {
    AnalyticsOverviewResponse,
    ChangeMetrics,
    PeriodMetrics,
    TimeSeriesEntry,
    Granularity,
    ChannelTimeSeriesResponse,
    ContentTypeBreakdownResponse,
    BestPostingTimesResponse,
    ChannelComparisonResponse,
    ComparisonChannelMetrics,
    ComparisonWinners,
} from './analytics.types.js';
import {
    aggregatePeriodMetrics,
    aggregateTimeSeries,
    aggregatePlatformBreakdown,
    aggregateTopPosts,
    aggregateChannelTimeSeries,
    aggregateChannelTimeSeriesWeekly,
    aggregateChannelTimeSeriesMonthly,
    aggregateContentTypePerformance,
    aggregateBestPostingTimes,
    aggregateChannelComparisonMetrics,
} from './analytics.repository.js';

const FALLBACK_USER_ID = '000000000000000000000000';

/**
 * Temporary helper while auth is disabled:
 * - Uses authenticated userId when present
 * - Otherwise falls back to the first available post owner
 * - If no posts exist, returns a valid zero ObjectId to yield empty analytics
 */
export async function resolveOverviewUserId(userId?: string): Promise<string> {
    if (userId) return userId;

    const firstPost = await Post.findOne().select('userId').lean();
    if (firstPost?.userId) return String(firstPost.userId);

    return FALLBACK_USER_ID;
}

/**
 * Computes percentage change between current and previous values.
 * Returns null when previous is 0 to avoid division by zero.
 */
function computeChangePct(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

function buildChangeMetrics(current: PeriodMetrics, previous: PeriodMetrics): ChangeMetrics {
    return {
        impressionsChangePct: computeChangePct(current.totalImpressions, previous.totalImpressions),
        engagementsChangePct: computeChangePct(current.totalEngagements, previous.totalEngagements),
        postsChangePct: computeChangePct(current.totalPosts, previous.totalPosts),
        avgEngagementRateChangePct: computeChangePct(current.avgEngagementRate, previous.avgEngagementRate),
    };
}

/**
 * Fills in zero-value entries for days with no posts in the given range
 * so timeSeries always has one entry per day (AC-X5, Story C).
 */
function fillTimeSeriesGaps(
    sparse: TimeSeriesEntry[],
    startDate: string,
    endDate: string,
): TimeSeriesEntry[] {
    const dateMap = new Map(sparse.map((e) => [e.date, e]));
    const result: TimeSeriesEntry[] = [];

    const current = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T00:00:00.000Z');

    while (current <= end) {
        const dateStr = current.toISOString().slice(0, 10);
        result.push(
            dateMap.get(dateStr) ?? { date: dateStr, impressions: 0, engagements: 0, posts: 0 },
        );
        current.setUTCDate(current.getUTCDate() + 1);
    }

    return result;
}

/**
 * Main analytics overview aggregation.
 * currentPeriod totals and timeSeries are computed from the same Post
 * collection via independent aggregation pipelines. AC-X1 consistency
 * (sum of breakdowns == overall totals) is maintained because both
 * pipelines use identical userId + date-range $match predicates.
 */
export async function getOverview(
    userId: string,
    start: string,
    end: string,
): Promise<AnalyticsOverviewResponse> {
    const startUtc = new Date(start + 'T00:00:00.000Z');
    const endUtc = new Date(end + 'T23:59:59.999Z');

    // Compute previous period: same window length, immediately before start
    const windowMs = endUtc.getTime() - startUtc.getTime() + 1; // +1 for inclusive
    const prevEndUtc = new Date(startUtc.getTime() - 1); // 1ms before current start
    const prevStartUtc = new Date(prevEndUtc.getTime() - windowMs + 1);

    logger.debug(
        {
            userId,
            currentRange: { start: startUtc.toISOString(), end: endUtc.toISOString() },
            previousRange: { start: prevStartUtc.toISOString(), end: prevEndUtc.toISOString() },
        },
        'analytics overview requested',
    );

    // Run all aggregations in parallel for performance
    const [
        currentPeriod,
        previousPeriod,
        sparseTimeSeries,
        platformBreakdown,
        topPosts,
    ] = await Promise.all([
        aggregatePeriodMetrics(userId, startUtc, endUtc),
        aggregatePeriodMetrics(userId, prevStartUtc, prevEndUtc),
        aggregateTimeSeries(userId, startUtc, endUtc),
        aggregatePlatformBreakdown(userId, startUtc, endUtc),
        aggregateTopPosts(userId, startUtc, endUtc, 10),
    ]);

    const timeSeries = fillTimeSeriesGaps(sparseTimeSeries, start, end);
    const changes = buildChangeMetrics(currentPeriod, previousPeriod);

    return {
        currentPeriod,
        previousPeriod,
        changes,
        timeSeries,
        platformBreakdown,
        topPosts,
    };
}



// ── US-301: Per-Channel Time Series with Granularity ──────────

function channelNotFoundError(): Error & { statusCode: number; code: string } {
    const error = new Error('Channel not found') as Error & { statusCode: number; code: string };
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    return error;
}

/**
 * Returns time series for a specific channel at the requested granularity.
 * Validates channel ownership before returning data.
 */
export async function getChannelTimeSeries(
    userId: string,
    channelId: string,
    start: string,
    end: string,
    granularity: Granularity = 'daily',
): Promise<ChannelTimeSeriesResponse> {
    if (!mongoose.Types.ObjectId.isValid(channelId)) throw channelNotFoundError();

    const channel = await Channel.findOne({
        _id: new mongoose.Types.ObjectId(channelId),
        userId: new mongoose.Types.ObjectId(userId),
    });
    if (!channel) throw channelNotFoundError();

    const startUtc = new Date(start + 'T00:00:00.000Z');
    const endUtc = new Date(end + 'T23:59:59.999Z');

    let timeSeries: TimeSeriesEntry[];

    switch (granularity) {
        case 'weekly':
            timeSeries = await aggregateChannelTimeSeriesWeekly(channelId, startUtc, endUtc);
            break;
        case 'monthly':
            timeSeries = await aggregateChannelTimeSeriesMonthly(channelId, startUtc, endUtc);
            break;
        case 'daily':
        default:
            timeSeries = await aggregateChannelTimeSeries(channelId, startUtc, endUtc);
            timeSeries = fillTimeSeriesGaps(timeSeries, start, end);
            break;
    }

    return { channelId, granularity, timeSeries };
}

// ── US-302: Content Type Performance Breakdown ────────────────

/**
 * Returns content type performance breakdown for a specific channel.
 * Sorted by avgEngagementRate descending. Types with 0 posts excluded.
 */
export async function getContentTypeBreakdown(
    userId: string,
    channelId: string,
    start: string,
    end: string,
): Promise<ContentTypeBreakdownResponse> {
    if (!mongoose.Types.ObjectId.isValid(channelId)) throw channelNotFoundError();

    const channel = await Channel.findOne({
        _id: new mongoose.Types.ObjectId(channelId),
        userId: new mongoose.Types.ObjectId(userId),
    });
    if (!channel) throw channelNotFoundError();

    const startUtc = new Date(start + 'T00:00:00.000Z');
    const endUtc = new Date(end + 'T23:59:59.999Z');

    const contentTypeBreakdown = await aggregateContentTypePerformance(channelId, startUtc, endUtc);

    return { channelId, contentTypeBreakdown };
}

// ── US-303: Best Posting Times ────────────────────────────────

/**
 * Returns the top 5 posting time slots (dayOfWeek × hour) by avgEngagementRate.
 * Slots with fewer than 2 posts are excluded.
 */
export async function getBestPostingTimes(
    userId: string,
    channelId: string,
    start: string,
    end: string,
): Promise<BestPostingTimesResponse> {
    if (!mongoose.Types.ObjectId.isValid(channelId)) throw channelNotFoundError();

    const channel = await Channel.findOne({
        _id: new mongoose.Types.ObjectId(channelId),
        userId: new mongoose.Types.ObjectId(userId),
    });
    if (!channel) throw channelNotFoundError();

    const startUtc = new Date(start + 'T00:00:00.000Z');
    const endUtc = new Date(end + 'T23:59:59.999Z');

    const bestPostingTimes = await aggregateBestPostingTimes(channelId, startUtc, endUtc, 2, 5);

    return { channelId, bestPostingTimes };
}

// ── US-304: Channel Comparison ────────────────────────────────

function validationError(message: string): Error & { statusCode: number; code: string } {
    const error = new Error(message) as Error & { statusCode: number; code: string };
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    return error;
}

function forbiddenError(message: string): Error & { statusCode: number; code: string } {
    const error = new Error(message) as Error & { statusCode: number; code: string };
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    return error;
}

/**
 * Compares analytics for 2+ channels side-by-side.
 * Returns per-channel metrics and a winners object.
 */
export async function compareChannels(
    userId: string,
    channelIds: string[],
    start: string,
    end: string,
): Promise<ChannelComparisonResponse> {
    if (channelIds.length < 2) {
        throw validationError('At least 2 channel IDs required');
    }

    const startUtc = new Date(start + 'T00:00:00.000Z');
    const endUtc = new Date(end + 'T23:59:59.999Z');

    // Validate all channels exist and belong to user
    const channels: ComparisonChannelMetrics[] = [];
    for (const cid of channelIds) {
        if (!mongoose.Types.ObjectId.isValid(cid)) throw channelNotFoundError();

        const channel = await Channel.findOne({
            _id: new mongoose.Types.ObjectId(cid),
        });

        if (!channel) throw channelNotFoundError();

        // Check ownership
        if (String(channel.userId) !== userId) {
            throw forbiddenError('Channel does not belong to the authenticated user');
        }

        const metrics = await aggregateChannelComparisonMetrics(cid, userId, startUtc, endUtc);

        channels.push({
            channelId: cid,
            platform: channel.platform,
            displayName: channel.displayName,
            totalImpressions: metrics?.totalImpressions ?? 0,
            totalEngagements: metrics?.totalEngagements ?? 0,
            totalPosts: metrics?.totalPosts ?? 0,
            avgEngagementRate: metrics?.avgEngagementRate ?? 0,
        });
    }

    // Determine winners
    const winners: ComparisonWinners = {
        totalImpressions: findWinner(channels, 'totalImpressions'),
        totalEngagements: findWinner(channels, 'totalEngagements'),
        avgEngagementRate: findWinner(channels, 'avgEngagementRate'),
        totalPosts: findWinner(channels, 'totalPosts'),
    };

    return { channels, winners };
}

function findWinner(
    channels: ComparisonChannelMetrics[],
    metric: keyof Pick<ComparisonChannelMetrics, 'totalImpressions' | 'totalEngagements' | 'avgEngagementRate' | 'totalPosts'>,
): string {
    let best = channels[0]!;
    for (let i = 1; i < channels.length; i++) {
        if (channels[i]![metric] > best[metric]) {
            best = channels[i]!;
        }
    }
    return best.channelId;
}