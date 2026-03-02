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
