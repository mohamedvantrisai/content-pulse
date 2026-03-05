import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { validate } from '../../../middleware/validate.js';
import { authMiddleware } from '../../../middleware/auth.js';
import { successResponse, errorResponse } from '../../../utils/response.js';
import { listChannels, upsertChannel } from '../../../services/channels.service.js';
import {
    buildAuthUrl,
    exchangeCodeForToken,
    fetchInstagramAccount,
} from '../../../services/instagramOAuth.service.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';

const router: Router = Router();

const STATE_COOKIE_NAME = 'oauth_state';
const STATE_COOKIE_MAX_AGE_S = 600;
const STATE_COOKIE_PATH = '/api/v1/channels/instagram';

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
    return `${base}?${qs}`;
}

// ─── List channels ──────────────────────────────────────────

const listChannelsSchema = z.object({
    query: z.object({
        platform: z.string().optional(),
    }),
    body: z.unknown(),
    params: z.unknown(),
});

router.get('/', validate(listChannelsSchema), (_req, res) => {
    const data = listChannels();
    res.json(successResponse(data));
});

// ─── Instagram OAuth: start connect ─────────────────────────

router.get('/instagram/connect', authMiddleware, (req, res, next) => {
    try {
        const userId = req.user!.id;
        const { url, state } = buildAuthUrl();

        const stateCookie = jwt.sign(
            { nonce: state, userId },
            env.JWT_SECRET,
            { expiresIn: STATE_COOKIE_MAX_AGE_S },
        );

        res.cookie(STATE_COOKIE_NAME, stateCookie, {
            httpOnly: true,
            sameSite: 'lax',
            secure: env.NODE_ENV === 'production',
            path: STATE_COOKIE_PATH,
            maxAge: STATE_COOKIE_MAX_AGE_S * 1000,
        });

        res.redirect(url);
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

    const cookies = parseCookies(req.headers.cookie);
    const stateCookie = cookies[STATE_COOKIE_NAME];

    if (!stateCookie) {
        res.status(400).json(
            errorResponse('CSRF_VALIDATION_FAILED', 'Missing OAuth state cookie. Please try connecting again.'),
        );
        return;
    }

    let decoded: { nonce: string; userId: string };
    try {
        decoded = jwt.verify(stateCookie, env.JWT_SECRET) as typeof decoded;
    } catch {
        res.status(400).json(
            errorResponse('CSRF_VALIDATION_FAILED', 'Invalid or expired OAuth state. Please try connecting again.'),
        );
        return;
    }

    if (decoded.nonce !== stateParam) {
        res.status(400).json(
            errorResponse('CSRF_VALIDATION_FAILED', 'OAuth state mismatch. Please try connecting again.'),
        );
        return;
    }

    try {
        const { accessToken, expiresIn } = await exchangeCodeForToken(code);
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

        res.clearCookie(STATE_COOKIE_NAME, { path: STATE_COOKIE_PATH });
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

export default router;
