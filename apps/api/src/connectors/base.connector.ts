/**
 * Shared metric interface that all connectors normalise platform-specific
 * metrics to. See TDD Section 6.2 — Platform Metric Mapping.
 */
export interface NormalizedMetrics {
    impressions: number;
    reach: number;
    engagements: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    saves: number;
}

export interface ProfileInfo {
    platformAccountId: string;
    displayName: string;
    handle: string;
    followerCount: number;
    followingCount: number;
}

export interface PostData {
    platformPostId: string;
    content: string;
    postType: 'text' | 'image' | 'video' | 'link' | 'carousel';
    publishedAt: Date;
    metrics: NormalizedMetrics;
}

export interface TokenRefreshResult {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
}

/**
 * Abstract base class for platform connectors.
 *
 * Each platform (Instagram, LinkedIn, …) implements this contract.
 * Adding a new platform = implementing 4 methods, zero changes to the
 * service layer.  See TDD Section 6.1.
 */
export abstract class BaseConnector {
    abstract readonly platform: 'instagram' | 'linkedin';

    abstract getProfile(accessToken: string): Promise<ProfileInfo>;

    abstract getPosts(accessToken: string, since?: Date): Promise<PostData[]>;

    abstract getPostMetrics(
        accessToken: string,
        platformPostId: string,
    ): Promise<NormalizedMetrics>;

    abstract refreshAccessToken(refreshToken: string): Promise<TokenRefreshResult>;
}
