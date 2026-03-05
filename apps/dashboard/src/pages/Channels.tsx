import { useState } from 'react';
import type { CSSProperties } from 'react';
import { apiClient, ApiError } from '@/api/client';
import { useChannels } from '@/hooks/useChannels';
import type { BannerInfo } from '@/hooks/useChannels';
import ErrorState from '@/components/states/ErrorState';
import { formatNumber, formatDate } from '@/utils/formatting';
import type { Channel, Platform, SyncStatus } from '@/types';
import '@/styles/channels.css';

const SKELETON_ROWS = 4;

const styles = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
  },
} satisfies Record<string, CSSProperties>;

// ── Sub-components ──

function CallbackBanner({
  banner,
  onDismiss,
}: {
  banner: BannerInfo;
  onDismiss: () => void;
}) {
  const cls =
    banner.type === 'success'
      ? 'channel-banner channel-banner--success'
      : 'channel-banner channel-banner--error';

  return (
    <div className={cls} role="status">
      <span>{banner.message}</span>
      <button
        type="button"
        className="channel-banner__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

function ConnectButtons({ disabled }: { disabled?: boolean }) {
  const [connecting, setConnecting] = useState<Platform | null>(null);

  async function handleConnect(platform: Platform) {
    setConnecting(platform);
    try {
      const fetcher =
        platform === 'instagram'
          ? apiClient.getInstagramConnectUrl
          : apiClient.getLinkedInConnectUrl;
      const { url } = await fetcher();
      window.location.href = url;
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to start connection. Please try again.';
      alert(message);
      setConnecting(null);
    }
  }

  return (
    <div className="channels-header__actions">
      <button
        type="button"
        className="connect-btn connect-btn--instagram"
        disabled={disabled || connecting === 'instagram'}
        onClick={() => void handleConnect('instagram')}
      >
        {connecting === 'instagram' ? 'Connecting...' : 'Connect Instagram'}
      </button>
      <button
        type="button"
        className="connect-btn connect-btn--linkedin"
        disabled={disabled || connecting === 'linkedin'}
        onClick={() => void handleConnect('linkedin')}
      >
        {connecting === 'linkedin' ? 'Connecting...' : 'Connect LinkedIn'}
      </button>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className={`platform-badge platform-badge--${platform}`}>
      {platform}
    </span>
  );
}

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  return (
    <span className={`sync-badge sync-badge--${status}`}>
      <span className="sync-badge__dot" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ChannelTable({ channels }: { channels: Channel[] }) {
  return (
    <div className="channels-table-wrap">
      <table className="channels-table">
        <thead>
          <tr>
            <th>Platform</th>
            <th>Name</th>
            <th>Handle</th>
            <th>Followers</th>
            <th>Status</th>
            <th>Last Synced</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((ch) => (
            <tr key={ch.id}>
              <td>
                <PlatformBadge platform={ch.platform} />
              </td>
              <td>{ch.displayName}</td>
              <td>@{ch.handle}</td>
              <td>{formatNumber(ch.followerCount)}</td>
              <td>
                <SyncStatusBadge status={ch.syncStatus} />
              </td>
              <td>{ch.lastSyncedAt ? formatDate(ch.lastSyncedAt) : 'Never'}</td>
              <td>{formatDate(ch.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChannelSkeletons() {
  return (
    <div
      className="channels-skeleton"
      role="status"
      aria-label="Loading channels"
    >
      <div className="channels-skeleton__header" />
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div key={i} className="channels-skeleton__row" />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

function EmptyChannels() {
  return (
    <div className="channels-empty" role="status">
      <span className="channels-empty__icon" aria-hidden="true">
        📡
      </span>
      <p className="channels-empty__title">No channels connected</p>
      <p className="channels-empty__subtitle">
        Connect your Instagram or LinkedIn account to start tracking your
        content performance.
      </p>
      <div className="channels-empty__actions">
        <ConnectButtons />
      </div>
    </div>
  );
}

// ── Main page ──

export default function Channels() {
  const { data, error, loading, banner, retry, dismissBanner } = useChannels();

  return (
    <section style={styles.section}>
      {banner && <CallbackBanner banner={banner} onDismiss={dismissBanner} />}

      <div className="channels-header">
        <h1 className="channels-header__title">Channels</h1>
        {data && data.length > 0 && <ConnectButtons />}
      </div>

      {loading && <ChannelSkeletons />}

      {error && !loading && (
        <ErrorState message={error.message} onRetry={retry} />
      )}

      {data && !loading && !error && data.length === 0 && <EmptyChannels />}

      {data && !loading && !error && data.length > 0 && (
        <ChannelTable channels={data} />
      )}
    </section>
  );
}
