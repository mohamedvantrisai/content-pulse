/** Formats a number with locale-specific thousand separators (e.g. 1,000,000). */
export function formatNumber(value: number): string {
    return value.toLocaleString('en-US');
}

/** Formats a decimal rate as a percentage string (e.g. 0.058 → "5.8%"). */
export function formatRate(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
}

/** Formats a 0–1 decimal as a display percentage (e.g. 0.058 → "5.8%"). */
export function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

/** Formats an ISO date string as a human-readable date (e.g. "Mar 4, 2026"). */
export function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/** Truncates text to `maxLength` characters, appending "..." if truncated. */
export function truncate(text: string, maxLength = 80): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface FormattedChange {
    text: string;
    direction: TrendDirection;
}

/**
 * Formats a percentage change value for display.
 * Returns "N/A" when the value is null (previous period was 0).
 */
export function formatChangePct(pct: number | null): FormattedChange {
    if (pct === null) {
        return { text: 'N/A', direction: 'neutral' };
    }
    if (pct > 0) {
        return { text: `↑ ${pct.toFixed(1)}%`, direction: 'up' };
    }
    if (pct < 0) {
        return { text: `↓ ${Math.abs(pct).toFixed(1)}%`, direction: 'down' };
    }
    return { text: '0.0%', direction: 'neutral' };
}
