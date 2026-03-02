import mongoose from 'mongoose';
import { Post } from '../models/Post.js';
import { Channel } from '../models/Channel.js';
import type {
    PeriodMetrics,
    TimeSeriesEntry,
    PlatformBreakdownEntry,
    TopPostEntry,
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
