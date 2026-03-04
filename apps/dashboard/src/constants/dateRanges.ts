/** Centralized date-range definitions used across the dashboard. */

export type DateRangeKey = '7d' | '14d' | '30d' | '60d' | '90d';

export interface DateRangeOption {
    key: DateRangeKey;
    label: string;
    days: number;
}

export const DATE_RANGES: readonly DateRangeOption[] = [
    { key: '7d', label: '7d', days: 7 },
    { key: '14d', label: '14d', days: 14 },
    { key: '30d', label: '30d', days: 30 },
    { key: '60d', label: '60d', days: 60 },
    { key: '90d', label: '90d', days: 90 },
] as const;

export const DEFAULT_RANGE: DateRangeKey = '30d';

/** Weekly aggregation threshold: aggregate when data exceeds this many points. */
export const WEEKLY_AGGREGATION_THRESHOLD = 35;
