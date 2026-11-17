import React from 'react';
import {
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Tooltip
} from 'recharts';
import { ShieldCheck, Info } from 'lucide-react';

export default function Dashboard01PlanRadarChart({ data, loading }) {
    const radarData = data?.radarData || [
        { tier: 'FREE', users: 0, subscriptions: 0, percentage: 0 },
        { tier: 'PRO', users: 0, subscriptions: 0, percentage: 0 },
        { tier: 'PREMIUM', users: 0, subscriptions: 0, percentage: 0 }
    ];

    const totalUsers = data?.totalUsers || 1;
    const userPlans = data?.userPlans || { free: 0, pro: 0, premium: 0 };
    const subPlans = data?.subscriptionPlans || { free: 0, pro: 0, premium: 0 };

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload || !payload.length) return null;
        const item = payload[0]?.payload;
        if (!item) return null;

        return (
            <div className="custom-recharts-tooltip">
                <div className="tooltip-header">
                    <span className="tooltip-timestamp">{item.tier} TIER</span>
                    <span className="tooltip-total-pill">{item.percentage}% of users</span>
                </div>
                <div className="tooltip-items-list">
                    <div className="tooltip-item-row">
                        <span className="item-color-dot" style={{ backgroundColor: '#38bdf8' }}></span>
                        <span className="item-name">User Account Tier:</span>
                        <span className="item-val">{item.users} users</span>
                    </div>
                    <div className="tooltip-item-row">
                        <span className="item-color-dot" style={{ backgroundColor: '#6366f1' }}></span>
                        <span className="item-name">Active Subscriptions:</span>
                        <span className="item-val">{item.subscriptions} active</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-01-chart-card plan-radar-chart-card">
            <div className="chart-card-header">
                <div className="header-text-group">
                    <div className="title-row">
                        <h3>User Plan Distribution</h3>
                        <span className="live-count-badge" style={{ backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                            <ShieldCheck size={12} />
                            RADAR TIERS
                        </span>
                    </div>
                    <p className="chart-description">
                        Multi-axis radar comparing user tier assignment vs active gateway subscription agreements.
                    </p>
                </div>
            </div>

            <div className="chart-card-body">
                {loading ? (
                    <div className="chart-loading-state">
                        <div className="loading-spinner-ring"></div>
                        <span>Calculating tier distribution...</span>
                    </div>
                ) : (
                    <div className="radar-layout-wrapper">
                        <div className="recharts-wrapper-container" style={{ width: '100%', height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                                    <PolarGrid stroke="rgba(255, 255, 255, 0.08)" />
                                    <PolarAngleAxis
                                        dataKey="tier"
                                        stroke="#94a3b8"
                                        tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 600 }}
                                    />
                                    <PolarRadiusAxis
                                        angle={30}
                                        domain={[0, 'auto']}
                                        stroke="rgba(255, 255, 255, 0.05)"
                                        tick={{ fill: '#64748b', fontSize: 10 }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Radar
                                        name="User Accounts"
                                        dataKey="users"
                                        stroke="#38bdf8"
                                        fill="#38bdf8"
                                        fillOpacity={0.4}
                                        dot={{ fill: '#38bdf8', r: 4, stroke: '#fff', strokeWidth: 1.5 }}
                                    />
                                    <Radar
                                        name="Active Subscriptions"
                                        dataKey="subscriptions"
                                        stroke="#a855f7"
                                        fill="#a855f7"
                                        fillOpacity={0.25}
                                        dot={{ fill: '#a855f7', r: 3 }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Breakdown Legend with Percentages */}
                        <div className="radar-legend-breakdown">
                            <div className="legend-tier-item">
                                <div className="tier-header">
                                    <span className="dot" style={{ backgroundColor: '#38bdf8' }}></span>
                                    <span className="name">FREE Tier</span>
                                </div>
                                <div className="tier-counts">
                                    <span className="user-count">{userPlans.free} accounts</span>
                                    <span className="pct">{Math.round((userPlans.free / totalUsers) * 100)}%</span>
                                </div>
                            </div>
                            <div className="legend-tier-item">
                                <div className="tier-header">
                                    <span className="dot" style={{ backgroundColor: '#818cf8' }}></span>
                                    <span className="name">PRO Tier</span>
                                </div>
                                <div className="tier-counts">
                                    <span className="user-count">{userPlans.pro} accounts ({subPlans.pro} subs)</span>
                                    <span className="pct">{Math.round((userPlans.pro / totalUsers) * 100)}%</span>
                                </div>
                            </div>
                            <div className="legend-tier-item">
                                <div className="tier-header">
                                    <span className="dot" style={{ backgroundColor: '#c084fc' }}></span>
                                    <span className="name">PREMIUM Tier</span>
                                </div>
                                <div className="tier-counts">
                                    <span className="user-count">{userPlans.premium} accounts ({subPlans.premium} subs)</span>
                                    <span className="pct">{Math.round((userPlans.premium / totalUsers) * 100)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="radar-audit-footnote">
                    <Info size={12} />
                    <span>
                        Audited reconciliation: User plan assignment grants features; subscription records track recurring Razorpay agreements.
                    </span>
                </div>
            </div>
        </div>
    );
}

