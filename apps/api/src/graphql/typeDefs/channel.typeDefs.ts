export const channelTypeDefs = `#graphql
  type Channel {
    id: ID!
    name: String!
    platform: String!
  }

  type Post {
    id: ID!
    channelId: ID!
    platform: String!
    content: String!
    postType: String!
    publishedAt: String!
    metrics: PostMetrics!
    engagementRate: Float!
  }

  type PostMetrics {
    impressions: Int!
    reach: Int!
    engagements: Int!
    likes: Int!
    comments: Int!
    shares: Int!
    clicks: Int!
    saves: Int!
  }

  extend type Query {
    channels: [Channel!]!
    channel(id: ID!): Channel
    posts(channelId: ID!): [Post!]!
  }
`;
