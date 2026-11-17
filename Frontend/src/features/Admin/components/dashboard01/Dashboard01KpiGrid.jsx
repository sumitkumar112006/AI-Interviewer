import React from 'react';
import {
    Users,
    Activity,
    UserPlus,
    Layers,
    Crown,
    IndianRupee,
    AlertCircle,
    Zap,
    TrendingUp,
    TrendingDown,
    Minus,
    HelpCircle
} from 'lucide-react';

export default function Dashboard01KpiGrid({ kpis, loading }) {
    if (loading && !kpis) {
        return (
            <div className="dashboard-01-kpi-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="dashboard-01-kpi-card skeleton">
                        <div className="kpi-header-skeleton"></div>
                        <div className="kpi-value-skeleton"></div>
                        <div className="kpi-footer-skeleton"></div>
                    </div>
                ))}
            </div>
        );
    }

    const safeKpis = kpis || {};

    const cards = [
        {
            key: 'totalUsers',
            title: safeKpis.totalUsers?.title || 'Total Registered Users',
            value: safeKpis.totalUsers?.value?.toLocaleString?.('en-IN') ?? '0',
            previous: safeKpis.totalUsers?.previous,
            change: safeKpis.totalUsers?.change,
            icon: Users,
            color: '#38bdf8',
            bgColor: 'rgba(56, 189, 248, 0.12)',
            description: safeKpis.totalUsers?.description || 'All non-deleted user accounts on platform',
            isPositiveGood: true
        },
        {
            key: 'activeUsers',
            title: safeKpis.activeUsers?.title || 'Active Users',
            value: safeKpis.activeUsers?.value?.toLocaleString?.('en-IN') ?? '0',
            previous: safeKpis.activeUsers?.previous,
            change: safeKpis.activeUsers?.change,
            icon: Activity,
            color: '#4ade80',
            bgColor: 'rgba(74, 222, 128, 0.12)',
            description: safeKpis.activeUsers?.description || 'Users active within selected timeframe',
            isPositiveGood: true
        },
        {
            key: 'newRegistrations',
            title: safeKpis.newRegistrations?.title || 'New Registrations',
            value: safeKpis.newRegistrations?.value?.toLocaleString?.('en-IN') ?? '0',
            previous: safeKpis.newRegistrations?.previous,
            change: safeKpis.newRegistrations?.change,
            icon: UserPlus,
            color: '#a855f7',
            bgColor: 'rgba(168, 85, 247, 0.12)',
            description: safeKpis.newRegistrations?.description || 'New user signups during selected timeframe',
            isPositiveGood: true
        },
        {
            key: 'activeSubscriptions',
            title: safeKpis.activeSubscriptions?.title || 'Active Subscriptions',
            value: safeKpis.activeSubscriptions?.value?.toLocaleString?.('en-IN') ?? '0',
            previous: safeKpis.activeSubscriptions?.previous,
            change: safeKpis.activeSubscriptions?.change,
            icon: Layers,
            color: '#6366f1',
            bgColor: 'rgba(99, 102, 241, 0.12)',
            description: safeKpis.activeSubscriptions?.description || 'Active paid subscription agreements',
            isPositiveGood: true
        },
        {
            key: 'paidSubscribers',
            title: safeKpis.paidSubscribers?.title || 'Paid Subscribers',
            value: safeKpis.paidSubscribers?.value?.toLocaleString?.('en-IN') ?? '0',
            previous: safeKpis.paidSubscribers?.previous,
            change: safeKpis.paidSubscribers?.change,
            icon: Crown,
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.12)',
            description: safeKpis.paidSubscribers?.description || 'Unique users currently on Pro or Premium plans',
            isPositiveGood: true
        },
        {
            key: 'totalRevenue',
            title: safeKpis.totalRevenue?.title || 'Total Revenue',
            value: safeKpis.totalRevenue?.valueFormatted || `₹${(safeKpis.totalRevenue?.value || 0).toLocaleString('en-IN')}`,
            subCount: safeKpis.totalRevenue?.count ? `${safeKpis.totalRevenue.count} paid orders` : null,
            previous: safeKpis.totalRevenue?.previous ? `₹${safeKpis.totalRevenue.previous.toLocaleString('en-IN')}` : null,
            change: safeKpis.totalRevenue?.change,
            icon: IndianRupee,
            color: '#10b981',
            bgColor: 'rgba(168, 85, 247, 0.12)',
            description: safeKpis.totalRevenue?.description || 'Verified settled revenue from successful payments',
            isPositiveGood: true
        },
        {
            key: 'failedPayments',
            title: safeKpis.failedPayments?.title || 'Failed Payments',
            value: safeKpis.failedPayments?.value?.toLocaleString?.('en-IN') ?? '0',
            previous: safeKpis.failedPayments?.previous,
            change: safeKpis.failedPayments?.change,
            icon: AlertCircle,
            color: '#f43f5e',
            bgColor: 'rgba(244, 63, 94, 0.12)',
            description: safeKpis.failedPayments?.description || 'Gateway payment attempts marked as failed',
            isPositiveGood: false // Lower is better for failed payments
        },
        {
            key: 'appActivity',
            title: safeKpis.appActivity?.title || 'Application Activity',
            value: safeKpis.appActivity?.value?.toLocaleString?.('en-IN') ?? '0',
            previous: safeKpis.appActivity?.previous,
            change: safeKpis.appActivity?.change,
            icon: Zap,
            color: '#06b6d4',
            bgColor: 'rgba(6, 182, 212, 0.12)',
            description: safeKpis.appActivity?.description || 'Total operational jobs, reports, and AI requests executed',
            isPositiveGood: true
        }
    ];

    const renderTrendPill = (change, isPositiveGood) => {
        if (change === null || change === undefined) {
            return (
                <span className="trend-indicator-pill neutral" title="No previous period comparison data available">
                    <Minus size={11} />
                    <span>Baseline</span>
                </span>
            );
        }

        const isUp = change > 0;
        const isNeutral = change === 0;

        let statusClass = 'neutral';
        if (!isNeutral) {
            if (isPositiveGood) {
                statusClass = isUp ? 'positive' : 'negative';
            } else {
                statusClass = isUp ? 'negative' : 'positive';
            }
        }

        return (
            <span className={`trend-indicator-pill ${statusClass}`} title={`${change > 0 ? '+' : ''}${change}% compared to previous period`}>
                {isUp ? <TrendingUp size={11} /> : isNeutral ? <Minus size={11} /> : <TrendingDown size={11} />}
                <span>{isUp ? '+' : ''}{change}%</span>
            </span>
        );
    };

    return (
        <div className="dashboard-01-kpi-grid">
            {cards.map(card => {
                const IconComponent = card.icon;
                return (
                    <div key={card.key} className="dashboard-01-kpi-card">
                        <div className="kpi-card-header">
                            <div className="kpi-title-row">
                                <span className="kpi-title">{card.title}</span>
                                <div className="kpi-help-tooltip" title={card.description}>
                                    <HelpCircle size={12} />
                                </div>
                            </div>
                            <div className="kpi-icon-box" style={{ color: card.color, backgroundColor: card.bgColor }}>
                                <IconComponent size={16} />
                            </div>
                        </div>

                        <div className="kpi-card-body">
                            <div className="kpi-value-row">
                                <span className="kpi-main-value">{card.value}</span>
                                {card.subCount && <span className="kpi-sub-count">{card.subCount}</span>}
                            </div>
                        </div>

                        <div className="kpi-card-footer">
                            <div className="kpi-trend-row">
                                {renderTrendPill(card.change, card.isPositiveGood)}
                                <span className="kpi-period-label">
                                    {card.previous !== undefined && card.previous !== null
                                        ? `vs ${card.previous} prev`
                                        : 'vs previous period'}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

