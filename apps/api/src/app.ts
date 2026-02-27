import express, { type RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { correlationMiddleware, requestLogger } from './middleware/index.js';
import { authMiddleware } from './middleware/auth.js';
import { scopeValidator } from './middleware/scope-validator.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';
import { typeDefs, resolvers } from './graphql/schema.js';
import { buildContext, type GraphQLContext } from './graphql/context.js';
import { formatError } from './graphql/format-error.js';
import v1Router from './rest/routes/v1/index.js';

export interface AppContext {
    redisStatus: () => string;
}

export async function createApp(deps?: { redisStatus?: () => string }): Promise<express.Express> {
    const app = express();

    const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

    /* ──────────────────────────────────────────────
     * Middleware execution order (AC-3):
     *  1. correlationId
     *  2. requestLogger
     *  3. CORS
     *  4. JSON parser (1 MB limit)
     *  5. auth middleware        ── on /api/v1 only
     *  6. scopeValidator         ── on /api/v1 only
     *  7. rateLimiter            ── on /api/v1 only
     *  8. route handler
     *  9. errorHandler (global)
     * ────────────────────────────────────────────── */

    // 1. correlationId
    app.use(correlationMiddleware);

    // 2. requestLogger
    app.use(requestLogger);

    // 3. CORS
    app.use(helmet());
    app.use(
        cors({
            origin(origin, callback) {
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
        }),
    );

    // 4. JSON parser (1 MB limit)
    app.use(express.json({ limit: '1mb' }));

    // Routes outside versioning: /health, /graphql
    app.get('/health', (_req, res) => {
        const dbState = mongoose.connection.readyState;
        const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
        const redisStatus = deps?.redisStatus?.() ?? 'not configured';

        res.json({
            status: 'ok',
            database: dbStatus,
            redis: redisStatus,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    });

    const isProduction = env.NODE_ENV === 'production';
    const apollo = new ApolloServer<GraphQLContext>({
        typeDefs,
        resolvers,
        formatError,
        introspection: !isProduction,
    });
    await apollo.start();
    app.use(
        '/graphql',
        express.json(),
        expressMiddleware(apollo, {
            context: buildContext,
        }) as unknown as RequestHandler,
    );

    // 5–8. auth → scopeValidator → rateLimiter → route handlers (versioned REST only)
    app.use('/api/v1', authMiddleware, scopeValidator, rateLimiter, v1Router);

    // 9. errorHandler (global)
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
