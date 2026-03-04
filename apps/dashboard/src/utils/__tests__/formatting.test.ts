import { describe, it, expect } from 'vitest';
import {
    formatNumber,
    formatRate,
    formatPercent,
    formatDate,
    truncate,
    formatChangePct,
} from '../formatting';

describe('formatNumber', () => {
    it('formats small numbers without separators', () => {
        expect(formatNumber(42)).toBe('42');
    });

    it('formats thousands with comma separator', () => {
        expect(formatNumber(1000)).toBe('1,000');
    });

    it('formats millions with comma separators', () => {
        expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('formats zero', () => {
        expect(formatNumber(0)).toBe('0');
    });
});

describe('formatRate', () => {
    it('converts decimal to percentage with one decimal place', () => {
        expect(formatRate(0.058)).toBe('5.8%');
    });

    it('handles zero rate', () => {
        expect(formatRate(0)).toBe('0.0%');
    });

    it('handles rate of 1 (100%)', () => {
        expect(formatRate(1)).toBe('100.0%');
    });

    it('handles small rates', () => {
        expect(formatRate(0.001)).toBe('0.1%');
    });
});

describe('formatPercent', () => {
    it('converts decimal to percentage with one decimal place', () => {
        expect(formatPercent(0.058)).toBe('5.8%');
    });

    it('handles zero', () => {
        expect(formatPercent(0)).toBe('0.0%');
    });

    it('handles 1 (100%)', () => {
        expect(formatPercent(1)).toBe('100.0%');
    });
});

describe('formatDate', () => {
    it('formats an ISO date string to human-readable format', () => {
        expect(formatDate('2026-03-04')).toBe('Mar 4, 2026');
    });

    it('formats an ISO datetime string', () => {
        expect(formatDate('2026-12-25T10:30:00Z')).toBe('Dec 25, 2026');
    });

    it('formats a date at the start of the year', () => {
        expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
    });
});

describe('truncate', () => {
    it('returns the full string when shorter than maxLength', () => {
        expect(truncate('Hello world')).toBe('Hello world');
    });

    it('truncates to 80 chars by default and appends "..."', () => {
        const long = 'A'.repeat(100);
        const result = truncate(long);
        expect(result).toBe('A'.repeat(80) + '...');
    });

    it('returns exact-length strings without truncation', () => {
        const exact = 'B'.repeat(80);
        expect(truncate(exact)).toBe(exact);
    });

    it('accepts a custom maxLength', () => {
        expect(truncate('Hello world', 5)).toBe('Hello...');
    });

    it('handles empty string', () => {
        expect(truncate('')).toBe('');
    });
});

describe('formatChangePct', () => {
    it('returns "N/A" with neutral direction for null', () => {
        const result = formatChangePct(null);
        expect(result.text).toBe('N/A');
        expect(result.direction).toBe('neutral');
    });

    it('returns up arrow and positive direction for positive change', () => {
        const result = formatChangePct(25.3);
        expect(result.text).toBe('↑ 25.3%');
        expect(result.direction).toBe('up');
    });

    it('returns down arrow and negative direction for negative change', () => {
        const result = formatChangePct(-12.5);
        expect(result.text).toBe('↓ 12.5%');
        expect(result.direction).toBe('down');
    });

    it('returns neutral direction for zero change', () => {
        const result = formatChangePct(0);
        expect(result.text).toBe('0.0%');
        expect(result.direction).toBe('neutral');
    });

    it('formats with one decimal place', () => {
        const result = formatChangePct(100);
        expect(result.text).toBe('↑ 100.0%');
    });
});
