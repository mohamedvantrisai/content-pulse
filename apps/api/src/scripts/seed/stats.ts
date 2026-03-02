import { Channel, Post, User } from '../../models/index.js';
import type { SeedPlatform, SeedSummary } from './types.js';

const PLATFORMS: SeedPlatform[] = ['instagram', 'linkedin'];

function withPlatformDefaults<T>(source: Partial<Record<SeedPlatform, T>>, fallback: T): Record<SeedPlatform, T> {
    return {
        instagram: source.instagram ?? fallback,
        linkedin: source.linkedin ?? fallback,
    };
}

export async function collectSeedSummary(): Promise<SeedSummary> {
    const [usersCount, channelsCount, groupedCounts, groupedRates] = await Promise.all([
        User.countDocuments({}),
        Channel.countDocuments({}),
        Post.aggregate<{ _id: SeedPlatform; total: number }>([
            { $group: { _id: '$platform', total: { $sum: 1 } } },
        ]),
        Post.aggregate<{ _id: SeedPlatform; avgRate: number }>([
            { $group: { _id: '$platform', avgRate: { $avg: '$engagementRate' } } },
        ]),
    ]);

    const postsByPlatform = withPlatformDefaults(
        groupedCounts.reduce<Partial<Record<SeedPlatform, number>>>((acc, row) => {
            acc[row._id] = row.total;
            return acc;
        }, {}),
        0,
    );

    const avgEngagementRateByPlatform = withPlatformDefaults(
        groupedRates.reduce<Partial<Record<SeedPlatform, number>>>((acc, row) => {
            acc[row._id] = Number(row.avgRate.toFixed(4));
            return acc;
        }, {}),
        0,
    );

    return {
        usersCount,
        channelsCount,
        postsByPlatform,
        avgEngagementRateByPlatform,
    };
}

export function averageByPlatformAndCondition<T extends { platform: SeedPlatform }>(
    values: T[],
    predicate: (value: T) => boolean,
    getMetric: (value: T) => number,
): Record<SeedPlatform, number> {
    const result: Partial<Record<SeedPlatform, number>> = {};

    for (const platform of PLATFORMS) {
        const filtered = values.filter((value) => value.platform === platform && predicate(value));
        if (filtered.length === 0) {
            result[platform] = 0;
            continue;
        }
        const avg = filtered.reduce((sum, value) => sum + getMetric(value), 0) / filtered.length;
        result[platform] = Number(avg.toFixed(4));
    }

    return withPlatformDefaults(result, 0);
}
