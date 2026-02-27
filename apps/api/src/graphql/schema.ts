import { typeDefs as schemaTypeDefs } from './typeDefs/index.js';
import { resolvers as domainResolvers } from './resolvers/index.js';

export const typeDefs = schemaTypeDefs;

export const resolvers = {
    Query: {
        health: (): { status: string; timestamp: string } => ({
            status: 'ok',
            timestamp: new Date().toISOString(),
        }),
        ...domainResolvers.Query,
    },
};
