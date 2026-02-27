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

const AUTH_HEADER = 'Bearer test-token';

beforeAll(async () => {
    const { createApp } = await import('../app.js');
    app = await createApp({ redisStatus: () => 'ready' });
});

describe('TC-1: All REST routes use /api/v1/ prefix', () => {
    it('GET /api/v1/status is reachable', async () => {
        const res = await request(app)
            .get('/api/v1/status')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
    });

    it('GET /api/v1/analytics/overview is reachable', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
    });

    it('GET /api/v1/channels is reachable', async () => {
        const res = await request(app)
            .get('/api/v1/channels')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
    });

    it('GET /api/v1/strategist/brief is reachable', async () => {
        const res = await request(app)
            .get('/api/v1/strategist/brief')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
    });

    it('GET /api/v1/apikeys is reachable', async () => {
        const res = await request(app)
            .get('/api/v1/apikeys')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
    });

    it('no REST route exists at root level (except /health and /graphql)', async () => {
        const res = await request(app).get('/analytics');
        expect(res.status).toBe(404);
    });
});

describe('TC-2: correlationId exists in request context', () => {
    it('response includes x-request-id header from correlation middleware', async () => {
        const res = await request(app)
            .get('/api/v1/status')
            .set('Authorization', AUTH_HEADER);

        const requestId = res.headers['x-request-id'] as string;
        expect(requestId).toBeDefined();
        expect(typeof requestId).toBe('string');
        expect(requestId.length).toBeGreaterThan(0);
    });

    it('echoes back a provided x-request-id', async () => {
        const customId = 'test-correlation-id-12345';
        const res = await request(app)
            .get('/api/v1/status')
            .set('Authorization', AUTH_HEADER)
            .set('x-request-id', customId);

        expect(res.headers['x-request-id']).toBe(customId);
    });
});

describe('TC-3: Malformed JSON returns structured error envelope', () => {
    it('returns 400 with error envelope for malformed JSON', async () => {
        const res = await request(app)
            .post('/api/v1/status')
            .set('Content-Type', 'application/json')
            .set('Authorization', AUTH_HEADER)
            .send('{invalid json}');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code');
        expect(res.body.error).toHaveProperty('message');
        expect(res.body.error).toHaveProperty('details');
    });
});

describe('TC-4: Each route file exports a Router imported into app.ts', () => {
    it('analytics routes module exports a Router', async () => {
        const mod = await import('../rest/routes/v1/analytics.routes.js');
        const router = mod.default as unknown as Record<string, unknown>;
        expect(router).toBeDefined();
        expect(typeof router.use).toBe('function');
        expect(typeof router.get).toBe('function');
    });

    it('channels routes module exports a Router', async () => {
        const mod = await import('../rest/routes/v1/channels.routes.js');
        const router = mod.default as unknown as Record<string, unknown>;
        expect(router).toBeDefined();
        expect(typeof router.use).toBe('function');
        expect(typeof router.get).toBe('function');
    });

    it('strategist routes module exports a Router', async () => {
        const mod = await import('../rest/routes/v1/strategist.routes.js');
        const router = mod.default as unknown as Record<string, unknown>;
        expect(router).toBeDefined();
        expect(typeof router.use).toBe('function');
        expect(typeof router.get).toBe('function');
    });

    it('apikeys routes module exports a Router', async () => {
        const mod = await import('../rest/routes/v1/apikeys.routes.js');
        const router = mod.default as unknown as Record<string, unknown>;
        expect(router).toBeDefined();
        expect(typeof router.use).toBe('function');
        expect(typeof router.get).toBe('function');
    });
});

describe('TC-5: Valid endpoint returns { data, meta } structure', () => {
    it('GET /api/v1/analytics/overview matches success envelope', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body.meta).toHaveProperty('generatedAt');
        expect(res.body.meta).toHaveProperty('cached');
        expect(typeof res.body.meta.generatedAt).toBe('string');
        expect(typeof res.body.meta.cached).toBe('boolean');
    });

    it('GET /api/v1/channels matches success envelope', async () => {
        const res = await request(app)
            .get('/api/v1/channels')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
    });

    it('GET /api/v1/status matches success envelope', async () => {
        const res = await request(app)
            .get('/api/v1/status')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
    });
});

describe('TC-6: Error response matches { error: { code, message } }', () => {
    it('404 returns structured error envelope', async () => {
        const res = await request(app)
            .get('/api/v1/nonexistent')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
        expect(res.body.error).toHaveProperty('message');
        expect(res.body.error).toHaveProperty('details');
        expect(res.body.error.message).toMatch(/Not Found/);
    });

    it('401 returns structured error envelope without auth header', async () => {
        const res = await request(app).get('/api/v1/analytics/overview');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
        expect(res.body.error).toHaveProperty('message');
        expect(res.body.error).toHaveProperty('details');
    });
});

describe('TC-7: X-Request-ID header exists in response', () => {
    it('health endpoint includes x-request-id', async () => {
        const res = await request(app).get('/health');

        expect(res.headers['x-request-id']).toBeDefined();
    });

    it('versioned REST endpoint includes x-request-id', async () => {
        const res = await request(app)
            .get('/api/v1/status')
            .set('Authorization', AUTH_HEADER);

        expect(res.headers['x-request-id']).toBeDefined();
    });

    it('error response includes x-request-id', async () => {
        const res = await request(app).get('/api/v1/nonexistent');

        expect(res.headers['x-request-id']).toBeDefined();
    });
});

describe('GET /health', () => {
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

describe('GraphQL /graphql', () => {
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

describe('CORS', () => {
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
