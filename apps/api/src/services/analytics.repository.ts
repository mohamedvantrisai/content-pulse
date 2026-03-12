import mongoose from 'mongoose';
import { Post } from '../models/Post.js';
import { Channel } from '../models/Channel.js';
import type {
    PeriodMetrics,
    TimeSeriesEntry,
    PlatformBreakdownEntry,
    TopPostEntry,
    ContentBreakdownEntry,
    PostingTimeEntry,
    ContentTypePerformanceEntry,
    BestPostingTimeEntry,
    ComparisonChannelMetrics,
} from './analytics.types.js';

/**
 * Aggregates period metrics (impressions, engagements, posts) for a user
 * within a UTC date range using a single $group stage.
 */
export async function aggregatePeriodMetrics(
    userId: string,
    startUtc: Date,
    endUtc: Date,
): Promise<PeriodMetrics> {
    const pipeline = [
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        {
            $group: {
                _id: null,
                totalImpressions: { $sum: '$metrics.impressions' },
                totalEngagements: { $sum: '$metrics.engagements' },
                totalPosts: { $sum: 1 },
            },
        },
    ];

    const results = await Post.aggregate(pipeline);
    const row = results[0] as { totalImpressions: number; totalEngagements: number; totalPosts: number } | undefined;

    if (!row) {
        return { totalImpressions: 0, totalEngagements: 0, totalPosts: 0, avgEngagementRate: 0 };
    }

    const avgEngagementRate =
        row.totalImpressions > 0
            ? row.totalEngagements / row.totalImpressions
            : 0;

    return {
        totalImpressions: row.totalImpressions,
        totalEngagements: row.totalEngagements,
        totalPosts: row.totalPosts,
        avgEngagementRate: parseFloat(avgEngagementRate.toFixed(6)),
    };
}

/**
 * Aggregates daily time series for impressions, engagements, and post count
 * within a UTC date range. Uses $dateToString to group by day in UTC.
 */
export async function aggregateTimeSeries(
    userId: string,
    startUtc: Date,
    endUtc: Date,
): Promise<TimeSeriesEntry[]> {
    const pipeline = [
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$publishedAt', timezone: 'UTC' },
                },
                impressions: { $sum: '$metrics.impressions' },
                engagements: { $sum: '$metrics.engagements' },
                posts: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 as const } },
    ];

    const results = await Post.aggregate(pipeline) as Array<{
        _id: string;
        impressions: number;
        engagements: number;
        posts: number;
    }>;

    return results.map((r) => ({
        date: r._id,
        impressions: r.impressions,
        engagements: r.engagements,
        posts: r.posts,
    }));
}

/**
 * Aggregates metrics per platform for a user within a UTC date range.
 * Joins with Channel collection to get followerCount.
 */
export async function aggregatePlatformBreakdown(
    userId: string,
    startUtc: Date,
    endUtc: Date,
): Promise<PlatformBreakdownEntry[]> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Step 1: Aggregate post metrics per platform
    const postPipeline = [
        {
            $match: {
                userId: userObjectId,
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        {
            $group: {
                _id: '$platform',
                totalImpressions: { $sum: '$metrics.impressions' },
                totalEngagements: { $sum: '$metrics.engagements' },
                totalPosts: { $sum: 1 },
            },
        },
    ];

    const postResults = await Post.aggregate(postPipeline) as Array<{
        _id: string;
        totalImpressions: number;
        totalEngagements: number;
        totalPosts: number;
    }>;

    const postMap = new Map(postResults.map((r) => [r._id, r]));

    // Step 2: Get all channels for the user to include platforms with no posts
    const channels = await Channel.find({ userId: userObjectId })
        .select('platform followerCount')
        .lean();

    // Group channels by platform, summing followerCount for multiple channels per platform
    const platformFollowers = new Map<string, number>();
    for (const ch of channels) {
        const existing = platformFollowers.get(ch.platform) ?? 0;
        platformFollowers.set(ch.platform, existing + ch.followerCount);
    }

    // Ensure orphan-post platforms (posts with no channel record) are also
    // included so that sum(platformBreakdown) always equals overall totals.
    for (const r of postResults) {
        if (!platformFollowers.has(r._id)) {
            platformFollowers.set(r._id, 0);
        }
    }

    // Merge: every platform that has a channel OR posts gets an entry
    const breakdown: PlatformBreakdownEntry[] = [];
    for (const [platform, followerCount] of platformFollowers) {
        const postData = postMap.get(platform);
        const totalImpressions = postData?.totalImpressions ?? 0;
        const totalEngagements = postData?.totalEngagements ?? 0;
        const totalPosts = postData?.totalPosts ?? 0;
        const avgEngagementRate =
            totalImpressions > 0
                ? parseFloat((totalEngagements / totalImpressions).toFixed(6))
                : 0;

        breakdown.push({
            platform,
            totalImpressions,
            totalEngagements,
            totalPosts,
            avgEngagementRate,
            followerCount,
        });
    }

    return breakdown.sort((a, b) => a.platform.localeCompare(b.platform));
}

/**
 * Retrieves top N posts by engagementRate desc within a UTC date range.
 * Uses DB-level sort + limit to avoid loading all posts into memory (AC-X4).
 */
export async function aggregateTopPosts(
    userId: string,
    startUtc: Date,
    endUtc: Date,
    limit: number = 10,
): Promise<TopPostEntry[]> {
    const pipeline = [
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        { $sort: { engagementRate: -1 as const, publishedAt: -1 as const } },
        { $limit: limit },
        {
            $project: {
                _id: 1,
                platform: 1,
                content: 1,
                postType: 1,
                impressions: '$metrics.impressions',
                engagements: '$metrics.engagements',
                engagementRate: 1,
                publishedAt: 1,
            },
        },
    ];

    const results = await Post.aggregate(pipeline) as Array<{
        _id: mongoose.Types.ObjectId;
        platform: string;
        content: string;
        postType: string;
        impressions: number;
        engagements: number;
        engagementRate: number;
        publishedAt: Date;
    }>;

    return results.map((r) => ({
        id: r._id.toString(),
        platform: r.platform,
        content: r.content.length > 120 ? r.content.substring(0, 120) + '...' : r.content,
        postType: r.postType,
        impressions: r.impressions,
        engagements: r.engagements,
        engagementRate: r.engagementRate,
        publishedAt: r.publishedAt.toISOString(),
    }));
}

/**
 * Aggregates daily time series for a single channel.
 */
export async function aggregateChannelTimeSeries(
    channelId: string,
    startUtc: Date,
    endUtc: Date,
): Promise<TimeSeriesEntry[]> {
    const pipeline = [
        {
            $match: {
                channelId: new mongoose.Types.ObjectId(channelId),
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$publishedAt', timezone: 'UTC' },
                },
                impressions: { $sum: '$metrics.impressions' },
                engagements: { $sum: '$metrics.engagements' },
                posts: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 as const } },
    ];

    const results = await Post.aggregate(pipeline) as Array<{
        _id: string;
        impressions: number;
        engagements: number;
        posts: number;
    }>;

    return results.map((r) => ({
        date: r._id,
        impressions: r.impressions,
        engagements: r.engagements,
        posts: r.posts,
    }));
}

/**
 * Aggregates post counts and metrics grouped by postType for a single channel.
 */
export async function aggregateContentBreakdown(
    channelId: string,
    startUtc: Date,
    endUtc: Date,
): Promise<ContentBreakdownEntry[]> {
    const pipeline = [
        {
            $match: {
                channelId: new mongoose.Types.ObjectId(channelId),
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        {
            $group: {
                _id: '$postType',
                count: { $sum: 1 },
                totalImpressions: { $sum: '$metrics.impressions' },
                totalEngagements: { $sum: '$metrics.engagements' },
            },
        },
        { $sort: { count: -1 as const } },
    ];

    const results = await Post.aggregate(pipeline) as Array<{
        _id: string;
        count: number;
        totalImpressions: number;
        totalEngagements: number;
    }>;

    return results.map((r) => ({
        postType: r._id,
        count: r.count,
        totalImpressions: r.totalImpressions,
        totalEngagements: r.totalEngagements,
    }));
}

/**
 * Aggregates post frequency by hour-of-day (0-23) for a single channel.
 */
export async function aggregatePostingTimes(
    channelId: string,
    startUtc: Date,
    endUtc: Date,
): Promise<PostingTimeEntry[]> {
    const pipeline = [
        {
            $match: {
                channelId: new mongoose.Types.ObjectId(channelId),
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        {
            $group: {
                _id: { $hour: '$publishedAt' },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 as const } },
    ];

    const results = await Post.aggregate(pipeline) as Array<{
        _id: number;
        count: number;
    }>;

    return results.map((r) => ({
        hour: r._id,
        count: r.count,
    }));
}



// ── US-301: Weekly Time Series ────────────────────────────────

/**
 * Aggregates time series into ISO-week buckets (Monday–Sunday).
 * Each entry's date is the Monday of that week (YYYY-MM-DD).
 */
export async function aggregateChannelTimeSeriesWeekly(
    channelId: string,
    startUtc: Date,
    endUtc: Date,
): Promise<TimeSeriesEntry[]> {
    const pipeline = [
        {
            $match: {
                channelId: new mongoose.Types.ObjectId(channelId),
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        {
            $addFields: {
                // Compute ISO Monday: subtract (dayOfWeek - 2) days, where Mongo Sun=1..Sat=7
                isoMonday: {
                    $dateSubtract: {
                        startDate: '$publishedAt',
                        unit: 'day',
                        amount: {
                            $mod: [
                                { $add: [{ $subtract: [{ $dayOfWeek: '$publishedAt' }, 2] }, 7] },
                                7,
                            ],
                        },
                    },
                },
            },
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$isoMonday', timezone: 'UTC' } },
                impressions: { $sum: '$metrics.impressions' },
                engagements: { $sum: '$metrics.engagements' },
                posts: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 as const } },
    ];

    const results = await Post.aggregate(pipeline) as Array<{
        _id: string;
        impressions: number;
        engagements: number;
        posts: number;
    }>;

    return results.map((r) => ({
        date: r._id,
        impressions: r.impressions,
        engagements: r.engagements,
        posts: r.posts,
    }));
}

// ── US-301: Monthly Time Series ───────────────────────────────

/**
 * Aggregates time series into calendar-month buckets.
 * Each entry's date is the first day of that month (YYYY-MM-01).
 */
export async function aggregateChannelTimeSeriesMonthly(
    channelId: string,
    startUtc: Date,
    endUtc: Date,
): Promise<TimeSeriesEntry[]> {
    const pipeline = [
        {
            $match: {
                channelId: new mongoose.Types.ObjectId(channelId),
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-01', date: '$publishedAt', timezone: 'UTC' },
                },
                impressions: { $sum: '$metrics.impressions' },
                engagements: { $sum: '$metrics.engagements' },
                posts: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 as const } },
    ];

    const results = await Post.aggregate(pipeline) as Array<{
        _id: string;
        impressions: number;
        engagements: number;
        posts: number;
    }>;

    return results.map((r) => ({
        date: r._id,
        impressions: r.impressions,
        engagements: r.engagements,
        posts: r.posts,
    }));
}

// ── US-302: Content Type Performance Breakdown ────────────────

/**
 * Aggregates content type performance with avg metrics, sorted by avgEngagementRate desc.
 * Types with 0 posts are excluded by the $match stage.
 */
export async function aggregateContentTypePerformance(
    channelId: string,
    startUtc: Date,
    endUtc: Date,
): Promise<ContentTypePerformanceEntry[]> {
    const pipeline = [
        {
            $match: {
                channelId: new mongoose.Types.ObjectId(channelId),
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        {
            $group: {
                _id: '$postType',
                postCount: { $sum: 1 },
                totalImpressions: { $sum: '$metrics.impressions' },
                totalEngagements: { $sum: '$metrics.engagements' },
            },
        },
        {
            $addFields: {
                avgImpressions: { $round: [{ $divide: ['$totalImpressions', '$postCount'] }, 2] },
                avgEngagements: { $round: [{ $divide: ['$totalEngagements', '$postCount'] }, 2] },
                avgEngagementRate: {
                    $cond: {
                        if: { $gt: ['$totalImpressions', 0] },
                        then: {
                            $round: [
                                { $divide: ['$totalEngagements', '$totalImpressions'] },
                                6,
                            ],
                        },
                        else: 0,
                    },
                },
            },
        },
        { $sort: { avgEngagementRate: -1 as const } },
    ];

    const results = await Post.aggregate(pipeline) as Array<{
        _id: string;
        postCount: number;
        avgImpressions: number;
        avgEngagements: number;
        avgEngagementRate: number;
    }>;

    return results.map((r) => ({
        postType: r._id,
        postCount: r.postCount,
        avgImpressions: r.avgImpressions,
        avgEngagements: r.avgEngagements,
        avgEngagementRate: r.avgEngagementRate,
    }));
}

// ── US-303: Best Posting Times ────────────────────────────────

/**
 * Aggregates day-of-week × hour slots with avgEngagementRate.
 * Slots with < minPosts are excluded. Returns top N sorted by rate desc.
 */
export async function aggregateBestPostingTimes(
    channelId: string,
    startUtc: Date,
    endUtc: Date,
    minPosts: number = 2,
    topN: number = 5,
): Promise<BestPostingTimeEntry[]> {
    const pipeline = [
        {
            $match: {
                channelId: new mongoose.Types.ObjectId(channelId),
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        {
            $group: {
                _id: {
                    // MongoDB $dayOfWeek: Sun=1..Sat=7 → convert to 0-6 (Sun=0)
                    dayOfWeek: { $subtract: [{ $dayOfWeek: '$publishedAt' }, 1] },
                    hour: { $hour: '$publishedAt' },
                },
                postCount: { $sum: 1 },
                totalImpressions: { $sum: '$metrics.impressions' },
                totalEngagements: { $sum: '$metrics.engagements' },
            },
        },
        {
            $match: {
                postCount: { $gte: minPosts },
            },
        },
        {
            $addFields: {
                avgEngagementRate: {
                    $cond: {
                        if: { $gt: ['$totalImpressions', 0] },
                        then: {
                            $round: [
                                { $divide: ['$totalEngagements', '$totalImpressions'] },
                                6,
                            ],
                        },
                        else: 0,
                    },
                },
            },
        },
        { $sort: { avgEngagementRate: -1 as const } },
        { $limit: topN },
    ];

    const results = await Post.aggregate(pipeline) as Array<{
        _id: { dayOfWeek: number; hour: number };
        postCount: number;
        avgEngagementRate: number;
    }>;

    return results.map((r) => ({
        dayOfWeek: r._id.dayOfWeek,
        hour: r._id.hour,
        avgEngagementRate: r.avgEngagementRate,
        postCount: r.postCount,
    }));
}

// ── US-304: Channel Comparison Metrics ────────────────────────

/**
 * Aggregates total metrics for a specific channel within a date range.
 */
export async function aggregateChannelComparisonMetrics(
    channelId: string,
    userId: string,
    startUtc: Date,
    endUtc: Date,
): Promise<{
    totalImpressions: number;
    totalEngagements: number;
    totalPosts: number;
    avgEngagementRate: number;
} | null> {
    const channelOid = new mongoose.Types.ObjectId(channelId);
    const userOid = new mongoose.Types.ObjectId(userId);

    const pipeline = [
        {
            $match: {
                channelId: channelOid,
                userId: userOid,
                publishedAt: { $gte: startUtc, $lte: endUtc },
            },
        },
        {
            $group: {
                _id: null,
                totalImpressions: { $sum: '$metrics.impressions' },
                totalEngagements: { $sum: '$metrics.engagements' },
                totalPosts: { $sum: 1 },
            },
        },
    ];

    const results = await Post.aggregate(pipeline) as Array<{
        totalImpressions: number;
        totalEngagements: number;
        totalPosts: number;
    }>;

    const row = results[0];
    if (!row) return null;

    const avgEngagementRate =
        row.totalImpressions > 0
            ? parseFloat((row.totalEngagements / row.totalImpressions).toFixed(6))
            : 0;

    return {
        totalImpressions: row.totalImpressions,
        totalEngagements: row.totalEngagements,
        totalPosts: row.totalPosts,
        avgEngagementRate,
    };
}