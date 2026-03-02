export const analyticsTypeDefs = `#graphql
  type PeriodMetrics {
    totalImpressions: Int!
    totalEngagements: Int!
    totalPosts: Int!
    avgEngagementRate: Float!
  }

  type ChangeMetrics {
    impressionsChangePct: Float
    engagementsChangePct: Float
    postsChangePct: Float
    avgEngagementRateChangePct: Float
  }

  type TimeSeriesEntry {
    date: String!
    impressions: Int!
    engagements: Int!
    posts: Int!
  }

  type PlatformBreakdownEntry {
    platform: String!
    totalImpressions: Int!
    totalEngagements: Int!
    totalPosts: Int!
    avgEngagementRate: Float!
    followerCount: Int!
  }

  type TopPostEntry {
    id: ID!
    platform: String!
    content: String!
    postType: String!
    impressions: Int!
    engagements: Int!
    engagementRate: Float!
    publishedAt: String!
  }

  type AnalyticsOverview {
    currentPeriod: PeriodMetrics!
    previousPeriod: PeriodMetrics!
    changes: ChangeMetrics!
    timeSeries: [TimeSeriesEntry!]!
    platformBreakdown: [PlatformBreakdownEntry!]!
    topPosts: [TopPostEntry!]!
  }

  type ChannelAnalytics {
    channelId: ID!
    platform: Platform!
    period: AnalyticsPeriod!
    date: String!
    metrics: SnapshotMetrics!
  }

  type SnapshotMetrics {
    totalPosts: Int!
    totalImpressions: Int!
    totalReach: Int!
    totalEngagements: Int!
    engagementRate: Float!
    followerGrowth: Int!
    bestPostingHour: Int
    bestPostingDay: Int
  }

  type PlatformBreakdown {
    platform: Platform!
    totalImpressions: Int!
    totalEngagements: Int!
    engagementRate: Float!
  }

  type TimeSeriesPoint {
    date: String!
    value: Float!
  }

  extend type Query {
    analyticsOverview(start: String, end: String): AnalyticsOverview!
    channelAnalytics(channelId: ID!, period: AnalyticsPeriod!): [ChannelAnalytics!]!
    platformBreakdown: [PlatformBreakdown!]!
    timeSeries(metric: String!, from: String, to: String): [TimeSeriesPoint!]!
  }
`;
