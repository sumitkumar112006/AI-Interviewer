import React from 'react';
import { Calendar, RefreshCw, Download, Sparkles, TrendingUp } from 'lucide-react';

export default function Dashboard01Header({
    timeframe,
    setTimeframe,
    onRefresh,
    isRefreshing,
    onExport,
    windowDates
}) {
    const timeframes = [
        { id: '24h', label: '24 Hours' },
        { id: '7d', label: 'Last 7 Days' },
        { id: '30d', label: 'Last 30 Days' },
        { id: '90d', label: 'Last 90 Days' }
    ];

    const formatDateRange = () => {
        if (!windowDates?.startDate || !windowDates?.endDate) return '';
        try {
            const s = new Date(windowDates.startDate);
            const e = new Date(windowDates.endDate);
            return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } catch (_) {
            return '';
        }
    };

    return (
        <div className="dashboard-01-header">
            <div className="header-title-block">
                <div className="title-row">
                    <h2>Admin Analytics & Operations</h2>
                    <span className="live-telemetry-badge">
                        <span className="live-dot pulse"></span>
                        LIVE TELEMETRY
                    </span>
                </div>
                <p className="header-subtitle">
                    Real-time platform metrics, verified revenue tracking, user cohorts, and operational health.
                </p>
                {formatDateRange() && (
                    <div className="active-window-indicator">
                        <Calendar size={13} />
                        <span>Active Window: {formatDateRange()}</span>
                    </div>
                )}
            </div>

            <div className="header-controls-block">
                {/* Timeframe Pill Selector */}
                <div className="timeframe-pill-group" role="tablist" aria-label="Select date range">
                    {timeframes.map(tf => (
                        <button
                            key={tf.id}
                            type="button"
                            role="tab"
                            aria-selected={timeframe === tf.id}
                            className={`timeframe-tab-btn ${timeframe === tf.id ? 'active' : ''}`}
                            onClick={() => setTimeframe(tf.id)}
                        >
                            {tf.label}
                        </button>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="header-actions-group">
                    <button
                        type="button"
                        className="header-action-btn refresh-btn"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        title="Reload latest data from database"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
                        <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

