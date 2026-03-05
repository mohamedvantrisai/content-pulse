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

const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const META_OAUTH_BASE = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

const SCOPES = ['instagram_basic', 'instagram_manage_insights'] as const;

interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export interface AuthUrlResult {
    url: string;
    state: string;
}

export interface TokenExchangeResult {
    accessToken: string;
    expiresIn: number;
}

/**
 * Instagram connector — Meta Graph API integration.
 *
 * Implements the 4 abstract BaseConnector methods and adds
 * OAuth-specific helpers (buildAuthUrl, exchangeCodeForToken)
 * that are not part of the base contract.
 */
export class InstagramConnector extends BaseConnector {
    readonly platform = 'instagram' as const;

    // ─── OAuth helpers (not part of abstract contract) ──────

    private getOAuthConfig(): OAuthConfig {
        const { META_CLIENT_ID, META_CLIENT_SECRET, META_REDIRECT_URI } = env;

        if (!META_CLIENT_ID || !META_CLIENT_SECRET || !META_REDIRECT_URI) {
            throw new Error(
                'Meta OAuth is not configured. Set META_CLIENT_ID, META_CLIENT_SECRET, and META_REDIRECT_URI.',
            );
        }

        return {
            clientId: META_CLIENT_ID,
            clientSecret: META_CLIENT_SECRET,
            redirectUri: META_REDIRECT_URI,
        };
    }

    buildAuthUrl(): AuthUrlResult {
        const config = this.getOAuthConfig();
        const state = randomBytes(32).toString('hex');

        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: SCOPES.join(','),
            response_type: 'code',
            state,
        });

        return {
            url: `${META_OAUTH_BASE}?${params.toString()}`,
            state,
        };
    }

    async exchangeCodeForToken(code: string): Promise<TokenExchangeResult> {
        const config = this.getOAuthConfig();

        const shortLivedRes = await fetch(`${META_GRAPH_BASE}/oauth/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: config.redirectUri,
                code,
            }),
        });

        if (!shortLivedRes.ok) {
            const body = await shortLivedRes.text();
            logger.error({ status: shortLivedRes.status }, 'Meta short-lived token exchange failed');
            throw new Error(`Token exchange failed: ${body}`);
        }

        const shortLived = (await shortLivedRes.json()) as {
            access_token: string;
            token_type: string;
        };

        const longLivedParams = new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            fb_exchange_token: shortLived.access_token,
        });

        const longLivedRes = await fetch(
            `${META_GRAPH_BASE}/oauth/access_token?${longLivedParams.toString()}`,
        );

        if (!longLivedRes.ok) {
            const body = await longLivedRes.text();
            logger.error({ status: longLivedRes.status }, 'Meta long-lived token exchange failed');
            throw new Error(`Long-lived token exchange failed: ${body}`);
        }

        const longLived = (await longLivedRes.json()) as {
            access_token: string;
            token_type: string;
            expires_in: number;
        };

        return {
            accessToken: longLived.access_token,
            expiresIn: longLived.expires_in,
        };
    }

    // ─── BaseConnector abstract implementations ─────────────

    async getProfile(accessToken: string): Promise<ProfileInfo> {
        const pagesRes = await fetch(
            `${META_GRAPH_BASE}/me/accounts?fields=id,instagram_business_account&access_token=${accessToken}`,
        );

        if (!pagesRes.ok) {
            const body = await pagesRes.text();
            logger.error({ status: pagesRes.status }, 'Failed to fetch Facebook pages');
            throw new Error(`Failed to fetch pages: ${body}`);
        }

        const pages = (await pagesRes.json()) as {
            data: Array<{
                id: string;
                instagram_business_account?: { id: string };
            }>;
        };

        const pageWithIg = pages.data.find((p) => p.instagram_business_account?.id);
        if (!pageWithIg?.instagram_business_account) {
            throw new Error(
                'No Instagram Business account found. Ensure your Facebook Page is linked to an Instagram Business or Creator account.',
            );
        }

        const igUserId = pageWithIg.instagram_business_account.id;

        const igRes = await fetch(
            `${META_GRAPH_BASE}/${igUserId}?fields=id,username,name,followers_count,follows_count&access_token=${accessToken}`,
        );

        if (!igRes.ok) {
            const body = await igRes.text();
            logger.error({ status: igRes.status }, 'Failed to fetch Instagram account details');
            throw new Error(`Failed to fetch IG account: ${body}`);
        }

        const igUser = (await igRes.json()) as {
            id: string;
            username: string;
            name?: string;
            followers_count?: number;
            follows_count?: number;
        };

        return {
            platformAccountId: igUser.id,
            displayName: igUser.name ?? igUser.username,
            handle: igUser.username,
            followerCount: igUser.followers_count ?? 0,
            followingCount: igUser.follows_count ?? 0,
        };
    }

    async getPosts(_accessToken: string, _since?: Date): Promise<PostData[]> {
        throw new Error('InstagramConnector.getPosts is not yet implemented (future sync story).');
    }

    async getPostMetrics(
        _accessToken: string,
        _platformPostId: string,
    ): Promise<NormalizedMetrics> {
        throw new Error('InstagramConnector.getPostMetrics is not yet implemented (future sync story).');
    }

    async refreshAccessToken(_refreshToken: string): Promise<TokenRefreshResult> {
        throw new Error('InstagramConnector.refreshAccessToken is not yet implemented (future sync story).');
    }
}
