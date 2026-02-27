export const typeDefs = `#graphql
  type Query {
    health: HealthStatus!
  }

  type HealthStatus {
    status: String!
    timestamp: String!
  }
`;

export const resolvers = {
    Query: {
        health: (): { status: string; timestamp: string } => ({
            status: 'ok',
            timestamp: new Date().toISOString(),
        }),
    },
};
