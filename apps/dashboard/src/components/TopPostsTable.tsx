import { useMemo } from 'react';
import type { TopPostEntry } from '@/types';
import { formatNumber, formatPercent, formatDate, truncate } from '@/utils/formatting';
import '@/styles/top-posts-table.css';

const MAX_ROWS = 10;

const PLATFORM_COLORS: Record<string, string> = {
    instagram: '#E4405F',
    linkedin: '#0A66C2',
};

interface TopPostsTableProps {
    topPosts: TopPostEntry[];
}

export default function TopPostsTable({ topPosts }: TopPostsTableProps) {
    const sortedPosts = useMemo(() => {
        const sorted = [...topPosts].sort((a, b) => {
            const rateDiff = b.engagementRate - a.engagementRate;
            if (rateDiff !== 0) return rateDiff;
            return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        });
        return sorted.slice(0, MAX_ROWS);
    }, [topPosts]);

    if (sortedPosts.length === 0) return null;

    return (
        <div className="top-posts-container">
            <h2 className="top-posts-container__title">Top Posts</h2>
            <div className="top-posts-table-wrapper">
                <table className="top-posts-table" role="table">
                    <thead>
                        <tr>
                            <th scope="col">Platform</th>
                            <th scope="col">Content</th>
                            <th scope="col">Type</th>
                            <th scope="col" className="top-posts-table__number">Impressions</th>
                            <th scope="col" className="top-posts-table__number">Engagements</th>
                            <th scope="col" className="top-posts-table__number">Rate</th>
                            <th scope="col">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedPosts.map((post) => (
                            <tr key={post.id}>
                                <td>
                                    <PlatformBadge platform={post.platform} />
                                </td>
                                <td className="top-posts-table__content" title={post.content}>
                                    {truncate(post.content)}
                                </td>
                                <td>{post.postType}</td>
                                <td className="top-posts-table__number">
                                    {formatNumber(post.impressions)}
                                </td>
                                <td className="top-posts-table__number">
                                    {formatNumber(post.engagements)}
                                </td>
                                <td className="top-posts-table__number">
                                    {formatPercent(post.engagementRate)}
                                </td>
                                <td>{formatDate(post.publishedAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PlatformBadge({ platform }: { platform: string }) {
    const color = PLATFORM_COLORS[platform.toLowerCase()] ?? '#6b7280';

    return (
        <span className="platform-badge" style={{ backgroundColor: color }}>
            {platform}
        </span>
    );
}
