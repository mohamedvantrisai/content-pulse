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

  # ── US-301/302/303/304: Channel Analytics Types ──

  enum Granularity {
    daily
    weekly
    monthly
  }

  type ChannelTimeSeries {
    channelId: ID!
    granularity: String!
    timeSeries: [TimeSeriesEntry!]!
  }

  type ContentTypePerformanceEntry {
    postType: String!
    postCount: Int!
    avgImpressions: Float!
    avgEngagements: Float!
    avgEngagementRate: Float!
  }

  type ContentTypeBreakdownResult {
    channelId: ID!
    contentTypeBreakdown: [ContentTypePerformanceEntry!]!
  }

  type BestPostingTimeEntry {
    dayOfWeek: Int!
    hour: Int!
    avgEngagementRate: Float!
    postCount: Int!
  }

  type BestPostingTimesResult {
    channelId: ID!
    bestPostingTimes: [BestPostingTimeEntry!]!
  }

  type ComparisonChannelMetrics {
    channelId: ID!
    platform: String!
    displayName: String!
    totalImpressions: Int!
    totalEngagements: Int!
    totalPosts: Int!
    avgEngagementRate: Float!
  }

  type ComparisonWinners {
    totalImpressions: ID!
    totalEngagements: ID!
    avgEngagementRate: ID!
    totalPosts: ID!
  }

  type ChannelComparison {
    channels: [ComparisonChannelMetrics!]!
    winners: ComparisonWinners!
  }

  extend type Query {
    analyticsOverview(start: String, end: String): AnalyticsOverview!
    channelAnalytics(channelId: ID!, period: AnalyticsPeriod!): [ChannelAnalytics!]!
    platformBreakdown: [PlatformBreakdown!]!
    timeSeries(metric: String!, from: String, to: String): [TimeSeriesPoint!]!
    channelTimeSeries(channelId: ID!, start: String!, end: String!, granularity: Granularity): ChannelTimeSeries!
    contentTypeBreakdown(channelId: ID!, start: String!, end: String!): ContentTypeBreakdownResult!
    bestPostingTimes(channelId: ID!, start: String!, end: String!): BestPostingTimesResult!
    compareChannels(channelIds: [ID!]!, start: String!, end: String!): ChannelComparison!
  }
`;
