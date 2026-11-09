import React, { useEffect, useState, useCallback } from 'react';
import { getAdminAtsAnalytics } from '../services/admin.api';
import { 
    Sparkles, 
    TrendingUp, 
    BarChart2, 
    Layers, 
    Calendar, 
    RefreshCw, 
    AlertCircle, 
    Award, 
    Target, 
    Zap,
    CheckCircle2
} from 'lucide-react';

export const AdminAtsAnalytics = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dateRange, setDateRange] = useState('all'); // 'all' | '30d' | '7d'

    const fetchAnalytics = useCallback(async (bypassCache = false) => {
        try {
            setLoading(true);
            setError(null);

            let startDate;
            const now = new Date();
            if (dateRange === '7d') {
                const d = new Date();
                d.setDate(now.getDate() - 7);
                startDate = d.toISOString().split('T')[0];
            } else if (dateRange === '30d') {
                const d = new Date();
                d.setDate(now.getDate() - 30);
                startDate = d.toISOString().split('T')[0];
            }

            const res = await getAdminAtsAnalytics({
                startDate,
                refresh: bypassCache ? '1' : undefined
            });

            if (res.success) {
                setData(res);
            } else {
                setError(res.message || 'Failed to load ATS analytics.');
            }
        } catch (err) {
            console.error('Failed to load ATS analytics:', err);
            setError(err?.response?.data?.message || err?.message || 'Error loading ATS scores.');
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const summary = data?.summary || {
        totalEvaluations: 0,
        avgScore: 0,
        medianScore: 0,
        highestScore: 0,
        lowestScore: 0
    };

    const distribution = data?.distribution || [];
    const trends = data?.trends || [];
    const planBreakdown = data?.planBreakdown || { free: { count: 0, avgScore: 0 }, pro: { count: 0, avgScore: 0 }, premium: { count: 0, avgScore: 0 } };

    return (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 mt-6 shadow-xl animate-fade-in">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
                        <Target className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            Global ATS Score Intelligence
                            <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                                Aggregated
                            </span>
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Cross-candidate ATS evaluation telemetry, score distribution percentiles, and subscription tier correlation.
                        </p>
                    </div>
                </div>

                {/* Filter Controls */}
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg bg-zinc-800 p-0.5 border border-zinc-700/80 text-xs">
                        <button
                            type="button"
                            onClick={() => setDateRange('all')}
                            className={`px-3 py-1.5 rounded-md font-medium transition ${
                                dateRange === 'all'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            All Time
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateRange('30d')}
                            className={`px-3 py-1.5 rounded-md font-medium transition ${
                                dateRange === '30d'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            Last 30 Days
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateRange('7d')}
                            className={`px-3 py-1.5 rounded-md font-medium transition ${
                                dateRange === '7d'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            Last 7 Days
                        </button>
                    </div>

                    <button
                        onClick={() => fetchAnalytics(true)}
                        disabled={loading}
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition"
                        title="Force refresh (bypass cache)"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* KPI Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
                <div className="bg-zinc-850/60 border border-zinc-800 rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Total Evaluated</span>
                    <div className="text-2xl font-bold text-white mt-1">
                        {summary.totalEvaluations.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">Resumes Scored</span>
                </div>

                <div className="bg-zinc-850/60 border border-zinc-800 rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider block">Average Score</span>
                    <div className="text-2xl font-bold text-indigo-400 mt-1">
                        {summary.avgScore} <span className="text-xs text-zinc-400 font-normal">/ 100</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">Global Mean</span>
                </div>

                <div className="bg-zinc-850/60 border border-zinc-800 rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-purple-400 uppercase tracking-wider block">Median Score</span>
                    <div className="text-2xl font-bold text-purple-400 mt-1">
                        {summary.medianScore} <span className="text-xs text-zinc-400 font-normal">/ 100</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">50th Percentile</span>
                </div>

                <div className="bg-zinc-850/60 border border-zinc-800 rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">Highest Score</span>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">
                        {summary.highestScore}
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">Top Match</span>
                </div>

                <div className="bg-zinc-850/60 border border-zinc-800 rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">Lowest Score</span>
                    <div className="text-2xl font-bold text-amber-400 mt-1">
                        {summary.lowestScore}
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">Baseline Floor</span>
                </div>
            </div>

            {/* Score Range Distribution & Plan Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
                {/* Score Range Distribution Histogram */}
                <div className="lg:col-span-2 bg-zinc-850/40 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                <BarChart2 className="w-4 h-4 text-indigo-400" />
                                ATS Score Distribution Ranges
                            </span>
                            <span className="text-[11px] text-zinc-500">
                                {summary.totalEvaluations} Samples
                            </span>
                        </div>

                        <div className="space-y-3">
                            {distribution.map((bucket) => (
                                <div key={bucket.range} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-medium text-zinc-200 w-16">
                                                {bucket.range}
                                            </span>
                                            <span className="text-zinc-400 text-[11px]">
                                                ({bucket.label})
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 font-mono">
                                            <span className="text-zinc-300">{bucket.count}</span>
                                            <span className="text-zinc-500 text-[11px]">
                                                ({bucket.percentage}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${Math.max(bucket.percentage, 1)}%`,
                                                backgroundColor: bucket.color
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>Range Boundaries: 0-40, 41-60, 61-75, 76-85, 86-100</span>
                        <span>Normal Distribution Fit</span>
                    </div>
                </div>

                {/* Performance by Subscription Plan */}
                <div className="bg-zinc-850/40 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                            <Layers className="w-4 h-4 text-purple-400" />
                            Average Score by Subscription Plan
                        </span>

                        <div className="space-y-3">
                            {/* Free Tier */}
                            <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-750">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Free Tier</span>
                                    <span className="font-mono font-bold text-sm text-white">{planBreakdown.free?.avgScore || 0}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                                    <span>{planBreakdown.free?.count || 0} candidate reports</span>
                                    <span>Standard AI Prompts</span>
                                </div>
                            </div>

                            {/* Pro Tier */}
                            <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Pro Tier</span>
                                    <span className="font-mono font-bold text-sm text-indigo-300">{planBreakdown.pro?.avgScore || 0}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                                    <span>{planBreakdown.pro?.count || 0} candidate reports</span>
                                    <span>Deep ATS Optimization</span>
                                </div>
                            </div>

                            {/* Premium Tier */}
                            <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Premium Tier</span>
                                    <span className="font-mono font-bold text-sm text-purple-300">{planBreakdown.premium?.avgScore || 0}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                                    <span>{planBreakdown.premium?.count || 0} candidate reports</span>
                                    <span>Unlimited Generations</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 text-[11px] text-zinc-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Scores calculated via ATS keyword & semantic match engine</span>
                    </div>
                </div>
            </div>

            {/* Score Trends Timeline (if records exist) */}
            {trends.length > 0 && (
                <div className="mt-5 bg-zinc-850/40 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            Recent Evaluation Trends
                        </span>
                        <span className="text-[11px] text-zinc-500">
                            Daily Average Score Progression
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                        {trends.slice(-7).map(t => (
                            <div key={t.date} className="p-2.5 rounded-lg bg-zinc-800/60 border border-zinc-750 text-center">
                                <span className="text-[10px] text-zinc-400 block font-mono">{t.date.slice(5)}</span>
                                <div className="text-sm font-bold text-emerald-400 mt-1">
                                    {t.avgScore}
                                </div>
                                <span className="text-[10px] text-zinc-500 block">{t.count} evals</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAtsAnalytics;

