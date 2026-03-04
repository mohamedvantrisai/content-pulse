import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { PlatformBreakdownEntry } from '@/types';
import { toPlatformEngagementSlices, type PlatformEngagementSlice } from '@/utils/chartMath';
import { formatNumber } from '@/utils/formatting';
import '@/styles/platform-donut.css';

interface PlatformDonutChartProps {
    platformBreakdown: PlatformBreakdownEntry[];
}

export default function PlatformDonutChart({ platformBreakdown }: PlatformDonutChartProps) {
    const slices = useMemo(
        () => toPlatformEngagementSlices(platformBreakdown),
        [platformBreakdown],
    );

    if (slices.length === 0) return null;

    return (
        <div className="donut-chart-container" role="img" aria-label="Engagement distribution by platform">
            <h2 className="donut-chart-container__title">Engagement by Platform</h2>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={slices}
                        dataKey="engagements"
                        nameKey="platform"
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={2}
                        strokeWidth={0}
                    >
                        {slices.map((slice) => (
                            <Cell key={slice.platform} fill={slice.color} />
                        ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                </PieChart>
            </ResponsiveContainer>
            <div className="donut-chart-legend">
                {slices.map((slice) => (
                    <div key={slice.platform} className="donut-chart-legend__item">
                        <span
                            className="donut-chart-legend__dot"
                            style={{ backgroundColor: slice.color }}
                        />
                        <span>
                            {capitalize(slice.platform)} &middot; {slice.percentage}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface TooltipPayloadEntry {
    payload: PlatformEngagementSlice;
}

interface DonutTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadEntry[];
}

function DonutTooltip({ active, payload }: DonutTooltipProps) {
    if (!active || !payload?.length) return null;

    const data = payload[0]!.payload;

    return (
        <div className="donut-chart-tooltip">
            <p className="donut-chart-tooltip__platform">{capitalize(data.platform)}</p>
            <p className="donut-chart-tooltip__row">
                Engagements: {formatNumber(data.engagements)}
            </p>
            <p className="donut-chart-tooltip__row">
                Share: {data.percentage}%
            </p>
        </div>
    );
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
