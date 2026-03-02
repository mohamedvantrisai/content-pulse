import { describe, it, expect } from 'vitest';
import { aggregateWeekly } from '../aggregation';
import type { TimeSeriesEntry } from '@/types';

function makeDailyEntries(startDate: string, count: number): TimeSeriesEntry[] {
    const entries: TimeSeriesEntry[] = [];
    const d = new Date(startDate + 'T00:00:00');
    for (let i = 0; i < count; i++) {
        entries.push({
            date: formatLocal(d),
            impressions: 100,
            engagements: 10,
            posts: 1,
        });
        d.setDate(d.getDate() + 1);
    }
    return entries;
}

function formatLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

describe('aggregateWeekly', () => {
    it('returns empty array for empty input', () => {
        expect(aggregateWeekly([])).toEqual([]);
    });

    it('groups 7 consecutive days into 1 bucket when all in same ISO week', () => {
        // 2026-02-23 is a Monday
        const entries = makeDailyEntries('2026-02-23', 7);
        const result = aggregateWeekly(entries);
        expect(result).toHaveLength(1);
        expect(result[0]!.impressions).toBe(700);
        expect(result[0]!.engagements).toBe(70);
        expect(result[0]!.posts).toBe(7);
    });

    it('produces week labels in "YYYY-MM-DD — YYYY-MM-DD" format', () => {
        const entries = makeDailyEntries('2026-02-23', 7);
        const result = aggregateWeekly(entries);
        expect(result[0]!.weekLabel).toBe('2026-02-23 — 2026-03-01');
    });

    it('splits days spanning two weeks into 2 buckets', () => {
        // 2026-02-27 is Friday, so entries span Fri-Sat-Sun-Mon (2 ISO weeks)
        const entries = makeDailyEntries('2026-02-27', 4);
        const result = aggregateWeekly(entries);
        expect(result).toHaveLength(2);
    });

    it('sums impressions, engagements, and posts correctly across a week', () => {
        const entries: TimeSeriesEntry[] = [
            { date: '2026-02-23', impressions: 100, engagements: 10, posts: 1 },
            { date: '2026-02-24', impressions: 200, engagements: 20, posts: 2 },
            { date: '2026-02-25', impressions: 300, engagements: 30, posts: 3 },
        ];
        const result = aggregateWeekly(entries);
        expect(result).toHaveLength(1);
        expect(result[0]!.impressions).toBe(600);
        expect(result[0]!.engagements).toBe(60);
        expect(result[0]!.posts).toBe(6);
    });

    it('reduces 90 daily entries to fewer than 20 weekly buckets', () => {
        const entries = makeDailyEntries('2025-12-01', 90);
        const result = aggregateWeekly(entries);
        expect(result.length).toBeLessThan(20);
    });

    it('produces buckets in chronological order', () => {
        const entries = makeDailyEntries('2026-01-01', 30);
        const result = aggregateWeekly(entries);
        for (let i = 1; i < result.length; i++) {
            const prev = result[i - 1]!.weekLabel.slice(0, 10);
            const curr = result[i]!.weekLabel.slice(0, 10);
            expect(curr > prev).toBe(true);
        }
    });
});
