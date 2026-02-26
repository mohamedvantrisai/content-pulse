/**
 * Model test suite — covers all 9 acceptance test cases (TC-1 through TC-9).
 * Uses mongodb-memory-server for isolated in-memory MongoDB.
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// ─── Mock env BEFORE any model imports
jest.mock('../../config/env.js', () => ({
    env: {
        ENCRYPTION_KEY:
            '32bd3bb9b3313b9f259f7c8d6c9221f3829c828cf31668f85145e3f0a47b9882',
    },
}));

// Set ENCRYPTION_KEY on process.env for the encryption utility
process.env['ENCRYPTION_KEY'] =
    '32bd3bb9b3313b9f259f7c8d6c9221f3829c828cf31668f85145e3f0a47b9882';

import { User } from '../User.js';
import { Channel } from '../Channel.js';
import { Post } from '../Post.js';
import { AnalyticsSnapshot } from '../AnalyticsSnapshot.js';
import { ApiKey } from '../ApiKey.js';
import { isEncrypted } from '../../utils/encryption.js';
import type {
    IUser,
    IChannel,
    IPost,
    IAnalyticsSnapshot,
    IApiKey,
    IPostMetrics,
    ISnapshotMetrics,
    IApiKeyDocument,
    ApiKeyScope,
} from '../index.js';

// ─── Setup & Teardown─────────────────

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    const collections = Object.values(mongoose.connection.collections);
    await Promise.all(collections.map((c) => c.deleteMany({})));
});

// ─── Helpers──────

const userId = new mongoose.Types.ObjectId();
const channelId = new mongoose.Types.ObjectId();

function validUserData(): Partial<IUser> {
    return {
        email: 'riyas@contentpulse.dev',
        name: 'Riyas',
        passwordHash: 'P@ssword123!',
        plan: 'free',
    };
}

function validChannelData(): Partial<IChannel> {
    return {
        userId,
        platform: 'instagram',
        platformAccountId: 'acct_123',
        displayName: 'Riyas Insta',
        handle: '@riyas',
        accessToken: 'my-secret-access-token',
        refreshToken: 'my-secret-refresh-token',
    };
}

function validPostData(): Partial<IPost> {
    return {
        channelId,
        userId,
        platformPostId: 'post_abc',
        platform: 'instagram',
        postType: 'image',
        publishedAt: new Date('2026-01-15'),
        metrics: {
            impressions: 1000,
            reach: 800,
            engagements: 150,
            likes: 100,
            comments: 30,
            shares: 10,
            clicks: 5,
            saves: 5,
        },
    };
}

function validSnapshotData(): Partial<IAnalyticsSnapshot> {
    return {
        channelId,
        userId,
        platform: 'instagram',
        period: 'daily',
        date: new Date('2026-01-15'),
        metrics: {
            totalPosts: 5,
            totalImpressions: 5000,
            totalReach: 4000,
            totalEngagements: 750,
            engagementRate: 15,
            followerGrowth: 20,
            bestPostingHour: 14,
            bestPostingDay: 3,
            topPostId: null,
        },
    };
}

async function validApiKeyData(): Promise<Partial<IApiKey>> {
    const { keyHash, keyPrefix } = await ApiKey.generateApiKey();
    return {
        userId,
        name: 'Test Key',
        keyHash,
        keyPrefix,
        scopes: ['analytics:read', 'posts:read'],
    };
}

// ─── TC-1: Valid document creation────

describe('TC-1: Valid document creation', () => {
    it('creates a User with valid data', async () => {
        const user = await User.create(validUserData());
        expect(user._id).toBeDefined();
        expect(user.email).toBe('riyas@contentpulse.dev');
        expect(user.plan).toBe('free');
        expect(user.timezone).toBe('America/New_York');
    });

    it('creates a Channel with valid data', async () => {
        const channel = await Channel.create(validChannelData());
        expect(channel._id).toBeDefined();
        expect(channel.platform).toBe('instagram');
        expect(channel.syncStatus).toBe('pending');
        expect(channel.followerCount).toBe(0);
    });

    it('creates a Post with valid data', async () => {
        const post = await Post.create(validPostData());
        expect(post._id).toBeDefined();
        expect(post.platform).toBe('instagram');
        expect(post.metrics.impressions).toBe(1000);
    });

    it('creates an AnalyticsSnapshot with valid data', async () => {
        const snap = await AnalyticsSnapshot.create(validSnapshotData());
        expect(snap._id).toBeDefined();
        expect(snap.period).toBe('daily');
        expect(snap.metrics.totalPosts).toBe(5);
    });

    it('creates an ApiKey with valid data', async () => {
        const data = await validApiKeyData();
        const apiKey = await ApiKey.create(data);
        expect(apiKey._id).toBeDefined();
        expect(apiKey.isActive).toBe(true);
        expect(apiKey.rateLimit).toBe(60);
        expect(apiKey.totalRequests).toBe(0);
    });
});

// ─── TC-2: User without email → validation error ────────────

describe('TC-2: User validation', () => {
    it('throws validation error when email is missing', async () => {
        const data = validUserData();
        delete data.email;
        await expect(User.create(data)).rejects.toThrow(/email/i);
    });

    it('throws validation error when name is missing', async () => {
        const data = validUserData();
        delete data.name;
        await expect(User.create(data)).rejects.toThrow(/name/i);
    });
});

// ─── TC-3: Duplicate Channel → duplicate key error ──────────

describe('TC-3: Channel compound unique index', () => {
    it('prevents duplicate userId + platform + platformAccountId', async () => {
        const data = validChannelData();
        await Channel.create(data);

        await expect(Channel.create(data)).rejects.toThrow(/duplicate key|E11000/i);
    });
});

// ─── TC-4: Channel access token encryption ──────────────────

describe('TC-4: AES-256-GCM encryption', () => {
    it('encrypts accessToken on save', async () => {
        const channel = await Channel.create(validChannelData());

        // Read back with select('+accessToken') to get the encrypted value
        const stored = await Channel.findById(channel._id)
            .select('+accessToken +refreshToken')
            .exec();

        expect(stored).not.toBeNull();
        expect(stored!.accessToken).not.toBe('my-secret-access-token');
        expect(isEncrypted(stored!.accessToken)).toBe(true);
    });

    it('decrypts accessToken via instance method', async () => {
        const channel = await Channel.create(validChannelData());

        const stored = await Channel.findById(channel._id)
            .select('+accessToken +refreshToken')
            .exec();

        expect(stored!.getDecryptedAccessToken()).toBe('my-secret-access-token');
        expect(stored!.getDecryptedRefreshToken()).toBe('my-secret-refresh-token');
    });

    it('does not double-encrypt on subsequent saves', async () => {
        const channel = await Channel.create(validChannelData());

        const stored = await Channel.findById(channel._id)
            .select('+accessToken')
            .exec();

        const firstEncrypted = stored!.accessToken;

        // Modify a non-token field and save again
        stored!.displayName = 'Updated Name';
        await stored!.save();

        const reloaded = await Channel.findById(channel._id)
            .select('+accessToken')
            .exec();

        expect(reloaded!.accessToken).toBe(firstEncrypted);
    });
});

// ─── TC-5: Post engagementRate computation ──────────────────

describe('TC-5: engagementRate computation', () => {
    it('computes engagementRate = (engagements / impressions) × 100', async () => {
        const post = await Post.create(validPostData());
        // 150 / 1000 × 100 = 15
        expect(post.engagementRate).toBe(15);
    });

    it('sets engagementRate to 0 when impressions is 0', async () => {
        const data = validPostData();
        data.metrics = {
            impressions: 0,
            reach: 0,
            engagements: 10,
            likes: 5,
            comments: 3,
            shares: 1,
            clicks: 1,
            saves: 0,
        };
        const post = await Post.create(data);
        expect(post.engagementRate).toBe(0);
    });

    it('recomputes engagementRate via findOneAndUpdate', async () => {
        const post = await Post.create(validPostData());
        const newMetrics: IPostMetrics = {
            impressions: 2000,
            reach: 1500,
            engagements: 400,
            likes: 250,
            comments: 80,
            shares: 40,
            clicks: 20,
            saves: 10,
        };

        await Post.findOneAndUpdate(
            { _id: post._id },
            { $set: { metrics: newMetrics } },
        );

        const updated = await Post.findById(post._id);
        // 400 / 2000 × 100 = 20
        expect(updated!.engagementRate).toBe(20);
    });
});

// ─── TC-6: Duplicate AnalyticsSnapshot → duplicate key error ─

describe('TC-6: AnalyticsSnapshot compound unique index', () => {
    it('prevents duplicate channelId + period + date', async () => {
        const data = validSnapshotData();
        await AnalyticsSnapshot.create(data);

        await expect(AnalyticsSnapshot.create(data)).rejects.toThrow(
            /duplicate key|E11000/i,
        );
    });
});

// ─── TC-7: ApiKey.generateApiKey()───

describe('TC-7: ApiKey key generation and verification', () => {
    it('generates { fullKey, keyPrefix, keyHash } with correct format', async () => {
        const result = await ApiKey.generateApiKey();

        expect(result.fullKey).toBeDefined();
        expect(result.fullKey.startsWith('cp_')).toBe(true);
        expect(result.keyPrefix).toBe(result.fullKey.slice(3, 3 + 12));
        expect(result.keyHash.startsWith('$2a$') || result.keyHash.startsWith('$2b$')).toBe(
            true,
        );
    });

    it('verifyApiKey returns true for correct key', async () => {
        const { fullKey, keyPrefix, keyHash } = await ApiKey.generateApiKey();

        const apiKey = await ApiKey.create({
            userId,
            name: 'Verify Test',
            keyHash,
            keyPrefix,
            scopes: ['analytics:read'],
        });

        const stored = (await ApiKey.findById(apiKey._id)
            .select('+keyHash')
            .exec()) as IApiKeyDocument;

        expect(await stored.verifyApiKey(fullKey)).toBe(true);
        expect(await stored.verifyApiKey('wrong-key')).toBe(false);
    });

    it('hasScope returns correct result', async () => {
        const data = await validApiKeyData();
        const apiKey = await ApiKey.create(data);

        expect(apiKey.hasScope('analytics:read')).toBe(true);
        expect(apiKey.hasScope('channels:write')).toBe(false);
    });
});

describe('TC-8: Compound indexes exist', () => {
    it('Channel has userId_platform_platformAccountId unique index', async () => {
        await Channel.createCollection();
        const indexes = await Channel.listIndexes();
        const found = indexes.some(
            (idx) => idx.key?.['userId'] === 1 && idx.key?.['platform'] === 1 && idx.key?.['platformAccountId'] === 1,
        );
        expect(found).toBe(true);
    });

    it('Post has channelId_platformPostId unique index', async () => {
        await Post.createCollection();
        const indexes = await Post.listIndexes();
        expect(
            indexes.some((idx) => idx.key?.['channelId'] === 1 && idx.key?.['platformPostId'] === 1),
        ).toBe(true);
    });

    it('Post has userId_publishedAt_desc index', async () => {
        await Post.createCollection();
        const indexes = await Post.listIndexes();
        expect(
            indexes.some((idx) => idx.key?.['userId'] === 1 && idx.key?.['publishedAt'] === -1),
        ).toBe(true);
    });

    it('AnalyticsSnapshot has channelId_period_date unique index', async () => {
        await AnalyticsSnapshot.createCollection();
        const indexes = await AnalyticsSnapshot.listIndexes();
        expect(
            indexes.some(
                (idx) => idx.key?.['channelId'] === 1 && idx.key?.['period'] === 1 && idx.key?.['date'] === 1,
            ),
        ).toBe(true);
    });

    it('ApiKey has userId_isActive index', async () => {
        await ApiKey.createCollection();
        const indexes = await ApiKey.listIndexes();
        expect(
            indexes.some((idx) => idx.key?.['userId'] === 1 && idx.key?.['isActive'] === 1),
        ).toBe(true);
    });
});

// ─── TC-9: TypeScript interfaces are exported ────────────────

describe('TC-9: TypeScript interfaces exported and type-check', () => {
    it('interfaces are importable and usable at compile time', () => {
        // This test validates that TS interfaces compile correctly.
        // If any interface is missing or broken, this file won't compile.
        const _user: Partial<IUser> = { email: 'test@test.com' };
        const _channel: Partial<IChannel> = { platform: 'instagram' };
        const _post: Partial<IPost> = { platformPostId: 'p1' };
        const _snapshot: Partial<IAnalyticsSnapshot> = { period: 'daily' };
        const _apiKey: Partial<IApiKey> = { name: 'key' };
        const _metrics: Partial<IPostMetrics> = { impressions: 100 };
        const _snapMetrics: Partial<ISnapshotMetrics> = { totalPosts: 1 };
        const _scope: ApiKeyScope = 'analytics:read';

        expect(_user.email).toBe('test@test.com');
        expect(_channel.platform).toBe('instagram');
        expect(_post.platformPostId).toBe('p1');
        expect(_snapshot.period).toBe('daily');
        expect(_apiKey.name).toBe('key');
        expect(_metrics.impressions).toBe(100);
        expect(_snapMetrics.totalPosts).toBe(1);
        expect(_scope).toBe('analytics:read');
    });
});
