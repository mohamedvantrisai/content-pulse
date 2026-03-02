import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { resolveSeedValue, SeededRng } from './rng.js';
import type {
    GenerateSeedDatasetOptions,
    GeneratedSeedData,
    SeedChannelDocument,
    SeedPlatform,
    SeedPostDocument,
    SeedPostType,
    SeedUserDocument,
} from './types.js';

const DAYS_TO_GENERATE = 90;
const DEFAULT_POSTS_PER_PLATFORM = 120;
const MINUTES = [0, 10, 20, 30, 40, 50];

const PLATFORM_DISTRIBUTION: Record<SeedPlatform, ReadonlyArray<{ type: SeedPostType; ratio: number }>> = {
    instagram: [
        { type: 'image', ratio: 0.4 },
        { type: 'carousel', ratio: 0.25 },
        { type: 'video', ratio: 0.2 },
        { type: 'text', ratio: 0.15 },
    ],
    linkedin: [
        { type: 'text', ratio: 0.5 },
        { type: 'link', ratio: 0.25 },
        { type: 'image', ratio: 0.15 },
        { type: 'video', ratio: 0.1 },
    ],
};

const DAY_MULTIPLIER: Record<number, number> = {
    0: 0.82,
    1: 0.94,
    2: 1.18,
    3: 1.2,
    4: 1.16,
    5: 0.87,
    6: 0.78,
};

const HOUR_MULTIPLIER: Record<number, number> = {
    0: 0.75,
    1: 0.75,
    2: 0.75,
    3: 0.75,
    4: 0.78,
    5: 0.8,
    6: 0.84,
    7: 0.9,
    8: 0.95,
    9: 1,
    10: 1.22,
    11: 1.25,
    12: 1.28,
    13: 1.25,
    14: 1.22,
    15: 1.08,
    16: 1.04,
    17: 0.98,
    18: 0.95,
    19: 0.91,
    20: 0.88,
    21: 0.84,
    22: 0.81,
    23: 0.78,
};

const POST_TYPE_MULTIPLIER: Record<SeedPostType, number> = {
    video: 1.8,
    carousel: 1.5,
    image: 1.3,
    text: 1,
    link: 1,
};

function objectIdFromKey(key: string): Types.ObjectId {
    const hex = createHash('sha1').update(key).digest('hex').slice(0, 24);
    return Types.ObjectId.createFromHexString(hex);
}

function allocatePostTypeCounts(
    platform: SeedPlatform,
    totalPosts: number,
): Array<{ postType: SeedPostType; count: number }> {
    const ratios = PLATFORM_DISTRIBUTION[platform];
    const allocations = ratios.map(({ type, ratio }) => ({
        postType: type,
        count: Math.floor(totalPosts * ratio),
    }));

    const allocated = allocations.reduce((sum, item) => sum + item.count, 0);
    let remainder = totalPosts - allocated;
    let cursor = 0;
    while (remainder > 0) {
        allocations[cursor % allocations.length]!.count += 1;
        cursor += 1;
        remainder -= 1;
    }

    return allocations;
}

function baseEngagementRate(platform: SeedPlatform): number {
    return platform === 'instagram' ? 0.038 : 0.063;
}

function baseImpressions(platform: SeedPlatform): number {
    return platform === 'instagram' ? 1800 : 1400;
}

function buildContent(platform: SeedPlatform, postType: SeedPostType, index: number): string {
    const prefix = platform === 'instagram' ? 'IG' : 'LI';
    return `${prefix} ${postType.toUpperCase()} insight #${index + 1}: practical growth idea for this week.`;
}

function buildMediaUrls(platform: SeedPlatform, postType: SeedPostType, index: number): string[] {
    if (postType === 'text' || postType === 'link') return [];
    const baseUrl = `https://cdn.contentpulse.dev/demo/${platform}`;
    if (postType === 'carousel') {
        return [
            `${baseUrl}/carousel-${index + 1}-1.jpg`,
            `${baseUrl}/carousel-${index + 1}-2.jpg`,
            `${baseUrl}/carousel-${index + 1}-3.jpg`,
        ];
    }
    if (postType === 'video') {
        return [`${baseUrl}/video-${index + 1}.mp4`];
    }
    return [`${baseUrl}/image-${index + 1}.jpg`];
}

function splitEngagements(
    platform: SeedPlatform,
    postType: SeedPostType,
    engagements: number,
): { likes: number; comments: number; shares: number; clicks: number; saves: number } {
    const profile = platform === 'instagram'
        ? { likes: 0.62, comments: 0.13, shares: 0.1, clicks: 0.05, saves: 0.1 }
        : postType === 'link'
            ? { likes: 0.4, comments: 0.14, shares: 0.12, clicks: 0.26, saves: 0.08 }
            : { likes: 0.48, comments: 0.14, shares: 0.16, clicks: 0.14, saves: 0.08 };

    const likes = Math.round(engagements * profile.likes);
    const comments = Math.round(engagements * profile.comments);
    const shares = Math.round(engagements * profile.shares);
    const clicks = Math.round(engagements * profile.clicks);
    const used = likes + comments + shares + clicks;
    const saves = Math.max(0, engagements - used);

    return { likes, comments, shares, clicks, saves };
}

/**
 * Engagement is synthesized using platform baseline rates and behavior multipliers
 * (day-of-week, posting hour, and post type) to produce realistic analytics trends.
 */
function buildPostMetrics(
    rng: SeededRng,
    platform: SeedPlatform,
    postType: SeedPostType,
    publishedAt: Date,
): SeedPostDocument['metrics'] {
    const dayFactor = DAY_MULTIPLIER[publishedAt.getUTCDay()] ?? 1;
    const hourFactor = HOUR_MULTIPLIER[publishedAt.getUTCHours()] ?? 1;
    const typeFactor = POST_TYPE_MULTIPLIER[postType];
    const noise = 0.88 + rng.nextFloat() * 0.24;

    const impressions = Math.max(
        120,
        Math.round(baseImpressions(platform) * dayFactor * hourFactor * typeFactor * noise),
    );
    const reach = Math.max(90, Math.round(impressions * (0.72 + rng.nextFloat() * 0.2)));
    const engagementRate = baseEngagementRate(platform) * dayFactor * hourFactor * typeFactor * noise;
    const engagements = Math.max(5, Math.round(impressions * engagementRate));
    const split = splitEngagements(platform, postType, engagements);

    return {
        impressions,
        reach,
        engagements,
        likes: split.likes,
        comments: split.comments,
        shares: split.shares,
        clicks: split.clicks,
        saves: split.saves,
    };
}

function toEngagementRatePercent(metrics: SeedPostDocument['metrics']): number {
    if (metrics.impressions <= 0) return 0;
    return Number(((metrics.engagements / metrics.impressions) * 100).toFixed(4));
}

function buildPublishedAt(rng: SeededRng, anchorDate: Date): Date {
    const date = new Date(anchorDate);
    const dayOffset = rng.nextInt(0, DAYS_TO_GENERATE - 1);
    const hour = rng.pickWeighted<number>([
        { value: 10, weight: 3 },
        { value: 11, weight: 3 },
        { value: 12, weight: 3 },
        { value: 13, weight: 3 },
        { value: 14, weight: 3 },
        { value: 9, weight: 1.5 },
        { value: 15, weight: 1.3 },
        { value: 8, weight: 1 },
        { value: 16, weight: 1 },
        { value: 17, weight: 0.9 },
        { value: 18, weight: 0.8 },
        { value: 7, weight: 0.6 },
        { value: 19, weight: 0.6 },
        { value: 6, weight: 0.4 },
        { value: 20, weight: 0.4 },
    ]);
    const minute = rng.pickOne(MINUTES);

    date.setUTCDate(date.getUTCDate() - dayOffset);
    date.setUTCHours(hour, minute, 0, 0);
    if (date.getTime() > anchorDate.getTime()) {
        date.setUTCDate(date.getUTCDate() - 1);
    }
    return date;
}

function buildUser(seed: string): SeedUserDocument {
    return {
        _id: objectIdFromKey(`${seed}:user`),
        email: 'developer@contentpulse.dev',
        name: 'Demo Developer',
        passwordHash: '$2b$12$T2bM0Pgs0N6.5P7fY4H.vOqnQf6mfhA3f0ktwVDqveufqdpypPn6e',
        plan: 'pro',
        timezone: 'UTC',
        emailReportPreferences: {
            enabled: true,
            frequency: 'weekly',
            dayOfWeek: 2,
            channelIds: [],
        },
    };
}

function buildChannels(seed: string, userId: Types.ObjectId): SeedChannelDocument[] {
    return [
        {
            _id: objectIdFromKey(`${seed}:channel:instagram`),
            userId,
            platform: 'instagram',
            platformAccountId: 'ig_demo_001',
            displayName: 'Content Pulse Instagram',
            handle: '@contentpulse_demo',
            accessToken: 'ig-demo-access-token',
            refreshToken: 'ig-demo-refresh-token',
            tokenExpiresAt: undefined,
            followerCount: 48620,
            syncStatus: 'active',
            syncErrorMessage: undefined,
            lastSyncedAt: undefined,
            metadata: { vertical: 'saas' },
        },
        {
            _id: objectIdFromKey(`${seed}:channel:linkedin`),
            userId,
            platform: 'linkedin',
            platformAccountId: 'li_demo_001',
            displayName: 'Content Pulse LinkedIn',
            handle: 'contentpulse-company',
            accessToken: 'li-demo-access-token',
            refreshToken: 'li-demo-refresh-token',
            tokenExpiresAt: undefined,
            followerCount: 23980,
            syncStatus: 'active',
            syncErrorMessage: undefined,
            lastSyncedAt: undefined,
            metadata: { vertical: 'b2b' },
        },
    ];
}

function buildPlatformPosts(
    rng: SeededRng,
    seed: string,
    anchorDate: Date,
    userId: Types.ObjectId,
    channel: SeedChannelDocument,
    totalPosts: number,
): SeedPostDocument[] {
    const allocations = allocatePostTypeCounts(channel.platform, totalPosts);
    const postTypes: SeedPostType[] = [];

    for (const allocation of allocations) {
        for (let count = 0; count < allocation.count; count += 1) {
            postTypes.push(allocation.postType);
        }
    }

    const shuffledTypes = rng.shuffle(postTypes);
    const posts: SeedPostDocument[] = [];

    for (let index = 0; index < shuffledTypes.length; index += 1) {
        const postType = shuffledTypes[index] as SeedPostType;
        const publishedAt = buildPublishedAt(rng, anchorDate);
        const metrics = buildPostMetrics(rng, channel.platform, postType, publishedAt);
        const engagementRate = toEngagementRatePercent(metrics);
        const postId = objectIdFromKey(`${seed}:${channel.platform}:post:${index + 1}`);
        const platformPostId = `${channel.platform}_${String(index + 1).padStart(4, '0')}`;

        posts.push({
            _id: postId,
            channelId: channel._id,
            userId,
            platformPostId,
            platform: channel.platform,
            content: buildContent(channel.platform, postType, index),
            mediaUrls: buildMediaUrls(channel.platform, postType, index),
            postType,
            publishedAt,
            metrics,
            metricsHistory: [
                {
                    metrics: {
                        impressions: Math.max(100, Math.round(metrics.impressions * 0.86)),
                        reach: Math.max(80, Math.round(metrics.reach * 0.88)),
                        engagements: Math.max(4, Math.round(metrics.engagements * 0.83)),
                        likes: Math.max(2, Math.round(metrics.likes * 0.84)),
                        comments: Math.max(0, Math.round(metrics.comments * 0.8)),
                        shares: Math.max(0, Math.round(metrics.shares * 0.82)),
                        clicks: Math.max(0, Math.round(metrics.clicks * 0.8)),
                        saves: Math.max(0, Math.round(metrics.saves * 0.85)),
                    },
                    recordedAt: new Date(publishedAt.getTime() + 1000 * 60 * 60 * 24),
                },
            ],
            engagementRate,
        });
    }

    return posts;
}

export function generateSeedDataset(options: GenerateSeedDatasetOptions = {}): GeneratedSeedData {
    const seed = resolveSeedValue(options.seed);
    const rng = new SeededRng(seed);
    const now = options.now ? new Date(options.now) : new Date();
    const postsPerPlatform = options.postCountPerPlatform ?? DEFAULT_POSTS_PER_PLATFORM;
    const user = buildUser(seed);
    const channels = buildChannels(seed, user._id);

    const posts = channels.flatMap((channel) =>
        buildPlatformPosts(rng, seed, now, user._id, channel, postsPerPlatform),
    );

    return {
        seed,
        generatedAt: now,
        user,
        channels,
        posts,
    };
}
