import { useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import type { TimeSeriesEntry } from '@/types';
import { aggregateWeekly, type WeeklyTimeSeriesEntry } from '@/utils/aggregation';
import { formatNumber } from '@/utils/formatting';
import { WEEKLY_AGGREGATION_THRESHOLD } from '@/constants/dateRanges';
import '@/styles/engagement-chart.css';

const COLORS = {
    impressions: '#3b82f6',
    engagements: '#22c55e',
} as const;

interface ChartDataPoint {
    label: string;
    impressions: number;
    engagements: number;
}

interface EngagementChartProps {
    timeSeries: TimeSeriesEntry[];
}

export default function EngagementChart({ timeSeries }: EngagementChartProps) {
    const { chartData, isWeekly } = useMemo(() => {
        if (timeSeries.length > WEEKLY_AGGREGATION_THRESHOLD) {
            const weekly = aggregateWeekly(timeSeries);
            return {
                chartData: weekly.map(
                    (w: WeeklyTimeSeriesEntry): ChartDataPoint => ({
                        label: w.weekLabel,
                        impressions: w.impressions,
                        engagements: w.engagements,
                    }),
                ),
                isWeekly: true,
            };
        }

        return {
            chartData: timeSeries.map(
                (d): ChartDataPoint => ({
                    label: d.date,
                    impressions: d.impressions,
                    engagements: d.engagements,
                }),
            ),
            isWeekly: false,
        };
    }, [timeSeries]);

    return (
        <div className="chart-container" role="img" aria-label="Impressions and engagements over time">
            <h2 className="chart-container__title">
                {isWeekly ? 'Weekly Trends' : 'Daily Trends'}
            </h2>
            <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="gradImpressions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.impressions} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={COLORS.impressions} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradEngagements" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.engagements} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={COLORS.engagements} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => formatNumber(v)}
                        width={60}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="impressions"
                        stroke={COLORS.impressions}
                        strokeWidth={2}
                        fill="url(#gradImpressions)"
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2 }}
                        name="Impressions"
                    />
                    <Area
                        type="monotone"
                        dataKey="engagements"
                        stroke={COLORS.engagements}
                        strokeWidth={2}
                        fill="url(#gradEngagements)"
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2 }}
                        name="Engagements"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

interface TooltipPayloadItem {
    name: string;
    value: number;
    color: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;

    return (
        <div className="chart-tooltip">
            <p className="chart-tooltip__label">{label}</p>
            {payload.map((entry) => (
                <div key={entry.name} className="chart-tooltip__row">
                    <span className="chart-tooltip__dot" style={{ backgroundColor: entry.color }} />
                    <span>
                        {entry.name}: {formatNumber(entry.value)}
                    </span>
                </div>
            ))}
        </div>
    );
}
