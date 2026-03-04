import KpiCards from '@/components/KpiCards';
import EngagementChart from '@/components/EngagementChart';
import PlatformDonutChart from '@/components/PlatformDonutChart';
import TopPostsTable from '@/components/TopPostsTable';
import WidgetSkeleton from '@/components/states/WidgetSkeleton';
import ErrorState from '@/components/states/ErrorState';
import EmptyState from '@/components/states/EmptyState';
import { useDashboardData } from '@/hooks/useDashboardData';
import DateRangeSelector from '@/components/DateRangeSelector';
import type { CSSProperties } from 'react';

const styles = {
  heading: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginBottom: 'var(--space-5)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-5)',
  },
  selectorRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 'var(--space-3)',
  },
  widgetRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-5)',
  },
} satisfies Record<string, CSSProperties>;

export default function Overview() {
  const { data, error, loading, selectedRange, setSelectedRange, retry } =
    useDashboardData();

  const hasNoData =
    data !== null &&
    data.platformBreakdown.length === 0 &&
    data.topPosts.length === 0 &&
    data.timeSeries.length === 0;

  return (
    <section style={styles.section}>
      <div style={styles.selectorRow}>
        <h1 style={styles.heading}>Overview</h1>
        <DateRangeSelector selected={selectedRange} onSelect={setSelectedRange} />
      </div>

      {loading && (
        <>
          <div style={styles.widgetRow}>
            <WidgetSkeleton variant="chart" />
            <WidgetSkeleton variant="chart" />
          </div>
          <WidgetSkeleton variant="table" />
        </>
      )}

      {error && !loading && (
        <ErrorState
          message={error.message}
          onRetry={retry}
        />
      )}

      {data && !loading && !error && hasNoData && (
        <EmptyState
          title="No data available"
          subtitle="Connect a channel or adjust the date range to see your analytics."
        />
      )}

      {data && !loading && !error && !hasNoData && (
        <>
          <KpiCards currentPeriod={data.currentPeriod} changes={data.changes} />
          <div style={styles.widgetRow}>
            <EngagementChart timeSeries={data.timeSeries} />
            <PlatformDonutChart platformBreakdown={data.platformBreakdown} />
          </div>
          <TopPostsTable topPosts={data.topPosts} />
        </>
      )}
    </section>
  );
}
