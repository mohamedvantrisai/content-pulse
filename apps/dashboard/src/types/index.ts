// ── Enums / Unions ──

export type Platform = 'instagram' | 'linkedin';

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

export type PostType = 'text' | 'image' | 'video' | 'link' | 'carousel';

// ── Domain models ──

export interface PeriodMetrics {
  totalImpressions: number;
  totalEngagements: number;
  totalPosts: number;
  avgEngagementRate: number;
}

export interface ChangeMetrics {
  impressionsChangePct: number | null;
  engagementsChangePct: number | null;
  postsChangePct: number | null;
  avgEngagementRateChangePct: number | null;
}

export interface TimeSeriesEntry {
  date: string;
  impressions: number;
  engagements: number;
  posts: number;
}

export interface PlatformBreakdownEntry {
  platform: string;
  totalImpressions: number;
  totalEngagements: number;
  totalPosts: number;
  avgEngagementRate: number;
  followerCount: number;
}

export interface TopPostEntry {
  id: string;
  platform: string;
  content: string;
  postType: string;
  impressions: number;
  engagements: number;
  engagementRate: number;
  publishedAt: string;
}

export interface AnalyticsOverviewResponse {
  currentPeriod: PeriodMetrics;
  previousPeriod: PeriodMetrics;
  changes: ChangeMetrics;
  timeSeries: TimeSeriesEntry[];
  platformBreakdown: PlatformBreakdownEntry[];
  topPosts: TopPostEntry[];
}

export interface Channel {
  id: string;
  name: string;
  platform: Platform;
}

export interface PostMetrics {
  impressions: number;
  reach: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  saves: number;
}

export interface Post {
  id: string;
  channelId: string;
  platform: Platform;
  content: string;
  postType: PostType;
  publishedAt: string;
  metrics: PostMetrics;
  engagementRate: number;
}

export interface ContentBrief {
  id: string;
  title: string;
  status: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded';
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'unavailable' | 'not configured';
  uptime: number;
  timestamp: string;
}

// ── Analytics aggregates ──

export interface SnapshotMetrics {
  totalPosts: number;
  totalImpressions: number;
  totalReach: number;
  totalEngagements: number;
  engagementRate: number;
  followerGrowth: number;
  bestPostingHour: number | null;
  bestPostingDay: number | null;
}

export interface ChannelAnalytics {
  channelId: string;
  platform: Platform;
  period: AnalyticsPeriod;
  date: string;
  metrics: SnapshotMetrics;
}

export interface PlatformBreakdown {
  platform: Platform;
  totalImpressions: number;
  totalEngagements: number;
  engagementRate: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

// ── API envelope types (mirrors backend response.ts) ──

export interface ApiMeta {
  dateRange?: string;
  generatedAt: string;
  cached: boolean;
}

export interface SuccessEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
}
