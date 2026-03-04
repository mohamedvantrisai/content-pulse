import { describe, it, expect } from 'vitest';
import { computeDateRange } from '../dates';

describe('computeDateRange', () => {
    it('returns start and end as YYYY-MM-DD strings', () => {
        const result = computeDateRange(30);
        expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('end date is today', () => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const expected = `${y}-${m}-${d}`;

        const result = computeDateRange(7);
        expect(result.end).toBe(expected);
    });

    it('start date is (days - 1) before today for 7d', () => {
        const result = computeDateRange(7);
        const start = new Date(result.start + 'T00:00:00');
        const end = new Date(result.end + 'T00:00:00');
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBe(6); // inclusive: 7 calendar days = 6-day gap
    });

    it('start date is (days - 1) before today for 30d', () => {
        const result = computeDateRange(30);
        const start = new Date(result.start + 'T00:00:00');
        const end = new Date(result.end + 'T00:00:00');
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBe(29);
    });

    it('start date is (days - 1) before today for 90d', () => {
        const result = computeDateRange(90);
        const start = new Date(result.start + 'T00:00:00');
        const end = new Date(result.end + 'T00:00:00');
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBe(89);
    });

    it('start date is same as end for 1d', () => {
        const result = computeDateRange(1);
        expect(result.start).toBe(result.end);
    });
});
