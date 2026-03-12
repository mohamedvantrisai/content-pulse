import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { apiClient, ApiError } from '@/api/client';
import WidgetSkeleton from '@/components/states/WidgetSkeleton';
import ErrorState from '@/components/states/ErrorState';
import EmptyState from '@/components/states/EmptyState';
import { formatNumber } from '@/utils/formatting';
import type { Channel } from '@/types';
import '@/styles/comparison.css';

interface ComparisonChannelMetrics {
  channelId: string;
  platform: string;
  displayName: string;
  totalImpressions: number;
  totalEngagements: number;
  totalPosts: number;
  avgEngagementRate: number;
}

interface ComparisonWinners {
  totalImpressions: string;
  totalEngagements: string;
  avgEngagementRate: string;
  totalPosts: string;
}

interface ComparisonData {
  channels: ComparisonChannelMetrics[];
  winners: ComparisonWinners;
}

const CHANNEL_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e'];

function MetricCard({
  label,
  values,
  winnerId,
  channels,
  format,
}: {
  label: string;
  values: Record<string, number>;
  winnerId: string;
  channels: ComparisonChannelMetrics[];
  format?: (v: number) => string;
}) {
  const fmt = format ?? formatNumber;
  return (
    <div className="cmp-metric-card" data-testid={`metric-card-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <h3 className="cmp-metric-card__label">{label}</h3>
      <div className="cmp-metric-card__values">
        {channels.map((ch, idx) => (
          <div
            key={ch.channelId}
            className={`cmp-metric-card__value ${ch.channelId === winnerId ? 'cmp-metric-card__value--winner' : ''}`}
          >
            <span
              className="cmp-metric-card__dot"
              style={{ backgroundColor: CHANNEL_COLORS[idx] }}
            />
            <span className="cmp-metric-card__name">{ch.displayName}</span>
            <span className="cmp-metric-card__number">{fmt(values[ch.channelId] ?? 0)}</span>
            {ch.channelId === winnerId && <span className="cmp-metric-card__badge">Winner</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Comparison() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiClient.getChannels()
      .then((chs) => {
        setChannels(chs);
        if (chs.length >= 2) {
          setSelectedIds([chs[0].id, chs[1].id]);
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err : new ApiError('UNKNOWN', String(err))))
      .finally(() => setChannelsLoading(false));
  }, []);

  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }, []);

  const fetchComparison = useCallback(async () => {
    if (selectedIds.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getChannelComparison({
        channel_ids: selectedIds.join(','),
        start: dateRange.start,
        end: dateRange.end,
      });
      setComparison(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('UNKNOWN', String(err)));
    } finally {
      setLoading(false);
    }
  }, [selectedIds, dateRange]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  function toggleChannel(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  if (channelsLoading) {
    return (
      <section className="cmp-page">
        <WidgetSkeleton variant="chart" />
      </section>
    );
  }

  if (error && !comparison) {
    return (
      <section className="cmp-page">
        <h1 className="cmp-title" data-testid="comparison-title">Channel Comparison</h1>
        <ErrorState message={error.message} onRetry={fetchComparison} />
      </section>
    );
  }

  if (channels.length < 2) {
    return (
      <section className="cmp-page">
        <h1 className="cmp-title" data-testid="comparison-title">Channel Comparison</h1>
        <EmptyState
          title="Not enough channels"
          subtitle="You need at least 2 connected channels to compare."
        />
      </section>
    );
  }

  const chartData = comparison
    ? [
        {
          metric: 'Impressions',
          ...Object.fromEntries(
            comparison.channels.map((c) => [c.displayName, c.totalImpressions]),
          ),
        },
        {
          metric: 'Engagements',
          ...Object.fromEntries(
            comparison.channels.map((c) => [c.displayName, c.totalEngagements]),
          ),
        },
        {
          metric: 'Posts',
          ...Object.fromEntries(
            comparison.channels.map((c) => [c.displayName, c.totalPosts]),
          ),
        },
      ]
    : [];

  return (
    <section className="cmp-page" data-testid="comparison-page">
      <h1 className="cmp-title" data-testid="comparison-title">Channel Comparison</h1>

      <div className="cmp-selector" data-testid="channel-selector">
        <p className="cmp-selector__label">Select channels to compare:</p>
        <div className="cmp-selector__chips">
          {channels.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className={`cmp-chip ${selectedIds.includes(ch.id) ? 'cmp-chip--active' : ''}`}
              onClick={() => toggleChannel(ch.id)}
              data-testid={`channel-chip-${ch.id}`}
            >
              <span className={`cmp-chip__platform cmp-chip__platform--${ch.platform}`}>
                {ch.platform === 'instagram' ? '📸' : '💼'}
              </span>
              {ch.displayName}
            </button>
          ))}
        </div>
        {selectedIds.length < 2 && (
          <p className="cmp-selector__hint" data-testid="comparison-hint">Select at least 2 channels</p>
        )}
      </div>

      {loading ? (
        <div className="cmp-grid">
          <WidgetSkeleton variant="chart" />
          <WidgetSkeleton variant="chart" />
        </div>
      ) : comparison ? (
        <>
          <div className="cmp-metrics" data-testid="comparison-metrics">
            <MetricCard
              label="Total Impressions"
              values={Object.fromEntries(comparison.channels.map((c) => [c.channelId, c.totalImpressions]))}
              winnerId={comparison.winners.totalImpressions}
              channels={comparison.channels}
            />
            <MetricCard
              label="Total Engagements"
              values={Object.fromEntries(comparison.channels.map((c) => [c.channelId, c.totalEngagements]))}
              winnerId={comparison.winners.totalEngagements}
              channels={comparison.channels}
            />
            <MetricCard
              label="Avg Engagement Rate"
              values={Object.fromEntries(comparison.channels.map((c) => [c.channelId, c.avgEngagementRate]))}
              winnerId={comparison.winners.avgEngagementRate}
              channels={comparison.channels}
              format={(v) => `${(v * 100).toFixed(2)}%`}
            />
            <MetricCard
              label="Total Posts"
              values={Object.fromEntries(comparison.channels.map((c) => [c.channelId, c.totalPosts]))}
              winnerId={comparison.winners.totalPosts}
              channels={comparison.channels}
            />
          </div>

          <div className="cmp-chart" data-testid="comparison-chart">
            <h2 className="cmp-chart__title">Side-by-Side Metrics</h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="metric"
                  tick={{ fontSize: 12, fill: 'var(--color-text)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatNumber(v)}
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
                <Legend />
                {comparison.channels.map((ch, idx) => (
                  <Bar
                    key={ch.channelId}
                    dataKey={ch.displayName}
                    fill={CHANNEL_COLORS[idx]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </section>
  );
}
