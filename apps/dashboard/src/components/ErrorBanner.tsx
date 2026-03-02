import '@/styles/error-banner.css';

interface ErrorBannerProps {
    message: string;
    onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
    return (
        <div className="error-banner" role="alert">
            <span className="error-banner__icon" aria-hidden="true">⚠</span>
            <span className="error-banner__message">{message}</span>
            {onRetry && (
                <button type="button" className="error-banner__retry" onClick={onRetry}>
                    Retry
                </button>
            )}
        </div>
    );
}
