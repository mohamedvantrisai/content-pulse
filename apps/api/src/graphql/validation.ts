import { GraphQLError } from 'graphql';
import type { ZodSchema, ZodError } from 'zod';
import type { GraphQLContext } from './context.js';

/**
 * Validates GraphQL resolver arguments against a Zod schema.
 * Throws a GraphQLError with VALIDATION_ERROR code and structured details on failure.
 * Shared across all domain resolvers to eliminate copy-paste validation logic.
 */
export function validateArgs<T>(schema: ZodSchema<T>, args: unknown): T {
    const result = schema.safeParse(args);
    if (!result.success) {
        throw createValidationError(result.error);
    }
    return result.data;
}

/**
 * Enforces that the request has a verified authenticated user in context.
 * Must be called at the top of every resolver that accesses protected data.
 * Throws UNAUTHENTICATED if ctx.user is null (invalid/missing JWT).
 */
export function requireAuth(ctx: GraphQLContext): void {
    if (!ctx.user) {
        throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
        });
    }
}

function createValidationError(error: ZodError): GraphQLError {
    return new GraphQLError('Invalid input', {
        extensions: {
            code: 'VALIDATION_ERROR',
            validationErrors: error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
            })),
        },
    });
}
