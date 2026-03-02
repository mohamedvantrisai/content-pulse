/**
 * TC-3: Supertest integration test for GET /health.
 *
 * Uses the Express app instance directly (no port binding).
 * Relies on the global Jest setup for env vars, in-memory MongoDB,
 * and Redis disabled (redisClient: null).
 */

import request from 'supertest';
import { getTestApp } from '../test/app-helper.js';

let app: Awaited<ReturnType<typeof getTestApp>>;

beforeAll(async () => {
    app = await getTestApp();
});

describe('TC-3: GET /health integration', () => {
    it('returns 200 with healthy status', async () => {
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status', 'healthy');
    });

    it('includes database, redis, uptime, and timestamp fields', async () => {
        const res = await request(app).get('/health');

        expect(res.body).toHaveProperty('database', 'connected');
        expect(res.body).toHaveProperty('redis', 'not configured');
        expect(res.body).toHaveProperty('uptime');
        expect(res.body).toHaveProperty('timestamp');
        expect(typeof res.body.uptime).toBe('number');
        expect(typeof res.body.timestamp).toBe('string');
    });

    it('response has x-request-id header', async () => {
        const res = await request(app).get('/health');

        expect(res.headers['x-request-id']).toBeDefined();
        expect(typeof res.headers['x-request-id']).toBe('string');
    });
});
