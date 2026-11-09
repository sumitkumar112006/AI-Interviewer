import React, { useState, useEffect, useCallback } from 'react';
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
    FileText,
    ExternalLink,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { getAdminSystemHealth, getAdminSystemEvents } from '../services/admin.api';
import AdminPagination from './AdminPagination';

export function AdminSystemHealthTab() {
    // Sub-view: 'health' | 'events'
    const [subTab, setSubTab] = useState('health');

    // Health state
    const [healthData, setHealthData] = useState(null);
    const [healthLoading, setHealthLoading] = useState(true);
    const [healthRefreshing, setHealthRefreshing] = useState(false);

    // Events state
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

    useEffect(() => {
        fetchHealth();
    }, [fetchHealth]);

    useEffect(() => {
        if (subTab === 'events') {
            const timer = setTimeout(() => {
                fetchEvents(1);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [subTab, fetchEvents]);

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

    const getStatusBadge = (status) => {
        switch (status?.toLowerCase()) {
            case 'healthy':
                return (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Healthy
                    </span>
                );
            case 'degraded':
                return (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Degraded
                    </span>
                );
            case 'unavailable':
                return (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3.5 h-3.5" />
                        Unavailable
                    </span>
                );
            default:
                return (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Unknown
                    </span>
                );
        }
    };

    const getSeverityPill = (severity) => {
        switch (severity?.toUpperCase()) {
            case 'CRITICAL':
                return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">CRITICAL</span>;
            case 'ERROR':
                return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">ERROR</span>;
            case 'WARN':
                return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">WARN</span>;
            case 'INFO':
            default:
                return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">INFO</span>;
        }
    };

    const getCategoryPill = (category) => {
        const cat = (category || 'SYSTEM').toUpperCase();
        const colors = {
            AUTH: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            BILLING: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            SECURITY: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
            SYSTEM: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            ADMIN: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
        };
        const color = colors[cat] || colors.SYSTEM;
        return <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${color}`}>{cat}</span>;
    };

    return (
        <div className="space-y-6">
            {/* View Switcher Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setSubTab('health')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                            subTab === 'health'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                    >
                        <Activity className="w-4 h-4" />
                        Application Health Monitor
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubTab('events')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                            subTab === 'events'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                    >
                        <Server className="w-4 h-4" />
                        Operational System Events
                        {pagination.total > 0 && (
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/30 text-indigo-200">
                                {pagination.total}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {subTab === 'health' && healthData?.cached && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                            Cached ({healthData.cacheAgeSeconds}s ago)
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            if (subTab === 'health') fetchHealth(true);
                            else fetchEvents(pagination.page);
                        }}
                        disabled={healthRefreshing || eventsLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${healthRefreshing || (subTab === 'events' && eventsLoading) ? 'animate-spin' : ''}`} />
                        {healthRefreshing ? 'Probing...' : 'Live Refresh'}
                    </button>
                </div>
            </div>

            {/* TAB 1: SYSTEM HEALTH OVERVIEW */}
            {subTab === 'health' && (
                <div className="space-y-6">
                    {/* Overall Health Status Banner */}
                    <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-zinc-800/80 border border-zinc-700/60">
                                {healthData?.overallStatus === 'healthy' ? (
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                ) : healthData?.overallStatus === 'degraded' ? (
                                    <AlertTriangle className="w-8 h-8 text-amber-400" />
                                ) : (
                                    <XCircle className="w-8 h-8 text-rose-400" />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-white">System Architecture Status:</h3>
                                    {getStatusBadge(healthData?.overallStatus || 'healthy')}
                                </div>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                    {healthData?.overallStatus === 'healthy'
                                        ? 'All backend subsystems, database clusters, and asynchronous workers are operating normally.'
                                        : 'One or more non-critical subsystems are operating with reduced throughput or fallback cache.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="px-3 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-center">
                                <span className="block text-[10px] uppercase font-mono text-zinc-400">Healthy</span>
                                <span className="text-sm font-bold text-emerald-400">{healthData?.summary?.healthyCount ?? '...'}</span>
                            </div>
                            <div className="px-3 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-center">
                                <span className="block text-[10px] uppercase font-mono text-zinc-400">Degraded</span>
                                <span className="text-sm font-bold text-amber-400">{healthData?.summary?.degradedCount ?? 0}</span>
                            </div>
                            <div className="px-3 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-center">
                                <span className="block text-[10px] uppercase font-mono text-zinc-400">Unavailable</span>
                                <span className="text-sm font-bold text-rose-400">{healthData?.summary?.unavailableCount ?? 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Subsystem Health Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* 1. Backend Runtime */}
                        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                        <Server className="w-5 h-5" />
                                    </div>
                                    <h4 className="text-sm font-bold text-white">Backend Process</h4>
                                </div>
                                {getStatusBadge(healthData?.services?.backend?.status)}
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Uptime:</span>
                                    <strong className="text-white font-mono">{formatUptime(healthData?.services?.backend?.uptimeSeconds)}</strong>
                                </div>
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Node Version:</span>
                                    <strong className="text-zinc-300 font-mono">{healthData?.services?.backend?.nodeVersion || 'N/A'}</strong>
                                </div>
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Heap Memory:</span>
                                    <strong className="text-zinc-300 font-mono">
                                        {healthData?.services?.backend?.memory?.heapUsedMB} MB / {healthData?.services?.backend?.memory?.heapTotalMB} MB
                                    </strong>
                                </div>
                                <div className="flex justify-between py-1 text-zinc-400">
                                    <span>RSS Memory:</span>
                                    <strong className="text-zinc-300 font-mono">{healthData?.services?.backend?.memory?.rssMB} MB</strong>
                                </div>
                            </div>
                            <p className="text-[11px] text-zinc-500">{healthData?.services?.backend?.message}</p>
                        </div>

                        {/* 2. MongoDB Cluster */}
                        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <Database className="w-5 h-5" />
                                    </div>
                                    <h4 className="text-sm font-bold text-white">MongoDB Cluster</h4>
                                </div>
                                {getStatusBadge(healthData?.services?.mongodb?.status)}
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Connection State:</span>
                                    <strong className="text-emerald-400 capitalize">{healthData?.services?.mongodb?.connectionState || 'N/A'}</strong>
                                </div>
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Ping Latency:</span>
                                    <strong className="text-white font-mono">
                                        {healthData?.services?.mongodb?.latencyMs !== null ? `${healthData?.services?.mongodb?.latencyMs} ms` : 'N/A'}
                                    </strong>
                                </div>
                                <div className="flex justify-between py-1 text-zinc-400">
                                    <span>Deployment:</span>
                                    <span className="text-zinc-400 font-mono text-[11px]">MongoDB Atlas Replica</span>
                                </div>
                            </div>
                            <p className="text-[11px] text-zinc-500">{healthData?.services?.mongodb?.message}</p>
                        </div>

                        {/* 3. Redis Distributed Store */}
                        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                        <Zap className="w-5 h-5" />
                                    </div>
                                    <h4 className="text-sm font-bold text-white">Redis Cache & Limiter</h4>
                                </div>
                                {getStatusBadge(healthData?.services?.redis?.status)}
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Client State:</span>
                                    <strong className="text-zinc-300 font-mono">{healthData?.services?.redis?.connectionState || 'N/A'}</strong>
                                </div>
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Roundtrip Latency:</span>
                                    <strong className="text-white font-mono">
                                        {healthData?.services?.redis?.latencyMs !== null ? `${healthData?.services?.redis?.latencyMs} ms` : 'Fallback Active'}
                                    </strong>
                                </div>
                                <div className="flex justify-between py-1 text-zinc-400">
                                    <span>Fallback Mechanism:</span>
                                    <span className="text-zinc-400 font-mono text-[11px]">Sliding In-Memory Map</span>
                                </div>
                            </div>
                            <p className="text-[11px] text-zinc-500">{healthData?.services?.redis?.message}</p>
                        </div>

                        {/* 4. BullMQ Queue & Worker */}
                        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                        <Cpu className="w-5 h-5" />
                                    </div>
                                    <h4 className="text-sm font-bold text-white">BullMQ Async Queue</h4>
                                </div>
                                {getStatusBadge(healthData?.services?.bullmq?.status)}
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Worker Status:</span>
                                    <strong className="text-white font-mono capitalize">{healthData?.services?.bullmq?.workerState || 'N/A'}</strong>
                                </div>
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Active Backlog:</span>
                                    <strong className="text-indigo-400 font-mono">{healthData?.services?.bullmq?.totalBacklog || 0} jobs</strong>
                                </div>
                                <div className="flex justify-between py-1 text-zinc-400">
                                    <span>Waiting / Active:</span>
                                    <strong className="text-zinc-300 font-mono">
                                        {healthData?.services?.bullmq?.queueCounts?.waiting || 0} waiting • {healthData?.services?.bullmq?.queueCounts?.active || 0} active
                                    </strong>
                                </div>
                            </div>
                            <p className="text-[11px] text-zinc-500">{healthData?.services?.bullmq?.message}</p>
                        </div>

                        {/* 5. AI Cluster Availability */}
                        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        <Radio className="w-5 h-5" />
                                    </div>
                                    <h4 className="text-sm font-bold text-white">AI Cluster State</h4>
                                </div>
                                {getStatusBadge(healthData?.services?.ai?.status)}
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Current Provider:</span>
                                    <strong className="text-amber-400 font-mono">{healthData?.services?.ai?.currentProvider || 'None'}</strong>
                                </div>
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Primary Model:</span>
                                    <strong className="text-white font-mono">{healthData?.services?.ai?.primaryModel || 'Tier-based'}</strong>
                                </div>
                                <div className="flex justify-between py-1 text-zinc-400">
                                    <span>Cluster Mode:</span>
                                    <strong className="text-zinc-300 font-mono">{healthData?.services?.ai?.label || 'Active'}</strong>
                                </div>
                            </div>
                            <p className="text-[11px] text-zinc-500">{healthData?.services?.ai?.message}</p>
                        </div>

                        {/* 6. OpenTelemetry & Structured Logs */}
                        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                        <Layers className="w-5 h-5" />
                                    </div>
                                    <h4 className="text-sm font-bold text-white">Telemetry & Logs</h4>
                                </div>
                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Active
                                </span>
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Telemetry Layer:</span>
                                    <strong className="text-cyan-400 font-mono">OpenTelemetry SDK</strong>
                                </div>
                                <div className="flex justify-between py-1 border-b border-zinc-800/60 text-zinc-400">
                                    <span>Log Transport:</span>
                                    <strong className="text-white font-mono">OTLP / Loki Ready</strong>
                                </div>
                                <div className="flex justify-between py-1 text-zinc-400">
                                    <span>Trace Correlation:</span>
                                    <span className="text-emerald-400 font-mono">Active (128-bit traceId)</span>
                                </div>
                            </div>
                            <p className="text-[11px] text-zinc-500">Structured logging with privacy scrubbing and cardinality protection active.</p>
                        </div>
                    </div>

                    {/* Recent Operational Errors */}
                    <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Recent Server & Execution Errors</h4>
                                    <p className="text-xs text-zinc-400">Top 10 most recent error/critical events captured from SystemEvent audit stream</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSeverityFilter('ERROR');
                                    setSubTab('events');
                                }}
                                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                            >
                                View in Events Log
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {healthData?.recentErrors?.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-zinc-800 text-zinc-400">
                                            <th className="py-2.5 px-3">Severity</th>
                                            <th className="py-2.5 px-3">Event Type</th>
                                            <th className="py-2.5 px-3">Message</th>
                                            <th className="py-2.5 px-3">Trace ID</th>
                                            <th className="py-2.5 px-3">Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60">
                                        {healthData.recentErrors.map((err) => (
                                            <tr key={err.id} className="hover:bg-zinc-800/30">
                                                <td className="py-2.5 px-3">{getSeverityPill(err.severity)}</td>
                                                <td className="py-2.5 px-3 font-mono font-medium text-white">{err.eventType}</td>
                                                <td className="py-2.5 px-3 text-zinc-300 max-w-[320px] truncate" title={err.message}>
                                                    {err.message}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono text-zinc-400">
                                                    {err.traceId ? `${err.traceId.slice(0, 12)}…` : '—'}
                                                </td>
                                                <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap">
                                                    {new Date(err.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-zinc-800/40">
                                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                                <p className="text-xs font-medium text-emerald-300">No operational errors recorded recently.</p>
                                <p className="text-[11px] text-zinc-500 mt-0.5">All services are operating within expected error budgets.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: SYSTEM OPERATIONAL EVENTS */}
            {subTab === 'events' && (
                <div className="space-y-4">
                    {/* Events Filters Bar */}
                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search events, messages, actions, resources..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
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
                                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="">All Severities</option>
                                    <option value="INFO">INFO</option>
                                    <option value="WARN">WARN</option>
                                    <option value="ERROR">ERROR</option>
                                    <option value="CRITICAL">CRITICAL</option>
                                </select>

                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    title="Start Date"
                                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
                                />

                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    title="End Date"
                                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
                                />

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
                                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Events Table */}
                    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-950/40">
                                        <th className="py-3 px-4">Severity</th>
                                        <th className="py-3 px-4">Category</th>
                                        <th className="py-3 px-4">Event Name</th>
                                        <th className="py-3 px-4">Resource / Actor</th>
                                        <th className="py-3 px-4">Safe Message</th>
                                        <th className="py-3 px-4">Timestamp</th>
                                        <th className="py-3 px-4 text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/60">
                                    {eventsLoading ? (
                                        <tr>
                                            <td colSpan="7" className="py-12 text-center text-zinc-500">
                                                Loading system operational events...
                                            </td>
                                        </tr>
                                    ) : events.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="py-12 text-center text-zinc-500">
                                                No operational events found matching the specified filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        events.map((evt) => (
                                            <tr key={evt._id} className="hover:bg-zinc-800/30 transition-colors">
                                                <td className="py-3 px-4">{getSeverityPill(evt.severity)}</td>
                                                <td className="py-3 px-4">{getCategoryPill(evt.category)}</td>
                                                <td className="py-3 px-4 font-mono font-medium text-white">{evt.eventType}</td>
                                                <td className="py-3 px-4">
                                                    <span className="text-zinc-300 block font-medium">
                                                        {evt.targetType || 'System'}
                                                    </span>
                                                    <span className="text-[11px] text-zinc-500 font-mono block">
                                                        {evt.actorId?.username ? `by @${evt.actorId.username}` : (evt.actorRole || 'system')}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-zinc-300 max-w-[280px] truncate" title={evt.details?.message || evt.details?.action || evt.eventType}>
                                                    {evt.details?.message || evt.details?.action || 'Event completed successfully'}
                                                </td>
                                                <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                                                    {new Date(evt.createdAt).toLocaleString([], {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedEvent(evt)}
                                                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
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

                        {pagination.pages > 1 && (
                            <div className="p-4 border-t border-zinc-800">
                                <AdminPagination
                                    page={pagination.page}
                                    pages={pagination.pages}
                                    onPageChange={(p) => fetchEvents(p)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Event Detail Inspection Modal */}
            {selectedEvent && (
                <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
                    <div className="modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-row">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-indigo-400" />
                                <h3>Event Inspection: {selectedEvent.eventType}</h3>
                            </div>
                            <button className="modal-close-btn" onClick={() => setSelectedEvent(null)}>✕</button>
                        </div>

                        <div className="modal-body-content space-y-4 text-xs" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                <div>
                                    <span className="block text-zinc-500 text-[10px] uppercase font-mono">Severity</span>
                                    <div className="mt-1">{getSeverityPill(selectedEvent.severity)}</div>
                                </div>
                                <div>
                                    <span className="block text-zinc-500 text-[10px] uppercase font-mono">Category</span>
                                    <div className="mt-1">{getCategoryPill(selectedEvent.category)}</div>
                                </div>
                                <div>
                                    <span className="block text-zinc-500 text-[10px] uppercase font-mono">Actor</span>
                                    <span className="text-zinc-200 font-medium">
                                        {selectedEvent.actorId?.username ? `@${selectedEvent.actorId.username} (${selectedEvent.actorId.email})` : (selectedEvent.actorRole || 'System')}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-zinc-500 text-[10px] uppercase font-mono">Target Resource</span>
                                    <span className="text-zinc-200 font-medium">
                                        {selectedEvent.targetType} {selectedEvent.targetId?._id ? `(${selectedEvent.targetId._id})` : ''}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-zinc-500 text-[10px] uppercase font-mono">Trace ID</span>
                                    <span className="text-zinc-300 font-mono">
                                        {selectedEvent.traceId || 'None (Local event)'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-zinc-500 text-[10px] uppercase font-mono">Recorded At</span>
                                    <span className="text-zinc-300 font-mono">
                                        {new Date(selectedEvent.createdAt).toISOString()}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <span className="block text-zinc-400 font-semibold mb-1">Sanitized Event Details & Payload</span>
                                <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                                    {JSON.stringify(selectedEvent.details, null, 2)}
                                </pre>
                            </div>
                        </div>

                        <div className="modal-actions" style={{ marginTop: '1.2rem' }}>
                            <button type="button" className="btn-cancel" onClick={() => setSelectedEvent(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminSystemHealthTab;

