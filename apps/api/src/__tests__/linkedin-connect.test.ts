import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { Channel } from '../models/Channel';
import { isEncrypted } from '../utils/encryption';

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
const TEST_USER_ID = '64a1f0b0c1d2e3f4a5b6c7d8';
const VALID_TOKEN = jwt.sign({ sub: TEST_USER_ID }, JWT_SECRET, { expiresIn: '1h' });
const AUTH_HEADER = `Bearer ${VALID_TOKEN}`;

const LINKEDIN_CLIENT_ID = 'test-linkedin-client-id';
const LINKEDIN_REDIRECT_URI = 'http://localhost:4000/api/v1/channels/linkedin/callback';
const DASHBOARD_URL = 'http://localhost:5173';

const MOCK_LI_PROFILE = {
    platformAccountId: 'li-sub-abc123',
    displayName: 'Jane Doe',
    handle: 'jane@example.com',
    followerCount: 0,
};

const MOCK_TOKEN_RESULT = {
    accessToken: 'AQXn8e_long_lived_linkedin_token_value',
    expiresIn: 5184000,
};

jest.mock('../services/linkedinOAuth.service', () => ({
    buildAuthUrl: jest.fn(() => ({
        url: `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&scope=openid+profile+w_member_social&state=mock-li-state-nonce`,
        state: 'mock-li-state-nonce',
    })),
    exchangeCodeForToken: jest.fn(() => Promise.resolve(MOCK_TOKEN_RESULT)),
    fetchLinkedInProfile: jest.fn(() => Promise.resolve(MOCK_LI_PROFILE)),
}));

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
        DASHBOARD_URL,
        LINKEDIN_CLIENT_ID,
        LINKEDIN_CLIENT_SECRET: 'test-linkedin-client-secret',
        LINKEDIN_REDIRECT_URI,
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

function makeStateCookie(nonce: string, userId: string, secret: string = JWT_SECRET): string {
    return jwt.sign({ nonce, userId }, secret, { expiresIn: 600 });
}

let app: Express;

beforeAll(async () => {
    const { createApp } = await import('../app');
    app = await createApp({ redisClient: null });
});

// ─── TC-1: Start connect redirect URL ──────────────────────

describe('TC-1: Start LinkedIn connect redirect URL', () => {
    it('returns 302 redirect containing correct client_id, redirect_uri, and scopes', async () => {
        const res = await request(app)
            .get('/api/v1/channels/linkedin/connect')
            .set('Authorization', AUTH_HEADER);

        expect(res.status).toBe(302);

        const location = res.headers['location'] as string;
        expect(location).toBeDefined();
        expect(location).toContain(`client_id=${LINKEDIN_CLIENT_ID}`);
        expect(location).toContain(`redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}`);
        expect(location).toContain('openid');
        expect(location).toContain('profile');
        expect(location).toContain('w_member_social');
    });

    it('redirect URL includes state parameter', async () => {
        const res = await request(app)
            .get('/api/v1/channels/linkedin/connect')
            .set('Authorization', AUTH_HEADER);

        const location = res.headers['location'] as string;
        expect(location).toContain('state=');
    });

    it('sets an httpOnly oauth_state cookie', async () => {
        const res = await request(app)
            .get('/api/v1/channels/linkedin/connect')
            .set('Authorization', AUTH_HEADER);

        const cookies = res.headers['set-cookie'] as unknown as string[];
        const stateCookie = cookies?.find((c: string) => c.startsWith('oauth_state='));
        expect(stateCookie).toBeDefined();
        expect(stateCookie).toContain('HttpOnly');
        expect(stateCookie).toContain('Path=/api/v1/channels/linkedin');
    });

    it('returns 401 without auth header', async () => {
        const res = await request(app)
            .get('/api/v1/channels/linkedin/connect');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
});

// ─── TC-2: Simulate valid callback ─────────────────────────

describe('TC-2: Simulate valid LinkedIn callback', () => {
    it('creates channel with platform=linkedin, syncStatus=active, correct displayName and handle', async () => {
        const stateCookie = makeStateCookie('mock-li-state-nonce', TEST_USER_ID);

        const res = await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'valid-auth-code', state: 'mock-li-state-nonce' })
            .set('Cookie', `oauth_state=${stateCookie}`);

        expect(res.status).toBe(302);
        expect(res.headers['location']).toContain(`${DASHBOARD_URL}?connected=linkedin`);

        const channel = await Channel.findOne({
            platform: 'linkedin',
            platformAccountId: MOCK_LI_PROFILE.platformAccountId,
        }).select('+accessToken');

        expect(channel).not.toBeNull();
        expect(channel!.platform).toBe('linkedin');
        expect(channel!.syncStatus).toBe('active');
        expect(channel!.displayName).toBe(MOCK_LI_PROFILE.displayName);
        expect(channel!.handle).toBe(MOCK_LI_PROFILE.handle);
        expect(channel!.accessToken).toBeDefined();
        expect(isEncrypted(channel!.accessToken)).toBe(true);
    });
});

// ─── TC-3: Expired code (invalid_grant) ────────────────────

describe('TC-3: Expired authorization code', () => {
    it('redirects with friendly retry error when code is expired', async () => {
        const { LinkedInOAuthError } = jest.requireActual('../connectors/linkedin.connector') as {
            LinkedInOAuthError: new (msg: string, err: string) => Error & { oauthError: string };
        };

        const { exchangeCodeForToken } = jest.requireMock(
            '../services/linkedinOAuth.service',
        ) as { exchangeCodeForToken: jest.Mock };
        exchangeCodeForToken.mockRejectedValueOnce(
            new LinkedInOAuthError(
                'Authorization code has expired or is invalid. Please try connecting again.',
                'invalid_grant',
            ),
        );

        const stateCookie = makeStateCookie('mock-li-state-nonce', TEST_USER_ID);
        const res = await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'expired-code', state: 'mock-li-state-nonce' })
            .set('Cookie', `oauth_state=${stateCookie}`);

        expect(res.status).toBe(302);
        const location = res.headers['location'] as string;
        expect(location).toContain('error=expired_code');
        expect(location).toContain('expired');
    });

    it('does not create a channel on expired code', async () => {
        const { LinkedInOAuthError } = jest.requireActual('../connectors/linkedin.connector') as {
            LinkedInOAuthError: new (msg: string, err: string) => Error & { oauthError: string };
        };

        const { exchangeCodeForToken } = jest.requireMock(
            '../services/linkedinOAuth.service',
        ) as { exchangeCodeForToken: jest.Mock };
        exchangeCodeForToken.mockRejectedValueOnce(
            new LinkedInOAuthError('expired', 'invalid_grant'),
        );

        const stateCookie = makeStateCookie('mock-li-state-nonce', TEST_USER_ID);
        await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'expired-code', state: 'mock-li-state-nonce' })
            .set('Cookie', `oauth_state=${stateCookie}`);

        const count = await Channel.countDocuments({ platform: 'linkedin' });
        expect(count).toBe(0);
    });
});

// ─── TC-4: CSRF state validation ───────────────────────────

describe('TC-4: CSRF state validation', () => {
    it('returns 400 when state cookie is missing', async () => {
        const res = await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'valid-code', state: 'some-state' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('returns 400 when state nonce does not match', async () => {
        const stateCookie = makeStateCookie('correct-nonce', TEST_USER_ID);

        const res = await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'valid-code', state: 'wrong-nonce' })
            .set('Cookie', `oauth_state=${stateCookie}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('returns 400 when state cookie JWT is signed with wrong secret', async () => {
        const badCookie = jwt.sign(
            { nonce: 'nonce', userId: TEST_USER_ID },
            'wrong-secret-that-is-long-enough-32chars',
            { expiresIn: 600 },
        );

        const res = await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'valid-code', state: 'nonce' })
            .set('Cookie', `oauth_state=${badCookie}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('returns 400 when code or state query param is missing', async () => {
        const res = await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'valid-code' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_CALLBACK');
    });

    it('does not create a channel on state mismatch', async () => {
        const stateCookie = makeStateCookie('correct-nonce', TEST_USER_ID);

        await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'valid-code', state: 'wrong-nonce' })
            .set('Cookie', `oauth_state=${stateCookie}`);

        const count = await Channel.countDocuments({ platform: 'linkedin' });
        expect(count).toBe(0);
    });
});

// ─── Idempotent upsert ─────────────────────────────────────

describe('Idempotent upsert: connect same LinkedIn account twice', () => {
    it('creates only 1 channel document on duplicate connect', async () => {
        const stateCookie1 = makeStateCookie('mock-li-state-nonce', TEST_USER_ID);
        await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'auth-code-1', state: 'mock-li-state-nonce' })
            .set('Cookie', `oauth_state=${stateCookie1}`);

        const stateCookie2 = makeStateCookie('mock-li-state-nonce', TEST_USER_ID);
        await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'auth-code-2', state: 'mock-li-state-nonce' })
            .set('Cookie', `oauth_state=${stateCookie2}`);

        const count = await Channel.countDocuments({
            platform: 'linkedin',
            platformAccountId: MOCK_LI_PROFILE.platformAccountId,
        });

        expect(count).toBe(1);
    });

    it('updates tokens on second connect', async () => {
        const stateCookie1 = makeStateCookie('mock-li-state-nonce', TEST_USER_ID);
        await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'auth-code-1', state: 'mock-li-state-nonce' })
            .set('Cookie', `oauth_state=${stateCookie1}`);

        const firstChannel = await Channel.findOne({
            platform: 'linkedin',
            platformAccountId: MOCK_LI_PROFILE.platformAccountId,
        }).select('+accessToken');
        const firstToken = firstChannel!.accessToken;

        const stateCookie2 = makeStateCookie('mock-li-state-nonce', TEST_USER_ID);
        await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'auth-code-2', state: 'mock-li-state-nonce' })
            .set('Cookie', `oauth_state=${stateCookie2}`);

        const secondChannel = await Channel.findOne({
            platform: 'linkedin',
            platformAccountId: MOCK_LI_PROFILE.platformAccountId,
        }).select('+accessToken');

        expect(secondChannel!.accessToken).not.toBe(firstToken);
        expect(isEncrypted(secondChannel!.accessToken)).toBe(true);
    });
});

// ─── Token stored as ciphertext in DB ──────────────────────

describe('Token stored as ciphertext in DB', () => {
    it('accessToken in DB is ciphertext, not the raw token', async () => {
        const stateCookie = makeStateCookie('mock-li-state-nonce', TEST_USER_ID);
        await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'valid-code', state: 'mock-li-state-nonce' })
            .set('Cookie', `oauth_state=${stateCookie}`);

        const channel = await Channel.findOne({
            platform: 'linkedin',
            platformAccountId: MOCK_LI_PROFILE.platformAccountId,
        }).select('+accessToken');

        expect(channel!.accessToken).not.toBe(MOCK_TOKEN_RESULT.accessToken);
        expect(isEncrypted(channel!.accessToken)).toBe(true);

        const parts = channel!.accessToken.split(':');
        expect(parts).toHaveLength(3);
        expect(parts[0]).toHaveLength(32); // IV hex
        expect(parts[1]).toHaveLength(32); // AuthTag hex
    });
});

// ─── User denies access ────────────────────────────────────

describe('User denies LinkedIn access', () => {
    it('redirects to dashboard with friendly error on access_denied', async () => {
        const res = await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ error: 'access_denied' });

        expect(res.status).toBe(302);
        const location = res.headers['location'] as string;
        expect(location).toContain(DASHBOARD_URL);
        expect(location).toContain('error=access_denied');
        expect(location).toContain('message=');
    });

    it('does not create a channel on access_denied', async () => {
        await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ error: 'access_denied' });

        const count = await Channel.countDocuments({ platform: 'linkedin' });
        expect(count).toBe(0);
    });
});

// ─── Error handling on callback failure ────────────────────

describe('Error handling on LinkedIn callback failure', () => {
    it('redirects to dashboard with error when token exchange fails (non-expired)', async () => {
        const { exchangeCodeForToken } = jest.requireMock(
            '../services/linkedinOAuth.service',
        ) as { exchangeCodeForToken: jest.Mock };
        exchangeCodeForToken.mockRejectedValueOnce(new Error('Token exchange failed'));

        const stateCookie = makeStateCookie('mock-li-state-nonce', TEST_USER_ID);
        const res = await request(app)
            .get('/api/v1/channels/linkedin/callback')
            .query({ code: 'bad-code', state: 'mock-li-state-nonce' })
            .set('Cookie', `oauth_state=${stateCookie}`);

        expect(res.status).toBe(302);
        expect(res.headers['location']).toContain('error=connection_failed');
    });
});
