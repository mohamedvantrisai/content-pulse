import type { ExpressContextFunctionArgument } from '@apollo/server/express4';
import { getCorrelationId } from '../lib/async-context.js';

export interface GraphQLContext {
    correlationId: string | undefined;
    user: { id: string; token: string } | null;
}

/**
 * Builds the GraphQL context from the incoming Express request.
 * Injects correlationId from AsyncLocalStorage and authenticated user if present.
 */
export async function buildContext({ req }: ExpressContextFunctionArgument): Promise<GraphQLContext> {
    const correlationId = getCorrelationId();

    let user: GraphQLContext['user'] = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        if (token) {
            user = { id: 'authenticated-user', token };
        }
    }

    return { correlationId, user };
}
