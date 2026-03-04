import '@/styles/widget-states.css';

interface EmptyStateProps {
    title: string;
    subtitle?: string;
}

export default function EmptyState({ title, subtitle }: EmptyStateProps) {
    return (
        <div className="empty-state" role="status">
            <span className="empty-state__icon" aria-hidden="true">📭</span>
            <p className="empty-state__title">{title}</p>
            {subtitle && <p className="empty-state__subtitle">{subtitle}</p>}
        </div>
    );
}
