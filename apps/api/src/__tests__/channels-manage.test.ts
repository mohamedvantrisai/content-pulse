import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { Channel } from '../models/Channel';
import { Post } from '../models/Post';
import { encrypt } from '../utils/encryption';
import { findChannelsForSync } from '../services/channels.service';

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
const TEST_USER_ID = '64a1f0b0c1d2e3f4a5b6c7d8';
const OTHER_USER_ID = '64a1f0b0c1d2e3f4a5b6c7d9';
const VALID_TOKEN = jwt.sign({ sub: TEST_USER_ID }, JWT_SECRET, { expiresIn: '1h' });
const AUTH_HEADER = `Bearer ${VALID_TOKEN}`;
const NON_EXISTENT_ID = '64a1f0b0c1d2e3f4a5b6c000';

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
        platformAccountId: overrides.platformAccountId ?? `acct_${Date.now()}_${Math.random()}`,
        displayName: overrides.displayName ?? 'Test Channel',
        handle: overrides.handle ?? 'testhandle',
        accessToken: encrypt(overrides.accessToken ?? 'raw-token-value'),
        syncStatus: overrides.syncStatus ?? 'active',
        followerCount: overrides.followerCount ?? 100,
        lastSyncedAt: overrides.lastSyncedAt ?? new Date(),
    });
}

async function seedPost(channelId: string, overrides: Partial<{
    userId: string;
    platform: string;
    publishedAt: Date;
    postType: string;
}> = {}) {
    return Post.create({
        channelId: new mongoose.Types.ObjectId(channelId),
        userId: new mongoose.Types.ObjectId(overrides.userId ?? TEST_USER_ID),
        platformPostId: `post_${Date.now()}_${Math.random()}`,
        platform: overrides.platform ?? 'instagram',
        content: 'Test post content',
        postType: overrides.postType ?? 'image',
        publishedAt: overrides.publishedAt ?? new Date(),
        metrics: {
            impressions: 1000,
            reach: 800,
            engagements: 100,
            likes: 50,
            comments: 20,
            shares: 15,
            clicks: 10,
            saves: 5,
        },
    });
}

let app: Express;

beforeAll(async () => {
    const { createApp } = await import('../app');
    app = await createApp({ redisClient: null });
});

// ─── Story A: Pause / Resume Sync ──────────────────────────

describe('TC-A1: PATCH paused → channel shows paused', () => {
    it('pauses an active channel', async () => {
        const ch = await seedChannel({ syncStatus: 'active' });

        const patchRes = await request(app)
            .patch(`/api/v1/channels/${ch._id}`)
            .set('Authorization', AUTH_HEADER)
            .send({ syncStatus: 'paused' });

        expect(patchRes.status).toBe(200);
        expect(patchRes.body.data.syncStatus).toBe('paused');

        const listRes = await request(app)
            .get('/api/v1/channels')
            .set('Authorization', AUTH_HEADER);

        const found = listRes.body.data.find((c: { id: string }) => c.id === ch._id.toString());
        expect(found).toBeDefined();
        expect(found.syncStatus).toBe('paused');
    });
});

describe('TC-A2: PATCH active → channel resumes', () => {
    it('resumes a paused channel', async () => {
        const ch = await seedChannel({ syncStatus: 'paused' });

        const patchRes = await request(app)
            .patch(`/api/v1/channels/${ch._id}`)
            .set('Authorization', AUTH_HEADER)
            .send({ syncStatus: 'active' });

        expect(patchRes.status).toBe(200);
        expect(patchRes.body.data.syncStatus).toBe('active');
    });
});

describe('TC-A3: PATCH invalid status → 400', () => {
    it('rejects inactive as a PATCH value', async () => {
        const ch = await seedChannel();

        const res = await request(app)
            .patch(`/api/v1/channels/${ch._id}`)
            .set('Authorization', AUTH_HEADER)
            .send({ syncStatus: 'inactive' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects bogus status value', async () => {
        const ch = await seedChannel();

        const res = await request(app)
            .patch(`/api/v1/channels/${ch._id}`)
            .set('Authorization', AUTH_HEADER)
            .send({ syncStatus: 'bogus' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
});

describe('TC-A4: Sync job query excludes paused channels', () => {
    it('findChannelsForSync returns only active channels', async () => {
        await seedChannel({ syncStatus: 'active', platformAccountId: 'sync_active' });
        await seedChannel({ syncStatus: 'paused', platformAccountId: 'sync_paused' });
        await seedChannel({ syncStatus: 'inactive', platformAccountId: 'sync_inactive' });
        await seedChannel({ syncStatus: 'error', platformAccountId: 'sync_error' });
        await seedChannel({ syncStatus: 'pending', platformAccountId: 'sync_pending' });

        const channels = await findChannelsForSync();

        expect(channels).toHaveLength(1);
        expect(channels[0]!.syncStatus).toBe('active');
    });
});

// ─── Story B: Disconnect Channel ───────────────────────────

describe('TC-B1: DELETE channel → gone from GET /channels', () => {
    it('soft-deletes and hides from list', async () => {
        const ch = await seedChannel({ platformAccountId: 'del_test' });

        const delRes = await request(app)
            .delete(`/api/v1/channels/${ch._id}`)
            .set('Authorization', AUTH_HEADER);

        expect(delRes.status).toBe(204);

        const listRes = await request(app)
            .get('/api/v1/channels')
            .set('Authorization', AUTH_HEADER);

        const ids = listRes.body.data.map((c: { id: string }) => c.id);
        expect(ids).not.toContain(ch._id.toString());

        const raw = await Channel.findById(ch._id);
        expect(raw).not.toBeNull();
        expect(raw!.syncStatus).toBe('inactive');
        expect(raw!.disconnectedAt).toBeInstanceOf(Date);
    });
});

describe('TC-B2: Posts for deleted channel still exist', () => {
    it('historical posts remain after disconnect', async () => {
        const ch = await seedChannel({ platformAccountId: 'post_persist' });
        await seedPost(ch._id.toString());

        await request(app)
            .delete(`/api/v1/channels/${ch._id}`)
            .set('Authorization', AUTH_HEADER);

        const posts = await Post.find({ channelId: ch._id });
        expect(posts).toHaveLength(1);
    });
});

describe('TC-B3: Analytics still include historical data', () => {
    it('analytics for disconnected channel posts still works', async () => {
        const ch = await seedChannel({ platformAccountId: 'analytics_persist' });
        await seedPost(ch._id.toString(), {
            publishedAt: new Date('2025-06-15T12:00:00Z'),
        });

        await request(app)
            .delete(`/api/v1/channels/${ch._id}`)
            .set('Authorization', AUTH_HEADER);

        const posts = await Post.find({
            channelId: ch._id,
            publishedAt: {
                $gte: new Date('2025-06-01T00:00:00Z'),
                $lte: new Date('2025-06-30T23:59:59Z'),
            },
        });
        expect(posts).toHaveLength(1);
        expect(posts[0]!.metrics.impressions).toBe(1000);
    });
});

describe('TC-B4: DELETE non-existent id → 404', () => {
    it('returns 404 for unknown channel', async () => {
        const res = await request(app)
            .delete(`/api/v1/channels/${NON_EXISTENT_ID}`)
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
    });
});

describe('TC-B5: DELETE without auth → 401', () => {
    it('returns 401 when no token provided', async () => {
        const ch = await seedChannel();

        const res = await request(app)
            .delete(`/api/v1/channels/${ch._id}`);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
});

// ─── Ownership scoping ─────────────────────────────────────

describe('Ownership: PATCH/DELETE another user channel → 404', () => {
    it('PATCH returns 404 for other user channel', async () => {
        const ch = await seedChannel({ userId: OTHER_USER_ID, platformAccountId: 'other_patch' });

        const res = await request(app)
            .patch(`/api/v1/channels/${ch._id}`)
            .set('Authorization', AUTH_HEADER)
            .send({ syncStatus: 'paused' });

        expect(res.status).toBe(404);
    });

    it('DELETE returns 404 for other user channel', async () => {
        const ch = await seedChannel({ userId: OTHER_USER_ID, platformAccountId: 'other_del' });

        const res = await request(app)
            .delete(`/api/v1/channels/${ch._id}`)
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(404);
    });
});
