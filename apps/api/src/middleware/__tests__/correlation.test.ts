import express from 'express';
import request from 'supertest';
import { correlationMiddleware } from '../correlation.js';
import { requestLogger } from '../request-logger.js';
import { asyncLocalStorage, getCorrelationId } from '../../lib/async-context.js';

jest.mock('../../config/env.js', () => ({
    env: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        PORT: 4000,
        CORS_ORIGINS: '*',
        MONGODB_URI: 'mongodb://localhost:27017/test',
        JWT_SECRET: 'a'.repeat(32),
        ENCRYPTION_KEY: 'a'.repeat(64),
        REDIS_URL: '',
    },
}));

function createTestApp() {
    const logs: Record<string, unknown>[] = [];
    const app = express();

    app.use(correlationMiddleware);
    app.use(requestLogger);

    app.get('/test', (_req, res) => {
        const id = getCorrelationId();
        res.json({ correlationId: id });
    });

    app.get('/async-test', async (_req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const id = getCorrelationId();
        res.json({ correlationId: id });
    });

    return { app, logs };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('correlationMiddleware', () => {
    it('TC-1: generates UUID and sets X-Request-ID response header when none sent', async () => {
        const { app } = createTestApp();

        const res = await request(app).get('/test');

        const header = res.headers['x-request-id'];
        expect(header).toBeDefined();
        expect(header).toMatch(UUID_REGEX);
        expect(res.body.correlationId).toBe(header);
    });

    it('TC-2: preserves incoming X-Request-ID header and echoes it back', async () => {
        const { app } = createTestApp();

        const res = await request(app)
            .get('/test')
            .set('X-Request-ID', 'my-trace-123');

        expect(res.headers['x-request-id']).toBe('my-trace-123');
        expect(res.body.correlationId).toBe('my-trace-123');
    });

    it('correlation ID is available inside async/await handlers', async () => {
        const { app } = createTestApp();

        const res = await request(app)
            .get('/async-test')
            .set('X-Request-ID', 'async-trace-456');

        expect(res.body.correlationId).toBe('async-trace-456');
    });

    it('parallel requests maintain isolated correlation IDs', async () => {
        const { app } = createTestApp();

        const [res1, res2, res3] = await Promise.all([
            request(app).get('/test').set('X-Request-ID', 'req-1'),
            request(app).get('/test').set('X-Request-ID', 'req-2'),
            request(app).get('/test').set('X-Request-ID', 'req-3'),
        ]);

        expect(res1.body.correlationId).toBe('req-1');
        expect(res2.body.correlationId).toBe('req-2');
        expect(res3.body.correlationId).toBe('req-3');
    });

    it('context is undefined outside of request lifecycle', () => {
        const id = getCorrelationId();
        expect(id).toBeUndefined();
    });
});

describe('asyncLocalStorage', () => {
    it('run() creates isolated context accessible via getCorrelationId()', () => {
        asyncLocalStorage.run({ correlationId: 'ctx-test', startTime: Date.now() }, () => {
            expect(getCorrelationId()).toBe('ctx-test');
        });
    });

    it('nested async operations preserve context', async () => {
        await asyncLocalStorage.run(
            { correlationId: 'nested-test', startTime: Date.now() },
            async () => {
                await new Promise((resolve) => setTimeout(resolve, 5));
                expect(getCorrelationId()).toBe('nested-test');

                await Promise.all([
                    new Promise<void>((resolve) => {
                        expect(getCorrelationId()).toBe('nested-test');
                        resolve();
                    }),
                    new Promise<void>((resolve) => {
                        expect(getCorrelationId()).toBe('nested-test');
                        resolve();
                    }),
                ]);
            },
        );
    });
});
