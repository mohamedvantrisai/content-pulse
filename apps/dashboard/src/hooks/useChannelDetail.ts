import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, ApiError } from '@/api/client';
import type { ChannelDetailAnalytics } from '@/types';
import type { DateRangeKey } from '@/constants/dateRanges';
import { DATE_RANGES, DEFAULT_RANGE } from '@/constants/dateRanges';
import { computeDateRange } from '@/utils/dates';

export interface ChannelDetailState {
  data: ChannelDetailAnalytics | null;
  error: ApiError | null;
  loading: boolean;
  selectedRange: DateRangeKey;
  setSelectedRange: (range: DateRangeKey) => void;
  retry: () => void;
}

export function useChannelDetail(channelId: string | undefined): ChannelDetailState {
  const [selectedRange, setSelectedRange] = useState<DateRangeKey>(DEFAULT_RANGE);
  const [data, setData] = useState<ChannelDetailAnalytics | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (range: DateRangeKey) => {
      if (!channelId) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const rangeDef = DATE_RANGES.find((r) => r.key === range);
      if (!rangeDef) return;

      const { start, end } = computeDateRange(rangeDef.days);

      setLoading(true);
      setError(null);

      try {
        const result = await apiClient.getChannelDetailAnalytics(channelId, { start, end });
        if (!controller.signal.aborted) {
          setData(result);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError('UNKNOWN', 'An unexpected error occurred'),
        );
        setLoading(false);
      }
    },
    [channelId],
  );

  const retry = useCallback(() => {
    void fetchData(selectedRange);
  }, [fetchData, selectedRange]);

  useEffect(() => {
    void fetchData(selectedRange);
    return () => {
      abortRef.current?.abort();
    };
  }, [selectedRange, fetchData]);

  return { data, error, loading, selectedRange, setSelectedRange, retry };
}
