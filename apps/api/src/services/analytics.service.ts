export interface AnalyticsOverview {
    totalViews: number;
    totalEngagement: number;
    topChannel: string;
}

export function getAnalyticsOverview(): AnalyticsOverview {
    return {
        totalViews: 12500,
        totalEngagement: 3200,
        topChannel: 'twitter',
    };
}
