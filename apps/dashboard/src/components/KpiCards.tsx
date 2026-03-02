import type { PeriodMetrics, ChangeMetrics } from '@/types';
import { formatNumber, formatRate, formatChangePct } from '@/utils/formatting';
import '@/styles/kpi-cards.css';

interface KpiCardDef {
    id: string;
    label: string;
    getValue: (metrics: PeriodMetrics) => string;
    getChange: (changes: ChangeMetrics) => number | null;
}

const KPI_DEFINITIONS: readonly KpiCardDef[] = [
    {
        id: 'impressions',
        label: 'Impressions',
        getValue: (m) => formatNumber(m.totalImpressions),
        getChange: (c) => c.impressionsChangePct,
    },
    {
        id: 'engagements',
        label: 'Engagements',
        getValue: (m) => formatNumber(m.totalEngagements),
        getChange: (c) => c.engagementsChangePct,
    },
    {
        id: 'posts',
        label: 'Posts',
        getValue: (m) => formatNumber(m.totalPosts),
        getChange: (c) => c.postsChangePct,
    },
    {
        id: 'engagement-rate',
        label: 'Engagement Rate',
        getValue: (m) => formatRate(m.avgEngagementRate),
        getChange: (c) => c.avgEngagementRateChangePct,
    },
] as const;

interface KpiCardsProps {
    currentPeriod: PeriodMetrics;
    changes: ChangeMetrics;
}

export default function KpiCards({ currentPeriod, changes }: KpiCardsProps) {
    return (
        <div className="kpi-grid" role="region" aria-label="Key performance indicators">
            {KPI_DEFINITIONS.map((kpi) => {
                const change = formatChangePct(kpi.getChange(changes));
                return (
                    <article key={kpi.id} className="kpi-card" aria-labelledby={`kpi-label-${kpi.id}`}>
                        <span id={`kpi-label-${kpi.id}`} className="kpi-card__label">
                            {kpi.label}
                        </span>
                        <span className="kpi-card__value">{kpi.getValue(currentPeriod)}</span>
                        <span className={`kpi-card__change kpi-card__change--${change.direction}`}>
                            {change.text}
                        </span>
                    </article>
                );
            })}
        </div>
    );
}
