import { analyticsResolvers } from './analytics.resolver.js';
import { channelResolvers } from './channel.resolver.js';
import { strategistResolvers } from './strategist.resolver.js';

/**
 * Merges domain resolver maps into a single resolver object.
 * Each domain module contributes its Query (and optionally field) resolvers.
 */
export const resolvers = {
    Query: {
        ...analyticsResolvers.Query,
        ...channelResolvers.Query,
        ...strategistResolvers.Query,
    },
};
