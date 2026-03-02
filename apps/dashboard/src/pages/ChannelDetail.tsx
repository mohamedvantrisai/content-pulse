import type { CSSProperties } from 'react';
import { useParams } from 'react-router-dom';

const styles = {
  heading: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginBottom: 'var(--space-3)',
  },
  badges: {
    display: 'flex',
    gap: 'var(--space-2)',
    flexWrap: 'wrap' as const,
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

export default function ChannelDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <section>
      <h1 style={styles.heading}>Channel Detail</h1>
      <div style={styles.badges}>
        <span style={styles.badge}>Route: /channel/:id</span>
        <span style={styles.badge}>id={id}</span>
      </div>
    </section>
  );
}
