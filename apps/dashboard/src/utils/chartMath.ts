import type { PlatformBreakdownEntry } from '@/types';

export interface PlatformEngagementSlice {
    platform: string;
    engagements: number;
    percentage: number;
    color: string;
}

const PLATFORM_COLORS: Record<string, string> = {
    instagram: '#E4405F',
    linkedin: '#0A66C2',
};

const FALLBACK_COLOR = '#6b7280';

/**
 * Converts platform breakdown data into donut chart slices.
 *
 * Percentage normalization: each slice is rounded to 1 decimal place,
 * then the last slice absorbs the rounding remainder so the total is
 * exactly 100%. This guarantees the sum is 100% ±0 (not ±1%).
 */
export function toPlatformEngagementSlices(
    breakdown: PlatformBreakdownEntry[],
): PlatformEngagementSlice[] {
    const totalEngagements = breakdown.reduce(
        (sum, entry) => sum + entry.totalEngagements,
        0,
    );

    if (totalEngagements === 0) return [];

    const slices = breakdown.map((entry) => ({
        platform: entry.platform,
        engagements: entry.totalEngagements,
        percentage: Math.round((entry.totalEngagements / totalEngagements) * 1000) / 10,
        color: PLATFORM_COLORS[entry.platform.toLowerCase()] ?? FALLBACK_COLOR,
    }));

    if (slices.length > 0) {
        const sumOfOthers = slices
            .slice(0, -1)
            .reduce((sum, s) => sum + s.percentage, 0);
        slices[slices.length - 1]!.percentage =
            Math.round((100 - sumOfOthers) * 10) / 10;
    }

    return slices;
}
