import { API_BASE } from './config';
import type {
  AnalyticsOverview,
  Channel,
  ContentBrief,
  ErrorEnvelope,
  HealthStatus,
  SuccessEnvelope,
} from '@/types';

// ── Error type ──

export class ApiError extends Error {
  readonly code: string;
  readonly details: unknown[];

  constructor(code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

// ── Loading-state helper ──

export interface LoadingState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

/** Returns a fresh loading-state object suitable for component state init. */
export function createLoadingState<T>(): LoadingState<T> {
  return { data: null, error: null, loading: false };
}

// ── Core request function ──

type QueryParams = Record<string, string | undefined>;

function buildUrl(path: string, params?: QueryParams): string {
  const url = `${API_BASE}${path}`;
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Generic fetch wrapper that unwraps the backend SuccessEnvelope
 * and converts error responses into typed ApiError instances.
 */
async function request<T>(
  path: string,
  options?: RequestInit & { params?: QueryParams },
): Promise<T> {
  const { params, ...fetchOptions } = options ?? {};

  const response = await fetch(buildUrl(path, params), {
    headers: { 'Content-Type': 'application/json' },
    ...fetchOptions,
  });

  if (!response.ok) {
    let errorBody: ErrorEnvelope | undefined;
    try {
      errorBody = (await response.json()) as ErrorEnvelope;
    } catch {
      /* response may not be JSON */
    }

    throw new ApiError(
      errorBody?.error.code ?? `HTTP_${response.status}`,
      errorBody?.error.message ?? response.statusText,
      errorBody?.error.details ?? [],
    );
  }

  const envelope = (await response.json()) as SuccessEnvelope<T>;
  return envelope.data;
}

// ── Typed endpoint methods ──

/**
 * Health sits outside the /api/v1 prefix and returns
 * a raw JSON body (no envelope), so it uses fetch directly.
 */
async function getHealth(): Promise<HealthStatus> {
  const response = await fetch('/health');
  if (!response.ok) {
    throw new ApiError(`HTTP_${response.status}`, response.statusText);
  }
  return (await response.json()) as HealthStatus;
}

function getStatus(): Promise<{ status: string }> {
  return request<{ status: string }>('/status');
}

function getOverview(params?: {
  from?: string;
  to?: string;
}): Promise<AnalyticsOverview> {
  return request<AnalyticsOverview>('/analytics/overview', { params });
}

function getChannels(platform?: string): Promise<Channel[]> {
  return request<Channel[]>('/channels', {
    params: platform ? { platform } : undefined,
  });
}

function getStrategyBrief(): Promise<ContentBrief> {
  return request<ContentBrief>('/strategist/brief');
}

function getApiKeys(): Promise<unknown[]> {
  return request<unknown[]>('/apikeys');
}

// ── Public client singleton ──

export const apiClient = {
  getHealth,
  getStatus,
  getOverview,
  getChannels,
  getStrategyBrief,
  getApiKeys,
} as const;
