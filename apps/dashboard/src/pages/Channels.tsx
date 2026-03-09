import { useState, useCallback } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true">
      <div className="confirm-dialog">
        <p className="confirm-dialog__message">{message}</p>
        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--confirm"
            onClick={onConfirm}
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelTable({
  channels,
  onPauseResume,
  onDisconnect,
}: {
  channels: Channel[];
  onPauseResume: (id: string, status: 'active' | 'paused') => void;
  onDisconnect: (id: string) => void;
}) {
  const navigate = useNavigate();

  const handleRowClick = useCallback(
    (id: string) => {
      navigate(`/channel/${id}`);
    },
    [navigate],
  );

  const handleRowKeyDown = useCallback(
    (e: KeyboardEvent, id: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(`/channel/${id}`);
      }
    },
    [navigate],
  );

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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((ch) => (
            <tr
              key={ch.id}
              role="link"
              tabIndex={0}
              className="channels-table__row--clickable"
              onClick={() => handleRowClick(ch.id)}
              onKeyDown={(e) => handleRowKeyDown(e, ch.id)}
            >
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
              <td
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="channel-actions">
                  {(ch.syncStatus === 'active' || ch.syncStatus === 'paused') && (
                    <button
                      type="button"
                      className="channel-action-btn"
                      onClick={() =>
                        onPauseResume(
                          ch.id,
                          ch.syncStatus === 'active' ? 'paused' : 'active',
                        )
                      }
                    >
                      {ch.syncStatus === 'active' ? 'Pause' : 'Resume'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="channel-action-btn channel-action-btn--danger"
                    onClick={() => onDisconnect(ch.id)}
                  >
                    Disconnect
                  </button>
                </div>
              </td>
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
  const { data, error, loading, banner, retry, dismissBanner, updateSyncStatus, disconnectChannel } =
    useChannels();
  const [pendingDisconnect, setPendingDisconnect] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handlePauseResume = useCallback(
    async (channelId: string, syncStatus: 'active' | 'paused') => {
      setActionError(null);
      try {
        await updateSyncStatus(channelId, syncStatus);
      } catch (err: unknown) {
        const msg =
          err instanceof ApiError
            ? err.message
            : 'Failed to update channel status.';
        setActionError(msg);
      }
    },
    [updateSyncStatus],
  );

  const handleDisconnectConfirm = useCallback(async () => {
    if (!pendingDisconnect) return;
    const channelId = pendingDisconnect;
    setPendingDisconnect(null);
    setActionError(null);
    try {
      await disconnectChannel(channelId);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to disconnect channel.';
      setActionError(msg);
    }
  }, [pendingDisconnect, disconnectChannel]);

  return (
    <section style={styles.section}>
      {banner && <CallbackBanner banner={banner} onDismiss={dismissBanner} />}

      {actionError && (
        <CallbackBanner
          banner={{ type: 'error', message: actionError }}
          onDismiss={() => setActionError(null)}
        />
      )}

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
        <ChannelTable
          channels={data}
          onPauseResume={(id, status) => void handlePauseResume(id, status)}
          onDisconnect={(id) => setPendingDisconnect(id)}
        />
      )}

      {pendingDisconnect && (
        <ConfirmDialog
          message="Are you sure you want to disconnect this channel? Historical data will be preserved, but syncing will stop permanently."
          onConfirm={() => void handleDisconnectConfirm()}
          onCancel={() => setPendingDisconnect(null)}
        />
      )}
    </section>
  );
}
