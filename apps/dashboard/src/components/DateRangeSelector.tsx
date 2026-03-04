import { DATE_RANGES, type DateRangeKey } from '@/constants/dateRanges';
import '@/styles/date-range-selector.css';

interface DateRangeSelectorProps {
    selected: DateRangeKey;
    onSelect: (range: DateRangeKey) => void;
}

export default function DateRangeSelector({ selected, onSelect }: DateRangeSelectorProps) {
    return (
        <div className="date-range-selector" role="group" aria-label="Date range">
            {DATE_RANGES.map(({ key, label }) => (
                <button
                    key={key}
                    type="button"
                    className={`date-range-btn${key === selected ? ' date-range-btn--active' : ''}`}
                    aria-pressed={key === selected}
                    onClick={() => onSelect(key)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
