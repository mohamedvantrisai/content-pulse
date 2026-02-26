import express, { type RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { correlationMiddleware, requestLogger } from './middleware/index.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';
import { typeDefs, resolvers } from './graphql/schema.js';
import v1Router from './rest/routes/v1/index.js';

export interface AppContext {
    redisStatus: () => string;
}

export async function createApp(deps?: { redisStatus?: () => string }): Promise<express.Express> {
    const app = express();

    const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

    app.use(correlationMiddleware);
    app.use(requestLogger);
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
    app.use(express.json({ limit: '1mb' }));

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

    app.use('/api/v1', v1Router);

    const apollo = new ApolloServer({ typeDefs, resolvers });
    await apollo.start();
    app.use(
        '/graphql',
        express.json(),
        expressMiddleware(apollo, {
            context: async () => ({}),
        }) as unknown as RequestHandler,
    );

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
