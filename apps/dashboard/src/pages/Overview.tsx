import KpiCards from '@/components/KpiCards';
import EngagementChart from '@/components/EngagementChart';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBanner from '@/components/ErrorBanner';
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
} satisfies Record<string, CSSProperties>;

export default function Overview() {
  const { data, error, loading, selectedRange, setSelectedRange } = useDashboardData();

  return (
    <section style={styles.section}>
      <div style={styles.selectorRow}>
        <h1 style={styles.heading}>Overview</h1>
        <DateRangeSelector selected={selectedRange} onSelect={setSelectedRange} />
      </div>

      {loading && <LoadingSpinner />}

      {error && !loading && (
        <ErrorBanner
          message={error.message}
          onRetry={() => setSelectedRange(selectedRange)}
        />
      )}

      {data && !loading && (
        <>
          <KpiCards currentPeriod={data.currentPeriod} changes={data.changes} />
          <EngagementChart timeSeries={data.timeSeries} />
        </>
      )}
    </section>
  );
}
