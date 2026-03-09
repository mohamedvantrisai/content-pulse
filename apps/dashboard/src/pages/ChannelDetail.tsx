import { useMemo } from 'react';
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
import DateRangeSelector from '@/components/DateRangeSelector';
import WidgetSkeleton from '@/components/states/WidgetSkeleton';
import ErrorState from '@/components/states/ErrorState';
import EmptyState from '@/components/states/EmptyState';
import { formatNumber } from '@/utils/formatting';
import { aggregateWeekly, type WeeklyTimeSeriesEntry } from '@/utils/aggregation';
import { WEEKLY_AGGREGATION_THRESHOLD } from '@/constants/dateRanges';
import type { TimeSeriesEntry, ContentBreakdownEntry, PostingTimeEntry, Platform, SyncStatus } from '@/types';
import '@/styles/channel-detail.css';

const PLATFORM_ICONS: Record<Platform, string> = {
  instagram: '📸',
  linkedin: '💼',
};

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
    <div className="cd-header">
      <button
        type="button"
        className="cd-header__back"
        onClick={onBack}
        aria-label="Back to channels"
      >
        ← Back
      </button>
      <div className="cd-header__info">
        <span className="cd-header__icon" aria-hidden="true">
          {PLATFORM_ICONS[platform]}
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

// ── Time Series Chart ──

interface ChartDataPoint {
  label: string;
  impressions: number;
  engagements: number;
}

function TimeSeriesChart({ timeSeries }: { timeSeries: TimeSeriesEntry[] }) {
  const { chartData, isWeekly } = useMemo(() => {
    if (timeSeries.length > WEEKLY_AGGREGATION_THRESHOLD) {
      const weekly = aggregateWeekly(timeSeries);
      return {
        chartData: weekly.map(
          (w: WeeklyTimeSeriesEntry): ChartDataPoint => ({
            label: w.weekLabel,
            impressions: w.impressions,
            engagements: w.engagements,
          }),
        ),
        isWeekly: true,
      };
    }
    return {
      chartData: timeSeries.map(
        (d): ChartDataPoint => ({
          label: d.date,
          impressions: d.impressions,
          engagements: d.engagements,
        }),
      ),
      isWeekly: false,
    };
  }, [timeSeries]);

  if (chartData.length === 0) return null;

  return (
    <div className="cd-widget" role="img" aria-label="Impressions and engagements over time">
      <h2 className="cd-widget__title">
        {isWeekly ? 'Weekly Trends' : 'Daily Trends'}
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            dataKey="label"
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

// ── Content Breakdown ──

function ContentBreakdown({ data }: { data: ContentBreakdownEntry[] }) {
  if (data.length === 0) return null;

  return (
    <div className="cd-widget">
      <h2 className="cd-widget__title">Content Breakdown</h2>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 50)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatNumber(v)}
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
            formatter={(value: number) => formatNumber(value)}
          />
          <Bar dataKey="count" name="Posts" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.postType} fill={getContentColor(entry.postType)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Posting Times ──

function PostingTimes({ data }: { data: PostingTimeEntry[] }) {
  const allHours = useMemo(() => {
    const map = new Map(data.map((d) => [d.hour, d.count]));
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: formatHour(i),
      count: map.get(i) ?? 0,
    }));
  }, [data]);

  const maxCount = Math.max(...allHours.map((h) => h.count), 1);

  if (data.length === 0) return null;

  return (
    <div className="cd-widget">
      <h2 className="cd-widget__title">Posting Times</h2>
      <div className="cd-posting-grid">
        {allHours.map((h) => {
          const intensity = h.count / maxCount;
          return (
            <div key={h.hour} className="cd-posting-cell" title={`${h.label}: ${h.count} posts`}>
              <div
                className="cd-posting-bar"
                style={{ height: `${Math.max(intensity * 100, 4)}%`, opacity: 0.3 + intensity * 0.7 }}
              />
              <span className="cd-posting-label">{h.label}</span>
            </div>
          );
        })}
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
        >
          ← Back
        </button>
        <EmptyState title="No channel data" subtitle="This channel has no analytics data available." />
      </section>
    );
  }

  const { channel, timeSeries, contentBreakdown, postingTimes } = data;
  const hasData = timeSeries.length > 0 || contentBreakdown.length > 0 || postingTimes.length > 0;

  return (
    <section className="cd-page">
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
      </div>

      {!hasData ? (
        <EmptyState
          title="No data for this period"
          subtitle="Try selecting a different date range."
        />
      ) : (
        <div className="cd-grid">
          <TimeSeriesChart timeSeries={timeSeries} />
          <ContentBreakdown data={contentBreakdown} />
          <PostingTimes data={postingTimes} />
        </div>
      )}
    </section>
  );
}
