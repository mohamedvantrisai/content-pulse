/**
 * Computes a date range ending today (local time) for the given window size.
 *
 * @param days - Number of days in the window (e.g. 30 for "last 30 days").
 * @returns Object with `start` and `end` as YYYY-MM-DD strings.
 *          `end` is always today; `start` is `days - 1` days before today
 *          so the range is inclusive on both ends (30d = 30 calendar days).
 */
export function computeDateRange(days: number): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));

    return {
        start: formatDateISO(start),
        end: formatDateISO(end),
    };
}

/** Formats a Date as YYYY-MM-DD using local time. */
function formatDateISO(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
