import { ConnectorRegistry } from '../connectors/registry.js';
import { LinkedInConnector } from '../connectors/linkedin.connector.js';

export interface AuthUrlResult {
    url: string;
    state: string;
}

export interface TokenResult {
    accessToken: string;
    expiresIn: number;
}

export interface LinkedInProfileInfo {
    platformAccountId: string;
    displayName: string;
    handle: string;
    followerCount: number;
}

function getLinkedInConnector(): LinkedInConnector {
    return ConnectorRegistry.getConnector('linkedin') as LinkedInConnector;
}

export function buildAuthUrl(): AuthUrlResult {
    return getLinkedInConnector().buildAuthUrl();
}

export async function exchangeCodeForToken(code: string): Promise<TokenResult> {
    return getLinkedInConnector().exchangeCodeForToken(code);
}

export async function fetchLinkedInProfile(
    accessToken: string,
): Promise<LinkedInProfileInfo> {
    const profile = await getLinkedInConnector().getProfile(accessToken);
    return {
        platformAccountId: profile.platformAccountId,
        displayName: profile.displayName,
        handle: profile.handle,
        followerCount: profile.followerCount,
    };
}
