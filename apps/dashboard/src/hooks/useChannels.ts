import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient, ApiError } from '@/api/client';
import type { Channel } from '@/types';

export interface BannerInfo {
  type: 'success' | 'error';
  message: string;
}

export interface ChannelsState {
  data: Channel[] | null;
  error: ApiError | null;
  loading: boolean;
  banner: BannerInfo | null;
  retry: () => void;
  dismissBanner: () => void;
}

function extractBanner(params: URLSearchParams): BannerInfo | null {
  const connected = params.get('connected');
  if (connected) {
    const name = connected.charAt(0).toUpperCase() + connected.slice(1);
    return { type: 'success', message: `${name} connected successfully.` };
  }

  const error = params.get('error');
  if (error) {
    const message =
      params.get('message') ?? 'Something went wrong during the connection.';
    return { type: 'error', message };
  }

  return null;
}

export function useChannels(): ChannelsState {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<Channel[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const info = extractBanner(searchParams);
    if (info) {
      setBanner(info);
      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete('connected');
      cleaned.delete('error');
      cleaned.delete('message');
      setSearchParams(cleaned, { replace: true });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchChannels = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.getChannels();
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
  }, []);

  const retry = useCallback(() => {
    void fetchChannels();
  }, [fetchChannels]);

  const dismissBanner = useCallback(() => {
    setBanner(null);
  }, []);

  useEffect(() => {
    void fetchChannels();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchChannels]);

  return { data, error, loading, banner, retry, dismissBanner };
}
