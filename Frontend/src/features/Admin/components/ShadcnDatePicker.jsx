import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Format a Date object to "YYYY-MM-DD" in local timezone
 */
export const toDateString = (date) => {
    if (!date || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Parse a "YYYY-MM-DD" string into local Date object
 */
export const parseDateString = (str) => {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Format date for trigger button display, e.g. "Nov 09, 2026"
 */
export const formatDisplayDate = (str) => {
    const d = parseDateString(str);
    if (!d) return '';
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
    });
};

export const ShadcnDatePicker = ({
    value = '',
    onChange,
    placeholder = 'Pick a date',
    minDate = '',
    maxDate = '',
    align = 'left',
    disabled = false,
    className = '',
    ariaLabel = 'Select date'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Initial viewing month/year based on value or today
    const parsedValue = useMemo(() => parseDateString(value), [value]);

    const [viewDate, setViewDate] = useState(() => {
        if (parsedValue) return new Date(parsedValue.getFullYear(), parsedValue.getMonth(), 1);
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });

    // Update viewing month when value changes externally
    useEffect(() => {
        if (parsedValue) {
            setViewDate(new Date(parsedValue.getFullYear(), parsedValue.getMonth(), 1));
        }
    }, [parsedValue]);

    // Handle click outside to close popover
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();

    const handlePrevMonth = (e) => {
        e.stopPropagation();
        setViewDate(new Date(viewYear, viewMonth - 1, 1));
    };

    const handleNextMonth = (e) => {
        e.stopPropagation();
        setViewDate(new Date(viewYear, viewMonth + 1, 1));
    };

    // Generate days for 6-row (42-cell) calendar
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

        const days = [];

        // Previous month filler days
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const dateObj = new Date(viewYear, viewMonth - 1, dayNum);
            days.push({
                date: dateObj,
                dateString: toDateString(dateObj),
                dayNumber: dayNum,
                isOutside: true
            });
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(viewYear, viewMonth, i);
            days.push({
                date: dateObj,
                dateString: toDateString(dateObj),
                dayNumber: i,
                isOutside: false
            });
        }

        // Next month filler days up to 42 cells or complete row
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            const dateObj = new Date(viewYear, viewMonth + 1, i);
            days.push({
                date: dateObj,
                dateString: toDateString(dateObj),
                dayNumber: i,
                isOutside: true
            });
        }

        return days;
    }, [viewYear, viewMonth]);

    const todayString = useMemo(() => toDateString(new Date()), []);

    const isDateDisabled = (dateStr) => {
        if (minDate && dateStr < minDate) return true;
        if (maxDate && dateStr > maxDate) return true;
        return false;
    };

    const handleSelectDay = (dateStr) => {
        if (isDateDisabled(dateStr)) return;
        if (onChange) {
            onChange(dateStr);
        }
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        if (onChange) onChange('');
    };

    const handleSetToday = (e) => {
        e.stopPropagation();
        if (isDateDisabled(todayString)) return;
        if (onChange) onChange(todayString);
        setViewDate(new Date());
        setIsOpen(false);
    };

    const displayText = value ? formatDisplayDate(value) : placeholder;

    return (
        <div className={`shadcn-date-picker ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(prev => !prev)}
                className={`date-picker-trigger ${isOpen ? 'is-open' : ''}`}
                disabled={disabled}
                aria-label={ariaLabel}
                aria-expanded={isOpen}
            >
                <div className="trigger-content">
                    <CalendarIcon className="w-4 h-4 calendar-icon" />
                    <span className={`date-label ${!value ? 'is-placeholder' : ''}`}>
                        {displayText}
                    </span>
                </div>

                {value && !disabled && (
                    <span
                        role="button"
                        onClick={handleClear}
                        className="clear-date-btn"
                        title="Clear date"
                        aria-label="Clear date"
                    >
                        <X className="w-3.5 h-3.5" />
                    </span>
                )}
            </button>

            {/* Popover Dropdown */}
            {isOpen && (
                <div className={`date-picker-popover align-${align}`}>
                    {/* Header */}
                    <div className="popover-header">
                        <span className="month-year-label">
                            {MONTH_NAMES[viewMonth]} {viewYear}
                        </span>
                        <div className="nav-btns">
                            <button
                                type="button"
                                onClick={handlePrevMonth}
                                className="nav-btn"
                                aria-label="Previous month"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                className="nav-btn"
                                aria-label="Next month"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Weekday Labels */}
                    <div className="calendar-weekdays">
                        {WEEKDAY_NAMES.map((name) => (
                            <span key={name} className="weekday-label">
                                {name}
                            </span>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="calendar-days-grid">
                        {calendarDays.map((cell) => {
                            const isSelected = cell.dateString === value;
                            const isToday = cell.dateString === todayString;
                            const isDisabled = isDateDisabled(cell.dateString);

                            let cellClass = 'day-cell';
                            if (cell.isOutside) cellClass += ' is-outside';
                            if (isToday) cellClass += ' is-today';
                            if (isSelected) cellClass += ' is-selected';

                            return (
                                <button
                                    key={cell.dateString + (cell.isOutside ? '-out' : '')}
                                    type="button"
                                    onClick={() => handleSelectDay(cell.dateString)}
                                    disabled={isDisabled}
                                    className={cellClass}
                                    aria-label={cell.dateString}
                                >
                                    {cell.dayNumber}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="popover-footer">
                        <button
                            type="button"
                            onClick={handleClear}
                            className="footer-quick-btn"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={handleSetToday}
                            className="footer-quick-btn today-btn"
                        >
                            Today
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShadcnDatePicker;
