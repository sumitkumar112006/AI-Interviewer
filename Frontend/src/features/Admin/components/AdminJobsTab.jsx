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
    Zap,
    Copy,
    Check,
    RotateCw,
    XCircle
} from 'lucide-react';
import AdminPagination from './AdminPagination';
import { AdminExportButton } from './AdminExportButton';
import ShadcnDatePicker from './ShadcnDatePicker';

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

    // Clipboard Copy State
    const [copiedId, setCopiedId] = useState(null);

    // Action Confirmation Modal
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        action: null, // 'retry' | 'cancel'
        jobId: null,
        jobType: '',
        reason: ''
    });

    const handleCopy = (text, id) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

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

    const renderStatusBadge = (status) => {
        switch (status?.toLowerCase()) {
            case 'done':
                return (
                    <span className="jobs-status-badge status-done">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                    </span>
                );
            case 'processing':
                return (
                    <span className="jobs-status-badge status-processing">
                        <Activity className="w-3 h-3 animate-spin" />
                        Processing
                    </span>
                );
            case 'pending':
                return (
                    <span className="jobs-status-badge status-pending">
                        <Clock className="w-3 h-3" />
                        Pending
                    </span>
                );
            case 'failed':
                return (
                    <span className="jobs-status-badge status-failed">
                        <XCircle className="w-3 h-3" />
                        Failed
                    </span>
                );
            case 'cancelled':
                return (
                    <span className="jobs-status-badge status-cancelled">
                        <Ban className="w-3 h-3" />
                        Cancelled
                    </span>
                );
            default:
                return (
                    <span className="jobs-status-badge status-cancelled">
                        {status || 'Unknown'}
                    </span>
                );
        }
    };

    const renderTypeBadge = (type) => {
        const typeClass = `type-${type || 'default'}`;
        return (
            <span className={`jobs-type-badge ${typeClass}`}>
                {type || 'job'}
            </span>
        );
    };

    const isFiltered = Boolean(search || statusFilter || typeFilter || startDate || endDate);

    return (
        <div className="jobs-console-container">
            {/* 1. Header Section */}
            <div className="jobs-header">
                <div className="header-title-block">
                    <div className="title-row">
                        <div className="title-icon-badge">
                            <Cpu className="w-5 h-5" />
                        </div>
                        <h2>Background Job Monitoring</h2>
                        <div className="jobs-telemetry-badge">
                            <span className="pulse-dot" />
                            BullMQ Queue Active
                        </div>
                    </div>
                    <p className="header-subtitle">
                        Monitor BullMQ workers, inspect AI generation tasks, track attempt counts, and manage job lifecycles safely.
                    </p>
                </div>

                <div className="header-actions">
                    <button
                        onClick={fetchJobs}
                        disabled={loading}
                        className="action-btn refresh-btn"
                        title="Refresh job ledger"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
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

            {/* 2. Global Action Feedback Alert */}
            {actionFeedback && (
                <div className={`jobs-feedback-alert ${actionFeedback.type === 'success' ? 'variant-success' : 'variant-error'}`}>
                    <div className="alert-content">
                        {actionFeedback.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span>{actionFeedback.message}</span>
                    </div>
                    <button 
                        onClick={() => setActionFeedback(null)} 
                        className="close-alert-btn"
                        aria-label="Dismiss feedback"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* 3. Metrics Overview Cards Grid */}
            <div className="jobs-kpis-grid">
                <div className="kpi-stat-card variant-total">
                    <div className="card-header-mini">
                        <span className="card-label">Total Tasks</span>
                        <div className="icon-indicator">
                            <Cpu className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="card-value">
                        {summary?.totalJobs?.toLocaleString() || 0}
                    </div>
                    <span className="card-subtext">In database history</span>
                </div>

                <div className="kpi-stat-card variant-processing">
                    <div className="card-header-mini">
                        <span className="card-label">Processing</span>
                        <div className="icon-indicator">
                            <Activity className="w-4 h-4 animate-spin" />
                        </div>
                    </div>
                    <div className="card-value">
                        {summary?.processingCount?.toLocaleString() || 0}
                    </div>
                    <span className="card-subtext">Live in AI worker</span>
                </div>

                <div className="kpi-stat-card variant-pending">
                    <div className="card-header-mini">
                        <span className="card-label">Pending</span>
                        <div className="icon-indicator">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="card-value">
                        {summary?.pendingCount?.toLocaleString() || 0}
                    </div>
                    <span className="card-subtext">Waiting for slot</span>
                </div>

                <div className="kpi-stat-card variant-completed">
                    <div className="card-header-mini">
                        <span className="card-label">Completed</span>
                        <div className="icon-indicator">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="card-value">
                        {summary?.doneCount?.toLocaleString() || 0}
                    </div>
                    <span className="card-subtext">Successfully resolved</span>
                </div>

                <div className="kpi-stat-card variant-failed">
                    <div className="card-header-mini">
                        <span className="card-label">Failed</span>
                        <div className="icon-indicator">
                            <AlertCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="card-value">
                        {summary?.failedCount?.toLocaleString() || 0}
                    </div>
                    <span className="card-subtext">Eligible for retry</span>
                </div>

                <div className="kpi-stat-card variant-rate">
                    <div className="card-header-mini">
                        <span className="card-label">Success Rate</span>
                        <div className="icon-indicator">
                            <Zap className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="card-value">
                        {summary?.successRate || 0}%
                    </div>
                    <span className="card-subtext">
                        BullMQ: {queueMetrics?.activeWorkerCount > 0 ? 'Worker Active' : 'Standby'}
                    </span>
                </div>
            </div>

            {/* 4. Filters Toolbar Card */}
            <div className="jobs-filter-card">
                <div className="filter-grid">
                    {/* Search Input */}
                    <div className="search-box">
                        <Search className="w-4 h-4 search-icon" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search by Job ID, email, user..."
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="filter-select"
                        aria-label="Filter by job status"
                    >
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="done">Completed (Done)</option>
                        <option value="failed">Failed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>

                    {/* Task Type Filter */}
                    <select
                        value={typeFilter}
                        onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                        className="filter-select"
                        aria-label="Filter by task type"
                    >
                        <option value="">All Task Types</option>
                        <option value="interview_report">Interview Report</option>
                        <option value="resume_html">Resume HTML</option>
                        <option value="cover_letter">Cover Letter</option>
                        <option value="cover_letter_report">Cover Letter Report</option>
                        <option value="rewrite_section">Rewrite Section</option>
                    </select>

                    {/* Start Date */}
                    <ShadcnDatePicker
                        value={startDate}
                        onChange={(val) => { setStartDate(val); setPage(1); }}
                        placeholder="Start date"
                        maxDate={endDate}
                        ariaLabel="Filter start date"
                    />

                    {/* End Date */}
                    <ShadcnDatePicker
                        value={endDate}
                        onChange={(val) => { setEndDate(val); setPage(1); }}
                        placeholder="End date"
                        minDate={startDate}
                        ariaLabel="Filter end date"
                    />

                    {/* Reset Button */}
                    <button
                        onClick={handleResetFilters}
                        disabled={!isFiltered}
                        className="reset-filters-btn"
                        title="Clear all active filters"
                    >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                    </button>
                </div>
            </div>

            {/* 5. Jobs Ledger Table Container */}
            <div className="jobs-table-container">
                {loading ? (
                    <div className="table-state-box">
                        <div className="state-icon-wrap">
                            <Activity className="w-6 h-6 text-indigo-400 animate-spin" />
                        </div>
                        <h4>Loading Background Tasks</h4>
                        <p>Synchronizing active BullMQ queue state and task history from MongoDB...</p>
                    </div>
                ) : error ? (
                    <div className="table-state-box">
                        <div className="state-icon-wrap" style={{ color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.3)' }}>
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <h4>Failed to Load Jobs</h4>
                        <p>{error}</p>
                        <button onClick={fetchJobs} className="state-action-btn">
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Retry Connection</span>
                        </button>
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="table-state-box">
                        <div className="state-icon-wrap">
                            <Cpu className="w-6 h-6 text-slate-500" />
                        </div>
                        <h4>No Background Tasks Found</h4>
                        <p>
                            {isFiltered 
                                ? 'No background jobs match your current filter or search criteria.' 
                                : 'No background tasks have been executed yet in the system.'}
                        </p>
                        {isFiltered && (
                            <button onClick={handleResetFilters} className="state-action-btn">
                                <RotateCw className="w-3.5 h-3.5" />
                                <span>Reset Active Filters</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="table-responsive-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Job ID & Task</th>
                                    <th>User</th>
                                    <th>Status</th>
                                    <th>Attempts</th>
                                    <th>Duration</th>
                                    <th>Created At</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map((job) => {
                                    const rawId = job._id || job.id || '';
                                    const shortId = rawId.length > 8 ? rawId.slice(-8) : rawId;
                                    const isRetryEligible = job.status === 'failed' || job.status === 'cancelled';
                                    const isCancelEligible = job.status === 'pending' || job.status === 'processing';
                                    const isActionLoading = actionLoadingId === rawId;
                                    const isCopied = copiedId === rawId;

                                    return (
                                        <tr key={rawId}>
                                            {/* Job ID & Task */}
                                            <td>
                                                <div className="job-id-cell">
                                                    <div className="id-row">
                                                        <span className="id-text" title={rawId}>
                                                            {shortId}
                                                        </span>
                                                        <button
                                                            onClick={() => handleCopy(rawId, rawId)}
                                                            className="copy-id-btn"
                                                            title={isCopied ? 'Copied full ID!' : 'Copy full Job ID'}
                                                        >
                                                            {isCopied ? (
                                                                <Check className="w-3 h-3 text-emerald-400" />
                                                            ) : (
                                                                <Copy className="w-3 h-3" />
                                                            )}
                                                        </button>
                                                    </div>
                                                    <div>
                                                        {renderTypeBadge(job.type)}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* User Identity */}
                                            <td>
                                                <div className="user-cell">
                                                    {job.userId ? (
                                                        <>
                                                            <span className="user-name">
                                                                {job.userId.username || 'Unnamed'}
                                                                {job.userId.isDeleted && (
                                                                    <span className="archived-tag">Archived</span>
                                                                )}
                                                            </span>
                                                            <span className="user-email">
                                                                {job.userId.email || '—'}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="system-label">System Internal Task</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td>
                                                {renderStatusBadge(job.status)}
                                            </td>

                                            {/* Attempts */}
                                            <td>
                                                <span className="attempts-pill">
                                                    {job.attempts || 1} / 3
                                                </span>
                                            </td>

                                            {/* Duration */}
                                            <td>
                                                <span className="duration-cell">
                                                    {formatDuration(job.durationMs)}
                                                </span>
                                            </td>

                                            {/* Created */}
                                            <td>
                                                <span className="created-cell">
                                                    {job.createdAt ? new Date(job.createdAt).toLocaleString([], {
                                                        month: 'short',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    }) : '—'}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="action-cell">
                                                <div className="actions-group">
                                                    <button
                                                        onClick={() => handleInspectJob(rawId)}
                                                        className="icon-action-btn inspect-btn"
                                                        title="Inspect Job & Diagnostics"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {isRetryEligible && (
                                                        <button
                                                            onClick={() => handleOpenConfirm('retry', job)}
                                                            disabled={isActionLoading}
                                                            className="icon-action-btn retry-btn"
                                                            title="Retry Job Safely"
                                                        >
                                                            <RotateCcw className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
                                                        </button>
                                                    )}

                                                    {isCancelEligible && (
                                                        <button
                                                            onClick={() => handleOpenConfirm('cancel', job)}
                                                            disabled={isActionLoading}
                                                            className="icon-action-btn cancel-btn"
                                                            title="Cancel Execution"
                                                        >
                                                            <Ban className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
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

                {/* Bottom Pagination */}
                {jobs.length > 0 && (
                    <div className="table-pagination-strip">
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

            {/* 6. Job Details & Diagnostics Drawer */}
            {(selectedJob || detailsLoading) && (
                <div 
                    className="jobs-drawer-backdrop"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedJob(null);
                    }}
                >
                    <div className="jobs-drawer-panel">
                        {/* Drawer Header */}
                        <div className="drawer-header">
                            <div className="header-content">
                                <div className="drawer-icon-wrap">
                                    <Cpu className="w-5 h-5" />
                                </div>
                                <div className="title-text">
                                    <h3>Job Diagnostics & Payload</h3>
                                    <div className="job-id-subtitle">
                                        <span>{selectedJob?._id || selectedJob?.id || 'Loading...'}</span>
                                        {selectedJob && (
                                            <button
                                                onClick={() => handleCopy(selectedJob._id || selectedJob.id, 'drawer-id')}
                                                className="copy-mini-btn"
                                                title={copiedId === 'drawer-id' ? 'Copied!' : 'Copy Job ID'}
                                            >
                                                {copiedId === 'drawer-id' ? (
                                                    <Check className="w-3 h-3 text-emerald-400" />
                                                ) : (
                                                    <Copy className="w-3 h-3" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedJob(null)}
                                className="close-drawer-btn"
                                aria-label="Close drawer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="drawer-body">
                            {detailsLoading ? (
                                <div className="table-state-box">
                                    <Activity className="w-7 h-7 text-indigo-400 animate-spin mb-2" />
                                    <p>Loading diagnostic payload and BullMQ state...</p>
                                </div>
                            ) : selectedJob && (
                                <>
                                    {/* Timing & Diagnostics Grid */}
                                    <div className="diagnostics-grid">
                                        <div className="diag-item">
                                            <span className="diag-label">Current Status</span>
                                            <div>{renderStatusBadge(selectedJob.status)}</div>
                                        </div>
                                        <div className="diag-item">
                                            <span className="diag-label">Task Type</span>
                                            <div>{renderTypeBadge(selectedJob.type)}</div>
                                        </div>
                                        <div className="diag-item">
                                            <span className="diag-label">Execution Attempts</span>
                                            <span className="diag-value mono">
                                                {selectedJob.attempts || 1} / 3 Max
                                            </span>
                                        </div>
                                        <div className="diag-item">
                                            <span className="diag-label">Execution Duration</span>
                                            <span className="diag-value mono">
                                                {formatDuration(selectedJob.durationMs)}
                                            </span>
                                        </div>
                                        <div className="diag-item">
                                            <span className="diag-label">Started At</span>
                                            <span className="diag-value">
                                                {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString() : '—'}
                                            </span>
                                        </div>
                                        <div className="diag-item">
                                            <span className="diag-label">Completed At</span>
                                            <span className="diag-value">
                                                {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString() : '—'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Requesting User Card */}
                                    <div className="user-card-box">
                                        <div className="box-header">
                                            <User className="w-3.5 h-3.5 text-slate-400" />
                                            Requesting User Account
                                        </div>
                                        {selectedJob.userId ? (
                                            <div className="user-info">
                                                <span className="u-name">
                                                    {selectedJob.userId.username || 'Unnamed'}
                                                </span>
                                                <span className="u-email">
                                                    {selectedJob.userId.email || '—'}
                                                </span>
                                                <span className="u-id">
                                                    User ID: {selectedJob.userId._id || selectedJob.userId}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="u-email">System Internal Execution (No User Bound)</span>
                                        )}
                                    </div>

                                    {/* BullMQ Metadata Card */}
                                    <div className="bullmq-card-box">
                                        <div className="box-header">
                                            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                                            BullMQ Queue Metadata
                                        </div>
                                        <div className="meta-rows">
                                            <div className="meta-row">
                                                <span className="row-label">Queue Name</span>
                                                <span className="row-value">ai-generation</span>
                                            </div>
                                            <div className="meta-row">
                                                <span className="row-label">Bull Job ID</span>
                                                <span className="row-value">
                                                    {selectedJob.bullJobId || selectedJob._id}
                                                </span>
                                            </div>
                                            {selectedJob.bullJobState && (
                                                <div className="meta-row">
                                                    <span className="row-label">Live BullMQ State</span>
                                                    <span className="row-value highlight">
                                                        {selectedJob.bullJobState}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Error Diagnostic (if present) */}
                                    {selectedJob.error && (
                                        <div className="error-diag-box">
                                            <div className="error-header">
                                                <AlertCircle className="w-4 h-4 text-rose-400" />
                                                Error Diagnostic Summary
                                            </div>
                                            <div className="error-content">
                                                {selectedJob.error}
                                            </div>
                                        </div>
                                    )}

                                    {/* Sanitized Input Parameters */}
                                    <div className="payload-box">
                                        <div className="payload-header">
                                            <div className="title-wrap">
                                                <FileCode className="w-3.5 h-3.5 text-slate-400" />
                                                Sanitized Input Parameters
                                            </div>
                                            <span className="purged-badge">Credentials Purged</span>
                                        </div>
                                        <pre>
                                            {JSON.stringify(selectedJob.input || {}, null, 2)}
                                        </pre>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Drawer Footer Actions */}
                        {selectedJob && (
                            <div className="drawer-footer">
                                {(selectedJob.status === 'failed' || selectedJob.status === 'cancelled') && (
                                    <button
                                        onClick={() => handleOpenConfirm('retry', selectedJob)}
                                        className="drawer-action-btn retry-action"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Retry Job Safely</span>
                                    </button>
                                )}
                                {(selectedJob.status === 'pending' || selectedJob.status === 'processing') && (
                                    <button
                                        onClick={() => handleOpenConfirm('cancel', selectedJob)}
                                        className="drawer-action-btn cancel-action"
                                    >
                                        <Ban className="w-3.5 h-3.5" />
                                        <span>Cancel Execution</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedJob(null)}
                                    className="drawer-action-btn close-action"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 7. Action Confirmation Modal */}
            {confirmModal.isOpen && (
                <div 
                    className="jobs-confirm-modal"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header-row">
                            <div className={`modal-icon-badge ${
                                confirmModal.action === 'retry' ? 'variant-retry' : 'variant-cancel'
                            }`}>
                                {confirmModal.action === 'retry' ? (
                                    <RotateCcw className="w-5 h-5" />
                                ) : (
                                    <Ban className="w-5 h-5" />
                                )}
                            </div>
                            <div className="modal-title-text">
                                <h3>
                                    {confirmModal.action === 'retry' ? 'Confirm Safe Job Retry' : 'Confirm Job Cancellation'}
                                </h3>
                                <div className="target-task">
                                    Target Task: <span>{confirmModal.jobType}</span>
                                </div>
                            </div>
                        </div>

                        <p className="modal-desc">
                            {confirmModal.action === 'retry'
                                ? 'Are you sure you want to retry this failed task? The system enforces strict deduplication guarantees and will update existing records without creating duplicates.'
                                : 'Are you sure you want to cancel this task? It will be removed from the active BullMQ queue and marked as cancelled.'}
                        </p>

                        <div className="reason-input-group">
                            <label htmlFor="job-audit-reason">
                                Reason for Audit Log (Optional)
                            </label>
                            <input
                                id="job-audit-reason"
                                type="text"
                                value={confirmModal.reason}
                                onChange={(e) => setConfirmModal(prev => ({ ...prev, reason: e.target.value }))}
                                placeholder="e.g. Upstream model rate-limit resolved / Manual admin intervention"
                            />
                        </div>

                        <div className="modal-footer">
                            <button
                                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                className="btn-modal-cancel"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleExecuteAction}
                                className={`btn-modal-confirm ${
                                    confirmModal.action === 'retry' ? 'variant-retry' : 'variant-cancel'
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
