import '@/styles/widget-states.css';

interface ErrorStateProps {
    message: string;
    onRetry: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
    return (
        <div className="error-state" role="alert">
            <span className="error-state__icon" aria-hidden="true">⚠</span>
            <p className="error-state__message">{message}</p>
            <button type="button" className="error-state__retry" onClick={onRetry}>
                Retry
            </button>
        </div>
    );
}
