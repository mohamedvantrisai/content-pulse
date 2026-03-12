import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useChannelDetail } from '@/hooks/useChannelDetail';
import { apiClient, ApiError } from '@/api/client';
import DateRangeSelector from '@/components/DateRangeSelector';
import WidgetSkeleton from '@/components/states/WidgetSkeleton';
import ErrorState from '@/components/states/ErrorState';
import EmptyState from '@/components/states/EmptyState';
import { formatNumber } from '@/utils/formatting';
import type { Platform, SyncStatus } from '@/types';
import '@/styles/channel-detail.css';

const CHART_COLORS = {
  impressions: '#3b82f6',
  engagements: '#22c55e',
} as const;

const CONTENT_TYPE_COLORS: Record<string, string> = {
  image: '#3b82f6',
  video: '#8b5cf6',
  carousel: '#f59e0b',
  text: '#6b7280',
  link: '#06b6d4',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getContentColor(postType: string): string {
  return CONTENT_TYPE_COLORS[postType] ?? '#6b7280';
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

// ── Header ──

function ChannelHeader({
  platform,
  displayName,
  handle,
  followerCount,
  syncStatus,
  onBack,
}: {
  platform: Platform;
  displayName: string;
  handle: string;
  followerCount: number;
  syncStatus: SyncStatus;
  onBack: () => void;
}) {
  return (
    <div className="cd-header" data-testid="channel-detail-header">
      <button
        type="button"
        className="cd-header__back"
        onClick={onBack}
        aria-label="Back to channels"
        data-testid="back-to-channels-btn"
      >
        ← Back
      </button>
      <div className="cd-header__info">
        <span className="cd-header__icon" aria-hidden="true">
          {platform === 'instagram' ? '📸' : '💼'}
        </span>
        <div className="cd-header__text">
          <h1 className="cd-header__name">{displayName}</h1>
          <span className="cd-header__handle">@{handle}</span>
        </div>
        <div className="cd-header__meta">
          <span className={`platform-badge platform-badge--${platform}`}>
            {platform}
          </span>
          <span className={`sync-badge sync-badge--${syncStatus}`}>
            <span className="sync-badge__dot" />
            {syncStatus.charAt(0).toUpperCase() + syncStatus.slice(1)}
          </span>
        </div>
      </div>
      <div className="cd-header__stat">
        <span className="cd-header__stat-value">{formatNumber(followerCount)}</span>
        <span className="cd-header__stat-label">Followers</span>
      </div>
    </div>
  );
}

// ── Granularity Selector ──

type Granularity = 'daily' | 'weekly' | 'monthly';

function GranularitySelector({
  selected,
  onSelect,
}: {
  selected: Granularity;
  onSelect: (g: Granularity) => void;
}) {
  const options: Granularity[] = ['daily', 'weekly', 'monthly'];
  return (
    <div className="cd-granularity" data-testid="granularity-selector">
      {options.map((g) => (
        <button
          key={g}
          type="button"
          className={`cd-granularity__btn ${selected === g ? 'cd-granularity__btn--active' : ''}`}
          onClick={() => onSelect(g)}
          data-testid={`granularity-${g}-btn`}
        >
          {g.charAt(0).toUpperCase() + g.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ── US-301: Time Series Chart with Granularity ──

interface TimeSeriesEntry {
  date: string;
  impressions: number;
  engagements: number;
  posts: number;
}

function TimeSeriesChart({
  timeSeries,
  granularity,
}: {
  timeSeries: TimeSeriesEntry[];
  granularity: Granularity;
}) {
  if (timeSeries.length === 0) return null;

  const labelMap: Record<Granularity, string> = {
    daily: 'Daily Trends',
    weekly: 'Weekly Trends',
    monthly: 'Monthly Trends',
  };

  return (
    <div className="cd-widget" data-testid="time-series-chart" role="img" aria-label="Impressions and engagements over time">
      <h2 className="cd-widget__title">{labelMap[granularity]}</h2>
      <div className="cd-widget__subtitle">
        {timeSeries.length} data points
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={timeSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cdGradImpressions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.impressions} stopOpacity={0.2} />
              <stop offset="95%" stopColor={CHART_COLORS.impressions} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cdGradEngagements" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.engagements} stopOpacity={0.2} />
              <stop offset="95%" stopColor={CHART_COLORS.engagements} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatNumber(v)}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
            }}
            formatter={(value: number) => formatNumber(value)}
          />
          <Area
            type="monotone"
            dataKey="impressions"
            stroke={CHART_COLORS.impressions}
            strokeWidth={2}
            fill="url(#cdGradImpressions)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
            name="Impressions"
          />
          <Area
            type="monotone"
            dataKey="engagements"
            stroke={CHART_COLORS.engagements}
            strokeWidth={2}
            fill="url(#cdGradEngagements)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
            name="Engagements"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── US-302: Content Type Performance Breakdown ──

interface ContentTypePerformance {
  postType: string;
  postCount: number;
  avgImpressions: number;
  avgEngagements: number;
  avgEngagementRate: number;
}

function ContentTypeBreakdown({ data }: { data: ContentTypePerformance[] }) {
  if (data.length === 0) return null;

  return (
    <div className="cd-widget" data-testid="content-type-breakdown">
      <h2 className="cd-widget__title">Content Type Performance</h2>
      <div className="cd-widget__subtitle">Sorted by engagement rate (highest first)</div>
      <div className="cd-perf-table">
        <div className="cd-perf-table__header">
          <span>Type</span>
          <span>Posts</span>
          <span>Avg Impressions</span>
          <span>Avg Engagements</span>
          <span>Eng. Rate</span>
        </div>
        {data.map((entry) => (
          <div key={entry.postType} className="cd-perf-table__row" data-testid={`content-type-${entry.postType}`}>
            <span className="cd-perf-table__type">
              <span
                className="cd-perf-table__dot"
                style={{ backgroundColor: getContentColor(entry.postType) }}
              />
              {entry.postType}
            </span>
            <span>{entry.postCount}</span>
            <span>{formatNumber(entry.avgImpressions)}</span>
            <span>{formatNumber(entry.avgEngagements)}</span>
            <span className="cd-perf-table__rate">{(entry.avgEngagementRate * 100).toFixed(2)}%</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 50)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
          />
          <YAxis
            type="category"
            dataKey="postType"
            tick={{ fontSize: 12, fill: 'var(--color-text)' }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
            }}
            formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
          />
          <Bar dataKey="avgEngagementRate" name="Avg Engagement Rate" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.postType} fill={getContentColor(entry.postType)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── US-303: Best Posting Times Heatmap ──

interface BestPostingTime {
  dayOfWeek: number;
  hour: number;
  avgEngagementRate: number;
  postCount: number;
}

function BestPostingTimes({ data }: { data: BestPostingTime[] }) {
  if (data.length === 0) {
    return (
      <div className="cd-widget" data-testid="best-posting-times">
        <h2 className="cd-widget__title">Best Posting Times</h2>
        <p className="cd-widget__empty">Not enough data (need 2+ posts per time slot)</p>
      </div>
    );
  }

  return (
    <div className="cd-widget" data-testid="best-posting-times">
      <h2 className="cd-widget__title">Best Posting Times</h2>
      <div className="cd-widget__subtitle">Top 5 time slots by engagement rate (min 2 posts)</div>
      <div className="cd-posting-slots">
        {data.map((slot, idx) => (
          <div
            key={`${slot.dayOfWeek}-${slot.hour}`}
            className="cd-posting-slot"
            data-testid={`posting-slot-${idx}`}
          >
            <div className="cd-posting-slot__rank">#{idx + 1}</div>
            <div className="cd-posting-slot__info">
              <span className="cd-posting-slot__day">{DAY_NAMES[slot.dayOfWeek]}</span>
              <span className="cd-posting-slot__hour">{formatHour(slot.hour)}</span>
            </div>
            <div className="cd-posting-slot__metrics">
              <span className="cd-posting-slot__rate">{(slot.avgEngagementRate * 100).toFixed(2)}%</span>
              <span className="cd-posting-slot__count">{slot.postCount} posts</span>
            </div>
            <div
              className="cd-posting-slot__bar"
              style={{
                width: `${(slot.avgEngagementRate / (data[0]?.avgEngagementRate || 1)) * 100}%`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──

export default function ChannelDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, error, loading, selectedRange, setSelectedRange, retry } =
    useChannelDetail(id);

  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [granularTimeSeries, setGranularTimeSeries] = useState<TimeSeriesEntry[] | null>(null);
  const [contentPerformance, setContentPerformance] = useState<ContentTypePerformance[] | null>(null);
  const [bestTimes, setBestTimes] = useState<BestPostingTime[] | null>(null);
  const [m3Loading, setM3Loading] = useState(false);

  const dateRange = useMemo(() => {
    if (!selectedRange) return null;
    const end = new Date();
    const start = new Date();
    switch (selectedRange) {
      case '7d': start.setDate(end.getDate() - 7); break;
      case '30d': start.setDate(end.getDate() - 30); break;
      case '90d': start.setDate(end.getDate() - 90); break;
      case '6m': start.setMonth(end.getMonth() - 6); break;
      case '1y': start.setFullYear(end.getFullYear() - 1); break;
      default: start.setDate(end.getDate() - 30);
    }
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }, [selectedRange]);

  const fetchM3Data = useCallback(async () => {
    if (!id || !dateRange) return;
    setM3Loading(true);
    try {
      const [tsData, ctData, btData] = await Promise.all([
        apiClient.getChannelTimeSeries(id, {
          start: dateRange.start,
          end: dateRange.end,
          granularity,
        }),
        apiClient.getContentTypeBreakdown(id, {
          start: dateRange.start,
          end: dateRange.end,
        }),
        apiClient.getBestPostingTimes(id, {
          start: dateRange.start,
          end: dateRange.end,
        }),
      ]);
      setGranularTimeSeries(tsData.timeSeries);
      setContentPerformance(ctData.contentTypeBreakdown);
      setBestTimes(btData.bestPostingTimes);
    } catch (err) {
      console.error('Failed to fetch M3 analytics:', err);
    } finally {
      setM3Loading(false);
    }
  }, [id, dateRange, granularity]);

  useEffect(() => {
    fetchM3Data();
  }, [fetchM3Data]);

  if (loading) {
    return (
      <section className="cd-page">
        <WidgetSkeleton variant="chart" />
        <WidgetSkeleton variant="chart" />
        <WidgetSkeleton variant="table" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="cd-page">
        <button
          type="button"
          className="cd-header__back"
          onClick={() => navigate('/channels')}
          aria-label="Back to channels"
          data-testid="back-to-channels-btn"
        >
          ← Back
        </button>
        <ErrorState message={error.message} onRetry={retry} />
      </section>
    );
  }

  if (!data) {
    return (
      <section className="cd-page">
        <button
          type="button"
          className="cd-header__back"
          onClick={() => navigate('/channels')}
          aria-label="Back to channels"
          data-testid="back-to-channels-btn"
        >
          ← Back
        </button>
        <EmptyState title="No channel data" subtitle="This channel has no analytics data available." />
      </section>
    );
  }

  const { channel } = data;
  const ts = granularTimeSeries ?? data.timeSeries;
  const cp = contentPerformance;
  const bt = bestTimes;
  const hasData = ts.length > 0 || (cp && cp.length > 0) || (bt && bt.length > 0);

  return (
    <section className="cd-page" data-testid="channel-detail-page">
      <ChannelHeader
        platform={channel.platform as Platform}
        displayName={channel.displayName}
        handle={channel.handle}
        followerCount={channel.followerCount}
        syncStatus={channel.syncStatus as SyncStatus}
        onBack={() => navigate('/channels')}
      />

      <div className="cd-controls">
        <DateRangeSelector selected={selectedRange} onSelect={setSelectedRange} />
        <GranularitySelector selected={granularity} onSelect={setGranularity} />
      </div>

      {m3Loading ? (
        <div className="cd-grid">
          <WidgetSkeleton variant="chart" />
          <WidgetSkeleton variant="chart" />
          <WidgetSkeleton variant="table" />
        </div>
      ) : !hasData ? (
        <EmptyState
          title="No data for this period"
          subtitle="Try selecting a different date range."
        />
      ) : (
        <div className="cd-grid">
          <TimeSeriesChart timeSeries={ts} granularity={granularity} />
          {cp && <ContentTypeBreakdown data={cp} />}
          {bt && <BestPostingTimes data={bt} />}
        </div>
      )}
    </section>
  );
}
