import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import {
    BaseConnector,
    type NormalizedMetrics,
    type PostData,
    type ProfileInfo,
    type TokenRefreshResult,
} from './base.connector.js';

const DEFAULT_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const DEFAULT_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const DEFAULT_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

const SCOPES = ['openid', 'profile', 'w_member_social'] as const;

interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authUrl: string;
    tokenUrl: string;
    userinfoUrl: string;
}

export interface AuthUrlResult {
    url: string;
    state: string;
}

export interface TokenExchangeResult {
    accessToken: string;
    expiresIn: number;
}

export class LinkedInOAuthError extends Error {
    constructor(
        message: string,
        public readonly oauthError?: string,
    ) {
        super(message);
        this.name = 'LinkedInOAuthError';
    }
}

/**
 * LinkedIn connector — OpenID Connect / OAuth 2.0 integration.
 *
 * Uses LinkedIn's /v2/userinfo (OIDC) for profile data and the
 * standard authorization-code grant for token exchange.
 */
export class LinkedInConnector extends BaseConnector {
    readonly platform = 'linkedin' as const;

    // ─── OAuth helpers (not part of abstract contract) ──────

    private getOAuthConfig(): OAuthConfig {
        const {
            LINKEDIN_CLIENT_ID,
            LINKEDIN_CLIENT_SECRET,
            LINKEDIN_REDIRECT_URI,
            LINKEDIN_AUTH_URL,
            LINKEDIN_TOKEN_URL,
            LINKEDIN_USERINFO_URL,
        } = env;

        if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_REDIRECT_URI) {
            throw new Error(
                'LinkedIn OAuth is not configured. Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI.',
            );
        }

        return {
            clientId: LINKEDIN_CLIENT_ID,
            clientSecret: LINKEDIN_CLIENT_SECRET,
            redirectUri: LINKEDIN_REDIRECT_URI,
            authUrl: LINKEDIN_AUTH_URL ?? DEFAULT_AUTH_URL,
            tokenUrl: LINKEDIN_TOKEN_URL ?? DEFAULT_TOKEN_URL,
            userinfoUrl: LINKEDIN_USERINFO_URL ?? DEFAULT_USERINFO_URL,
        };
    }

    buildAuthUrl(): AuthUrlResult {
        const config = this.getOAuthConfig();
        const state = randomBytes(32).toString('hex');

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: SCOPES.join(' '),
            state,
        });

        return {
            url: `${config.authUrl}?${params.toString()}`,
            state,
        };
    }

    async exchangeCodeForToken(code: string): Promise<TokenExchangeResult> {
        const config = this.getOAuthConfig();

        const res = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: config.redirectUri,
            }),
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({})) as Record<string, unknown>;
            const oauthError = (body['error'] as string) ?? undefined;

            logger.error({ status: res.status }, 'LinkedIn token exchange failed');

            if (oauthError === 'invalid_grant') {
                throw new LinkedInOAuthError(
                    'Authorization code has expired or is invalid. Please try connecting again.',
                    'invalid_grant',
                );
            }

            throw new LinkedInOAuthError(
                `LinkedIn token exchange failed (HTTP ${res.status})`,
                oauthError,
            );
        }

        const data = (await res.json()) as {
            access_token: string;
            expires_in: number;
        };

        return {
            accessToken: data.access_token,
            expiresIn: data.expires_in,
        };
    }

    // ─── BaseConnector abstract implementations ─────────────

    async getProfile(accessToken: string): Promise<ProfileInfo> {
        const config = this.getOAuthConfig();

        const res = await fetch(config.userinfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
            const body = await res.text();
            logger.error({ status: res.status }, 'Failed to fetch LinkedIn userinfo');
            throw new Error(`Failed to fetch LinkedIn profile: ${body}`);
        }

        const userinfo = (await res.json()) as {
            sub: string;
            name?: string;
            given_name?: string;
            family_name?: string;
            email?: string;
            picture?: string;
        };

        const displayName =
            userinfo.name ??
            ([userinfo.given_name, userinfo.family_name].filter(Boolean).join(' ') ||
            'LinkedIn User');

        const handle = userinfo.email ?? userinfo.sub;

        return {
            platformAccountId: userinfo.sub,
            displayName,
            handle,
            followerCount: 0,
            followingCount: 0,
        };
    }

    async getPosts(_accessToken: string, _since?: Date): Promise<PostData[]> {
        throw new Error('LinkedInConnector.getPosts is not yet implemented (future sync story).');
    }

    async getPostMetrics(
        _accessToken: string,
        _platformPostId: string,
    ): Promise<NormalizedMetrics> {
        throw new Error('LinkedInConnector.getPostMetrics is not yet implemented (future sync story).');
    }

    async refreshAccessToken(_refreshToken: string): Promise<TokenRefreshResult> {
        throw new Error('LinkedInConnector.refreshAccessToken is not yet implemented (future sync story).');
    }
}
