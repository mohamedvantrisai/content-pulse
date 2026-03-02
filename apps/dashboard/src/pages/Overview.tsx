import type { CSSProperties } from 'react';

const styles = {
  heading: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginBottom: 'var(--space-3)',
  },
  badge: {
    display: 'inline-block',
    padding: 'var(--space-1) var(--space-3)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
  },
} satisfies Record<string, CSSProperties>;

export default function Overview() {
  return (
    <section>
      <h1 style={styles.heading}>Overview</h1>
      <span style={styles.badge}>Route: /</span>
    </section>
  );
}
