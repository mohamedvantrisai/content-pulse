import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { validate } from '../../../middleware/validate.js';
import { authMiddleware } from '../../../middleware/auth.js';
import { successResponse, errorResponse } from '../../../utils/response.js';
import { listChannelsByUser, resolveChannelsUserId, upsertChannel } from '../../../services/channels.service.js';
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

// ─── List channels ──────────────────────────────────────────

const listChannelsSchema = z.object({
    query: z.object({
        platform: z.string().optional(),
    }),
    body: z.unknown(),
    params: z.unknown(),
});

router.get('/', validate(listChannelsSchema), async (req, res, next) => {
    try {
        const userId = await resolveChannelsUserId(req.user?.id);
        const data = await listChannelsByUser(userId);
        res.json(successResponse(data));
    } catch (err) {
        next(err);
    }
});

// ─── Instagram OAuth: start connect ─────────────────────────

const IG_COOKIE_PATH = '/api/v1/channels/instagram';

router.get('/instagram/connect', authMiddleware, (req, res, next) => {
    try {
        const userId = req.user!.id;
        const { url, state } = buildInstagramAuthUrl();
        setStateCookie(res, state, userId, IG_COOKIE_PATH);

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

router.get('/linkedin/connect', authMiddleware, (req, res, next) => {
    try {
        const userId = req.user!.id;
        const { url, state } = buildLinkedInAuthUrl();
        setStateCookie(res, state, userId, LI_COOKIE_PATH);

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
