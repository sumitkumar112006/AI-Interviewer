import React, { useEffect, useState, useCallback } from 'react';
import {
    getAdminAiUsageAnalytics,
    getAdminAiUsageLogs
} from '../services/admin.api';
import {
    Sparkles,
    Coins,
    Zap,
    TrendingUp,
    BarChart3,
    Layers,
    Clock,
    AlertTriangle,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Calendar,
    Server,
    Cpu,
    ArrowUpRight,
    Search,
    ChevronLeft,
    ChevronRight,
    DollarSign
} from 'lucide-react';

export const AdminAiUsageTab = () => {
    // Analytics state
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [analyticsError, setAnalyticsError] = useState(null);

    // Filters
    const [dateRange, setDateRange] = useState('all'); // 'all' | '30d' | '7d' | 'today'
    const [selectedFeature, setSelectedFeature] = useState('all');
    const [selectedProvider, setSelectedProvider] = useState('all');

    // Logs state (drill-down table)
    const [logs, setLogs] = useState([]);
    const [logsPagination, setLogsPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
    const [logsLoading, setLogsLoading] = useState(false);
    const [logStatusFilter, setLogStatusFilter] = useState('');

    // Fetch analytics summary
    const fetchAnalytics = useCallback(async (bypassCache = false) => {
        try {
            setAnalyticsLoading(true);
            setAnalyticsError(null);

            let startDate;
            const now = new Date();
            if (dateRange === 'today') {
                startDate = now.toISOString().split('T')[0];
            } else if (dateRange === '7d') {
                const d = new Date();
                d.setDate(now.getDate() - 7);
                startDate = d.toISOString().split('T')[0];
            } else if (dateRange === '30d') {
                const d = new Date();
                d.setDate(now.getDate() - 30);
                startDate = d.toISOString().split('T')[0];
            }

            const res = await getAdminAiUsageAnalytics({
                startDate,
                feature: selectedFeature !== 'all' ? selectedFeature : undefined,
                provider: selectedProvider !== 'all' ? selectedProvider : undefined,
                refresh: bypassCache ? '1' : undefined
            });

            if (res.success) {
                setAnalytics(res);
            } else {
                setAnalyticsError(res.message || 'Failed to load AI usage analytics');
            }
        } catch (err) {
            console.error('Error fetching AI analytics:', err);
            setAnalyticsError(err?.response?.data?.message || err?.message || 'Failed to load AI analytics');
        } finally {
            setAnalyticsLoading(false);
        }
    }, [dateRange, selectedFeature, selectedProvider]);

    // Fetch paginated logs
    const fetchLogs = useCallback(async (page = 1) => {
        try {
            setLogsLoading(true);
            let startDate;
            const now = new Date();
            if (dateRange === 'today') {
                startDate = now.toISOString().split('T')[0];
            } else if (dateRange === '7d') {
                const d = new Date();
                d.setDate(now.getDate() - 7);
                startDate = d.toISOString().split('T')[0];
            } else if (dateRange === '30d') {
                const d = new Date();
                d.setDate(now.getDate() - 30);
                startDate = d.toISOString().split('T')[0];
            }

            const res = await getAdminAiUsageLogs({
                page,
                limit: logsPagination.limit,
                status: logStatusFilter || undefined,
                feature: selectedFeature !== 'all' ? selectedFeature : undefined,
                provider: selectedProvider !== 'all' ? selectedProvider : undefined,
                startDate
            });

            if (res.success) {
                setLogs(res.logs || []);
                if (res.pagination) {
                    setLogsPagination(res.pagination);
                }
            }
        } catch (err) {
            console.error('Error fetching AI logs:', err);
        } finally {
            setLogsLoading(false);
        }
    }, [dateRange, selectedFeature, selectedProvider, logStatusFilter, logsPagination.limit]);

    useEffect(() => {
        fetchAnalytics();
        fetchLogs(1);
    }, [fetchAnalytics, fetchLogs]);

    const summary = analytics?.summary || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        avgLatencyMs: 0
    };

    const byProvider = analytics?.byProvider || [];
    const byFeature = analytics?.byFeature || [];
    const dailyTrends = analytics?.dailyTrends || [];

    // Helper formatter
    const formatNumber = (num) => {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString('en-US');
    };

    const formatCost = (cost) => {
        if (!cost) return '$0.0000';
        return `$${Number(cost).toFixed(4)}`;
    };

    const getFeatureBadgeColor = (feat) => {
        switch (feat) {
            case 'resume_generation':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'interview_report':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'ai_assistant':
                return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'cover_letter':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'resume_rewrite':
                return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
            default:
                return 'bg-zinc-800 text-zinc-300 border-zinc-700';
        }
    };

    const formatFeatureLabel = (feat) => {
        switch (feat) {
            case 'resume_generation': return 'Resume Generation';
            case 'interview_report': return 'Interview Report';
            case 'ai_assistant': return 'AI Assistant';
            case 'cover_letter': return 'Cover Letter';
            case 'resume_rewrite': return 'Resume Rewrite';
            default: return feat ? feat.replace(/_/g, ' ') : 'General AI';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                AI Token & Spend Intelligence
                                <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                    Real-Time Telemetry
                                </span>
                            </h2>
                            <p className="text-xs text-zinc-400 mt-1">
                                Centralized tracking across Groq, Google Gemini, and OpenRouter with genuine token metadata, pricing registry, and latency monitoring.
                            </p>
                        </div>
                    </div>

                    {/* Toolbar Filters */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Date Range */}
                        <div className="flex rounded-lg bg-zinc-800 p-0.5 border border-zinc-700/80 text-xs">
                            <button
                                type="button"
                                onClick={() => setDateRange('all')}
                                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                                    dateRange === 'all' ? 'bg-amber-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                All Time
                            </button>
                            <button
                                type="button"
                                onClick={() => setDateRange('30d')}
                                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                                    dateRange === '30d' ? 'bg-amber-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                30 Days
                            </button>
                            <button
                                type="button"
                                onClick={() => setDateRange('7d')}
                                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                                    dateRange === '7d' ? 'bg-amber-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                7 Days
                            </button>
                            <button
                                type="button"
                                onClick={() => setDateRange('today')}
                                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                                    dateRange === 'today' ? 'bg-amber-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                Today
                            </button>
                        </div>

                        {/* Feature Filter */}
                        <select
                            value={selectedFeature}
                            onChange={(e) => setSelectedFeature(e.target.value)}
                            className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500"
                        >
                            <option value="all">All Features</option>
                            <option value="resume_generation">Resume Generation</option>
                            <option value="interview_report">Interview Report</option>
                            <option value="ai_assistant">AI Assistant</option>
                            <option value="cover_letter">Cover Letter</option>
                            <option value="resume_rewrite">Resume Rewrite</option>
                        </select>

                        {/* Provider Filter */}
                        <select
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value)}
                            className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500"
                        >
                            <option value="all">All Providers</option>
                            <option value="groq">Groq</option>
                            <option value="gcp.gemini">Google Gemini</option>
                            <option value="openrouter">OpenRouter</option>
                        </select>

                        {/* Force Refresh */}
                        <button
                            type="button"
                            onClick={() => {
                                fetchAnalytics(true);
                                fetchLogs(1);
                            }}
                            disabled={analyticsLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors disabled:opacity-50"
                            title="Bypass 5-minute cache and re-aggregate live"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin text-amber-400' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                {analyticsError && (
                    <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{analyticsError}</span>
                    </div>
                )}

                {/* 4 Summary Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    {/* Estimated Spend */}
                    <div className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/60 hover:border-amber-500/40 transition-all">
                        <div className="flex items-center justify-between text-zinc-400 mb-2">
                            <span className="text-xs font-medium">Estimated AI Spend</span>
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                <DollarSign className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-white font-mono tracking-tight">
                            {formatCost(summary.estimatedCostUsd)}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
                            <span>USD list cost</span>
                            <span className="text-zinc-500">•</span>
                            <span className="text-emerald-400/90 font-mono">
                                {summary.totalRequests > 0 ? `$${((summary.estimatedCostUsd / summary.totalRequests) * 1000).toFixed(3)}/kReq` : '$0'}
                            </span>
                        </div>
                    </div>

                    {/* Total Tokens */}
                    <div className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/60 hover:border-amber-500/40 transition-all">
                        <div className="flex items-center justify-between text-zinc-400 mb-2">
                            <span className="text-xs font-medium">Total Tokens Consumed</span>
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                                <Coins className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-white font-mono tracking-tight">
                            {formatNumber(summary.totalTokens)}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
                            <span>In: <strong className="text-zinc-200 font-mono">{formatNumber(summary.totalInputTokens)}</strong></span>
                            <span>Out: <strong className="text-zinc-200 font-mono">{formatNumber(summary.totalOutputTokens)}</strong></span>
                        </div>
                    </div>

                    {/* Total Requests & Failure Rate */}
                    <div className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/60 hover:border-amber-500/40 transition-all">
                        <div className="flex items-center justify-between text-zinc-400 mb-2">
                            <span className="text-xs font-medium">LLM Requests</span>
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                <Zap className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-white font-mono tracking-tight">
                            {formatNumber(summary.totalRequests)}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
                            <span className="text-emerald-400 font-medium">
                                ✓ {formatNumber(summary.successfulRequests)} OK
                            </span>
                            <span className={summary.failedRequests > 0 ? 'text-red-400 font-medium' : 'text-zinc-500'}>
                                ✕ {formatNumber(summary.failedRequests)} Failed
                            </span>
                        </div>
                    </div>

                    {/* Turnaround Latency */}
                    <div className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/60 hover:border-amber-500/40 transition-all">
                        <div className="flex items-center justify-between text-zinc-400 mb-2">
                            <span className="text-xs font-medium">Average Latency</span>
                            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                <Clock className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-white font-mono tracking-tight">
                            {formatNumber(summary.avgLatencyMs)} <span className="text-sm font-normal text-zinc-400">ms</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1">
                            {summary.avgLatencyMs < 1000 ? (
                                <span className="text-emerald-400">⚡ Sub-second response speed</span>
                            ) : (
                                <span className="text-amber-400">Balanced generation throughput</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Provider/Model Breakdown & Feature Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Usage by Provider & Model */}
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Server className="w-4 h-4 text-amber-400" />
                            Usage by Provider & Model
                        </h3>
                        <span className="text-xs text-zinc-400 font-mono">
                            {byProvider.length} active models
                        </span>
                    </div>

                    {byProvider.length === 0 ? (
                        <div className="text-center py-10 text-zinc-500 text-xs">
                            No provider records matching selected filters.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {byProvider.map((item, idx) => {
                                const tokenShare = summary.totalTokens > 0
                                    ? Math.round((item.totalTokens / summary.totalTokens) * 100)
                                    : 0;

                                return (
                                    <div key={idx} className="p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-medium text-white">
                                                    {item.model}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 uppercase">
                                                    {item.provider}
                                                </span>
                                            </div>
                                            <span className="font-mono text-emerald-400 font-semibold">
                                                {formatCost(item.estimatedCostUsd)}
                                            </span>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="w-full bg-zinc-700/60 rounded-full h-1.5 my-2 overflow-hidden">
                                            <div
                                                className="bg-amber-500 h-1.5 rounded-full transition-all"
                                                style={{ width: `${Math.min(100, Math.max(2, tokenShare))}%` }}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                            <span>{formatNumber(item.totalTokens)} tokens ({tokenShare}%)</span>
                                            <span>{item.requests} calls • avg {formatNumber(item.avgLatencyMs)}ms</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Usage by Feature */}
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-400" />
                            Usage by Operational Feature
                        </h3>
                        <span className="text-xs text-zinc-400 font-mono">
                            {byFeature.length} domains
                        </span>
                    </div>

                    {byFeature.length === 0 ? (
                        <div className="text-center py-10 text-zinc-500 text-xs">
                            No feature telemetry matching selected filters.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {byFeature.map((item, idx) => {
                                const requestShare = summary.totalRequests > 0
                                    ? Math.round((item.requests / summary.totalRequests) * 100)
                                    : 0;

                                return (
                                    <div key={idx} className="p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${getFeatureBadgeColor(item.feature)}`}>
                                                    {formatFeatureLabel(item.feature)}
                                                </span>
                                            </div>
                                            <span className="font-mono text-zinc-200">
                                                {formatNumber(item.requests)} requests ({requestShare}%)
                                            </span>
                                        </div>

                                        <div className="w-full bg-zinc-700/60 rounded-full h-1.5 my-2 overflow-hidden">
                                            <div
                                                className="bg-blue-500 h-1.5 rounded-full transition-all"
                                                style={{ width: `${Math.min(100, Math.max(2, requestShare))}%` }}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                            <span>Tokens: {formatNumber(item.totalTokens)}</span>
                                            <span className="font-mono text-emerald-400 font-medium">
                                                Spend: {formatCost(item.estimatedCostUsd)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Daily Trends Timeline */}
            {dailyTrends.length > 0 && (
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            Recent Generation Volume & Spend Timeline
                        </h3>
                        <span className="text-xs text-zinc-400 font-mono">
                            {dailyTrends.length} days recorded
                        </span>
                    </div>

                    <div className="overflow-x-auto pb-2">
                        <div className="flex items-end gap-3 min-w-full h-40 pt-4">
                            {dailyTrends.slice(-14).map((d, idx) => {
                                const maxReqs = Math.max(...dailyTrends.map(t => t.requests), 1);
                                const heightPercent = Math.min(100, Math.max(12, Math.round((d.requests / maxReqs) * 100)));

                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group">
                                        <div className="text-[10px] font-mono text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {formatCost(d.estimatedCostUsd)}
                                        </div>
                                        <div className="w-full bg-zinc-800 rounded-t-lg relative flex items-end justify-center h-28 overflow-hidden">
                                            <div
                                                className={`w-full rounded-t-lg transition-all ${
                                                    d.failedRequests > 0
                                                        ? 'bg-gradient-to-t from-red-600/80 to-amber-500'
                                                        : 'bg-gradient-to-t from-amber-600 to-amber-400'
                                                }`}
                                                style={{ height: `${heightPercent}%` }}
                                            />
                                        </div>
                                        <div className="text-[10px] font-mono text-zinc-400 text-center truncate w-full">
                                            {d.date?.slice(5)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Paginated Detailed Request Logs */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-zinc-800">
                    <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-amber-400" />
                            Individual AI Invocations & Request Logs
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Drill-down operational logs showing exact token counts, latency, and sanitized error summaries.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={logStatusFilter}
                            onChange={(e) => setLogStatusFilter(e.target.value)}
                            className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                        >
                            <option value="">All Statuses</option>
                            <option value="success">Success Only</option>
                            <option value="failed">Failed Only</option>
                        </select>
                    </div>
                </div>

                {logsLoading ? (
                    <div className="py-12 text-center text-zinc-400 text-xs flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                        Loading invocation records...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-xs">
                        No individual usage entries found for the selected filter.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                                    <th className="py-2.5 px-3">Timestamp</th>
                                    <th className="py-2.5 px-3">Feature</th>
                                    <th className="py-2.5 px-3">Provider & Model</th>
                                    <th className="py-2.5 px-3">Tokens (In / Out)</th>
                                    <th className="py-2.5 px-3">Cost</th>
                                    <th className="py-2.5 px-3">Latency</th>
                                    <th className="py-2.5 px-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 font-sans">
                                {logs.map((log) => (
                                    <tr key={log._id} className="hover:bg-zinc-800/40 transition-colors">
                                        <td className="py-2.5 px-3 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                                            {log.timestamp ? new Date(log.timestamp).toLocaleString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit'
                                            }) : '—'}
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${getFeatureBadgeColor(log.feature)}`}>
                                                {formatFeatureLabel(log.feature)}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <div className="font-mono text-zinc-200 text-[11px]">{log.model}</div>
                                            <div className="text-[10px] text-zinc-400 font-mono uppercase">{log.provider}</div>
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                                            {log.tokenCountsAvailable !== false ? (
                                                <div className="text-zinc-200">
                                                    {formatNumber(log.totalTokens)}
                                                    <span className="text-zinc-500 text-[10px] ml-1">
                                                        ({formatNumber(log.inputTokens)}/{formatNumber(log.outputTokens)})
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-500 italic">Not exposed</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-emerald-400 text-[11px] whitespace-nowrap">
                                            {formatCost(log.estimatedCostUsd)}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-zinc-300 text-[11px] whitespace-nowrap">
                                            {formatNumber(log.latencyMs)} ms
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            {log.status === 'success' ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Success
                                                </span>
                                            ) : (
                                                <span
                                                    className="inline-flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20"
                                                    title={log.errorMessage || 'Execution failed'}
                                                >
                                                    <XCircle className="w-3 h-3" />
                                                    Failed
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {logsPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-800 text-xs text-zinc-400">
                        <div>
                            Showing page <strong className="text-white">{logsPagination.page}</strong> of{' '}
                            <strong className="text-white">{logsPagination.totalPages}</strong> ({formatNumber(logsPagination.total)} total requests)
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => fetchLogs(logsPagination.page - 1)}
                                disabled={logsPagination.page <= 1 || logsLoading}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-2 font-mono">{logsPagination.page}</span>
                            <button
                                type="button"
                                onClick={() => fetchLogs(logsPagination.page + 1)}
                                disabled={logsPagination.page >= logsPagination.totalPages || logsLoading}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

