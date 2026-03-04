import { describe, it, expect } from 'vitest';
import { toPlatformEngagementSlices } from '../chartMath';
import type { PlatformBreakdownEntry } from '@/types';

function makeEntry(
    platform: string,
    totalEngagements: number,
): PlatformBreakdownEntry {
    return {
        platform,
        totalImpressions: 0,
        totalEngagements,
        totalPosts: 0,
        avgEngagementRate: 0,
        followerCount: 0,
    };
}

describe('toPlatformEngagementSlices', () => {
    it('returns empty array for empty input', () => {
        expect(toPlatformEngagementSlices([])).toEqual([]);
    });

    it('returns empty array when all engagements are zero', () => {
        const input = [makeEntry('instagram', 0), makeEntry('linkedin', 0)];
        expect(toPlatformEngagementSlices(input)).toEqual([]);
    });

    it('produces one slice per platform', () => {
        const input = [makeEntry('instagram', 600), makeEntry('linkedin', 400)];
        const slices = toPlatformEngagementSlices(input);
        expect(slices).toHaveLength(2);
    });

    it('calculates correct percentages', () => {
        const input = [makeEntry('instagram', 600), makeEntry('linkedin', 400)];
        const slices = toPlatformEngagementSlices(input);
        expect(slices[0]!.percentage).toBe(60);
        expect(slices[1]!.percentage).toBe(40);
    });

    it('percentages sum to exactly 100', () => {
        const input = [makeEntry('instagram', 333), makeEntry('linkedin', 667)];
        const slices = toPlatformEngagementSlices(input);
        const total = slices.reduce((sum, s) => sum + s.percentage, 0);
        expect(total).toBeCloseTo(100, 0);
    });

    it('percentages sum to 100 even with awkward distributions', () => {
        const input = [
            makeEntry('instagram', 1),
            makeEntry('linkedin', 1),
        ];
        const slices = toPlatformEngagementSlices(input);
        const total = slices.reduce((sum, s) => sum + s.percentage, 0);
        expect(total).toBe(100);
    });

    it('assigns correct colors for instagram and linkedin', () => {
        const input = [makeEntry('instagram', 500), makeEntry('linkedin', 500)];
        const slices = toPlatformEngagementSlices(input);
        expect(slices[0]!.color).toBe('#E4405F');
        expect(slices[1]!.color).toBe('#0A66C2');
    });

    it('assigns fallback color for unknown platforms', () => {
        const input = [makeEntry('twitter', 1000)];
        const slices = toPlatformEngagementSlices(input);
        expect(slices[0]!.color).toBe('#6b7280');
    });

    it('handles a single platform producing 100%', () => {
        const input = [makeEntry('instagram', 1000)];
        const slices = toPlatformEngagementSlices(input);
        expect(slices).toHaveLength(1);
        expect(slices[0]!.percentage).toBe(100);
    });

    it('preserves engagement counts', () => {
        const input = [makeEntry('instagram', 750), makeEntry('linkedin', 250)];
        const slices = toPlatformEngagementSlices(input);
        expect(slices[0]!.engagements).toBe(750);
        expect(slices[1]!.engagements).toBe(250);
    });
});
