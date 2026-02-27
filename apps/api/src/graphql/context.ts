import type { ExpressContextFunctionArgument } from '@apollo/server/express4';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getCorrelationId } from '../lib/async-context.js';
import { logger } from '../lib/logger.js';

export interface AuthenticatedUser {
    id: string;
    email?: string;
}

export interface GraphQLContext {
    correlationId: string | undefined;
    user: AuthenticatedUser | null;
}

/**
 * Builds the GraphQL context from the incoming Express request.
 * Injects correlationId from AsyncLocalStorage and verified JWT user payload.
 * Token is verified — not merely shape-checked — and never retained in context.
 */
export async function buildContext({ req }: ExpressContextFunctionArgument): Promise<GraphQLContext> {
    const correlationId = getCorrelationId();

    let user: AuthenticatedUser | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        if (token) {
            try {
                const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
                user = {
                    id: decoded['sub'] as string ?? decoded['id'] as string ?? 'unknown',
                    ...(decoded['email'] && { email: decoded['email'] as string }),
                };
            } catch {
                logger.debug('invalid or expired JWT in GraphQL request');
            }
        }
    }

    return { correlationId, user };
}
