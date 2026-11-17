import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Dashboard01Header from './Dashboard01Header';
import Dashboard01KpiGrid from './Dashboard01KpiGrid';
import Dashboard01TrafficChart from './Dashboard01TrafficChart';
import Dashboard01RegistrationsChart from './Dashboard01RegistrationsChart';
import Dashboard01RevenueChart from './Dashboard01RevenueChart';
import Dashboard01PlanRadarChart from './Dashboard01PlanRadarChart';
import Dashboard01SubscriptionDonutChart from './Dashboard01SubscriptionDonutChart';
import Dashboard01FeatureUsageChart from './Dashboard01FeatureUsageChart';
import Dashboard01ActivityHeatmap from './Dashboard01ActivityHeatmap';
import Dashboard01RecentUsersTable from './Dashboard01RecentUsersTable';
import Dashboard01RecentFeeds from './Dashboard01RecentFeeds';

import {
    getAnalyticsOverview,
    getAnalyticsTraffic,
    getAnalyticsRegistrations,
    getAnalyticsRevenue,
    getAnalyticsPlans,
    getAnalyticsFeatureUsage,
    getAnalyticsHeatmap
} from '../../services/admin.api';

export default function AdminDashboard01View({ isSuperAdmin, onRefreshParent }) {
    const [timeframe, setTimeframe] = useState('30d');
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    // Analytics Data States
    const [overviewData, setOverviewData] = useState(null);
    const [trafficData, setTrafficData] = useState(null);
    const [registrationsData, setRegistrationsData] = useState(null);
    const [revenueData, setRevenueData] = useState(null);
    const [planData, setPlanData] = useState(null);
    const [featureData, setFeatureData] = useState(null);
    const [heatmapData, setHeatmapData] = useState(null);

    const fetchAllAnalytics = useCallback(async (isManualRefresh = false) => {
        if (isManualRefresh) setIsRefreshing(true);
        else setLoading(true);

        try {
            const [
                overviewRes,
                trafficRes,
                registrationsRes,
                revenueRes,
                plansRes,
                featuresRes,
                heatmapRes
            ] = await Promise.allSettled([
                getAnalyticsOverview({ timeframe }),
                getAnalyticsTraffic({ timeframe }),
                getAnalyticsRegistrations({ timeframe }),
                getAnalyticsRevenue({ timeframe }),
                getAnalyticsPlans(),
                getAnalyticsFeatureUsage({ timeframe }),
                getAnalyticsHeatmap({ days: 60 })
            ]);

            if (overviewRes.status === 'fulfilled' && overviewRes.value?.data) {
                setOverviewData(overviewRes.value.data);
                setFetchError(null);
            } else {
                const errMsg = overviewRes?.reason?.response?.data?.message || overviewRes?.reason?.message || 'Failed to fetch overview analytics';
                console.warn('[DASHBOARD-01] Overview data not available:', errMsg);
                setFetchError(errMsg);
            }
            if (trafficRes.status === 'fulfilled' && trafficRes.value?.data) {
                setTrafficData(trafficRes.value.data);
            }
            if (registrationsRes.status === 'fulfilled' && registrationsRes.value?.data) {
                setRegistrationsData(registrationsRes.value.data);
            }
            if (revenueRes.status === 'fulfilled' && revenueRes.value?.data) {
                setRevenueData(revenueRes.value.data);
            }
            if (plansRes.status === 'fulfilled' && plansRes.value?.data) {
                setPlanData(plansRes.value.data);
            }
            if (featuresRes.status === 'fulfilled' && featuresRes.value?.data) {
                setFeatureData(featuresRes.value.data);
            }
            if (heatmapRes.status === 'fulfilled' && heatmapRes.value?.data) {
                setHeatmapData(heatmapRes.value.data);
            }

            if (onRefreshParent) {
                onRefreshParent();
            }
        } catch (err) {
            console.error('[DASHBOARD-01 ERROR] Failed to fetch analytics dataset:', err);
            setFetchError(err.message || 'Network error fetching analytics');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [timeframe, onRefreshParent]);

    useEffect(() => {
        fetchAllAnalytics();
    }, [fetchAllAnalytics]);

    const handleManualRefresh = () => {
        fetchAllAnalytics(true);
    };

    return (
        <div className="dashboard-01-container">
            {/* 1. Header with Timeframe Pill Switcher */}
            <Dashboard01Header
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                onRefresh={handleManualRefresh}
                isRefreshing={isRefreshing}
                windowDates={overviewData?.window}
            />

            {/* Error Notification Banner when API is unreachable or fails */}
            {fetchError && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    margin: '12px 0',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '8px',
                    color: '#f87171',
                    fontSize: '13px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={18} />
                        <span><strong>Analytics Data Notice:</strong> {fetchError}. Please verify that the backend API server is running on the configured port.</span>
                    </div>
                    <button
                        onClick={handleManualRefresh}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500'
                        }}
                    >
                        <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                        Retry
                    </button>
                </div>
            )}

            {/* 2. 8 KPI Summary Cards */}
            <Dashboard01KpiGrid
                kpis={overviewData?.kpis}
                loading={loading}
            />

            {/* 3. Primary Charts Row: Traffic Area Chart & Registrations Line Chart */}
            <div className="dashboard-01-charts-grid primary-grid">
                <Dashboard01TrafficChart
                    data={trafficData}
                    loading={loading}
                    isHourly={trafficData?.isHourly}
                />
                <Dashboard01RegistrationsChart
                    data={registrationsData}
                    loading={loading}
                />
            </div>

            {/* 4. Secondary Charts Row: Revenue Velocity & Plan Radar Chart */}
            <div className="dashboard-01-charts-grid secondary-grid">
                <Dashboard01RevenueChart
                    data={revenueData}
                    loading={loading}
                />
                <Dashboard01PlanRadarChart
                    data={planData}
                    loading={loading}
                />
            </div>

            {/* 5. Tertiary Charts Row: Subscription Donut & Feature Invocations */}
            <div className="dashboard-01-charts-grid tertiary-grid">
                <Dashboard01SubscriptionDonutChart
                    data={overviewData?.plans}
                    loading={loading}
                />
                <Dashboard01FeatureUsageChart
                    data={featureData}
                    loading={loading}
                />
            </div>

            {/* 6. Activity Engagement Heatmap (60 Days Calendar Intensity) */}
            <Dashboard01ActivityHeatmap
                data={heatmapData}
                loading={loading}
            />

            {/* 7. Recent Operational Feeds (Settled Transactions & Admin Audit Stream) */}
            <Dashboard01RecentFeeds
                recent={overviewData?.recent}
                loading={loading}
            />

            {/* 8. Recent Users Paginated Data Table with Search, Column Visibility & Drawer */}
            <Dashboard01RecentUsersTable
                isSuperAdmin={isSuperAdmin}
            />
        </div>
    );
}

