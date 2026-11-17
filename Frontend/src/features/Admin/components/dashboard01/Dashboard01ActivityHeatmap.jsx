import React from 'react';
import { Calendar, Flame, Info } from 'lucide-react';

export default function Dashboard01ActivityHeatmap({ data, loading }) {
    const heatmap = data?.heatmap || [];
    const days = data?.days || 60;
    const maxActive = data?.maxDailyActive || 1;
    const totalActiveEvents = data?.totalActiveEvents || 0;

    const formatDate = (dateStr) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
        } catch (_) {
            return dateStr;
        }
    };

    return (
        <div className="dashboard-01-chart-card activity-heatmap-card">
            <div className="chart-card-header">
                <div className="header-text-group">
                    <div className="title-row">
                        <h3>User Engagement Activity Heatmap</h3>
                        <span className="live-count-badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
                            <Flame size={12} />
                            {days} Days Window
                        </span>
                    </div>
                    <p className="chart-description">
                        Daily authenticated active users density matrix. Darker cells represent peak engagement days.
                    </p>
                </div>

                <div className="heatmap-legend-row">
                    <span className="legend-label">Less</span>
                    <span className="heat-cell-sample level-0" title="0 active users"></span>
                    <span className="heat-cell-sample level-1" title="Low activity"></span>
                    <span className="heat-cell-sample level-2" title="Moderate activity"></span>
                    <span className="heat-cell-sample level-3" title="High activity"></span>
                    <span className="heat-cell-sample level-4" title="Peak activity"></span>
                    <span className="legend-label">More</span>
                </div>
            </div>

            <div className="chart-card-body">
                {loading ? (
                    <div className="chart-loading-state">
                        <div className="loading-spinner-ring"></div>
                        <span>Calculating engagement density...</span>
                    </div>
                ) : heatmap.length === 0 ? (
                    <div className="chart-empty-state">
                        <Calendar size={32} className="empty-icon" />
                        <p>No user activity recorded in the last {days} days.</p>
                    </div>
                ) : (
                    <div className="heatmap-grid-scroll-wrapper">
                        <div className="heatmap-cells-grid">
                            {heatmap.map((cell) => (
                                <div
                                    key={cell.date}
                                    className={`heatmap-day-cell level-${cell.level}`}
                                    title={`${formatDate(cell.date)}: ${cell.count} active users`}
                                >
                                    <span className="day-tooltip-pop">
                                        <strong>{cell.count}</strong> on {cell.date.slice(5)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="heatmap-footer-meta">
                    <Info size={12} />
                    <span>
                        Tracks daily unique user logins, sessions, and generator activity recorded via 2-tier throttled telemetry.
                    </span>
                </div>
            </div>
        </div>
    );
}

