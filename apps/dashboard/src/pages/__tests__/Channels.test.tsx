import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Channels from '../Channels';
import { apiClient, ApiError } from '@/api/client';
import type { Channel } from '@/types';

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>(
    '@/api/client',
  );
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getChannels: vi.fn(),
      getInstagramConnectUrl: vi.fn(),
      getLinkedInConnectUrl: vi.fn(),
    },
  };
});

const mockGetChannels = apiClient.getChannels as Mock;
const mockGetInstagramConnectUrl = apiClient.getInstagramConnectUrl as Mock;

const MOCK_CHANNELS: Channel[] = [
  {
    id: 'ch-1',
    platform: 'instagram',
    displayName: 'My IG Page',
    handle: 'myigpage',
    followerCount: 12500,
    syncStatus: 'active',
    lastSyncedAt: '2026-03-01T12:00:00.000Z',
    createdAt: '2026-02-15T08:00:00.000Z',
  },
  {
    id: 'ch-2',
    platform: 'linkedin',
    displayName: 'My Company',
    handle: 'mycompany',
    followerCount: 3400,
    syncStatus: 'paused',
    lastSyncedAt: null,
    createdAt: '2026-02-20T10:00:00.000Z',
  },
];

function renderChannels(initialRoute = '/channels') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Channels />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Channels page', () => {
  it('shows skeleton placeholders during loading', () => {
    mockGetChannels.mockReturnValue(new Promise(() => {}));

    renderChannels();

    expect(screen.getByRole('status', { name: /loading channels/i })).toBeInTheDocument();
  });

  it('renders channel rows from API response', async () => {
    mockGetChannels.mockResolvedValue(MOCK_CHANNELS);

    renderChannels();

    await waitFor(() => {
      expect(screen.getByText('My IG Page')).toBeInTheDocument();
    });

    expect(screen.getByText('My Company')).toBeInTheDocument();
    expect(screen.getByText('@myigpage')).toBeInTheDocument();
    expect(screen.getByText('@mycompany')).toBeInTheDocument();
    expect(screen.getByText('12,500')).toBeInTheDocument();
    expect(screen.getByText('3,400')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('shows platform badges with correct labels', async () => {
    mockGetChannels.mockResolvedValue(MOCK_CHANNELS);

    renderChannels();

    await waitFor(() => {
      expect(screen.getByText('instagram')).toBeInTheDocument();
    });
    expect(screen.getByText('linkedin')).toBeInTheDocument();
  });

  it('shows sync status badges', async () => {
    mockGetChannels.mockResolvedValue(MOCK_CHANNELS);

    renderChannels();

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('shows empty state with connect buttons when API returns []', async () => {
    mockGetChannels.mockResolvedValue([]);

    renderChannels();

    await waitFor(() => {
      expect(screen.getByText('No channels connected')).toBeInTheDocument();
    });

    const igButtons = screen.getAllByRole('button', {
      name: /connect instagram/i,
    });
    const liButtons = screen.getAllByRole('button', {
      name: /connect linkedin/i,
    });
    expect(igButtons.length).toBeGreaterThanOrEqual(1);
    expect(liButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error state with Retry button on API failure', async () => {
    mockGetChannels.mockRejectedValue(
      new ApiError('FETCH_FAILED', 'Network error'),
    );

    renderChannels();

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /retry/i }),
    ).toBeInTheDocument();
  });

  it('retry button triggers re-fetch', async () => {
    mockGetChannels.mockRejectedValueOnce(
      new ApiError('FETCH_FAILED', 'Network error'),
    );
    mockGetChannels.mockResolvedValueOnce(MOCK_CHANNELS);

    renderChannels();

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('My IG Page')).toBeInTheDocument();
    });

    expect(mockGetChannels).toHaveBeenCalledTimes(2);
  });

  it('shows success banner when ?connected= query param is present', async () => {
    mockGetChannels.mockResolvedValue(MOCK_CHANNELS);

    renderChannels('/channels?connected=instagram');

    await waitFor(() => {
      expect(
        screen.getByText('Instagram connected successfully.'),
      ).toBeInTheDocument();
    });
  });

  it('shows error banner when ?error= query param is present', async () => {
    mockGetChannels.mockResolvedValue([]);

    renderChannels('/channels?error=access_denied&message=You+denied+access');

    await waitFor(() => {
      expect(screen.getByText('You denied access')).toBeInTheDocument();
    });
  });

  it('connect button fetches URL and navigates', async () => {
    mockGetChannels.mockResolvedValue([]);
    mockGetInstagramConnectUrl.mockResolvedValue({
      url: 'https://meta.example.com/oauth',
    });

    const originalLocation = window.location.href;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: originalLocation },
    });

    renderChannels();

    await waitFor(() => {
      expect(screen.getByText('No channels connected')).toBeInTheDocument();
    });

    const igButtons = screen.getAllByRole('button', {
      name: /connect instagram/i,
    });
    await userEvent.click(igButtons[0]!);

    await waitFor(() => {
      expect(mockGetInstagramConnectUrl).toHaveBeenCalledTimes(1);
    });
  });
});
