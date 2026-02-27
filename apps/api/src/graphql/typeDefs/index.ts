import { analyticsTypeDefs } from './analytics.typeDefs.js';
import { channelTypeDefs } from './channel.typeDefs.js';
import { strategistTypeDefs } from './strategist.typeDefs.js';

const baseTypeDefs = `#graphql
  type Query {
    health: HealthStatus!
  }

  type HealthStatus {
    status: String!
    timestamp: String!
  }

  enum Platform {
    instagram
    linkedin
  }

  enum AnalyticsPeriod {
    daily
    weekly
    monthly
  }

  enum PostType {
    text
    image
    video
    link
    carousel
  }
`;

/**
 * Merged SDL string exported as a single schema definition.
 * Each domain module extends the Query type to add its own root fields.
 */
export const typeDefs = [
    baseTypeDefs,
    analyticsTypeDefs,
    channelTypeDefs,
    strategistTypeDefs,
];
