import '@/styles/widget-states.css';

type SkeletonVariant = 'chart' | 'table';

interface WidgetSkeletonProps {
    variant: SkeletonVariant;
}

const TABLE_SKELETON_ROWS = 5;

export default function WidgetSkeleton({ variant }: WidgetSkeletonProps) {
    return (
        <div className="widget-skeleton" role="status" aria-label="Loading content">
            <div className="widget-skeleton__title" />
            {variant === 'chart' && <div className="widget-skeleton__chart-block" />}
            {variant === 'table' && (
                <>
                    <div className="widget-skeleton__table-header" />
                    {Array.from({ length: TABLE_SKELETON_ROWS }, (_, i) => (
                        <div key={i} className="widget-skeleton__table-row" />
                    ))}
                </>
            )}
            <span className="sr-only">Loading</span>
        </div>
    );
}
