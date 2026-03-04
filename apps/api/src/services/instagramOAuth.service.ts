import { ConnectorRegistry } from '../connectors/registry.js';
import { InstagramConnector } from '../connectors/instagram.connector.js';

export interface AuthUrlResult {
    url: string;
    state: string;
}

export interface TokenResult {
    accessToken: string;
    expiresIn: number;
}

export interface InstagramAccountInfo {
    platformAccountId: string;
    username: string;
    displayName: string;
}

function getInstagramConnector(): InstagramConnector {
    return ConnectorRegistry.getConnector('instagram') as InstagramConnector;
}

export function buildAuthUrl(): AuthUrlResult {
    return getInstagramConnector().buildAuthUrl();
}

export async function exchangeCodeForToken(code: string): Promise<TokenResult> {
    return getInstagramConnector().exchangeCodeForToken(code);
}

export async function fetchInstagramAccount(
    accessToken: string,
): Promise<InstagramAccountInfo> {
    const profile = await getInstagramConnector().getProfile(accessToken);
    return {
        platformAccountId: profile.platformAccountId,
        username: profile.handle,
        displayName: profile.displayName,
    };
}
