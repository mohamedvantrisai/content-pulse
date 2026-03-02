import { logger } from '../lib/logger.js';
import type {
    AnalyticsOverviewResponse,
    ChangeMetrics,
    PeriodMetrics,
    TimeSeriesEntry,
} from './analytics.types.js';
import {
    aggregatePeriodMetrics,
    aggregateTimeSeries,
    aggregatePlatformBreakdown,
    aggregateTopPosts,
} from './analytics.repository.js';

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
 * Single-source-of-truth (AC-X1): currentPeriod totals are derived by
 * summing the timeSeries results, ensuring consistency.
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
