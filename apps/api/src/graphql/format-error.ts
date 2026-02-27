import type { GraphQLFormattedError } from 'graphql';
import type { ApolloServerOptions } from '@apollo/server';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

interface FormattedErrorEnvelope {
    message: string;
    extensions: {
        error: {
            code: string;
            message: string;
            details: unknown[];
        };
    };
}

/**
 * Apollo formatError implementation that produces a REST-compatible error envelope.
 * Suppresses stack traces in production. Maps Apollo error codes to application codes.
 */
export const formatError: ApolloServerOptions<object>['formatError'] = (
    formattedError: GraphQLFormattedError,
    error: unknown,
): FormattedErrorEnvelope => {
    const code = (formattedError.extensions?.['code'] as string) ?? 'INTERNAL_SERVER_ERROR';
    const message = code === 'INTERNAL_SERVER_ERROR' && env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : formattedError.message;

    const details: unknown[] = [];

    if (formattedError.extensions?.['validationErrors']) {
        (details as unknown[]).push(
            ...(formattedError.extensions['validationErrors'] as unknown[]),
        );
    }

    if (formattedError.locations) {
        details.push({ locations: formattedError.locations });
    }

    logger.error(
        {
            graphqlCode: code,
            message: formattedError.message,
            path: formattedError.path,
            ...(env.NODE_ENV !== 'production' && { originalError: error }),
        },
        'graphql error',
    );

    return {
        message,
        extensions: {
            error: {
                code,
                message,
                details,
            },
        },
    };
};
