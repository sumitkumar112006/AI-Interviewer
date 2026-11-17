import React from 'react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import { IndianRupee, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Dashboard01RevenueChart({ data, loading }) {
    const timeline = data?.timeline || [];
    const totalRevenue = data?.totalRevenue || 0;
    const totalSuccessful = data?.totalSuccessful || 0;
    const totalFailed = data?.totalFailed || 0;

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
                            <span className="item-val">
                                {item.dataKey === 'revenue' ? `₹${item.value?.toLocaleString('en-IN')}` : item.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-01-chart-card revenue-chart-card">
            <div className="chart-card-header">
                <div className="header-text-group">
                    <div className="title-row">
                        <h3>Verified Revenue & Payment Velocity</h3>
                        <span className="live-count-badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                            <IndianRupee size={12} />
                            ₹{totalRevenue.toLocaleString('en-IN')} Settled
                        </span>
                    </div>
                    <p className="chart-description">
                        Verified settled payments from Razorpay webhook events. Failed attempts tracked for gateway health.
                    </p>
                </div>

                <div className="revenue-quick-stats">
                    <span className="stat-pill success">
                        <CheckCircle2 size={12} />
                        {totalSuccessful} Succeeded
                    </span>
                    <span className="stat-pill failed">
                        <AlertTriangle size={12} />
                        {totalFailed} Failed
                    </span>
                </div>
            </div>

            <div className="chart-card-body">
                {loading ? (
                    <div className="chart-loading-state">
                        <div className="loading-spinner-ring"></div>
                        <span>Aggregating financial ledger...</span>
                    </div>
                ) : timeline.length === 0 ? (
                    <div className="chart-empty-state">
                        <IndianRupee size={32} className="empty-icon" />
                        <p>No settled payment transactions found in this date range.</p>
                    </div>
                ) : (
                    <div className="recharts-wrapper-container" style={{ width: '100%', height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatXAxis}
                                    stroke="#64748b"
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    tickLine={false}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="#64748b"
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `₹${v}`}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#64748b"
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar
                                    yAxisId="left"
                                    dataKey="revenue"
                                    name="Settled Revenue (₹)"
                                    fill="#10b981"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={32}
                                />
                                <Bar
                                    yAxisId="right"
                                    dataKey="failedCount"
                                    name="Failed Orders"
                                    fill="#f43f5e"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={20}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}

