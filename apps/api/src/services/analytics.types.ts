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
