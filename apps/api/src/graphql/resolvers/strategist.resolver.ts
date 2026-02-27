import { getStrategyBrief } from '../../services/strategist.service.js';
import type { GraphQLContext } from '../context.js';
import { requireAuth } from '../validation.js';

export const strategistResolvers = {
    Query: {
        contentBrief: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
            requireAuth(ctx);
            return getStrategyBrief();
        },
    },
};
