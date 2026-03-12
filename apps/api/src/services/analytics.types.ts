export interface PeriodMetrics {
    totalImpressions: number;
    totalEngagements: number;
    totalPosts: number;
    avgEngagementRate: number;
}

export interface ChangeMetrics {
    impressionsChangePct: number | null;
    engagementsChangePct: number | null;
    postsChangePct: number | null;
    avgEngagementRateChangePct: number | null;
}

export interface TimeSeriesEntry {
    date: string;
    impressions: number;
    engagements: number;
    posts: number;
}

export interface PlatformBreakdownEntry {
    platform: string;
    totalImpressions: number;
    totalEngagements: number;
    totalPosts: number;
    avgEngagementRate: number;
    followerCount: number;
}

export interface TopPostEntry {
    id: string;
    platform: string;
    content: string;
    postType: string;
    impressions: number;
    engagements: number;
    engagementRate: number;
    publishedAt: string;
}

export interface AnalyticsOverviewResponse {
    currentPeriod: PeriodMetrics;
    previousPeriod: PeriodMetrics;
    changes: ChangeMetrics;
    timeSeries: TimeSeriesEntry[];
    platformBreakdown: PlatformBreakdownEntry[];
    topPosts: TopPostEntry[];
}

export interface ContentBreakdownEntry {
    postType: string;
    count: number;
    totalImpressions: number;
    totalEngagements: number;
}

export interface PostingTimeEntry {
    hour: number;
    count: number;
}

export interface ChannelDetailAnalyticsResponse {
    channel: {
        id: string;
        platform: string;
        displayName: string;
        handle: string;
        followerCount: number;
        syncStatus: string;
        lastSyncedAt: Date | null;
        createdAt: Date;
    };
    timeSeries: TimeSeriesEntry[];
    contentBreakdown: ContentBreakdownEntry[];
    postingTimes: PostingTimeEntry[];
}

// ── US-301: Per-Channel Time Series with Granularity ──

export type Granularity = 'daily' | 'weekly' | 'monthly';

export interface ChannelTimeSeriesResponse {
    channelId: string;
    granularity: Granularity;
    timeSeries: TimeSeriesEntry[];
}

// ── US-302: Content Type Performance Breakdown ──

export interface ContentTypePerformanceEntry {
    postType: string;
    postCount: number;
    avgImpressions: number;
    avgEngagements: number;
    avgEngagementRate: number;
}

export interface ContentTypeBreakdownResponse {
    channelId: string;
    contentTypeBreakdown: ContentTypePerformanceEntry[];
}

// ── US-303: Best Posting Times ──

export interface BestPostingTimeEntry {
    dayOfWeek: number;
    hour: number;
    avgEngagementRate: number;
    postCount: number;
}

export interface BestPostingTimesResponse {
    channelId: string;
    bestPostingTimes: BestPostingTimeEntry[];
}

// ── US-304: Channel Comparison ──

export interface ComparisonChannelMetrics {
    channelId: string;
    platform: string;
    displayName: string;
    totalImpressions: number;
    totalEngagements: number;
    totalPosts: number;
    avgEngagementRate: number;
}

export interface ComparisonWinners {
    totalImpressions: string;
    totalEngagements: string;
    avgEngagementRate: string;
    totalPosts: string;
}

export interface ChannelComparisonResponse {
    channels: ComparisonChannelMetrics[];
    winners: ComparisonWinners;
}
