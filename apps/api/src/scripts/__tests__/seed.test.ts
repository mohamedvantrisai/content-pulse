import { Post, User, Channel } from '../../models/index.js';
import { runSeed } from '../seed.js';

type PostLean = {
    platform: 'instagram' | 'linkedin';
    postType: 'text' | 'image' | 'video' | 'link' | 'carousel';
    publishedAt: Date;
    metrics: {
        impressions: number;
        engagements: number;
        likes: number;
        comments: number;
        shares: number;
        clicks: number;
        saves: number;
    };
};

function average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe('seed script', () => {

    it('TC-1..TC-8: creates deterministic realistic data and logs summary', async () => {
        const now = new Date('2026-03-02T12:00:00.000Z');
        const logger = {
            info: jest.fn(),
            error: jest.fn(),
        };

        const deps = {
            connect: async () => undefined,
            disconnect: async () => undefined,
            logger,
        };

        const firstSummary = await runSeed({
            seed: 'seed-test-v1',
            now,
            deps,
        });

        // TC-1
        expect(firstSummary.usersCount).toBe(1);
        expect(firstSummary.channelsCount).toBe(2);
        const firstTotalPosts = firstSummary.postsByPlatform.instagram + firstSummary.postsByPlatform.linkedin;
        expect(firstTotalPosts).toBeGreaterThanOrEqual(200);

        // TC-2
        const secondSummary = await runSeed({
            seed: 'seed-test-v1',
            now,
            deps,
        });
        expect(secondSummary.usersCount).toBe(1);
        expect(secondSummary.channelsCount).toBe(2);
        expect(secondSummary.postsByPlatform.instagram + secondSummary.postsByPlatform.linkedin).toBe(
            firstTotalPosts,
        );

        const posts = await Post.find({})
            .select('platform postType publishedAt metrics')
            .lean<PostLean[]>()
            .exec();

        // TC-3 and TC-4
        const instagramPosts = posts.filter((post) => post.platform === 'instagram');
        const linkedinPosts = posts.filter((post) => post.platform === 'linkedin');
        const instagramAvgRate = average(
            instagramPosts.map((post) =>
                post.metrics.impressions > 0
                    ? (post.metrics.engagements / post.metrics.impressions) * 100
                    : 0,
            ),
        );
        const linkedinAvgRate = average(
            linkedinPosts.map((post) =>
                post.metrics.impressions > 0
                    ? (post.metrics.engagements / post.metrics.impressions) * 100
                    : 0,
            ),
        );
        expect(instagramAvgRate).toBeGreaterThanOrEqual(5);
        expect(instagramAvgRate).toBeLessThanOrEqual(7);
        expect(linkedinAvgRate).toBeGreaterThanOrEqual(7);
        expect(linkedinAvgRate).toBeLessThanOrEqual(9);

        // TC-5
        const earliest = posts.reduce((min, post) => (post.publishedAt < min ? post.publishedAt : min), posts[0]!.publishedAt);
        const latest = posts.reduce((max, post) => (post.publishedAt > max ? post.publishedAt : max), posts[0]!.publishedAt);
        const daysSpan = (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24);
        expect(daysSpan).toBeLessThanOrEqual(90);
        expect(latest.getTime()).toBeLessThanOrEqual(now.getTime());
        expect(earliest.getTime()).toBeGreaterThanOrEqual(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        // TC-6
        const weekdayRates = posts
            .filter((post) => {
                const day = post.publishedAt.getUTCDay();
                return day >= 2 && day <= 4;
            })
            .map((post) => (post.metrics.engagements / post.metrics.impressions) * 100);
        const weekendRates = posts
            .filter((post) => {
                const day = post.publishedAt.getUTCDay();
                return day === 0 || day === 6;
            })
            .map((post) => (post.metrics.engagements / post.metrics.impressions) * 100);
        expect(average(weekdayRates)).toBeGreaterThan(average(weekendRates));

        // TC-7
        const igTypeImpressions = instagramPosts.reduce<Record<string, number[]>>((acc, post) => {
            if (!acc[post.postType]) {
                acc[post.postType] = [];
            }
            acc[post.postType]!.push(post.metrics.impressions);
            return acc;
        }, {});
        const igTypeAverages = Object.fromEntries(
            Object.entries(igTypeImpressions).map(([postType, values]) => [postType, average(values)]),
        ) as Record<string, number>;
        const maxEntry = Object.entries(igTypeAverages).sort((a, b) => b[1] - a[1])[0];
        expect(maxEntry?.[0]).toBe('video');

        // TC-8
        expect(logger.info).toHaveBeenCalled();
        const summaryCall = logger.info.mock.calls.find((call) => call[1] === 'Seed completed');
        expect(summaryCall).toBeDefined();
        expect(summaryCall?.[0]).toEqual(
            expect.objectContaining({
                usersCount: 1,
                channelsCount: 2,
                postsByPlatform: expect.objectContaining({
                    instagram: expect.any(Number),
                    linkedin: expect.any(Number),
                }),
            }),
        );
    });
});
