import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { Post } from '../models/Post.js';
import { Channel } from '../models/Channel.js';
import { User } from '../models/User.js';

/* ────────────────────────────────────────────────────
 * Mocks — must precede any app import
 * ──────────────────────────────────────────────────── */

const JWT_SECRET = 'a'.repeat(32);

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

/* ────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────── */

let app: Express;
const userId = new mongoose.Types.ObjectId();
const VALID_TOKEN = jwt.sign({ sub: userId.toString() }, JWT_SECRET, { expiresIn: '1h' });
const AUTH = `Bearer ${VALID_TOKEN}`;

const otherUserId = new mongoose.Types.ObjectId();

function makeChannel(overrides: Record<string, unknown> = {}) {
    return {
        userId,
        platform: 'instagram',
        platformAccountId: `acct_${Math.random().toString(36).slice(2)}`,
        displayName: 'Test Channel',
        handle: '@test',
        accessToken: 'enc:test-token',
        followerCount: 1000,
        syncStatus: 'active',
        ...overrides,
    };
}

function makePost(overrides: Record<string, unknown> = {}) {
    return {
        userId,
        channelId: new mongoose.Types.ObjectId(),
        platformPostId: `post_${Math.random().toString(36).slice(2)}`,
        platform: 'instagram',
        content: 'Test post content',
        postType: 'image',
        publishedAt: new Date('2025-01-15T12:00:00.000Z'),
        metrics: {
            impressions: 1000,
            reach: 800,
            engagements: 100,
            likes: 50,
            comments: 20,
            shares: 10,
            clicks: 15,
            saves: 5,
        },
        engagementRate: 10,
        ...overrides,
    };
}

/* ────────────────────────────────────────────────────
 * Deterministic seed data
 * ──────────────────────────────────────────────────── */

async function seedTestData() {
    // Create channels
    const igChannel = await Channel.create(
        makeChannel({ userId, platform: 'instagram', followerCount: 5000 }),
    );
    const liChannel = await Channel.create(
        makeChannel({ userId, platform: 'linkedin', followerCount: 3000 }),
    );

    // Current period: 2025-01-01 to 2025-01-07 (7 days)
    const currentPosts = [
        // Day 1: 2025-01-01 – Instagram
        makePost({
            userId,
            channelId: igChannel._id,
            platform: 'instagram',
            publishedAt: new Date('2025-01-01T10:00:00.000Z'),
            content: 'Instagram post day 1',
            postType: 'image',
            metrics: { impressions: 1000, reach: 800, engagements: 200, likes: 100, comments: 50, shares: 30, clicks: 15, saves: 5 },
            engagementRate: 20,
        }),
        // Day 3: 2025-01-03 – Instagram
        makePost({
            userId,
            channelId: igChannel._id,
            platform: 'instagram',
            publishedAt: new Date('2025-01-03T14:00:00.000Z'),
            content: 'Instagram post day 3',
            postType: 'video',
            metrics: { impressions: 2000, reach: 1600, engagements: 500, likes: 250, comments: 100, shares: 80, clicks: 50, saves: 20 },
            engagementRate: 25,
        }),
        // Day 5: 2025-01-05 – LinkedIn
        makePost({
            userId,
            channelId: liChannel._id,
            platform: 'linkedin',
            publishedAt: new Date('2025-01-05T09:00:00.000Z'),
            content: 'LinkedIn post day 5',
            postType: 'text',
            metrics: { impressions: 500, reach: 400, engagements: 50, likes: 30, comments: 10, shares: 5, clicks: 3, saves: 2 },
            engagementRate: 10,
        }),
        // Day 7: 2025-01-07 – Instagram
        makePost({
            userId,
            channelId: igChannel._id,
            platform: 'instagram',
            publishedAt: new Date('2025-01-07T18:00:00.000Z'),
            content: 'Instagram post day 7',
            postType: 'carousel',
            metrics: { impressions: 1500, reach: 1200, engagements: 300, likes: 150, comments: 80, shares: 40, clicks: 20, saves: 10 },
            engagementRate: 20,
        }),
    ];

    // Previous period: 2024-12-25 to 2024-12-31 (7 days before)
    const previousPosts = [
        makePost({
            userId,
            channelId: igChannel._id,
            platform: 'instagram',
            publishedAt: new Date('2024-12-26T10:00:00.000Z'),
            content: 'Previous period post',
            postType: 'image',
            metrics: { impressions: 800, reach: 600, engagements: 80, likes: 40, comments: 20, shares: 10, clicks: 8, saves: 2 },
            engagementRate: 10,
        }),
        makePost({
            userId,
            channelId: liChannel._id,
            platform: 'linkedin',
            publishedAt: new Date('2024-12-28T12:00:00.000Z'),
            content: 'Previous linkedin post',
            postType: 'text',
            metrics: { impressions: 400, reach: 300, engagements: 40, likes: 20, comments: 10, shares: 5, clicks: 3, saves: 2 },
            engagementRate: 10,
        }),
    ];

    await Post.insertMany([...currentPosts, ...previousPosts]);

    return { igChannel, liChannel };
}

/* ────────────────────────────────────────────────────
 * Setup
 * ──────────────────────────────────────────────────── */

beforeAll(async () => {
    const { createApp } = await import('../app.js');
    app = await createApp({ redisClient: null });
});

/* ════════════════════════════════════════════════════
 * TC-X3: Auth enforcement
 * ════════════════════════════════════════════════════ */

describe('TC-X3: Auth enforcement', () => {
    it('returns 401 when no auth header is provided', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
        expect(res.body.error).toHaveProperty('message');
        expect(res.body.error).toHaveProperty('details');
    });

    it('returns 401 with an invalid token', async () => {
        const badToken = jwt.sign({ sub: 'user-1' }, 'wrong-secret-that-is-at-least-32-chars', { expiresIn: '1h' });
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', `Bearer ${badToken}`);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for JWT with valid signature but missing sub/id', async () => {
        const noSubToken = jwt.sign({ email: 'nobody@test.com' }, JWT_SECRET, { expiresIn: '1h' });
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', `Bearer ${noSubToken}`);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for JWT with valid signature but non-ObjectId subject', async () => {
        const badSubToken = jwt.sign({ sub: 'not-an-objectid' }, JWT_SECRET, { expiresIn: '1h' });
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', `Bearer ${badSubToken}`);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
});

/* ════════════════════════════════════════════════════
 * TC-X4: Invalid date message exact match
 * ════════════════════════════════════════════════════ */

describe('TC-X4: Invalid date format validation', () => {
    it('returns 400 with exact message for invalid start date', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=not-a-date&end=2025-01-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        const messages = res.body.error.details.map((d: { message: string }) => d.message);
        expect(messages).toContain('Invalid date format. Use ISO 8601 (YYYY-MM-DD).');
    });

    it('returns 400 with exact message for invalid end date', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=not-a-date')
            .set('Authorization', AUTH);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        const messages = res.body.error.details.map((d: { message: string }) => d.message);
        expect(messages).toContain('Invalid date format. Use ISO 8601 (YYYY-MM-DD).');
    });

    it('returns 400 when start is missing', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?end=2025-01-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when end is missing', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01')
            .set('Authorization', AUTH);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when end < start', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-07&end=2025-01-01')
            .set('Authorization', AUTH);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for calendar-invalid month (2026-13-01)', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2026-13-01&end=2026-13-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.message).toBe('Invalid date format. Use ISO 8601 (YYYY-MM-DD).');
        const messages = res.body.error.details.map((d: { message: string }) => d.message);
        expect(messages).toContain('Invalid date format. Use ISO 8601 (YYYY-MM-DD).');
    });

    it('returns 400 for calendar-invalid day (2026-02-30)', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2026-02-30&end=2026-03-01')
            .set('Authorization', AUTH);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.message).toBe('Invalid date format. Use ISO 8601 (YYYY-MM-DD).');
    });

    it('returns 400 for Feb 29 in a non-leap year (2025-02-29)', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-02-29&end=2025-03-01')
            .set('Authorization', AUTH);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('top-level error.message is the exact invalid-date string for regex-invalid input too', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=not-a-date&end=2025-01-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Invalid date format. Use ISO 8601 (YYYY-MM-DD).');
    });
});

/* ════════════════════════════════════════════════════
 * Story A: Cross-Platform Analytics Overview
 * ════════════════════════════════════════════════════ */

describe('Story A: Cross-Platform Analytics Overview', () => {
    beforeEach(async () => {
        await seedTestData();
    });

    it('returns correct totals for the current period', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');

        const { currentPeriod } = res.body.data;
        // Sum: 1000 + 2000 + 500 + 1500 = 5000
        expect(currentPeriod.totalImpressions).toBe(5000);
        // Sum: 200 + 500 + 50 + 300 = 1050
        expect(currentPeriod.totalEngagements).toBe(1050);
        expect(currentPeriod.totalPosts).toBe(4);
        // 1050 / 5000 = 0.21
        expect(currentPeriod.avgEngagementRate).toBeCloseTo(0.21, 2);
    });

    it('returns zeros and empty arrays when no posts in range', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2030-01-01&end=2030-01-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(200);
        const { data } = res.body;
        expect(data.currentPeriod.totalImpressions).toBe(0);
        expect(data.currentPeriod.totalEngagements).toBe(0);
        expect(data.currentPeriod.totalPosts).toBe(0);
        expect(data.currentPeriod.avgEngagementRate).toBe(0);
        expect(data.topPosts).toEqual([]);
        // platformBreakdown still lists connected platforms, but with zero metrics
        expect(data.platformBreakdown.length).toBeGreaterThanOrEqual(0);
        data.platformBreakdown.forEach((p: { totalImpressions: number; totalEngagements: number; totalPosts: number }) => {
            expect(p.totalImpressions).toBe(0);
            expect(p.totalEngagements).toBe(0);
            expect(p.totalPosts).toBe(0);
        });
        // timeSeries should still have 7 entries (one per day) with zeros
        expect(data.timeSeries).toHaveLength(7);
        data.timeSeries.forEach((entry: { impressions: number; engagements: number; posts: number }) => {
            expect(entry.impressions).toBe(0);
            expect(entry.engagements).toBe(0);
            expect(entry.posts).toBe(0);
        });
    });

    it('wraps response in success envelope with dateRange meta', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        expect(res.body.meta).toHaveProperty('generatedAt');
        expect(res.body.meta).toHaveProperty('cached', false);
        expect(res.body.meta).toHaveProperty('dateRange', '2025-01-01/2025-01-07');
    });
});

/* ════════════════════════════════════════════════════
 * Story B: Period-over-Period Comparison
 * ════════════════════════════════════════════════════ */

describe('Story B: Period-over-Period Comparison', () => {
    beforeEach(async () => {
        await seedTestData();
    });

    it('returns previous period metrics', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(200);
        const { previousPeriod } = res.body.data;
        // Previous period: 2024-12-25 through 2024-12-31
        // Posts: impressions 800+400=1200, engagements 80+40=120, count 2
        expect(previousPeriod.totalImpressions).toBe(1200);
        expect(previousPeriod.totalEngagements).toBe(120);
        expect(previousPeriod.totalPosts).toBe(2);
        expect(previousPeriod.avgEngagementRate).toBeCloseTo(0.1, 2);
    });

    it('returns change percentages', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        const { changes } = res.body.data;
        // impressions: current=5000, prev=1200 → ((5000-1200)/1200)*100 = 316.7%
        expect(changes.impressionsChangePct).toBeCloseTo(316.7, 0);
        // engagements: current=1050, prev=120 → ((1050-120)/120)*100 = 775%
        expect(changes.engagementsChangePct).toBeCloseTo(775.0, 0);
        // posts: current=4, prev=2 → 100%
        expect(changes.postsChangePct).toBeCloseTo(100.0, 0);
        // avgEngagementRate change
        expect(changes.avgEngagementRateChangePct).not.toBeNull();
    });

    it('works for any window length (30-day)', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-30')
            .set('Authorization', AUTH);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('previousPeriod');
        expect(res.body.data).toHaveProperty('changes');
    });
});

/* ════════════════════════════════════════════════════
 * TC-X2: Previous=0 changes
 * ════════════════════════════════════════════════════ */

describe('TC-X2: Previous period with 0 values', () => {
    beforeEach(async () => {
        // Only create current period data, no previous period
        const igChannel = await Channel.create(
            makeChannel({ userId, platform: 'instagram', followerCount: 5000 }),
        );

        await Post.create(
            makePost({
                userId,
                channelId: igChannel._id,
                platform: 'instagram',
                publishedAt: new Date('2025-06-15T12:00:00.000Z'),
                metrics: { impressions: 1000, reach: 800, engagements: 100, likes: 50, comments: 20, shares: 10, clicks: 15, saves: 5 },
                engagementRate: 10,
            }),
        );
    });

    it('returns null for all change percentages when previous period has no data', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-06-15&end=2025-06-21')
            .set('Authorization', AUTH);

        expect(res.status).toBe(200);
        const { changes } = res.body.data;
        expect(changes.impressionsChangePct).toBeNull();
        expect(changes.engagementsChangePct).toBeNull();
        expect(changes.postsChangePct).toBeNull();
        expect(changes.avgEngagementRateChangePct).toBeNull();
    });
});

/* ════════════════════════════════════════════════════
 * Story C: Engagement Time Series
 * ════════════════════════════════════════════════════ */

describe('Story C: Engagement Time Series', () => {
    beforeEach(async () => {
        await seedTestData();
    });

    it('returns one entry per day, sorted ascending', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(200);
        const { timeSeries } = res.body.data;
        expect(timeSeries).toHaveLength(7);

        // Sorted ascending
        for (let i = 1; i < timeSeries.length; i++) {
            expect(timeSeries[i].date > timeSeries[i - 1].date).toBe(true);
        }
    });

    it('includes zero-value entries for days with no posts', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        const { timeSeries } = res.body.data;
        // Day 2 (2025-01-02) has no posts
        const day2 = timeSeries.find((e: { date: string }) => e.date === '2025-01-02');
        expect(day2).toBeDefined();
        expect(day2.impressions).toBe(0);
        expect(day2.engagements).toBe(0);
        expect(day2.posts).toBe(0);
    });

    it('sum of timeSeries impressions equals totalImpressions (AC-X1)', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        const { currentPeriod, timeSeries } = res.body.data;
        const sumImpressions = timeSeries.reduce(
            (sum: number, e: { impressions: number }) => sum + e.impressions, 0,
        );
        expect(sumImpressions).toBe(currentPeriod.totalImpressions);
    });

    it('sum of timeSeries engagements equals totalEngagements', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        const { currentPeriod, timeSeries } = res.body.data;
        const sumEngagements = timeSeries.reduce(
            (sum: number, e: { engagements: number }) => sum + e.engagements, 0,
        );
        expect(sumEngagements).toBe(currentPeriod.totalEngagements);
    });
});

/* ════════════════════════════════════════════════════
 * TC-X1: Range length test (7-day)
 * ════════════════════════════════════════════════════ */

describe('TC-X1: Range length test', () => {
    beforeEach(async () => {
        await seedTestData();
    });

    it('7-day window → timeSeries length = 7', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(200);
        expect(res.body.data.timeSeries).toHaveLength(7);
    });

    it('previous period window = exact 7 days prior', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        // Previous period should be 2024-12-25 to 2024-12-31
        // We seeded a post on 2024-12-26 and 2024-12-28, so previous should have data
        expect(res.body.data.previousPeriod.totalPosts).toBe(2);
    });

    it('30-day window → timeSeries length = 30', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-30')
            .set('Authorization', AUTH);

        expect(res.status).toBe(200);
        expect(res.body.data.timeSeries).toHaveLength(30);
    });
});

/* ════════════════════════════════════════════════════
 * Story D: Platform Breakdown
 * ════════════════════════════════════════════════════ */

describe('Story D: Platform Breakdown', () => {
    beforeEach(async () => {
        await seedTestData();
    });

    it('returns one entry per connected platform', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(200);
        const { platformBreakdown } = res.body.data;
        expect(platformBreakdown).toHaveLength(2);

        const platforms = platformBreakdown.map((p: { platform: string }) => p.platform).sort();
        expect(platforms).toEqual(['instagram', 'linkedin']);
    });

    it('platform totals sum to overall totals (AC-X1)', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        const { currentPeriod, platformBreakdown } = res.body.data;

        const sumImpressions = platformBreakdown.reduce(
            (s: number, p: { totalImpressions: number }) => s + p.totalImpressions, 0,
        );
        const sumEngagements = platformBreakdown.reduce(
            (s: number, p: { totalEngagements: number }) => s + p.totalEngagements, 0,
        );
        const sumPosts = platformBreakdown.reduce(
            (s: number, p: { totalPosts: number }) => s + p.totalPosts, 0,
        );

        expect(sumImpressions).toBe(currentPeriod.totalImpressions);
        expect(sumEngagements).toBe(currentPeriod.totalEngagements);
        expect(sumPosts).toBe(currentPeriod.totalPosts);
    });

    it('computes per-platform avgEngagementRate correctly', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        const { platformBreakdown } = res.body.data;
        const ig = platformBreakdown.find((p: { platform: string }) => p.platform === 'instagram');
        const li = platformBreakdown.find((p: { platform: string }) => p.platform === 'linkedin');

        // Instagram: engagements (200+500+300)=1000, impressions (1000+2000+1500)=4500
        expect(ig.avgEngagementRate).toBeCloseTo(1000 / 4500, 4);
        // LinkedIn: engagements 50, impressions 500
        expect(li.avgEngagementRate).toBeCloseTo(50 / 500, 4);
    });

    it('includes followerCount from Channel data', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        const { platformBreakdown } = res.body.data;
        const ig = platformBreakdown.find((p: { platform: string }) => p.platform === 'instagram');
        const li = platformBreakdown.find((p: { platform: string }) => p.platform === 'linkedin');

        expect(ig.followerCount).toBe(5000);
        expect(li.followerCount).toBe(3000);
    });

    it('returns only connected platforms (single platform)', async () => {
        // Create a new user with only instagram
        const singleUserId = new mongoose.Types.ObjectId();
        const singleToken = jwt.sign({ sub: singleUserId.toString() }, JWT_SECRET, { expiresIn: '1h' });

        const ch = await Channel.create(
            makeChannel({ userId: singleUserId, platform: 'instagram', followerCount: 2000 }),
        );
        await Post.create(
            makePost({
                userId: singleUserId,
                channelId: ch._id,
                platform: 'instagram',
                publishedAt: new Date('2025-01-03T10:00:00.000Z'),
            }),
        );

        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', `Bearer ${singleToken}`);

        expect(res.body.data.platformBreakdown).toHaveLength(1);
        expect(res.body.data.platformBreakdown[0].platform).toBe('instagram');
    });
});

/* ════════════════════════════════════════════════════
 * TC-X6: Orphan posts (platform with no channel record)
 * ════════════════════════════════════════════════════ */

describe('TC-X6: Orphan posts (platform without channel)', () => {
    it('includes orphan-post platform in breakdown so sums match totals', async () => {
        // Create channel only for instagram, but create posts for both platforms
        const orphanUserId = new mongoose.Types.ObjectId();
        const orphanToken = jwt.sign({ sub: orphanUserId.toString() }, JWT_SECRET, { expiresIn: '1h' });

        const igChannel = await Channel.create(
            makeChannel({ userId: orphanUserId, platform: 'instagram', followerCount: 1000 }),
        );

        // Instagram post (has channel)
        await Post.create(
            makePost({
                userId: orphanUserId,
                channelId: igChannel._id,
                platform: 'instagram',
                publishedAt: new Date('2025-01-02T10:00:00.000Z'),
                metrics: { impressions: 500, reach: 400, engagements: 50, likes: 25, comments: 10, shares: 5, clicks: 5, saves: 5 },
                engagementRate: 10,
            }),
        );

        // LinkedIn post (NO channel for linkedin — orphan)
        await Post.create(
            makePost({
                userId: orphanUserId,
                channelId: new mongoose.Types.ObjectId(),
                platform: 'linkedin',
                publishedAt: new Date('2025-01-03T10:00:00.000Z'),
                metrics: { impressions: 300, reach: 200, engagements: 30, likes: 15, comments: 5, shares: 5, clicks: 3, saves: 2 },
                engagementRate: 10,
            }),
        );

        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', `Bearer ${orphanToken}`);

        expect(res.status).toBe(200);
        const { currentPeriod, platformBreakdown } = res.body.data;

        // Both platforms must appear
        const platforms = platformBreakdown.map((p: { platform: string }) => p.platform).sort();
        expect(platforms).toEqual(['instagram', 'linkedin']);

        // Sums must match overall totals (AC-X1)
        const sumImpressions = platformBreakdown.reduce(
            (s: number, p: { totalImpressions: number }) => s + p.totalImpressions, 0,
        );
        const sumEngagements = platformBreakdown.reduce(
            (s: number, p: { totalEngagements: number }) => s + p.totalEngagements, 0,
        );
        const sumPosts = platformBreakdown.reduce(
            (s: number, p: { totalPosts: number }) => s + p.totalPosts, 0,
        );

        expect(sumImpressions).toBe(currentPeriod.totalImpressions);
        expect(sumEngagements).toBe(currentPeriod.totalEngagements);
        expect(sumPosts).toBe(currentPeriod.totalPosts);

        // Orphan platform should have followerCount = 0
        const li = platformBreakdown.find((p: { platform: string }) => p.platform === 'linkedin');
        expect(li.followerCount).toBe(0);
    });
});

/* ════════════════════════════════════════════════════
 * Story E: Top Posts
 * ════════════════════════════════════════════════════ */

describe('Story E: Top Posts', () => {
    beforeEach(async () => {
        await seedTestData();
    });

    it('returns posts sorted by engagementRate desc', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(200);
        const { topPosts } = res.body.data;
        expect(topPosts.length).toBe(4);

        for (let i = 1; i < topPosts.length; i++) {
            expect(topPosts[i].engagementRate).toBeLessThanOrEqual(topPosts[i - 1].engagementRate);
        }
    });

    it('each post includes required fields', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        const post = res.body.data.topPosts[0];
        expect(post).toHaveProperty('id');
        expect(post).toHaveProperty('platform');
        expect(post).toHaveProperty('content');
        expect(post).toHaveProperty('postType');
        expect(post).toHaveProperty('impressions');
        expect(post).toHaveProperty('engagements');
        expect(post).toHaveProperty('engagementRate');
        expect(post).toHaveProperty('publishedAt');
    });

    it('truncates content longer than 120 chars', async () => {
        const igChannel = await Channel.findOne({ userId, platform: 'instagram' });
        const longContent = 'A'.repeat(200);
        await Post.create(
            makePost({
                userId,
                channelId: igChannel!._id,
                platform: 'instagram',
                publishedAt: new Date('2025-01-02T10:00:00.000Z'),
                content: longContent,
                engagementRate: 50,
                metrics: { impressions: 100, reach: 80, engagements: 50, likes: 25, comments: 10, shares: 5, clicks: 5, saves: 5 },
            }),
        );

        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        const longPost = res.body.data.topPosts.find(
            (p: { engagementRate: number }) => p.engagementRate === 50,
        );
        expect(longPost).toBeDefined();
        expect(longPost.content.length).toBe(123); // 120 + '...'
        expect(longPost.content.endsWith('...')).toBe(true);
    });

    it('returns at most 10 posts', async () => {
        const igChannel = await Channel.findOne({ userId, platform: 'instagram' });
        // Add 12 more posts to have >10 total
        const extraPosts = Array.from({ length: 12 }, (_, i) =>
            makePost({
                userId,
                channelId: igChannel!._id,
                platform: 'instagram',
                publishedAt: new Date(`2025-01-02T${String(i).padStart(2, '0')}:00:00.000Z`),
                content: `Extra post ${i}`,
                engagementRate: i + 1,
            }),
        );
        await Post.insertMany(extraPosts);

        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        expect(res.body.data.topPosts.length).toBeLessThanOrEqual(10);
    });

    it('returns all posts if fewer than 10', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        // We seeded 4 posts in current period
        expect(res.body.data.topPosts.length).toBe(4);
    });
});

/* ════════════════════════════════════════════════════
 * AC-X5: Response shape stability
 * ════════════════════════════════════════════════════ */

describe('AC-X5: Response shape stability', () => {
    it('always returns arrays, never null, even with no data', async () => {
        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2030-01-01&end=2030-01-07')
            .set('Authorization', AUTH);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.timeSeries)).toBe(true);
        expect(Array.isArray(res.body.data.platformBreakdown)).toBe(true);
        expect(Array.isArray(res.body.data.topPosts)).toBe(true);
        expect(res.body.data.timeSeries).not.toBeNull();
        expect(res.body.data.platformBreakdown).not.toBeNull();
        expect(res.body.data.topPosts).not.toBeNull();
    });
});

/* ════════════════════════════════════════════════════
 * Data isolation: other user's data not included
 * ════════════════════════════════════════════════════ */

describe('Data isolation', () => {
    it('does not include posts from other users', async () => {
        await seedTestData();

        // Create data for another user
        const otherChannel = await Channel.create(
            makeChannel({ userId: otherUserId, platform: 'instagram', followerCount: 9999 }),
        );
        await Post.create(
            makePost({
                userId: otherUserId,
                channelId: otherChannel._id,
                platform: 'instagram',
                publishedAt: new Date('2025-01-04T10:00:00.000Z'),
                metrics: { impressions: 999999, reach: 0, engagements: 999999, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0 },
                engagementRate: 100,
            }),
        );

        const res = await request(app)
            .get('/api/v1/analytics/overview?start=2025-01-01&end=2025-01-07')
            .set('Authorization', AUTH);

        // Totals should not include the other user's 999999 impressions
        expect(res.body.data.currentPeriod.totalImpressions).toBe(5000);
    });
});
