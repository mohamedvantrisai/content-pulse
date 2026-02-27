export const channelTypeDefs = `#graphql
  type Channel {
    id: ID!
    name: String!
    platform: Platform!
  }

  type Post {
    id: ID!
    channelId: ID!
    platform: Platform!
    content: String!
    postType: PostType!
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
