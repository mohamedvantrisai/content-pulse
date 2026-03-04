import type { TimeSeriesEntry } from '@/types';

export interface WeeklyTimeSeriesEntry {
    weekLabel: string;
    impressions: number;
    engagements: number;
    posts: number;
}

/**
 * Aggregates daily time-series data into weekly buckets.
 *
 * **Grouping logic**: Uses ISO-week boundaries (Monday–Sunday). Each entry
 * is assigned to its ISO week by finding the Monday of that week.
 * Impressions, engagements, and posts are summed within each bucket.
 *
 * **Week label format**: "YYYY-MM-DD — YYYY-MM-DD" showing the Monday
 * through Sunday of that ISO week.
 *
 * @param timeSeries - Daily time-series entries sorted by date ascending.
 * @returns Weekly buckets in chronological order, typically <20 entries
 *          for a 90-day window.
 */
export function aggregateWeekly(
    timeSeries: readonly TimeSeriesEntry[],
): WeeklyTimeSeriesEntry[] {
    if (timeSeries.length === 0) return [];

    const buckets = new Map<
        string,
        { monday: Date; impressions: number; engagements: number; posts: number }
    >();

    for (const entry of timeSeries) {
        const date = new Date(entry.date + 'T00:00:00');
        const monday = getISOMonday(date);
        const key = formatLocal(monday);

        const existing = buckets.get(key);
        if (existing) {
            existing.impressions += entry.impressions;
            existing.engagements += entry.engagements;
            existing.posts += entry.posts;
        } else {
            buckets.set(key, {
                monday,
                impressions: entry.impressions,
                engagements: entry.engagements,
                posts: entry.posts,
            });
        }
    }

    const result: WeeklyTimeSeriesEntry[] = [];
    for (const [, bucket] of buckets) {
        const sunday = new Date(bucket.monday);
        sunday.setDate(sunday.getDate() + 6);

        result.push({
            weekLabel: `${formatLocal(bucket.monday)} — ${formatLocal(sunday)}`,
            impressions: bucket.impressions,
            engagements: bucket.engagements,
            posts: bucket.posts,
        });
    }

    return result;
}

/** Returns the Monday of the ISO week containing the given date. */
function getISOMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    // JS: Sun=0, Mon=1 … Sat=6 → ISO offset: Sun→6, Mon→0, Tue→1 …
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d;
}

/** Formats a Date as YYYY-MM-DD using local time. */
function formatLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
