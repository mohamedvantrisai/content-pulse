import { type CSSProperties, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

interface NavItem {
  label: string;
  to: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', to: '/' },
  { label: 'Channels', to: '/channels' },
  { label: 'Comparison', to: '/comparison' },
  { label: 'Strategist', to: '/strategist' },
];

const styles = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    height: 'var(--header-height)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingInline: 'var(--space-4)',
    backgroundColor: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-6)',
    width: '100%',
    maxWidth: 'var(--container-max-width)',
    marginInline: 'auto',
  },
  logo: {
    fontWeight: 700,
    fontSize: '1.125rem',
    color: 'var(--color-primary)',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
  },
  nav: {
    display: 'flex',
    gap: 'var(--space-1)',
  },
  navLink: {
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    transition: 'color 0.15s, background-color 0.15s',
  },
  navLinkActive: {
    color: 'var(--color-primary)',
    backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
  },
  dateSlot: {
    marginLeft: 'auto',
    fontSize: '0.8125rem',
    color: 'var(--color-text-secondary)',
    padding: 'var(--space-2) var(--space-3)',
    border: '1px dashed var(--color-border)',
    borderRadius: 'var(--radius-md)',
    whiteSpace: 'nowrap',
  },
  main: {
    paddingBlock: 'var(--space-6)',
  },
} satisfies Record<string, CSSProperties>;

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link nav-link--active' : 'nav-link';
}

function navLinkStyle({
  isActive,
}: {
  isActive: boolean;
}): CSSProperties {
  return isActive
    ? { ...styles.navLink, ...styles.navLinkActive }
    : styles.navLink;
}

interface LayoutProps {
  dateFilter?: ReactNode;
}

export default function Layout({ dateFilter }: LayoutProps) {
  return (
    <>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>ContentPulse</span>

          <nav style={styles.nav}>
            {NAV_ITEMS.map(({ label, to }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={navLinkClassName}
                style={navLinkStyle}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div style={styles.dateSlot}>
            {dateFilter ?? 'Date filter'}
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <div className="container">
          <Outlet />
        </div>
      </main>
    </>
  );
}
