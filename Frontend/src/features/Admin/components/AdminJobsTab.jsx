import React, { useEffect, useState, useCallback } from 'react';
import { 
    getAdminJobs, 
    getAdminJobDetails, 
    retryAdminJob, 
    cancelAdminJob 
} from '../services/admin.api';
import { 
    Cpu, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    RotateCcw, 
    Search, 
    Calendar, 
    Eye, 
    X, 
    User, 
    Activity, 
    Ban, 
    RefreshCw, 
    Terminal, 
    FileCode, 
    ShieldCheck, 
    Zap,
    PlayCircle,
    XCircle
} from 'lucide-react';
import AdminPagination from './AdminPagination';
import { AdminExportButton } from './AdminExportButton';

export const AdminJobsTab = () => {
    const [jobs, setJobs] = useState([]);
    const [summary, setSummary] = useState(null);
    const [queueMetrics, setQueueMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters & Pagination
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });

    // Drawer & Inspection State
    const [selectedJob, setSelectedJob] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [actionFeedback, setActionFeedback] = useState(null);

    // Action Confirmation Modal
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        action: null, // 'retry' | 'cancel'
        jobId: null,
        jobType: '',
        reason: ''
    });

    const fetchJobs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getAdminJobs({
                page,
                limit: 20,
                status: statusFilter || undefined,
                type: typeFilter || undefined,
                search: search.trim() || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            });

            if (res.success) {
                setJobs(res.data || []);
                setSummary(res.summary || null);
                setQueueMetrics(res.queueMetrics || null);
                setPagination(res.pagination || { total: 0, pages: 1, limit: 20 });
            } else {
                setError(res.message || 'Failed to retrieve background jobs.');
            }
        } catch (err) {
            console.error('Failed to load admin jobs:', err);
            setError(err?.response?.data?.message || err?.message || 'Failed to load background jobs.');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, typeFilter, search, startDate, endDate]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const handleResetFilters = () => {
        setSearch('');
        setStatusFilter('');
        setTypeFilter('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const handleInspectJob = async (jobId) => {
        try {
            setDetailsLoading(true);
            setSelectedJob(null);
            const res = await getAdminJobDetails(jobId);
            if (res.success) {
                setSelectedJob(res.job);
            } else {
                setActionFeedback({ type: 'error', message: res.message || 'Failed to load job details.' });
            }
        } catch (err) {
            console.error('Failed to load job details:', err);
            setActionFeedback({ type: 'error', message: err?.response?.data?.message || 'Error loading job details.' });
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleOpenConfirm = (action, job) => {
        setConfirmModal({
            isOpen: true,
            action,
            jobId: job._id || job.id,
            jobType: job.type || 'Unknown Type',
            reason: ''
        });
    };

    const handleExecuteAction = async () => {
        const { action, jobId, reason } = confirmModal;
        if (!jobId || !action) return;

        try {
            setActionLoadingId(jobId);
            setConfirmModal(prev => ({ ...prev, isOpen: false }));

            let res;
            if (action === 'retry') {
                res = await retryAdminJob(jobId, reason);
            } else if (action === 'cancel') {
                res = await cancelAdminJob(jobId, reason);
            }

            if (res?.success) {
                setActionFeedback({
                    type: 'success',
                    message: res.message || `Job ${action} executed successfully.`
                });
                // If drawer was open for this job, refresh its details
                if (selectedJob && (selectedJob._id === jobId || selectedJob.id === jobId)) {
                    await handleInspectJob(jobId);
                }
                fetchJobs();
            } else {
                setActionFeedback({
                    type: 'error',
                    message: res?.message || `Failed to execute ${action} on job.`
                });
            }
        } catch (err) {
            console.error(`Failed to execute ${action} on job:`, err);
            setActionFeedback({
                type: 'error',
                message: err?.response?.data?.message || err?.message || `Failed to ${action} job.`
            });
        } finally {
            setActionLoadingId(null);
        }
    };

    const formatDuration = (ms) => {
        if (!ms || ms <= 0) return '—';
        if (ms < 1000) return `${ms}ms`;
        const seconds = (ms / 1000).toFixed(1);
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const remSecs = (seconds % 60).toFixed(0);
        return `${mins}m ${remSecs}s`;
    };

    const getStatusBadge = (status) => {
        switch (status?.toLowerCase()) {
            case 'done':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                    </span>
                );
            case 'processing':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">
                        <Activity className="w-3.5 h-3.5 animate-spin" />
                        Processing
                    </span>
                );
            case 'pending':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Clock className="w-3.5 h-3.5" />
                        Pending
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <XCircle className="w-3.5 h-3.5" />
                        Failed
                    </span>
                );
            case 'cancelled':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
                        <Ban className="w-3.5 h-3.5" />
                        Cancelled
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-700/30 text-zinc-300 border border-zinc-700">
                        {status || 'Unknown'}
                    </span>
                );
        }
    };

    const getTypeBadge = (type) => {
        switch (type) {
            case 'interview_report':
                return <span className="text-purple-400 font-mono text-xs bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">interview_report</span>;
            case 'resume_html':
                return <span className="text-cyan-400 font-mono text-xs bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">resume_html</span>;
            case 'cover_letter':
                return <span className="text-indigo-400 font-mono text-xs bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">cover_letter</span>;
            case 'rewrite_section':
                return <span className="text-pink-400 font-mono text-xs bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">rewrite_section</span>;
            default:
                return <span className="text-zinc-400 font-mono text-xs bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">{type || 'job'}</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                        <Cpu className="w-7 h-7 text-indigo-400" />
                        Background Job Monitoring
                    </h1>
                    <p className="text-sm text-zinc-400 mt-1">
                        Monitor BullMQ workers, inspect AI generation tasks, track attempt counts, and manage job lifecycles safely.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchJobs}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium border border-zinc-700 transition"
                        title="Refresh job ledger"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
                        Refresh
                    </button>
                    <AdminExportButton 
                        moduleName="jobs"
                        filters={{
                            status: statusFilter,
                            type: typeFilter,
                            search: search.trim() || undefined,
                            startDate,
                            endDate
                        }}
                    />
                </div>
            </div>

            {/* Global Action Feedback Alert */}
            {actionFeedback && (
                <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-fade-in ${
                    actionFeedback.type === 'success' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                    <div className="flex items-center gap-2">
                        {actionFeedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                        <span>{actionFeedback.message}</span>
                    </div>
                    <button 
                        onClick={() => setActionFeedback(null)} 
                        className="text-zinc-400 hover:text-white transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Metrics & Queue Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Tasks</span>
                        <Cpu className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="text-2xl font-bold text-white mt-2">
                        {summary?.totalJobs?.toLocaleString() || 0}
                    </div>
                    <span className="text-[11px] text-zinc-500 mt-1 block">In database history</span>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Processing</span>
                        <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
                    </div>
                    <div className="text-2xl font-bold text-blue-400 mt-2">
                        {summary?.processingCount?.toLocaleString() || 0}
                    </div>
                    <span className="text-[11px] text-zinc-500 mt-1 block">Live in AI worker</span>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Pending</span>
                        <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-amber-400 mt-2">
                        {summary?.pendingCount?.toLocaleString() || 0}
                    </div>
                    <span className="text-[11px] text-zinc-500 mt-1 block">Waiting for slot</span>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Completed</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-400 mt-2">
                        {summary?.doneCount?.toLocaleString() || 0}
                    </div>
                    <span className="text-[11px] text-zinc-500 mt-1 block">Successfully resolved</span>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-rose-400 uppercase tracking-wider">Failed</span>
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-2xl font-bold text-rose-400 mt-2">
                        {summary?.failedCount?.toLocaleString() || 0}
                    </div>
                    <span className="text-[11px] text-zinc-500 mt-1 block">Eligible for retry</span>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">Success Rate</span>
                        <Zap className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-400 mt-2">
                        {summary?.successRate || 0}%
                    </div>
                    <span className="text-[11px] text-zinc-500 mt-1 block">
                        BullMQ: {queueMetrics?.activeWorkerCount > 0 ? 'Worker Active' : 'Standby'}
                    </span>
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search by Job ID, email, user..."
                            className="w-full pl-9 pr-3 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                        />
                    </div>

                    {/* Status Filter */}
                    <div>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="done">Completed (Done)</option>
                            <option value="failed">Failed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    {/* Type Filter */}
                    <div>
                        <select
                            value={typeFilter}
                            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                        >
                            <option value="">All Task Types</option>
                            <option value="interview_report">Interview Report</option>
                            <option value="resume_html">Resume HTML</option>
                            <option value="cover_letter">Cover Letter</option>
                            <option value="cover_letter_report">Cover Letter Report</option>
                            <option value="rewrite_section">Rewrite Section</option>
                        </select>
                    </div>

                    {/* Start Date */}
                    <div className="relative">
                        <Calendar className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-3 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                    </div>

                    {/* End Date & Reset */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Calendar className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                className="w-full pl-9 pr-3 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                            />
                        </div>
                        <button
                            onClick={handleResetFilters}
                            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium border border-zinc-700 transition"
                            title="Reset filters"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Jobs Ledger Table */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="py-20 text-center">
                        <Activity className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
                        <p className="text-sm text-zinc-400">Loading background tasks and queue state...</p>
                    </div>
                ) : error ? (
                    <div className="py-16 text-center">
                        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
                        <p className="text-sm text-rose-300 mb-3">{error}</p>
                        <button
                            onClick={fetchJobs}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium border border-zinc-700 transition"
                        >
                            Retry Loading
                        </button>
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="py-16 text-center">
                        <Cpu className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                        <p className="text-base font-medium text-zinc-300">No background tasks found</p>
                        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                            No jobs match your current search or filter criteria. Try resetting your filters.
                        </p>
                        <button
                            onClick={handleResetFilters}
                            className="mt-4 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium border border-zinc-700 transition"
                        >
                            Clear Filters
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-900/90 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Job ID & Task</th>
                                    <th className="py-3.5 px-4">User</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4">Attempts</th>
                                    <th className="py-3.5 px-4">Duration</th>
                                    <th className="py-3.5 px-4">Created</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 text-sm">
                                {jobs.map((job) => {
                                    const isRetryEligible = job.status === 'failed' || job.status === 'cancelled';
                                    const isCancelEligible = job.status === 'pending' || job.status === 'processing';
                                    const isActionLoading = actionLoadingId === (job._id || job.id);

                                    return (
                                        <tr key={job._id || job.id} className="hover:bg-zinc-800/30 transition">
                                            {/* Job ID & Task */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-mono text-xs text-zinc-300 tracking-wider">
                                                        {(job._id || job.id).slice(-8)}
                                                    </span>
                                                    <div>
                                                        {getTypeBadge(job.type)}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* User Identity */}
                                            <td className="py-3.5 px-4">
                                                {job.userId ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-zinc-200 flex items-center gap-1.5">
                                                            {job.userId.username || 'Unnamed'}
                                                            {job.userId.isDeleted && (
                                                                <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1 rounded">Archived</span>
                                                            )}
                                                        </span>
                                                        <span className="text-xs text-zinc-500">
                                                            {job.userId.email || '—'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-zinc-500">System Task</span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="py-3.5 px-4">
                                                {getStatusBadge(job.status)}
                                            </td>

                                            {/* Attempts */}
                                            <td className="py-3.5 px-4">
                                                <span className="inline-flex items-center gap-1 font-mono text-xs text-zinc-300 bg-zinc-800/70 px-2 py-0.5 rounded border border-zinc-700/60">
                                                    {job.attempts || 1} / 3
                                                </span>
                                            </td>

                                            {/* Duration */}
                                            <td className="py-3.5 px-4 font-mono text-xs text-zinc-300">
                                                {formatDuration(job.durationMs)}
                                            </td>

                                            {/* Created */}
                                            <td className="py-3.5 px-4 text-xs text-zinc-400 whitespace-nowrap">
                                                {job.createdAt ? new Date(job.createdAt).toLocaleString([], {
                                                    month: 'short',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                }) : '—'}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleInspectJob(job._id || job.id)}
                                                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                                                        title="Inspect Job"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {isRetryEligible && (
                                                        <button
                                                            onClick={() => handleOpenConfirm('retry', job)}
                                                            disabled={isActionLoading}
                                                            className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition disabled:opacity-50"
                                                            title="Retry Job"
                                                        >
                                                            <RotateCcw className={`w-4 h-4 ${isActionLoading ? 'animate-spin' : ''}`} />
                                                        </button>
                                                    )}

                                                    {isCancelEligible && (
                                                        <button
                                                            onClick={() => handleOpenConfirm('cancel', job)}
                                                            disabled={isActionLoading}
                                                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition disabled:opacity-50"
                                                            title="Cancel Job"
                                                        >
                                                            <Ban className={`w-4 h-4 ${isActionLoading ? 'animate-spin' : ''}`} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {jobs.length > 0 && (
                    <div className="border-t border-zinc-800 p-4">
                        <AdminPagination
                            currentPage={page}
                            totalPages={pagination.pages || 1}
                            totalItems={pagination.total || 0}
                            pageSize={20}
                            onPageChange={(p) => setPage(p)}
                        />
                    </div>
                )}
            </div>

            {/* Job Details Drawer Modal */}
            {(selectedJob || detailsLoading) && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-xl bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl">
                        <div>
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                        <Cpu className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-white">
                                            Job Details & Diagnostics
                                        </h3>
                                        <p className="text-xs text-zinc-500 font-mono">
                                            {selectedJob?._id || selectedJob?.id || 'Loading...'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedJob(null)}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {detailsLoading ? (
                                <div className="py-20 text-center">
                                    <Activity className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
                                    <p className="text-xs text-zinc-400">Loading diagnostic payload...</p>
                                </div>
                            ) : selectedJob && (
                                <div className="mt-6 space-y-6">
                                    {/* Status & Timing Grid */}
                                    <div className="grid grid-cols-2 gap-3 bg-zinc-800/40 p-3.5 rounded-xl border border-zinc-800">
                                        <div>
                                            <span className="text-xs text-zinc-400 block mb-1">Status</span>
                                            {getStatusBadge(selectedJob.status)}
                                        </div>
                                        <div>
                                            <span className="text-xs text-zinc-400 block mb-1">Task Type</span>
                                            {getTypeBadge(selectedJob.type)}
                                        </div>
                                        <div>
                                            <span className="text-xs text-zinc-400 block mb-1">Attempts</span>
                                            <span className="font-mono text-sm text-zinc-200">
                                                {selectedJob.attempts || 1}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-zinc-400 block mb-1">Execution Duration</span>
                                            <span className="font-mono text-sm text-zinc-200">
                                                {formatDuration(selectedJob.durationMs)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-zinc-400 block mb-1">Started At</span>
                                            <span className="text-xs text-zinc-300">
                                                {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString() : '—'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-zinc-400 block mb-1">Completed At</span>
                                            <span className="text-xs text-zinc-300">
                                                {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString() : '—'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* User Details */}
                                    <div className="bg-zinc-800/40 p-3.5 rounded-xl border border-zinc-800">
                                        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                                            <User className="w-3.5 h-3.5 text-zinc-400" />
                                            Requesting User
                                        </div>
                                        {selectedJob.userId ? (
                                            <div className="text-sm">
                                                <p className="text-zinc-200 font-medium">
                                                    {selectedJob.userId.username}
                                                </p>
                                                <p className="text-xs text-zinc-400">
                                                    {selectedJob.userId.email}
                                                </p>
                                                <p className="text-[11px] text-zinc-500 mt-1 font-mono">
                                                    ID: {selectedJob.userId._id || selectedJob.userId}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-zinc-400">System Internal Execution</p>
                                        )}
                                    </div>

                                    {/* BullMQ Metadata */}
                                    <div className="bg-zinc-800/40 p-3.5 rounded-xl border border-zinc-800">
                                        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                                            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                                            BullMQ Queue Metadata
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between py-1 border-b border-zinc-800/80">
                                                <span className="text-zinc-400">Queue Name:</span>
                                                <span className="font-mono text-zinc-200">ai-generation</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-zinc-800/80">
                                                <span className="text-zinc-400">Bull Job ID:</span>
                                                <span className="font-mono text-zinc-200">
                                                    {selectedJob.bullJobId || selectedJob._id}
                                                </span>
                                            </div>
                                            {selectedJob.bullJobState && (
                                                <div className="flex justify-between py-1">
                                                    <span className="text-zinc-400">Live BullMQ State:</span>
                                                    <span className="font-mono text-indigo-300">
                                                        {selectedJob.bullJobState}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Error Diagnostics (if failed) */}
                                    {selectedJob.error && (
                                        <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-xl">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-rose-300 mb-2 uppercase tracking-wider">
                                                <AlertCircle className="w-4 h-4 text-rose-400" />
                                                Error Diagnostic Summary
                                            </div>
                                            <p className="text-xs font-mono text-rose-200 whitespace-pre-wrap break-all bg-black/40 p-2.5 rounded border border-rose-500/20">
                                                {selectedJob.error}
                                            </p>
                                        </div>
                                    )}

                                    {/* Sanitized Payload Preview */}
                                    <div className="bg-zinc-800/40 p-3.5 rounded-xl border border-zinc-800">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                                <FileCode className="w-3.5 h-3.5 text-zinc-400" />
                                                Sanitized Input Parameters
                                            </span>
                                            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                                                Credentials Purged
                                            </span>
                                        </div>
                                        <pre className="text-xs font-mono text-zinc-300 bg-black/40 p-3 rounded-lg overflow-x-auto max-h-48 border border-zinc-800/80">
                                            {JSON.stringify(selectedJob.input || {}, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer Actions */}
                        {selectedJob && (
                            <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2 mt-6">
                                {(selectedJob.status === 'failed' || selectedJob.status === 'cancelled') && (
                                    <button
                                        onClick={() => handleOpenConfirm('retry', selectedJob)}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-sm font-medium rounded-lg border border-amber-500/30 transition"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Retry Job Safely
                                    </button>
                                )}
                                {(selectedJob.status === 'pending' || selectedJob.status === 'processing') && (
                                    <button
                                        onClick={() => handleOpenConfirm('cancel', selectedJob)}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-sm font-medium rounded-lg border border-rose-500/30 transition"
                                    >
                                        <Ban className="w-4 h-4" />
                                        Cancel Execution
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedJob(null)}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg border border-zinc-700 transition"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Confirmation Action Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-xl ${
                                confirmModal.action === 'retry'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                                {confirmModal.action === 'retry' ? <RotateCcw className="w-6 h-6" /> : <Ban className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">
                                    {confirmModal.action === 'retry' ? 'Confirm Job Retry' : 'Confirm Job Cancellation'}
                                </h3>
                                <p className="text-xs text-zinc-400">
                                    Target Task: <span className="font-mono text-zinc-200">{confirmModal.jobType}</span>
                                </p>
                            </div>
                        </div>

                        <p className="text-sm text-zinc-300 mb-4">
                            {confirmModal.action === 'retry'
                                ? 'Are you sure you want to retry this failed task? The system enforces strict idempotency and will update existing records without creating duplicates.'
                                : 'Are you sure you want to cancel this task? It will be removed from the BullMQ active queue and marked cancelled.'}
                        </p>

                        <div className="mb-4">
                            <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                                Reason for Audit Log (Optional)
                            </label>
                            <input
                                type="text"
                                value={confirmModal.reason}
                                onChange={(e) => setConfirmModal(prev => ({ ...prev, reason: e.target.value }))}
                                placeholder="e.g. Rate limit recovered / Manual intervention"
                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg border border-zinc-700 transition"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleExecuteAction}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                                    confirmModal.action === 'retry'
                                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                                }`}
                            >
                                {confirmModal.action === 'retry' ? 'Confirm Retry' : 'Confirm Cancellation'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminJobsTab;

