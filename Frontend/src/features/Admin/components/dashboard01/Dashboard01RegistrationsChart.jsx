import React from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import { UserPlus, TrendingUp, TrendingDown } from 'lucide-react';

export default function Dashboard01RegistrationsChart({ data, loading }) {
    const timeline = data?.timeline || [];
    const totalNew = data?.totalNewInPeriod || 0;
    const totalPrev = data?.totalNewInPrev || 0;
    const pctChange = data?.pctChange;

    const formatXAxis = (tickItem) => {
        if (!tickItem) return '';
        try {
            const d = new Date(tickItem);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (_) {
            return tickItem;
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;

        let displayLabel = label;
        try {
            const d = new Date(label);
            displayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        } catch (_) {}

        return (
            <div className="custom-recharts-tooltip">
                <div className="tooltip-header">
                    <span className="tooltip-timestamp">{displayLabel}</span>
                </div>
                <div className="tooltip-items-list">
                    {payload.map((item, index) => (
                        <div key={index} className="tooltip-item-row">
                            <span className="item-color-dot" style={{ backgroundColor: item.color }}></span>
                            <span className="item-name">{item.name}:</span>
                            <span className="item-val">{item.value} users</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-01-chart-card registrations-chart-card">
            <div className="chart-card-header">
                <div className="header-text-group">
                    <div className="title-row">
                        <h3>New User Signups & Registrations</h3>
                        <span className="live-count-badge" style={{ backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
                            <UserPlus size={12} />
                            +{totalNew} in period
                        </span>
                    </div>
                    <p className="chart-description">
                        Continuous daily registration velocity compared against previous period baseline.
                    </p>
                </div>

                <div className="trend-summary-pill">
                    {pctChange !== null && pctChange !== undefined ? (
                        <span className={`pct-indicator ${pctChange >= 0 ? 'up' : 'down'}`}>
                            {pctChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {pctChange >= 0 ? '+' : ''}{pctChange}% vs previous
                        </span>
                    ) : (
                        <span className="pct-indicator neutral">Baseline</span>
                    )}
                </div>
            </div>

            <div className="chart-card-body">
                {loading ? (
                    <div className="chart-loading-state">
                        <div className="loading-spinner-ring"></div>
                        <span>Calculating registration trends...</span>
                    </div>
                ) : timeline.length === 0 ? (
                    <div className="chart-empty-state">
                        <UserPlus size={32} className="empty-icon" />
                        <p>No new registrations in this window.</p>
                    </div>
                ) : (
                    <div className="recharts-wrapper-container" style={{ width: '100%', height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatXAxis}
                                    stroke="#64748b"
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    name="Current Window"
                                    stroke="#a855f7"
                                    strokeWidth={3}
                                    dot={{ fill: '#a855f7', r: 3 }}
                                    activeDot={{ r: 6, fill: '#c084fc', stroke: '#fff', strokeWidth: 2 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="previousCount"
                                    name="Previous Period"
                                    stroke="rgba(148, 163, 184, 0.4)"
                                    strokeWidth={2}
                                    strokeDasharray="4 4"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}

