import React from 'react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell
} from 'recharts';
import { Sparkles, FileText, FileCode, FileCheck, Layers } from 'lucide-react';

const FEATURE_COLORS = ['#6366f1', '#38bdf8', '#a855f7', '#f59e0b', '#10b981'];

export default function Dashboard01FeatureUsageChart({ data, loading }) {
    const features = data?.features || [];
    const totalUsage = data?.totalUsage || 0;

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload || !payload.length) return null;
        const item = payload[0]?.payload;

        return (
            <div className="custom-recharts-tooltip">
                <div className="tooltip-header">
                    <span className="tooltip-timestamp">{item.name}</span>
                    <span className="tooltip-total-pill">{item.category}</span>
                </div>
                <div className="tooltip-items-list">
                    <div className="tooltip-item-row">
                        <span className="item-name">Total Invocations:</span>
                        <span className="item-val">{item.count}</span>
                    </div>
                    <div className="tooltip-item-row">
                        <span className="item-name">Share of Output:</span>
                        <span className="item-val">{item.percentage}%</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-01-chart-card feature-usage-chart-card">
            <div className="chart-card-header">
                <div className="header-text-group">
                    <div className="title-row">
                        <h3>Feature Invocations & Usage</h3>
                        <span className="live-count-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                            <Sparkles size={12} />
                            {totalUsage} Total Runs
                        </span>
                    </div>
                    <p className="chart-description">
                        Verified feature executions across AI resume compiler, mock evaluations, and cover letter generators.
                    </p>
                </div>
            </div>

            <div className="chart-card-body">
                {loading ? (
                    <div className="chart-loading-state">
                        <div className="loading-spinner-ring"></div>
                        <span>Aggregating feature utilization...</span>
                    </div>
                ) : features.length === 0 ? (
                    <div className="chart-empty-state">
                        <Layers size={32} className="empty-icon" />
                        <p>No feature executions recorded in this window.</p>
                    </div>
                ) : (
                    <div className="feature-horizontal-bars-container">
                        <div className="recharts-wrapper-container" style={{ width: '100%', height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={features}
                                    margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                                    <XAxis
                                        type="number"
                                        stroke="#64748b"
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                        allowDecimals={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        stroke="#64748b"
                                        tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 500 }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={160}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                                        {features.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={FEATURE_COLORS[index % FEATURE_COLORS.length]}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Feature Badges Grid */}
                        <div className="feature-badges-grid">
                            {features.map((f, i) => (
                                <div key={f.name} className="feature-badge-row">
                                    <div className="badge-name-block">
                                        <span className="dot" style={{ backgroundColor: FEATURE_COLORS[i % FEATURE_COLORS.length] }}></span>
                                        <span className="name">{f.name}</span>
                                    </div>
                                    <div className="badge-stats-block">
                                        <span className="count">{f.count}</span>
                                        <span className="pct">{f.percentage}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

