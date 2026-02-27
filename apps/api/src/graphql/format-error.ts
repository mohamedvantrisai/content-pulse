import type { GraphQLFormattedError } from 'graphql';
import type { ApolloServerOptions } from '@apollo/server';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { errorResponse } from '../utils/response.js';

const CLIENT_ERROR_CODES = new Set([
    'GRAPHQL_PARSE_FAILED',
    'GRAPHQL_VALIDATION_FAILED',
    'BAD_USER_INPUT',
    'VALIDATION_ERROR',
]);

/**
 * Apollo formatError that produces the same { error: { code, message, details } }
 * envelope used by the REST error handler (errorResponse from utils/response.ts).
 * Client errors (validation, parse, bad input) log at warn level.
 * Server errors log at the error level and suppress messages in production.
 */
export const formatError: ApolloServerOptions<object>['formatError'] = (
    formattedError: GraphQLFormattedError,
    error: unknown,
) => {
    const code = (formattedError.extensions?.['code'] as string) ?? 'INTERNAL_SERVER_ERROR';
    const message = code === 'INTERNAL_SERVER_ERROR' && env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : formattedError.message;

    const details: unknown[] = [];

    if (formattedError.extensions?.['validationErrors']) {
        details.push(
            ...(formattedError.extensions['validationErrors'] as unknown[]),
        );
    }

    if (formattedError.locations) {
        details.push({ locations: formattedError.locations });
    }

    const logPayload = {
        graphqlCode: code,
        message: formattedError.message,
        path: formattedError.path,
        ...(env.NODE_ENV !== 'production' && { originalError: error }),
    };

    if (CLIENT_ERROR_CODES.has(code)) {
        logger.warn(logPayload, 'graphql client error');
    } else {
        logger.error(logPayload, 'graphql server error');
    }

    const envelope = errorResponse(code, message, details);

    return {
        message,
        extensions: { ...envelope },
    };
};
