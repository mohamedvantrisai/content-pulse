import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ChannelDetail from '../ChannelDetail';
import { apiClient, ApiError } from '@/api/client';
import type { ChannelDetailAnalytics } from '@/types';

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>(
    '@/api/client',
  );
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getChannelDetailAnalytics: vi.fn(),
    },
  };
});

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

const mockGetAnalytics = apiClient.getChannelDetailAnalytics as Mock;

const MOCK_ANALYTICS: ChannelDetailAnalytics = {
  channel: {
    id: 'ch-1',
    platform: 'instagram',
    displayName: 'My IG Page',
    handle: 'myigpage',
    followerCount: 12500,
    syncStatus: 'active',
    lastSyncedAt: '2026-03-01T12:00:00.000Z',
    createdAt: '2026-02-15T08:00:00.000Z',
  },
  timeSeries: [
    { date: '2026-02-28', impressions: 5000, engagements: 300, posts: 2 },
    { date: '2026-03-01', impressions: 6000, engagements: 400, posts: 3 },
  ],
  contentBreakdown: [
    { postType: 'image', count: 5, totalImpressions: 8000, totalEngagements: 500 },
    { postType: 'video', count: 3, totalImpressions: 3000, totalEngagements: 200 },
  ],
  postingTimes: [
    { hour: 9, count: 4 },
    { hour: 14, count: 6 },
    { hour: 18, count: 3 },
  ],
};

function renderDetail(channelId = 'ch-1') {
  return render(
    <MemoryRouter initialEntries={[`/channel/${channelId}`]}>
      <Routes>
        <Route path="/channel/:id" element={<ChannelDetail />} />
        <Route path="/channels" element={<div data-testid="channels-page">Channels List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ChannelDetail page', () => {
  it('TC-C1: renders detail page with channel data from API', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS);

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('My IG Page')).toBeInTheDocument();
    });

    expect(mockGetAnalytics).toHaveBeenCalledWith('ch-1', expect.objectContaining({
      start: expect.any(String),
      end: expect.any(String),
    }));
  });

  it('TC-C2: header shows correct platform icon, name, handle, followers', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS);

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('My IG Page')).toBeInTheDocument();
    });

    expect(screen.getByText('@myigpage')).toBeInTheDocument();
    expect(screen.getByText('12,500')).toBeInTheDocument();
    expect(screen.getByText('Followers')).toBeInTheDocument();
    expect(screen.getByText('instagram')).toBeInTheDocument();
  });

  it('TC-C3: chart containers render', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS);

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('My IG Page')).toBeInTheDocument();
    });

    expect(screen.getByText('Daily Trends')).toBeInTheDocument();
    expect(screen.getByText('Content Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Posting Times')).toBeInTheDocument();
  });

  it('TC-C4: back button navigates to channels list', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS);

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('My IG Page')).toBeInTheDocument();
    });

    const backBtn = screen.getByRole('button', { name: /back to channels/i });
    await userEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByTestId('channels-page')).toBeInTheDocument();
    });
  });

  it('shows loading skeletons while fetching', () => {
    mockGetAnalytics.mockReturnValue(new Promise(() => {}));

    renderDetail();

    const skeletons = screen.getAllByRole('status', { name: /loading content/i });
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error state with retry on API failure', async () => {
    mockGetAnalytics.mockRejectedValue(
      new ApiError('FETCH_FAILED', 'Channel not found'),
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('Channel not found')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows empty state when no analytics data in range', async () => {
    mockGetAnalytics.mockResolvedValue({
      ...MOCK_ANALYTICS,
      timeSeries: [],
      contentBreakdown: [],
      postingTimes: [],
    });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('No data for this period')).toBeInTheDocument();
    });
  });
});
