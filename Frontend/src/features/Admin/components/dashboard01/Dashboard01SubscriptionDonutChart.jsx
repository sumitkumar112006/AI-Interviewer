import React, { useState } from 'react';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip
} from 'recharts';
import { Layers, ShieldCheck } from 'lucide-react';

const STATUS_CONFIG = [
    { key: 'ACTIVE', label: 'Active', color: '#10b981' },
    { key: 'CANCELLED', label: 'Cancelled', color: '#94a3b8' },
    { key: 'EXPIRED', label: 'Expired', color: '#f43f5e' },
    { key: 'GRACE_PERIOD', label: 'Grace Period', color: '#f59e0b' },
    { key: 'PAST_DUE', label: 'Past Due', color: '#ef4444' }
];

export default function Dashboard01SubscriptionDonutChart({ data, loading }) {
    const [hoveredSegment, setHoveredSegment] = useState(null);

    const statusCounts = data?.subscriptionStatusDistribution || {};
    const totalDocs = data?.totalSubscriptionDocs || 0;

    const pieData = STATUS_CONFIG.map(sc => ({
        name: sc.label,
        key: sc.key,
        value: statusCounts[sc.key] || 0,
        color: sc.color
    })).filter(item => item.value > 0);

    // Fallback if zero subscriptions
    const displayData = pieData.length > 0 ? pieData : [{ name: 'No Active Subscriptions', value: 1, color: '#334155' }];

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload || !payload.length) return null;
        const item = payload[0];
        const pct = totalDocs > 0 ? Math.round((item.value / totalDocs) * 100) : 0;

        return (
            <div className="custom-recharts-tooltip">
                <div className="tooltip-header">
                    <span className="tooltip-timestamp">{item.name}</span>
                    <span className="tooltip-total-pill">{pct}% of total</span>
                </div>
                <div className="tooltip-items-list">
                    <div className="tooltip-item-row">
                        <span className="item-color-dot" style={{ backgroundColor: item.payload?.color }}></span>
                        <span className="item-name">Count:</span>
                        <span className="item-val">{item.value} subscription documents</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-01-chart-card subscription-donut-chart-card">
            <div className="chart-card-header">
                <div className="header-text-group">
                    <div className="title-row">
                        <h3>Subscription Lifecycle Status</h3>
                        <span className="live-count-badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
                            <Layers size={12} />
                            {totalDocs} Total Agreements
                        </span>
                    </div>
                    <p className="chart-description">
                        Gateway agreement health across active, cancelled, expired, and grace period stages.
                    </p>
                </div>
            </div>

            <div className="chart-card-body">
                {loading ? (
                    <div className="chart-loading-state">
                        <div className="loading-spinner-ring"></div>
                        <span>Calculating subscription lifecycle...</span>
                    </div>
                ) : (
                    <div className="donut-layout-container">
                        <div className="recharts-wrapper-container donut-wrapper" style={{ width: 220, height: 220, position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Pie
                                        data={displayData}
                                        innerRadius={65}
                                        outerRadius={85}
                                        paddingAngle={4}
                                        dataKey="value"
                                        onMouseEnter={(_, index) => setHoveredSegment(displayData[index])}
                                        onMouseLeave={() => setHoveredSegment(null)}
                                    >
                                        {displayData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.color}
                                                stroke="rgba(15, 23, 42, 0.8)"
                                                strokeWidth={2}
                                            />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>

                            {/* Centered Total / Hover Label */}
                            <div className="donut-center-label-box">
                                {hoveredSegment ? (
                                    <>
                                        <span className="donut-hover-name" style={{ color: hoveredSegment.color }}>
                                            {hoveredSegment.name}
                                        </span>
                                        <span className="donut-hover-val">{hoveredSegment.value}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="donut-total-title">Total</span>
                                        <span className="donut-total-number">{totalDocs}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Status Legend Breakdown */}
                        <div className="donut-legend-breakdown">
                            {STATUS_CONFIG.map(sc => {
                                const count = statusCounts[sc.key] || 0;
                                const pct = totalDocs > 0 ? Math.round((count / totalDocs) * 100) : 0;
                                return (
                                    <div
                                        key={sc.key}
                                        className={`legend-item-pill ${hoveredSegment?.key === sc.key ? 'highlighted' : ''}`}
                                        onMouseEnter={() => setHoveredSegment({ name: sc.label, key: sc.key, value: count, color: sc.color })}
                                        onMouseLeave={() => setHoveredSegment(null)}
                                    >
                                        <span className="dot" style={{ backgroundColor: sc.color }}></span>
                                        <span className="label">{sc.label}</span>
                                        <span className="count">{count}</span>
                                        <span className="pct">({pct}%)</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

