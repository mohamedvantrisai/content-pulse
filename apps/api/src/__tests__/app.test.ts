import request from 'supertest';
import type { Express } from 'express';

let app: Express;

jest.mock('../config/env.js', () => ({
    env: {
        PORT: 4000,
        NODE_ENV: 'test',
        MONGODB_URI: 'mongodb://localhost:27017/test',
        REDIS_URL: '',
        JWT_SECRET: 'a'.repeat(32),
        ENCRYPTION_KEY: 'a'.repeat(64),
        LOG_LEVEL: 'silent',
        CORS_ORIGINS: 'http://localhost:5173',
    },
}));

jest.mock('../lib/logger.js', () => ({
    logger: {
        fatal: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
    },
}));

beforeAll(async () => {
    const { createApp } = await import('../app.js');
    app = await createApp({ redisStatus: () => 'ready' });
});

describe('GET /health (TC-2)', () => {
    it('returns JSON with status, database, redis, uptime, timestamp', async () => {
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('database');
        expect(res.body).toHaveProperty('redis');
        expect(res.body).toHaveProperty('uptime');
        expect(res.body).toHaveProperty('timestamp');
        expect(typeof res.body.uptime).toBe('number');
        expect(typeof res.body.timestamp).toBe('string');
    });
});

describe('GET /graphql (TC-3)', () => {
    it('responds to { health } query with status and timestamp', async () => {
        const res = await request(app)
            .post('/graphql')
            .send({ query: '{ health { status timestamp } }' })
            .set('Content-Type', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.data.health).toHaveProperty('status', 'ok');
        expect(res.body.data.health).toHaveProperty('timestamp');
    });
});

describe('POST /api/v1/nonexistent (TC-4)', () => {
    it('returns 404 with structured JSON error', async () => {
        const res = await request(app).post('/api/v1/nonexistent');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
        expect(res.body.error).toHaveProperty('message');
        expect(res.body.error.message).toMatch(/Not Found/);
    });
});

describe('Malformed JSON body (TC-5)', () => {
    it('returns 400 with helpful error', async () => {
        const res = await request(app)
            .post('/api/v1/status')
            .set('Content-Type', 'application/json')
            .send('{invalid json}');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('message');
    });
});

describe('CORS (TC-6)', () => {
    it('allows configured origin', async () => {
        const res = await request(app)
            .get('/health')
            .set('Origin', 'http://localhost:5173');

        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('rejects unconfigured origin', async () => {
        const res = await request(app)
            .options('/health')
            .set('Origin', 'http://evil.com')
            .set('Access-Control-Request-Method', 'GET');

        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
});

describe('Unhandled error (TC-7)', () => {
    it('returns structured JSON error without stack trace', async () => {
        const res = await request(app).get('/api/v1/nonexistent');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code');
        expect(res.body.error).toHaveProperty('message');
        expect(res.body.error).not.toHaveProperty('stack');
    });
});
