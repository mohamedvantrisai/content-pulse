import express, { type RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { env } from './config/env.js';
import { type RedisClient } from './config/redis.js';
import { correlationMiddleware, requestLogger } from './middleware/index.js';
import { authMiddleware } from './middleware/auth.js';
import { scopeValidator } from './middleware/scope-validator.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';
import { typeDefs, resolvers } from './graphql/schema.js';
import { buildContext, type GraphQLContext } from './graphql/context.js';
import { formatError } from './graphql/format-error.js';
import v1Router from './rest/routes/v1/index.js';
import { checkHealth } from './services/health.service.js';

export interface AppContext {
    redisClient?: RedisClient;
}

export async function createApp(deps?: { redisClient?: RedisClient }): Promise<express.Express> {
    const app = express();

    const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
    if (env.NODE_ENV !== 'production') {
        allowedOrigins.push(
            'https://studio.apollographql.com',
            'https://sandbox.embed.apollographql.com',
        );
    }

    const isProduction = env.NODE_ENV === 'production';

    /* ──────────────────────────────────────────────
     * Middleware execution order (AC-3):
     *  1. correlationId
     *  2. requestLogger
     *  3. CORS
     *  4. JSON parser (1 MB limit)
     *  5. auth middleware ── on /api/v1 and /graphql
     *  6. scopeValidator ── on /api/v1 and /graphql
     *  7. rateLimiter ── on /api/v1 and /graphql
     *  8. route handler
     *  9. errorHandler (global)
     * ────────────────────────────────────────────── */

    // 1. correlationId
    app.use(correlationMiddleware);

    // 2. requestLogger
    app.use(requestLogger);

    // 3. CORS
    app.use(
        helmet({
            contentSecurityPolicy: isProduction
                ? undefined
                : {
                      directives: {
                          defaultSrc: ["'self'"],
                          scriptSrc: ["'self'", "'unsafe-inline'", 'https://embeddable-sandbox.cdn.apollographql.com'],
                          frameSrc: ["'self'", 'https://sandbox.embed.apollographql.com'],
                          connectSrc: ["'self'", 'https://*.apollographql.com'],
                          imgSrc: ["'self'", 'data:', 'https://apollo-server-landing-page.cdn.apollographql.com'],
                          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                      },
                  },
            crossOriginEmbedderPolicy: isProduction,
        }),
    );
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
    app.get('/health', async (_req, res) => {
        const result = await checkHealth(deps?.redisClient ?? null);
        const statusCode = result.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(result);
    });

    const apollo = new ApolloServer<GraphQLContext>({
        typeDefs,
        resolvers,
        formatError,
        introspection: !isProduction,
    });
    await apollo.start();

    // 5–8. route handlers
    // POST /graphql: auth is handled at the resolver level via requireAuth(ctx).
    // buildContext extracts the JWT user when present, resolvers enforce access.
    app.post(
        '/graphql',
        express.json(),
        rateLimiter,
        expressMiddleware(apollo, {
            context: buildContext,
        }) as unknown as RequestHandler,
    );
    // GET /graphql: Apollo Sandbox landing page only (non-production).
    // No expressMiddleware — prevents query execution via GET transport.
    if (!isProduction) {
        app.get('/graphql', (_req, res) => {
            res.type('html').send(
                `<!DOCTYPE html>
<html><head><title>Apollo Sandbox</title></head>
<body style="margin:0;overflow:hidden">
<div style="width:100vw;height:100vh" id="sandbox"></div>
<script src="https://embeddable-sandbox.cdn.apollographql.com/_latest/embeddable-sandbox.umd.production.min.js"></script>
<script>new window.EmbeddedSandbox({ target:'#sandbox', initialEndpoint:window.location.href });</script>
</body></html>`,
            );
        });
    }

    app.use('/api/v1', authMiddleware, scopeValidator, rateLimiter, v1Router);

    // 9. errorHandler (global)
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
