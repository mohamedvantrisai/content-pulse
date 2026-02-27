export const analyticsTypeDefs = `#graphql
  type AnalyticsOverview {
    totalViews: Int!
    totalEngagement: Int!
    topChannel: String!
  }

  type ChannelAnalytics {
    channelId: ID!
    platform: String!
    period: String!
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
    platform: String!
    totalImpressions: Int!
    totalEngagements: Int!
    engagementRate: Float!
  }

  type TimeSeriesPoint {
    date: String!
    value: Float!
  }

  extend type Query {
    analyticsOverview: AnalyticsOverview!
    channelAnalytics(channelId: ID!, period: String!): [ChannelAnalytics!]!
    platformBreakdown: [PlatformBreakdown!]!
    timeSeries(metric: String!, from: String, to: String): [TimeSeriesPoint!]!
  }
`;
