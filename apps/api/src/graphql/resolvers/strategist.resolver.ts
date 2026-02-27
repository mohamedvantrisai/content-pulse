import { getStrategyBrief } from '../../services/strategist.service.js';
import type { GraphQLContext } from '../context.js';

export const strategistResolvers = {
    Query: {
        contentBrief: (_parent: unknown, _args: unknown, _ctx: GraphQLContext) => {
            return getStrategyBrief();
        },
    },
};
