import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, type LoadingState, ApiError } from '@/api/client';
import type { AnalyticsOverviewResponse } from '@/types';
import type { DateRangeKey } from '@/constants/dateRanges';
import { DATE_RANGES, DEFAULT_RANGE } from '@/constants/dateRanges';
import { computeDateRange } from '@/utils/dates';

export interface DashboardState extends LoadingState<AnalyticsOverviewResponse> {
    selectedRange: DateRangeKey;
    setSelectedRange: (range: DateRangeKey) => void;
    retry: () => void;
}

/**
 * Custom hook that manages the shared dashboard state:
 * - Tracks the selected date range (default 30d)
 * - Derives start/end dates and fetches analytics overview
 * - Re-fetches on every range change (single API call per change)
 */
export function useDashboardData(): DashboardState {
    const [selectedRange, setSelectedRange] = useState<DateRangeKey>(DEFAULT_RANGE);
    const [data, setData] = useState<AnalyticsOverviewResponse | null>(null);
    const [error, setError] = useState<ApiError | null>(null);
    const [loading, setLoading] = useState(true);

    // Abort controller ref for cancelling in-flight requests on range change
    const abortRef = useRef<AbortController | null>(null);

    const fetchData = useCallback(async (range: DateRangeKey) => {
        // Cancel any in-flight request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const rangeDef = DATE_RANGES.find((r) => r.key === range);
        if (!rangeDef) return;

        const { start, end } = computeDateRange(rangeDef.days);

        setLoading(true);
        setError(null);

        try {
            const result = await apiClient.getOverview({ start, end });

            // Only update if this request wasn't aborted
            if (!controller.signal.aborted) {
                setData(result);
                setLoading(false);
            }
        } catch (err: unknown) {
            if (controller.signal.aborted) return;

            if (err instanceof ApiError) {
                setError(err);
            } else {
                setError(new ApiError('UNKNOWN', 'An unexpected error occurred'));
            }
            setLoading(false);
        }
    }, []);

    const retry = useCallback(() => {
        void fetchData(selectedRange);
    }, [fetchData, selectedRange]);

    useEffect(() => {
        void fetchData(selectedRange);

        return () => {
            abortRef.current?.abort();
        };
    }, [selectedRange, fetchData]);

    return {
        data,
        error,
        loading,
        selectedRange,
        setSelectedRange,
        retry,
    };
}
