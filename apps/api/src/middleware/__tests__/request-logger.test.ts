import express from 'express';
import request from 'supertest';
import pino from 'pino';
import { correlationMiddleware } from '../correlation.js';
import { requestLogger } from '../request-logger.js';
import { asyncLocalStorage } from '../../lib/async-context.js';

jest.mock('../../config/env.js', () => ({
    env: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'info',
        PORT: 4000,
        CORS_ORIGINS: '*',
        MONGODB_URI: 'mongodb://localhost:27017/test',
        JWT_SECRET: 'a'.repeat(32),
        ENCRYPTION_KEY: 'a'.repeat(64),
        REDIS_URL: '',
    },
}));

const logOutput: string[] = [];

jest.mock('../../lib/logger.js', () => {
    const { getCorrelationId } = require('../../lib/async-context');
    const stream = {
        write(msg: string) {
            logOutput.push(msg);
        },
    };
    const testLogger = pino({
        level: 'info',
        mixin() {
            const correlationId = getCorrelationId();
            return correlationId ? { correlationId } : {};
        },
    }, stream);
    return { logger: testLogger };
});

function createTestApp() {
    const app = express();

    app.use(correlationMiddleware);
    app.use(requestLogger);

    app.get('/test', (_req, res) => {
        res.json({ ok: true });
    });

    app.get('/slow', async (_req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        res.json({ ok: true });
    });

    return app;
}

describe('requestLogger', () => {
    beforeEach(() => {
        logOutput.length = 0;
    });

    it('TC-3: logs contain correlationId for request', async () => {
        const app = createTestApp();

        await request(app)
            .get('/test')
            .set('X-Request-ID', 'log-trace-789');

        const entries = logOutput.map((line) => JSON.parse(line));
        const withCorrelation = entries.filter((e) => e.correlationId === 'log-trace-789');

        expect(withCorrelation.length).toBeGreaterThanOrEqual(1);
    });

    it('TC-4: completion log has method, path, statusCode, durationMs', async () => {
        const app = createTestApp();

        await request(app).get('/test');

        const entries = logOutput.map((line) => JSON.parse(line));
        const completionLog = entries.find((e) => e.msg === 'request completed');

        expect(completionLog).toBeDefined();
        expect(completionLog.method).toBe('GET');
        expect(completionLog.path).toBe('/test');
        expect(completionLog.statusCode).toBe(200);
        expect(typeof completionLog.durationMs).toBe('number');
        expect(completionLog.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('durationMs reflects actual request duration', async () => {
        const app = createTestApp();

        await request(app).get('/slow');

        const entries = logOutput.map((line) => JSON.parse(line));
        const completionLog = entries.find((e) => e.msg === 'request completed');

        expect(completionLog).toBeDefined();
        expect(completionLog.durationMs).toBeGreaterThanOrEqual(40);
    });

    it('request started log includes method and path', async () => {
        const app = createTestApp();

        await request(app).get('/test');

        const entries = logOutput.map((line) => JSON.parse(line));
        const startLog = entries.find((e) => e.msg === 'request started');

        expect(startLog).toBeDefined();
        expect(startLog.method).toBe('GET');
        expect(startLog.path).toBe('/test');
    });
});
