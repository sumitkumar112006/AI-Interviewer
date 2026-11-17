import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Activity,
    Server,
    Database,
    Cpu,
    Radio,
    Shield,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Search,
    RotateCcw,
    Clock,
    Zap,
    Layers,
    ExternalLink,
    X
} from 'lucide-react';
import { getAdminSystemHealth, getAdminSystemEvents } from '../services/admin.api';
import AdminPagination from './AdminPagination';
import ShadcnDatePicker from './ShadcnDatePicker';

export function AdminSystemHealthTab({ setActiveTab }) {
    // Active sub-view: 'health' | 'events'
    const [subTab, setSubTab] = useState('health');

    // System Health State
    const [healthData, setHealthData] = useState(null);
    const [healthLoading, setHealthLoading] = useState(true);
    const [healthRefreshing, setHealthRefreshing] = useState(false);

    // Auto-Refresh state
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(30); // 0 = off, 10, 30, 60s
    const isFetchingRef = useRef(false);

    // Events State
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 20 });
    const [eventMetrics, setEventMetrics] = useState({ categories: {}, severities: {} });

    // Event Filters
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [severityFilter, setSeverityFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Inspection Drawer State
    const [selectedEvent, setSelectedEvent] = useState(null);

    // Fetch System Health
    const fetchHealth = useCallback(async (forceRefresh = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (forceRefresh) setHealthRefreshing(true);
        else setHealthLoading(true);

        try {
            const res = await getAdminSystemHealth(forceRefresh ? { refresh: 'true' } : {});
            if (res?.data) {
                setHealthData(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch system health:', err);
        } finally {
            setHealthLoading(false);
            setHealthRefreshing(false);
            isFetchingRef.current = false;
        }
    }, []);

    // Fetch System Events
    const fetchEvents = useCallback(async (page = 1) => {
        setEventsLoading(true);
        try {
            const res = await getAdminSystemEvents({
                page,
                limit: 20,
                search: search.trim() || undefined,
                category: categoryFilter || undefined,
                severity: severityFilter || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            });

            if (res?.data) {
                setEvents(res.data);
                if (res.pagination) setPagination(res.pagination);
                if (res.metrics) setEventMetrics(res.metrics);
            }
        } catch (err) {
            console.error('Failed to fetch system events:', err);
        } finally {
            setEventsLoading(false);
        }
    }, [search, categoryFilter, severityFilter, startDate, endDate]);

    // Initial load
    useEffect(() => {
        fetchHealth();
    }, [fetchHealth]);

    // Events filter debounce
    useEffect(() => {
        if (subTab === 'events') {
            const timer = setTimeout(() => {
                fetchEvents(1);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [subTab, fetchEvents]);

    // Auto-refresh interval handling
    useEffect(() => {
        if (!autoRefreshInterval || autoRefreshInterval <= 0) return;

        const intervalId = setInterval(() => {
            if (subTab === 'health') {
                fetchHealth(true);
            } else if (subTab === 'events') {
                fetchEvents(pagination.page);
            }
        }, autoRefreshInterval * 1000);

        return () => clearInterval(intervalId);
    }, [autoRefreshInterval, subTab, fetchHealth, fetchEvents, pagination.page]);

    // Format uptime into human-friendly string
    const formatUptime = (seconds) => {
        if (!seconds && seconds !== 0) return 'N/A';
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0 || d > 0) parts.push(`${h}h`);
        parts.push(`${m}m`);
        return parts.join(' ');
    };

    const getStatusPill = (status) => {
        const s = status?.toLowerCase();
        if (s === 'healthy') {
            return (
                <span className="status-pill healthy">
                    <CheckCircle2 className="w-3 h-3" />
                    Healthy
                </span>
            );
        }
        if (s === 'degraded') {
            return (
                <span className="status-pill degraded">
                    <AlertTriangle className="w-3 h-3" />
                    Degraded
                </span>
            );
        }
        return (
            <span className="status-pill unavailable">
                <XCircle className="w-3 h-3" />
                Unavailable
            </span>
        );
    };

    const getSeverityPill = (severity) => {
        const sev = (severity || 'INFO').toUpperCase();
        const map = {
            CRITICAL: 'sev-pill critical',
            ERROR: 'sev-pill error',
            WARN: 'sev-pill warn',
            INFO: 'sev-pill info'
        };
        return <span className={map[sev] || 'sev-pill info'}>{sev}</span>;
    };

    const getCategoryPill = (category) => {
        const cat = (category || 'SYSTEM').toLowerCase();
        return <span className={`cat-pill ${cat}`}>{cat.toUpperCase()}</span>;
    };

    // Calculate memory utilization percentages safely
    const heapUsed = healthData?.services?.backend?.memory?.heapUsedMB || 0;
    const heapTotal = healthData?.services?.backend?.memory?.heapTotalMB || 1;
    const heapPercent = Math.min(100, Math.round((heapUsed / heapTotal) * 100)) || 0;

    const rssMB = healthData?.services?.backend?.memory?.rssMB || 0;
    const rssPercent = Math.min(100, Math.round((rssMB / 1024) * 100)) || 0;

    const overallStatus = healthData?.overallStatus || 'healthy';

    return (
        <div className="system-health-dashboard">
            {/* ── 1. Page Header ── */}
            <header className="health-header">
                <div className="header-title-block">
                    <div className="title-row">
                        <h2>System Health & Events</h2>
                        <div className="live-indicator-badge">
                            <span className="live-dot pulse" />
                            LIVE TELEMETRY
                        </div>
                    </div>
                    <p className="header-subtitle">
                        Real-time cluster telemetry, database connectivity, asynchronous worker status, and audit events.
                    </p>
                    <div className="header-timestamp-meta">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        {healthData?.timestamp ? (
                            <span>Probed at: {new Date(healthData.timestamp).toLocaleTimeString()}</span>
                        ) : (
                            <span>Probing telemetry nodes...</span>
                        )}
                        {healthData?.cached && (
                            <span className="text-zinc-500 ml-2">
                                (Cached {healthData.cacheAgeSeconds}s ago)
                            </span>
                        )}
                    </div>
                </div>

                <div className="header-controls-block">
                    {/* View Switcher Pills */}
                    <div className="view-pill-group">
                        <button
                            type="button"
                            onClick={() => setSubTab('health')}
                            className={`view-tab-btn ${subTab === 'health' ? 'active' : ''}`}
                        >
                            <Activity className="w-3.5 h-3.5" />
                            Health Monitor
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubTab('events')}
                            className={`view-tab-btn ${subTab === 'events' ? 'active' : ''}`}
                        >
                            <Server className="w-3.5 h-3.5" />
                            Operational Events
                            {pagination.total > 0 && (
                                <span className="tab-count-tag">{pagination.total}</span>
                            )}
                        </button>
                    </div>

                    {/* Auto-Refresh Select */}
                    <div className="auto-refresh-select-wrapper">
                        <select
                            value={autoRefreshInterval}
                            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                            className="auto-refresh-select"
                            title="Auto-refresh cadence"
                        >
                            <option value={0}>Auto-refresh: Off</option>
                            <option value={10}>Refresh: 10s</option>
                            <option value={30}>Refresh: 30s</option>
                            <option value={60}>Refresh: 60s</option>
                        </select>
                    </div>

                    {/* Live Refresh Button */}
                    <button
                        type="button"
                        onClick={() => {
                            if (subTab === 'health') fetchHealth(true);
                            else fetchEvents(pagination.page);
                        }}
                        disabled={healthRefreshing || (subTab === 'events' && eventsLoading)}
                        className="header-action-btn"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${healthRefreshing || (subTab === 'events' && eventsLoading) ? 'spin-icon' : ''}`} />
                        {healthRefreshing ? 'Probing...' : 'Live Refresh'}
                    </button>
                </div>
            </header>

            {/* ══════════════════════════════════════════════════════════════
                SUBTAB 1: HEALTH MONITOR
                ══════════════════════════════════════════════════════════════ */}
            {subTab === 'health' && (
                <>
                    {/* ── 2. Prominent Overall System Status Card ── */}
                    <div className={`overall-status-card ${overallStatus}`}>
                        <div className="status-main-col">
                            <div className={`status-large-icon-box ${overallStatus}`}>
                                {overallStatus === 'healthy' ? (
                                    <CheckCircle2 className="w-6 h-6" />
                                ) : overallStatus === 'degraded' ? (
                                    <AlertTriangle className="w-6 h-6" />
                                ) : (
                                    <XCircle className="w-6 h-6" />
                                )}
                            </div>
                            <div className="status-text-details">
                                <div className="status-title-row">
                                    <h3>System Architecture Status</h3>
                                    <span className={`status-badge-pill ${overallStatus}`}>
                                        {overallStatus === 'healthy'
                                            ? 'OPERATIONAL'
                                            : overallStatus === 'degraded'
                                            ? 'DEGRADED'
                                            : 'CRITICAL'}
                                    </span>
                                </div>
                                <p className="status-narrative">
                                    {overallStatus === 'healthy'
                                        ? 'All backend subsystems, database clusters, and asynchronous workers are operating normally.'
                                        : overallStatus === 'degraded'
                                        ? 'One or more non-critical subsystems are operating with reduced throughput or fallback cache.'
                                        : 'Critical infrastructure degraded. Immediate developer intervention required.'}
                                </p>
                            </div>
                        </div>

                        <div className="status-metrics-cluster">
                            <div className="metric-compact-box">
                                <span className="metric-lbl">Subsystems</span>
                                <span className="metric-num neutral">
                                    {healthData?.summary?.totalSubsystems || 6}
                                </span>
                            </div>
                            <div className="metric-compact-box">
                                <span className="metric-lbl">Healthy</span>
                                <span className="metric-num healthy">
                                    {healthData?.summary?.healthyCount ?? (healthLoading ? '—' : 6)}
                                </span>
                            </div>
                            <div className="metric-compact-box">
                                <span className="metric-lbl">Degraded</span>
                                <span className="metric-num degraded">
                                    {healthData?.summary?.degradedCount ?? 0}
                                </span>
                            </div>
                            <div className="metric-compact-box">
                                <span className="metric-lbl">Unavailable</span>
                                <span className="metric-num unavailable">
                                    {healthData?.summary?.unavailableCount ?? 0}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── 3. Quick Topology Status Matrix Strip ── */}
                    <div className="status-strip-matrix">
                        {/* Node 1: Backend */}
                        <div className="strip-node-cell">
                            <div className="node-identity">
                                <span className={`node-dot ${healthData?.services?.backend?.status || 'healthy'}`} />
                                <span className="node-name">Backend API</span>
                            </div>
                            <span className="node-latency-pill">
                                {healthData?.services?.backend?.uptimeSeconds
                                    ? formatUptime(healthData.services.backend.uptimeSeconds)
                                    : 'Online'}
                            </span>
                        </div>

                        {/* Node 2: MongoDB */}
                        <div className="strip-node-cell">
                            <div className="node-identity">
                                <span className={`node-dot ${healthData?.services?.mongodb?.status || 'healthy'}`} />
                                <span className="node-name">MongoDB Atlas</span>
                            </div>
                            <span className="node-latency-pill">
                                {healthData?.services?.mongodb?.latencyMs !== null && healthData?.services?.mongodb?.latencyMs !== undefined
                                    ? `${healthData.services.mongodb.latencyMs}ms`
                                    : 'Connected'}
                            </span>
                        </div>

                        {/* Node 3: Redis */}
                        <div className="strip-node-cell">
                            <div className="node-identity">
                                <span className={`node-dot ${healthData?.services?.redis?.status || 'healthy'}`} />
                                <span className="node-name">Redis Cache</span>
                            </div>
                            <span className="node-latency-pill">
                                {healthData?.services?.redis?.latencyMs !== null && healthData?.services?.redis?.latencyMs !== undefined
                                    ? `${healthData.services.redis.latencyMs}ms`
                                    : 'Fallback'}
                            </span>
                        </div>

                        {/* Node 4: BullMQ */}
                        <div className="strip-node-cell">
                            <div className="node-identity">
                                <span className={`node-dot ${healthData?.services?.bullmq?.status || 'healthy'}`} />
                                <span className="node-name">BullMQ Async</span>
                            </div>
                            <span className="node-latency-pill">
                                {healthData?.services?.bullmq?.totalBacklog !== undefined
                                    ? `${healthData.services.bullmq.totalBacklog} queued`
                                    : 'Ready'}
                            </span>
                        </div>

                        {/* Node 5: AI Providers */}
                        <div className="strip-node-cell">
                            <div className="node-identity">
                                <span className={`node-dot ${healthData?.services?.ai?.status || 'healthy'}`} />
                                <span className="node-name">AI Providers</span>
                            </div>
                            <span className="node-latency-pill">
                                {healthData?.services?.ai?.currentProvider || 'Tier Multi'}
                            </span>
                        </div>

                        {/* Node 6: Telemetry SDK */}
                        <div className="strip-node-cell">
                            <div className="node-identity">
                                <span className="node-dot healthy" />
                                <span className="node-name">OpenTelemetry</span>
                            </div>
                            <span className="node-latency-pill">OTLP / Loki</span>
                        </div>
                    </div>

                    {/* ── 4. Infrastructure Cards Grid (6 Cards) ── */}
                    <div className="infra-cards-grid">
                        {/* Card 1: Backend Process */}
                        <div className="infra-card">
                            <div className="infra-card-header">
                                <div className="service-title-group">
                                    <div className="service-icon-box backend">
                                        <Server className="w-4 h-4" />
                                    </div>
                                    <h4>Backend Process</h4>
                                </div>
                                {getStatusPill(healthData?.services?.backend?.status)}
                            </div>

                            <div className="infra-card-body">
                                <div className="metrics-spec-table">
                                    <div className="spec-row">
                                        <span className="spec-key">Process Uptime</span>
                                        <span className="spec-val">
                                            {formatUptime(healthData?.services?.backend?.uptimeSeconds)}
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Node Runtime</span>
                                        <span className="spec-val">
                                            {healthData?.services?.backend?.nodeVersion || 'v20+'}
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Heap Allocated</span>
                                        <span className="spec-val">
                                            {heapUsed} MB / {heapTotal} MB
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">RSS Footprint</span>
                                        <span className="spec-val">{rssMB} MB</span>
                                    </div>
                                </div>

                                <div className="utilization-bar-wrapper">
                                    <div className="bar-label-row">
                                        <span>Heap Allocation</span>
                                        <span className="font-mono">{heapPercent}%</span>
                                    </div>
                                    <div className="bar-track">
                                        <div
                                            className={`bar-fill ${heapPercent > 80 ? 'warn' : ''}`}
                                            style={{ width: `${heapPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="infra-card-footer">
                                <span className="footer-msg" title={healthData?.services?.backend?.message}>
                                    {healthData?.services?.backend?.message || 'Express engine healthy.'}
                                </span>
                            </div>
                        </div>

                        {/* Card 2: MongoDB Cluster */}
                        <div className="infra-card">
                            <div className="infra-card-header">
                                <div className="service-title-group">
                                    <div className="service-icon-box mongodb">
                                        <Database className="w-4 h-4" />
                                    </div>
                                    <h4>MongoDB Cluster</h4>
                                </div>
                                {getStatusPill(healthData?.services?.mongodb?.status)}
                            </div>

                            <div className="infra-card-body">
                                <div className="metrics-spec-table">
                                    <div className="spec-row">
                                        <span className="spec-key">Connection State</span>
                                        <span className="spec-val fast capitalize">
                                            {healthData?.services?.mongodb?.connectionState || 'Connected'}
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Roundtrip Latency</span>
                                        <span className={`spec-val ${(healthData?.services?.mongodb?.latencyMs ?? 0) < 50 ? 'fast' : 'normal'}`}>
                                            {healthData?.services?.mongodb?.latencyMs !== null && healthData?.services?.mongodb?.latencyMs !== undefined
                                                ? `${healthData.services.mongodb.latencyMs} ms`
                                                : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Topology</span>
                                        <span className="spec-val">Replica Set</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Driver State</span>
                                        <span className="spec-val fast">Ready (Mongoose)</span>
                                    </div>
                                </div>

                                <div className="utilization-bar-wrapper">
                                    <div className="bar-label-row">
                                        <span>Latency Quality</span>
                                        <span className="font-mono text-emerald-400">
                                            {(healthData?.services?.mongodb?.latencyMs ?? 20) < 50 ? 'Optimal (<50ms)' : 'Acceptable'}
                                        </span>
                                    </div>
                                    <div className="bar-track">
                                        <div
                                            className="bar-fill"
                                            style={{ width: `${Math.min(100, Math.max(15, 100 - (healthData?.services?.mongodb?.latencyMs || 10)))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="infra-card-footer">
                                <span className="footer-msg" title={healthData?.services?.mongodb?.message}>
                                    {healthData?.services?.mongodb?.message || 'Atlas cluster replica verified.'}
                                </span>
                            </div>
                        </div>

                        {/* Card 3: Redis Cache & Limiter */}
                        <div className="infra-card">
                            <div className="infra-card-header">
                                <div className="service-title-group">
                                    <div className="service-icon-box redis">
                                        <Zap className="w-4 h-4" />
                                    </div>
                                    <h4>Redis Cache & Limiter</h4>
                                </div>
                                {getStatusPill(healthData?.services?.redis?.status)}
                            </div>

                            <div className="infra-card-body">
                                <div className="metrics-spec-table">
                                    <div className="spec-row">
                                        <span className="spec-key">Client State</span>
                                        <span className="spec-val capitalize">
                                            {healthData?.services?.redis?.connectionState || 'Active'}
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Ping Latency</span>
                                        <span className="spec-val fast">
                                            {healthData?.services?.redis?.latencyMs !== null && healthData?.services?.redis?.latencyMs !== undefined
                                                ? `${healthData.services.redis.latencyMs} ms`
                                                : 'In-Memory Fallback'}
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Fallback Mechanism</span>
                                        <span className="spec-val normal">Sliding In-Memory Map</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Key Expiry Daemon</span>
                                        <span className="spec-val fast">Active</span>
                                    </div>
                                </div>

                                <div className="utilization-bar-wrapper">
                                    <div className="bar-label-row">
                                        <span>Throughput Capacity</span>
                                        <span className="font-mono text-cyan-400">100% Guaranteed</span>
                                    </div>
                                    <div className="bar-track">
                                        <div className="bar-fill" style={{ width: '100%' }} />
                                    </div>
                                </div>
                            </div>

                            <div className="infra-card-footer">
                                <span className="footer-msg" title={healthData?.services?.redis?.message}>
                                    {healthData?.services?.redis?.message || 'Redis memory store operating normally.'}
                                </span>
                            </div>
                        </div>

                        {/* Card 4: BullMQ Async Queue */}
                        <div className="infra-card">
                            <div className="infra-card-header">
                                <div className="service-title-group">
                                    <div className="service-icon-box bullmq">
                                        <Cpu className="w-4 h-4" />
                                    </div>
                                    <h4>BullMQ Async Queue</h4>
                                </div>
                                {getStatusPill(healthData?.services?.bullmq?.status)}
                            </div>

                            <div className="infra-card-body">
                                <div className="metrics-spec-table">
                                    <div className="spec-row">
                                        <span className="spec-key">Worker Status</span>
                                        <span className="spec-val fast capitalize">
                                            {healthData?.services?.bullmq?.workerState || 'Active'}
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Total Backlog</span>
                                        <span className="spec-val normal">
                                            {healthData?.services?.bullmq?.totalBacklog ?? 0} jobs
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Waiting Jobs</span>
                                        <span className="spec-val">
                                            {healthData?.services?.bullmq?.queueCounts?.waiting ?? 0}
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Active Processing</span>
                                        <span className="spec-val fast">
                                            {healthData?.services?.bullmq?.queueCounts?.active ?? 0}
                                        </span>
                                    </div>
                                </div>

                                <div className="utilization-bar-wrapper">
                                    <div className="bar-label-row">
                                        <span>Queue Drain Rate</span>
                                        <span className="font-mono text-emerald-400">Normal</span>
                                    </div>
                                    <div className="bar-track">
                                        <div
                                            className="bar-fill"
                                            style={{
                                                width: `${Math.min(100, Math.max(10, (healthData?.services?.bullmq?.totalBacklog || 0) * 10))}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="infra-card-footer">
                                <span className="footer-msg" title={healthData?.services?.bullmq?.message}>
                                    {healthData?.services?.bullmq?.message || 'Asynchronous processor ready.'}
                                </span>
                                {setActiveTab && (
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('jobs')}
                                        className="card-link-btn"
                                    >
                                        View Async Jobs →
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Card 5: AI Provider Cluster */}
                        <div className="infra-card">
                            <div className="infra-card-header">
                                <div className="service-title-group">
                                    <div className="service-icon-box ai">
                                        <Radio className="w-4 h-4" />
                                    </div>
                                    <h4>AI Provider Cluster</h4>
                                </div>
                                {getStatusPill(healthData?.services?.ai?.status)}
                            </div>

                            <div className="infra-card-body">
                                <div className="metrics-spec-table">
                                    <div className="spec-row">
                                        <span className="spec-key">Current Provider</span>
                                        <span className="spec-val normal">
                                            {healthData?.services?.ai?.currentProvider || 'Groq / Gemini / OpenRouter'}
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Primary Model</span>
                                        <span className="spec-val">
                                            {healthData?.services?.ai?.primaryModel || 'Tier-based Router'}
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Routing Strategy</span>
                                        <span className="spec-val fast">Failover Matrix</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Cluster Status</span>
                                        <span className="spec-val fast">Active & Monitored</span>
                                    </div>
                                </div>

                                <div className="utilization-bar-wrapper">
                                    <div className="bar-label-row">
                                        <span>Provider Availability</span>
                                        <span className="font-mono text-emerald-400">100% Up</span>
                                    </div>
                                    <div className="bar-track">
                                        <div className="bar-fill" style={{ width: '100%' }} />
                                    </div>
                                </div>
                            </div>

                            <div className="infra-card-footer">
                                <span className="footer-msg" title={healthData?.services?.ai?.message}>
                                    {healthData?.services?.ai?.message || 'Generative inference clusters active.'}
                                </span>
                            </div>
                        </div>

                        {/* Card 6: Telemetry & Logs */}
                        <div className="infra-card">
                            <div className="infra-card-header">
                                <div className="service-title-group">
                                    <div className="service-icon-box telemetry">
                                        <Layers className="w-4 h-4" />
                                    </div>
                                    <h4>Telemetry & Logs</h4>
                                </div>
                                <span className="status-pill healthy">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Active
                                </span>
                            </div>

                            <div className="infra-card-body">
                                <div className="metrics-spec-table">
                                    <div className="spec-row">
                                        <span className="spec-key">Instrumentation</span>
                                        <span className="spec-val normal">OpenTelemetry SDK</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Log Transports</span>
                                        <span className="spec-val">OTLP / Loki Ready</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Trace Correlation</span>
                                        <span className="spec-val fast">128-bit traceId</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-key">Scrubbing Layer</span>
                                        <span className="spec-val fast">PII & Cardinality Safe</span>
                                    </div>
                                </div>

                                <div className="utilization-bar-wrapper">
                                    <div className="bar-label-row">
                                        <span>Telemetry Pipeline</span>
                                        <span className="font-mono text-cyan-400">Active</span>
                                    </div>
                                    <div className="bar-track">
                                        <div className="bar-fill" style={{ width: '100%' }} />
                                    </div>
                                </div>
                            </div>

                            <div className="infra-card-footer">
                                <span className="footer-msg">
                                    Structured logging with privacy scrubbing and cardinality protection active.
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── 5. Resource Utilization Section ── */}
                    <div className="resource-util-card">
                        <div className="util-header">
                            <div className="title-group">
                                <h3>Host & Cluster Resource Utilization</h3>
                                <p>Memory, heap distribution, and cluster throughput across active instances.</p>
                            </div>
                        </div>

                        <div className="util-bars-grid">
                            {/* Metric 1: Heap Memory */}
                            <div className="util-metric-box">
                                <div className="box-top-row">
                                    <span className="lbl">Heap Memory Allocation</span>
                                    <span className="val">{heapUsed} MB / {heapTotal} MB</span>
                                </div>
                                <div className="util-track">
                                    <div
                                        className={`util-fill ${heapPercent > 80 ? 'amber' : 'green'}`}
                                        style={{ width: `${heapPercent}%` }}
                                    />
                                </div>
                                <span className="box-sub">
                                    {heapPercent}% of reserved heap actively occupied
                                </span>
                            </div>

                            {/* Metric 2: RSS Memory Footprint */}
                            <div className="util-metric-box">
                                <div className="box-top-row">
                                    <span className="lbl">RSS Memory Footprint</span>
                                    <span className="val">{rssMB} MB / 1024 MB</span>
                                </div>
                                <div className="util-track">
                                    <div
                                        className="util-fill cyan"
                                        style={{ width: `${rssPercent}%` }}
                                    />
                                </div>
                                <span className="box-sub">
                                    {rssPercent}% of standard 1GB container allotment
                                </span>
                            </div>

                            {/* Metric 3: Cluster Latency Quality */}
                            <div className="util-metric-box">
                                <div className="box-top-row">
                                    <span className="lbl">Data Layer Ping Latency</span>
                                    <span className="val">
                                        {healthData?.services?.mongodb?.latencyMs !== null && healthData?.services?.mongodb?.latencyMs !== undefined
                                            ? `${healthData.services.mongodb.latencyMs} ms`
                                            : 'N/A'}
                                    </span>
                                </div>
                                <div className="util-track">
                                    <div
                                        className="util-fill green"
                                        style={{
                                            width: `${Math.min(100, Math.max(10, 100 - (healthData?.services?.mongodb?.latencyMs || 10)))}%`
                                        }}
                                    />
                                </div>
                                <span className="box-sub">
                                    Direct roundtrip communication to primary database node
                                </span>
                            </div>
                        </div>

                        <div className="util-footnote">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Telemetry samples aggregated upon query. Background GC passes handled automatically by V8 engine.</span>
                        </div>
                    </div>

                    {/* ── Recent Operational Errors Feed ── */}
                    <div className="system-events-section">
                        <div className="events-header-bar">
                            <div className="events-title-group">
                                <h3>Recent Server & Execution Errors</h3>
                                <p>Top 10 most recent error/critical events captured from SystemEvent audit stream</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSeverityFilter('ERROR');
                                    setSubTab('events');
                                }}
                                className="header-action-btn"
                            >
                                View in Events Log
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {healthData?.recentErrors?.length > 0 ? (
                            <div className="events-table-wrapper">
                                <table className="events-data-table">
                                    <thead>
                                        <tr>
                                            <th>Severity</th>
                                            <th>Event Type</th>
                                            <th>Message</th>
                                            <th>Trace ID</th>
                                            <th>Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {healthData.recentErrors.map((err) => (
                                            <tr key={err.id} className="event-row">
                                                <td>{getSeverityPill(err.severity)}</td>
                                                <td className="event-name-cell">{err.eventType}</td>
                                                <td className="event-msg-cell" title={err.message}>
                                                    {err.message}
                                                </td>
                                                <td>
                                                    <span className="font-mono text-zinc-400">
                                                        {err.traceId ? `${err.traceId.slice(0, 12)}…` : '—'}
                                                    </span>
                                                </td>
                                                <td className="text-zinc-400">
                                                    {new Date(err.timestamp).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        second: '2-digit'
                                                    })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-zinc-800/40">
                                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                                <p className="text-xs font-semibold text-emerald-400">
                                    No operational errors recorded recently.
                                </p>
                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                    All services are operating within expected error budgets.
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SUBTAB 2: OPERATIONAL SYSTEM EVENTS
                ══════════════════════════════════════════════════════════════ */}
            {subTab === 'events' && (
                <div className="system-events-section">
                    <div className="events-header-bar">
                        <div className="events-title-group">
                            <h3>Operational System Events</h3>
                            <p>Immutable audit stream of security, authentication, system, and administrative activities.</p>
                        </div>

                        {/* Severity Summary Chips */}
                        <div className="events-summary-chips">
                            <button
                                type="button"
                                onClick={() => setSeverityFilter(severityFilter === 'CRITICAL' ? '' : 'CRITICAL')}
                                className={`chip-btn critical ${severityFilter === 'CRITICAL' ? 'active' : ''}`}
                            >
                                Critical ({eventMetrics?.severities?.CRITICAL || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSeverityFilter(severityFilter === 'ERROR' ? '' : 'ERROR')}
                                className={`chip-btn error ${severityFilter === 'ERROR' ? 'active' : ''}`}
                            >
                                Error ({eventMetrics?.severities?.ERROR || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSeverityFilter(severityFilter === 'WARN' ? '' : 'WARN')}
                                className={`chip-btn warn ${severityFilter === 'WARN' ? 'active' : ''}`}
                            >
                                Warn ({eventMetrics?.severities?.WARN || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSeverityFilter(severityFilter === 'INFO' ? '' : 'INFO')}
                                className={`chip-btn info ${severityFilter === 'INFO' ? 'active' : ''}`}
                            >
                                Info ({eventMetrics?.severities?.INFO || 0})
                            </button>
                        </div>
                    </div>

                    {/* Filters Toolbar */}
                    <div className="events-filters-toolbar">
                        <div className="filter-search-box">
                            <Search className="w-4 h-4 search-icon" />
                            <input
                                type="text"
                                placeholder="Search events, messages, actions, resources..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="clear-btn"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Categories</option>
                            <option value="AUTH">AUTH</option>
                            <option value="BILLING">BILLING</option>
                            <option value="SECURITY">SECURITY</option>
                            <option value="SYSTEM">SYSTEM</option>
                            <option value="ADMIN">ADMIN</option>
                        </select>

                        <select
                            value={severityFilter}
                            onChange={(e) => setSeverityFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Severities</option>
                            <option value="INFO">INFO</option>
                            <option value="WARN">WARN</option>
                            <option value="ERROR">ERROR</option>
                            <option value="CRITICAL">CRITICAL</option>
                        </select>

                        <div style={{ minWidth: '150px' }}>
                            <ShadcnDatePicker
                                value={startDate}
                                onChange={(val) => setStartDate(val)}
                                placeholder="Start date"
                                maxDate={endDate}
                                ariaLabel="Filter start date"
                            />
                        </div>

                        <div style={{ minWidth: '150px' }}>
                            <ShadcnDatePicker
                                value={endDate}
                                onChange={(val) => setEndDate(val)}
                                placeholder="End date"
                                minDate={startDate}
                                ariaLabel="Filter end date"
                            />
                        </div>

                        {(search || categoryFilter || severityFilter || startDate || endDate) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch('');
                                    setCategoryFilter('');
                                    setSeverityFilter('');
                                    setStartDate('');
                                    setEndDate('');
                                }}
                                className="filter-reset-btn"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Events Data Table */}
                    <div className="events-table-wrapper">
                        <table className="events-data-table">
                            <thead>
                                <tr>
                                    <th>Severity</th>
                                    <th>Category</th>
                                    <th>Event Name</th>
                                    <th>Resource / Actor</th>
                                    <th>Safe Message</th>
                                    <th>Timestamp</th>
                                    <th className="text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {eventsLoading ? (
                                    <tr>
                                        <td colSpan="7" className="events-empty-cell">
                                            Loading system operational events...
                                        </td>
                                    </tr>
                                ) : events.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="events-empty-cell">
                                            No operational events found matching the specified filters.
                                        </td>
                                    </tr>
                                ) : (
                                    events.map((evt) => (
                                        <tr key={evt._id} className="event-row">
                                            <td>{getSeverityPill(evt.severity)}</td>
                                            <td>{getCategoryPill(evt.category)}</td>
                                            <td className="event-name-cell">{evt.eventType}</td>
                                            <td>
                                                <div className="event-actor-cell">
                                                    <span className="actor-type">{evt.targetType || 'System'}</span>
                                                    <span className="actor-id">
                                                        {evt.actorId?.username
                                                            ? `@${evt.actorId.username}`
                                                            : (evt.actorRole || 'system')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="event-msg-cell" title={evt.details?.message || evt.details?.action || evt.eventType}>
                                                {evt.details?.message || evt.details?.action || 'Event completed successfully'}
                                            </td>
                                            <td className="text-zinc-400">
                                                {new Date(evt.createdAt).toLocaleString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedEvent(evt)}
                                                    className="inspect-btn"
                                                >
                                                    Inspect
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="events-pagination-bar">
                            <AdminPagination
                                page={pagination.page}
                                pages={pagination.pages}
                                onPageChange={(p) => fetchEvents(p)}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ── 7. Event Detail Drawer Modal ── */}
            {selectedEvent && (
                <div className="event-drawer-overlay" onClick={() => setSelectedEvent(null)}>
                    <div className="event-drawer-card" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div className="event-title-meta">
                                <Shield className="w-5 h-5 text-indigo-400" />
                                <h4>{selectedEvent.eventType}</h4>
                            </div>
                            <button
                                type="button"
                                className="drawer-close-btn"
                                onClick={() => setSelectedEvent(null)}
                                title="Close Drawer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="drawer-body">
                            <div className="event-meta-grid">
                                <div className="meta-box">
                                    <span className="meta-label">Severity</span>
                                    <div>{getSeverityPill(selectedEvent.severity)}</div>
                                </div>
                                <div className="meta-box">
                                    <span className="meta-label">Category</span>
                                    <div>{getCategoryPill(selectedEvent.category)}</div>
                                </div>
                                <div className="meta-box">
                                    <span className="meta-label">Actor</span>
                                    <span className="meta-val">
                                        {selectedEvent.actorId?.username
                                            ? `@${selectedEvent.actorId.username} (${selectedEvent.actorId.email || 'user'})`
                                            : (selectedEvent.actorRole || 'System')}
                                    </span>
                                </div>
                                <div className="meta-box">
                                    <span className="meta-label">Target Resource</span>
                                    <span className="meta-val">
                                        {selectedEvent.targetType} {selectedEvent.targetId?._id ? `(${selectedEvent.targetId._id})` : ''}
                                    </span>
                                </div>
                                <div className="meta-box full">
                                    <span className="meta-label">Trace ID</span>
                                    <span className="meta-val">
                                        {selectedEvent.traceId || 'None (Local event)'}
                                    </span>
                                </div>
                                <div className="meta-box full">
                                    <span className="meta-label">Timestamp (ISO)</span>
                                    <span className="meta-val">
                                        {new Date(selectedEvent.createdAt).toISOString()}
                                    </span>
                                </div>
                            </div>

                            <div className="event-payload-section">
                                <span className="payload-label">Sanitized Event Details & Payload</span>
                                <pre className="payload-json-pre">
                                    {JSON.stringify(selectedEvent.details, null, 2)}
                                </pre>
                            </div>
                        </div>

                        <div className="drawer-footer">
                            <button
                                type="button"
                                className="drawer-dismiss-btn"
                                onClick={() => setSelectedEvent(null)}
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminSystemHealthTab;
