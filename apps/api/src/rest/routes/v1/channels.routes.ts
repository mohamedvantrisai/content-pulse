import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { validate } from '../../../middleware/validate.js';
import { optionalAuthMiddleware } from '../../../middleware/auth.js';
import { successResponse, errorResponse } from '../../../utils/response.js';
import {
    listChannelsByUser,
    resolveChannelsUserId,
    upsertChannel,
    updateSyncStatus,
    disconnectChannel,
    getChannelDetailAnalytics,
} from '../../../services/channels.service.js';
import { strictIsoDate } from '../../../utils/date-validation.js';
import {
    buildAuthUrl as buildInstagramAuthUrl,
    exchangeCodeForToken as exchangeInstagramCode,
    fetchInstagramAccount,
} from '../../../services/instagramOAuth.service.js';
import {
    buildAuthUrl as buildLinkedInAuthUrl,
    exchangeCodeForToken as exchangeLinkedInCode,
    fetchLinkedInProfile,
} from '../../../services/linkedinOAuth.service.js';
import { LinkedInOAuthError } from '../../../connectors/linkedin.connector.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';

const router: Router = Router();

const STATE_COOKIE_NAME = 'oauth_state';
const STATE_COOKIE_MAX_AGE_S = 600;

function parseCookies(header: string | undefined): Record<string, string> {
    if (!header) return {};
    return Object.fromEntries(
        header.split(';').map((c) => {
            const [key, ...rest] = c.trim().split('=');
            return [key, rest.join('=')] as [string, string];
        }),
    );
}

function dashboardRedirect(params: Record<string, string>): string {
    const base = env.DASHBOARD_URL ?? 'http://localhost:5173';
    const qs = new URLSearchParams(params).toString();
    return `${base}/channels?${qs}`;
}

function wantsJson(req: import('express').Request): boolean {
    const accept = req.headers.accept ?? '';
    return accept.includes('application/json');
}

const DEV_DUMMY_CHANNELS: Record<'instagram' | 'linkedin', {
    platformAccountId: string; displayName: string; handle: string; followerCount: number;
}> = {
    instagram: {
        platformAccountId: 'ig_dev_001',
        displayName: 'Dev Instagram',
        handle: '@dev_instagram',
        followerCount: 12_500,
    },
    linkedin: {
        platformAccountId: 'li_dev_001',
        displayName: 'Dev LinkedIn',
        handle: 'dev-linkedin',
        followerCount: 8_300,
    },
};

async function devFallbackConnect(
    userId: string,
    platform: 'instagram' | 'linkedin',
): Promise<string> {
    const dummy = DEV_DUMMY_CHANNELS[platform];
    const channel = await upsertChannel({
        userId,
        platform,
        platformAccountId: dummy.platformAccountId,
        displayName: dummy.displayName,
        handle: dummy.handle,
        accessToken: 'dev_fake_token',
        tokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });
    channel.followerCount = dummy.followerCount;
    await channel.save();
    logger.info({ userId, platform }, 'Dev fallback: seeded dummy channel');
    return dashboardRedirect({ connected: platform });
}

function setStateCookie(
    res: import('express').Response,
    nonce: string,
    userId: string,
    cookiePath: string,
): void {
    const stateCookie = jwt.sign(
        { nonce, userId },
        env.JWT_SECRET,
        { expiresIn: STATE_COOKIE_MAX_AGE_S },
    );

    res.cookie(STATE_COOKIE_NAME, stateCookie, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        path: cookiePath,
        maxAge: STATE_COOKIE_MAX_AGE_S * 1000,
    });
}

function validateStateCookie(
    req: import('express').Request,
    stateParam: string,
): { nonce: string; userId: string } {
    const cookies = parseCookies(req.headers.cookie);
    const stateCookie = cookies[STATE_COOKIE_NAME];

    if (!stateCookie) {
        const err = new Error('Missing OAuth state cookie. Please try connecting again.');
        (err as Error & { code: string }).code = 'CSRF_VALIDATION_FAILED';
        throw err;
    }

    let decoded: { nonce: string; userId: string };
    try {
        decoded = jwt.verify(stateCookie, env.JWT_SECRET) as typeof decoded;
    } catch {
        const err = new Error('Invalid or expired OAuth state. Please try connecting again.');
        (err as Error & { code: string }).code = 'CSRF_VALIDATION_FAILED';
        throw err;
    }

    if (decoded.nonce !== stateParam) {
        const err = new Error('OAuth state mismatch. Please try connecting again.');
        (err as Error & { code: string }).code = 'CSRF_VALIDATION_FAILED';
        throw err;
    }

    return decoded;
}

// ─── Shared param schemas ────────────────────────────────────

const channelIdParam = z.object({
    id: z.string().refine(
        (v) => mongoose.Types.ObjectId.isValid(v),
        'Invalid channel ID',
    ),
});

// ─── List channels ──────────────────────────────────────────

const listChannelsSchema = z.object({
    query: z.object({
        platform: z.string().optional(),
    }),
    body: z.unknown(),
    params: z.unknown(),
});

router.get('/', optionalAuthMiddleware, validate(listChannelsSchema), async (req, res, next) => {
    try {
        const userId = await resolveChannelsUserId(req.user?.id);
        const data = await listChannelsByUser(userId);
        res.json(successResponse(data));
    } catch (err) {
        next(err);
    }
});

// ─── Update sync status (pause / resume) ────────────────────

const patchChannelSchema = z.object({
    params: channelIdParam,
    body: z.object({
        syncStatus: z.enum(['active', 'paused']),
    }),
    query: z.unknown(),
});

router.patch('/:id', optionalAuthMiddleware, validate(patchChannelSchema), async (req, res, next) => {
    try {
        const userId = await resolveChannelsUserId(req.user?.id);
        const channelId = req.params['id'] as string;
        const channel = await updateSyncStatus(
            userId,
            channelId,
            req.body.syncStatus as 'active' | 'paused',
        );
        res.json(successResponse(channel));
    } catch (err) {
        next(err);
    }
});

// ─── Disconnect channel (soft delete) ───────────────────────

const deleteChannelSchema = z.object({
    params: channelIdParam,
    body: z.unknown(),
    query: z.unknown(),
});

router.delete('/:id', optionalAuthMiddleware, validate(deleteChannelSchema), async (req, res, next) => {
    try {
        const userId = await resolveChannelsUserId(req.user?.id);
        const channelId = req.params['id'] as string;
        await disconnectChannel(userId, channelId);
        res.status(204).end();
    } catch (err) {
        next(err);
    }
});

// ─── Channel detail analytics ───────────────────────────────

const channelAnalyticsSchema = z.object({
    params: channelIdParam,
    query: z
        .object({
            start: strictIsoDate('start is required'),
            end: strictIsoDate('end is required'),
        })
        .refine((q) => q.end >= q.start, {
            message: 'end must be greater than or equal to start',
            path: ['end'],
        }),
    body: z.unknown(),
});

router.get('/:id/analytics', optionalAuthMiddleware, validate(channelAnalyticsSchema), async (req, res, next) => {
    try {
        const userId = await resolveChannelsUserId(req.user?.id);
        const channelId = req.params['id'] as string;
        const { start, end } = req.query as { start: string; end: string };
        const data = await getChannelDetailAnalytics(
            userId,
            channelId,
            start,
            end,
        );
        res.json(successResponse(data, { dateRange: `${start}/${end}` }));
    } catch (err) {
        next(err);
    }
});

// ─── Instagram OAuth: start connect ─────────────────────────

const IG_COOKIE_PATH = '/api/v1/channels/instagram';

router.get('/instagram/connect', optionalAuthMiddleware, async (req, res, next) => {
    try {
        const userId = await resolveChannelsUserId(req.user?.id);

        let url: string;
        try {
            const auth = buildInstagramAuthUrl();
            url = auth.url;
            setStateCookie(res, auth.state, userId, IG_COOKIE_PATH);
        } catch {
            url = await devFallbackConnect(userId, 'instagram');
        }

        if (wantsJson(req)) {
            res.json(successResponse({ url }));
        } else {
            res.redirect(url);
        }
    } catch (err) {
        next(err);
    }
});

// ─── Instagram OAuth: callback ──────────────────────────────

router.get('/instagram/callback', async (req, res) => {
    const queryError = req.query['error'] as string | undefined;
    if (queryError) {
        const message =
            queryError === 'access_denied'
                ? 'You denied access to your Instagram account.'
                : 'An error occurred during Instagram authorization.';
        res.redirect(dashboardRedirect({ error: queryError, message }));
        return;
    }

    const code = req.query['code'] as string | undefined;
    const stateParam = req.query['state'] as string | undefined;

    if (!code || !stateParam) {
        res.status(400).json(
            errorResponse('INVALID_CALLBACK', 'Missing code or state parameter.'),
        );
        return;
    }

    let decoded: { nonce: string; userId: string };
    try {
        decoded = validateStateCookie(req, stateParam);
    } catch (err) {
        res.status(400).json(
            errorResponse(
                (err as Error & { code: string }).code ?? 'CSRF_VALIDATION_FAILED',
                (err as Error).message,
            ),
        );
        return;
    }

    try {
        const { accessToken, expiresIn } = await exchangeInstagramCode(code);
        const igAccount = await fetchInstagramAccount(accessToken);

        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

        await upsertChannel({
            userId: decoded.userId,
            platform: 'instagram',
            platformAccountId: igAccount.platformAccountId,
            displayName: igAccount.displayName,
            handle: igAccount.username,
            accessToken,
            tokenExpiresAt,
        });

        logger.info(
            { userId: decoded.userId, platformAccountId: igAccount.platformAccountId },
            'Instagram channel connected',
        );

        res.clearCookie(STATE_COOKIE_NAME, { path: IG_COOKIE_PATH });
        res.redirect(dashboardRedirect({ connected: 'instagram' }));
    } catch (err) {
        logger.error(
            { userId: decoded.userId, error: (err as Error).message },
            'Instagram OAuth callback failed',
        );
        res.redirect(
            dashboardRedirect({
                error: 'connection_failed',
                message: 'Failed to connect your Instagram account. Please try again.',
            }),
        );
    }
});

// ─── LinkedIn OAuth: start connect ──────────────────────────

const LI_COOKIE_PATH = '/api/v1/channels/linkedin';

router.get('/linkedin/connect', optionalAuthMiddleware, async (req, res, next) => {
    try {
        const userId = await resolveChannelsUserId(req.user?.id);

        let url: string;
        try {
            const auth = buildLinkedInAuthUrl();
            url = auth.url;
            setStateCookie(res, auth.state, userId, LI_COOKIE_PATH);
        } catch {
            url = await devFallbackConnect(userId, 'linkedin');
        }

        if (wantsJson(req)) {
            res.json(successResponse({ url }));
        } else {
            res.redirect(url);
        }
    } catch (err) {
        next(err);
    }
});

// ─── LinkedIn OAuth: callback ───────────────────────────────

router.get('/linkedin/callback', async (req, res) => {
    const queryError = req.query['error'] as string | undefined;
    if (queryError) {
        const description = req.query['error_description'] as string | undefined;
        const message =
            queryError === 'access_denied'
                ? 'You denied access to your LinkedIn account.'
                : description ?? 'An error occurred during LinkedIn authorization.';
        res.redirect(dashboardRedirect({ error: queryError, message }));
        return;
    }

    const code = req.query['code'] as string | undefined;
    const stateParam = req.query['state'] as string | undefined;

    if (!code || !stateParam) {
        res.status(400).json(
            errorResponse('INVALID_CALLBACK', 'Missing code or state parameter.'),
        );
        return;
    }

    let decoded: { nonce: string; userId: string };
    try {
        decoded = validateStateCookie(req, stateParam);
    } catch (err) {
        res.status(400).json(
            errorResponse(
                (err as Error & { code: string }).code ?? 'CSRF_VALIDATION_FAILED',
                (err as Error).message,
            ),
        );
        return;
    }

    try {
        const { accessToken, expiresIn } = await exchangeLinkedInCode(code);
        const profile = await fetchLinkedInProfile(accessToken);

        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

        await upsertChannel({
            userId: decoded.userId,
            platform: 'linkedin',
            platformAccountId: profile.platformAccountId,
            displayName: profile.displayName,
            handle: profile.handle,
            accessToken,
            tokenExpiresAt,
        });

        logger.info(
            { userId: decoded.userId, platformAccountId: profile.platformAccountId },
            'LinkedIn channel connected',
        );

        res.clearCookie(STATE_COOKIE_NAME, { path: LI_COOKIE_PATH });
        res.redirect(dashboardRedirect({ connected: 'linkedin' }));
    } catch (err) {
        const isExpiredCode =
            err instanceof LinkedInOAuthError && err.oauthError === 'invalid_grant';

        logger.error(
            { userId: decoded.userId, error: (err as Error).message },
            'LinkedIn OAuth callback failed',
        );

        if (isExpiredCode) {
            res.redirect(
                dashboardRedirect({
                    error: 'expired_code',
                    message: 'Authorization code has expired. Please try connecting again.',
                }),
            );
        } else {
            res.redirect(
                dashboardRedirect({
                    error: 'connection_failed',
                    message: 'Failed to connect your LinkedIn account. Please try again.',
                }),
            );
        }
    }
});

export default router;
