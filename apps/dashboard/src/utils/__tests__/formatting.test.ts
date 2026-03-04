import { describe, it, expect } from 'vitest';
import { formatNumber, formatRate, formatChangePct } from '../formatting';

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
