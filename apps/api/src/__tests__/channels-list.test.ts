import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { Channel } from '../models/Channel';
import { encrypt } from '../utils/encryption';

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
const TEST_USER_ID = '64a1f0b0c1d2e3f4a5b6c7d8';
const OTHER_USER_ID = '64a1f0b0c1d2e3f4a5b6c7d9';
const VALID_TOKEN = jwt.sign({ sub: TEST_USER_ID }, JWT_SECRET, { expiresIn: '1h' });
const AUTH_HEADER = `Bearer ${VALID_TOKEN}`;

jest.mock('../lib/logger', () => ({
    logger: {
        fatal: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
    },
}));

jest.mock('../config/env', () => ({
    env: {
        PORT: 4000,
        NODE_ENV: 'test',
        MONGODB_URI: 'mongodb://localhost:27017/test',
        REDIS_URL: '',
        JWT_SECRET,
        ENCRYPTION_KEY: process.env['ENCRYPTION_KEY'] ?? '32bd3bb9b3313b9f259f7c8d6c9221f3829c828cf31668f85145e3f0a47b9882',
        LOG_LEVEL: 'fatal',
        CORS_ORIGINS: 'http://localhost:5173',
        META_CLIENT_ID: 'test-meta-client-id',
        META_CLIENT_SECRET: 'test-meta-client-secret',
        META_REDIRECT_URI: 'http://localhost:4000/api/v1/channels/instagram/callback',
        DASHBOARD_URL: 'http://localhost:5173',
        LINKEDIN_CLIENT_ID: 'test-linkedin-client-id',
        LINKEDIN_CLIENT_SECRET: 'test-linkedin-client-secret',
        LINKEDIN_REDIRECT_URI: 'http://localhost:4000/api/v1/channels/linkedin/callback',
    },
}));

jest.mock('../services/health.service', () => ({
    checkHealth: jest.fn().mockResolvedValue({
        status: 'healthy',
        database: 'connected',
        redis: 'not configured',
        uptime: 1,
        timestamp: new Date().toISOString(),
    }),
}));

async function seedChannel(overrides: Partial<{
    userId: string;
    platform: string;
    platformAccountId: string;
    displayName: string;
    handle: string;
    accessToken: string;
    syncStatus: string;
    followerCount: number;
    lastSyncedAt: Date;
}> = {}) {
    return Channel.create({
        userId: new mongoose.Types.ObjectId(overrides.userId ?? TEST_USER_ID),
        platform: overrides.platform ?? 'instagram',
        platformAccountId: overrides.platformAccountId ?? `acct_${Date.now()}`,
        displayName: overrides.displayName ?? 'Test Channel',
        handle: overrides.handle ?? 'testhandle',
        accessToken: encrypt(overrides.accessToken ?? 'raw-token-value'),
        syncStatus: overrides.syncStatus ?? 'active',
        followerCount: overrides.followerCount ?? 100,
        lastSyncedAt: overrides.lastSyncedAt ?? new Date(),
    });
}

let app: Express;

beforeAll(async () => {
    const { createApp } = await import('../app');
    app = await createApp({ redisClient: null });
});

// ─── TC-B1: Two channels → response length 2 ──────────────

describe('TC-B1: List channels returns correct count', () => {
    it('returns 2 channels when user has 2 connected', async () => {
        await seedChannel({ platform: 'instagram', platformAccountId: 'ig_001' });
        await seedChannel({ platform: 'linkedin', platformAccountId: 'li_001' });

        const res = await request(app)
            .get('/api/v1/channels')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
    });

    it('does not return channels belonging to other users', async () => {
        await seedChannel({ userId: TEST_USER_ID, platformAccountId: 'ig_mine' });
        await seedChannel({ userId: OTHER_USER_ID, platformAccountId: 'ig_theirs' });

        const res = await request(app)
            .get('/api/v1/channels')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].displayName).toBe('Test Channel');
    });
});

// ─── TC-B2: All expected fields present ────────────────────

describe('TC-B2: Response shape', () => {
    it('each channel includes exactly the expected fields', async () => {
        await seedChannel({
            platform: 'linkedin',
            platformAccountId: 'li_shape',
            displayName: 'My LinkedIn',
            handle: 'user@example.com',
            followerCount: 500,
            syncStatus: 'active',
            lastSyncedAt: new Date('2025-06-01T00:00:00Z'),
        });

        const res = await request(app)
            .get('/api/v1/channels')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
        const channel = res.body.data[0];

        expect(channel).toHaveProperty('id');
        expect(channel).toHaveProperty('platform', 'linkedin');
        expect(channel).toHaveProperty('displayName', 'My LinkedIn');
        expect(channel).toHaveProperty('handle', 'user@example.com');
        expect(channel).toHaveProperty('followerCount', 500);
        expect(channel).toHaveProperty('syncStatus', 'active');
        expect(channel).toHaveProperty('lastSyncedAt');
        expect(channel).toHaveProperty('createdAt');
    });
});

// ─── TC-B3: No tokens in response ─────────────────────────

describe('TC-B3: Token stripping', () => {
    it('never includes accessToken, refreshToken, or tokenExpiresAt in response', async () => {
        await seedChannel({ platformAccountId: 'ig_tokens' });

        const res = await request(app)
            .get('/api/v1/channels')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
        const channel = res.body.data[0];

        expect(channel).not.toHaveProperty('accessToken');
        expect(channel).not.toHaveProperty('refreshToken');
        expect(channel).not.toHaveProperty('tokenExpiresAt');
        expect(channel).not.toHaveProperty('__v');
    });
});

// ─── TC-B4: Zero channels → empty array + 200 ─────────────

describe('TC-B4: Empty state', () => {
    it('returns [] with HTTP 200 when user has 0 channels', async () => {
        const res = await request(app)
            .get('/api/v1/channels')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
    });
});

// ─── TC-B5: No auth → 401 ─────────────────────────────────

describe('TC-B5: Authentication required', () => {
    it('returns 401 when no Authorization header is provided', async () => {
        const res = await request(app)
            .get('/api/v1/channels');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
});
