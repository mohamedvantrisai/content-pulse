import '@/styles/loading-spinner.css';

export default function LoadingSpinner() {
    return (
        <div className="loading-spinner" role="status">
            <div className="loading-spinner__ring" />
            <span className="loading-spinner__text">Loading dashboard…</span>
            <span className="sr-only">Loading</span>
        </div>
    );
}
