import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    getAdminSupportTickets,
    getAdminSupportTicketDetails,
    assignAdminSupportTicket,
    updateAdminSupportTicketStatus,
    addAdminSupportTicketNote,
    replyAdminSupportTicket,
    getAdminUsers
} from '../services/admin.api';
import {
    LifeBuoy,
    CheckCircle2,
    AlertCircle,
    Clock,
    Search,
    Eye,
    X,
    User,
    RefreshCw,
    MessageSquare,
    Send,
    Lock,
    Shield,
    Tag,
    UserCheck,
    AlertTriangle,
    Mail,
    ChevronDown,
    RotateCcw,
    Sparkles,
    CheckCheck,
    Copy,
    CornerDownRight
} from 'lucide-react';
import AdminPagination from './AdminPagination';
import { AdminExportButton } from './AdminExportButton';
import ShadcnDatePicker from './ShadcnDatePicker';

export const AdminSupportTicketsTab = () => {
    const [tickets, setTickets] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [adminUsers, setAdminUsers] = useState([]);

    // Filters & Pagination
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });

    // Drawer State
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [ticketDetails, setTicketDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [activeDrawerTab, setActiveDrawerTab] = useState('conversation'); // 'conversation' | 'notes'

    // Form states inside drawer
    const [replyMessage, setReplyMessage] = useState('');
    const [replyStatus, setReplyStatus] = useState('');
    const [sendEmailNotify, setSendEmailNotify] = useState(true);
    const [submittingReply, setSubmittingReply] = useState(false);

    const [internalNoteText, setInternalNoteText] = useState('');
    const [submittingNote, setSubmittingNote] = useState(false);

    const [actionFeedback, setActionFeedback] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    // Fetch Tickets
    const fetchTickets = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getAdminSupportTickets({
                page,
                limit: 20,
                status: statusFilter || undefined,
                priority: priorityFilter || undefined,
                category: categoryFilter || undefined,
                search: search.trim() || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            });

            if (res.success) {
                setTickets(res.tickets || []);
                setSummary(res.summary || null);
                setPagination(res.pagination || { total: 0, pages: 1, limit: 20 });
            } else {
                setError(res.message || 'Failed to retrieve support tickets.');
            }
        } catch (err) {
            console.error('Failed to load support tickets:', err);
            setError(err?.response?.data?.message || err?.message || 'Failed to load support tickets.');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, priorityFilter, categoryFilter, search, startDate, endDate]);

    // Fetch Admins list for assignment dropdown
    const fetchAdmins = useCallback(async () => {
        try {
            const res = await getAdminUsers({ role: 'admin', limit: 50 });
            if (res.success) {
                setAdminUsers(res.users || []);
            }
        } catch (_) {}
    }, []);

    useEffect(() => {
        fetchTickets();
        fetchAdmins();
    }, [fetchTickets, fetchAdmins]);

    const handleResetFilters = () => {
        setSearch('');
        setStatusFilter('');
        setPriorityFilter('');
        setCategoryFilter('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    // Open & Load Details
    const handleOpenTicket = async (ticketId) => {
        try {
            setSelectedTicketId(ticketId);
            setDetailsLoading(true);
            setTicketDetails(null);
            setReplyMessage('');
            setInternalNoteText('');
            setActionFeedback(null);

            const res = await getAdminSupportTicketDetails(ticketId);
            if (res.success) {
                setTicketDetails(res.ticket);
                setReplyStatus(res.ticket.status);
            } else {
                setActionFeedback({ type: 'error', message: res.message || 'Failed to load ticket details.' });
            }
        } catch (err) {
            console.error('Error inspecting ticket:', err);
            setActionFeedback({ type: 'error', message: err?.response?.data?.message || 'Error loading ticket details.' });
        } finally {
            setDetailsLoading(false);
        }
    };

    // Update Status or Priority
    const handleUpdateStatusOrPriority = async (newStatus, newPriority) => {
        if (!selectedTicketId) return;
        try {
            const res = await updateAdminSupportTicketStatus(selectedTicketId, {
                status: newStatus || undefined,
                priority: newPriority || undefined
            });
            if (res.success) {
                setTicketDetails(prev => ({
                    ...prev,
                    status: res.ticket.status,
                    priority: res.ticket.priority
                }));
                setActionFeedback({ type: 'success', message: res.message || 'Ticket triage updated.' });
                fetchTickets();
            }
        } catch (err) {
            setActionFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to update ticket.' });
        }
    };

    // Assign Ticket
    const handleAssignTicket = async (adminId) => {
        if (!selectedTicketId) return;
        try {
            const res = await assignAdminSupportTicket(selectedTicketId, adminId || null);
            if (res.success) {
                setTicketDetails(prev => ({
                    ...prev,
                    assignedAdmin: res.ticket.assignedAdmin
                }));
                setActionFeedback({ type: 'success', message: res.message || 'Staff assignment updated.' });
                fetchTickets();
            }
        } catch (err) {
            setActionFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to update assignment.' });
        }
    };

    // Submit Staff Reply
    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!replyMessage.trim() || !selectedTicketId) return;

        try {
            setSubmittingReply(true);
            const res = await replyAdminSupportTicket(selectedTicketId, {
                message: replyMessage.trim(),
                status: replyStatus || undefined,
                sendEmail: sendEmailNotify
            });

            if (res.success) {
                setTicketDetails(prev => ({
                    ...prev,
                    status: res.ticket.status,
                    responseHistory: res.ticket.responseHistory
                }));
                setReplyMessage('');
                setActionFeedback({
                    type: 'success',
                    message: res.emailDelivered 
                        ? 'Response posted and verified email notification delivered to customer!' 
                        : 'Response posted successfully to ticket conversation.'
                });
                fetchTickets();
            }
        } catch (err) {
            setActionFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to post response.' });
        } finally {
            setSubmittingReply(false);
        }
    };

    // Submit Internal Staff Note
    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!internalNoteText.trim() || !selectedTicketId) return;

        try {
            setSubmittingNote(true);
            const res = await addAdminSupportTicketNote(selectedTicketId, internalNoteText.trim());
            if (res.success) {
                setTicketDetails(prev => ({
                    ...prev,
                    internalNotes: res.internalNotes
                }));
                setInternalNoteText('');
                setActionFeedback({ type: 'success', message: 'Internal staff note recorded.' });
            }
        } catch (err) {
            setActionFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to add note.' });
        } finally {
            setSubmittingNote(false);
        }
    };

    const handleCopyId = (ticketId) => {
        navigator.clipboard.writeText(ticketId);
        setCopiedId(ticketId);
        setTimeout(() => setCopiedId(null), 1800);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'OPEN':
                return (
                    <span className="status-badge status-open">
                        <Clock size={12} />
                        Open
                    </span>
                );
            case 'IN_PROGRESS':
                return (
                    <span className="status-badge status-progress">
                        <RefreshCw size={12} />
                        In Progress
                    </span>
                );
            case 'WAITING_FOR_USER':
                return (
                    <span className="status-badge status-waiting">
                        <UserCheck size={12} />
                        Waiting for User
                    </span>
                );
            case 'RESOLVED':
                return (
                    <span className="status-badge status-resolved">
                        <CheckCircle2 size={12} />
                        Resolved
                    </span>
                );
            case 'CLOSED':
                return (
                    <span className="status-badge status-closed">
                        Closed
                    </span>
                );
            default:
                return (
                    <span className="status-badge status-closed">
                        {status || 'Unknown'}
                    </span>
                );
        }
    };

    const getPriorityBadge = (priority) => {
        switch (priority) {
            case 'Urgent':
                return <span className="priority-badge priority-urgent">Urgent</span>;
            case 'High':
                return <span className="priority-badge priority-high">High</span>;
            case 'Normal':
                return <span className="priority-badge priority-normal">Normal</span>;
            case 'Low':
                return <span className="priority-badge priority-low">Low</span>;
            default:
                return <span className="priority-badge priority-normal">{priority}</span>;
        }
    };

    const isFiltered = Boolean(search || statusFilter || priorityFilter || categoryFilter || startDate || endDate);

    return (
        <div className="support-console-container">
            {/* ── 1. Header Section ─────────────────────────────────────────────────── */}
            <div className="support-header">
                <div className="header-title-block">
                    <div className="title-row">
                        <h2>Support Ticket Inbox & Resolution Desk</h2>
                        <span className="support-telemetry-badge">
                            <span className="pulse-dot"></span>
                            Live Inbox
                        </span>
                    </div>
                    <p className="header-subtitle">
                        Triage customer inquiries, coordinate staff assignments, post verified responses, and record private internal notes.
                    </p>
                </div>

                <div className="header-actions">
                    <button
                        onClick={fetchTickets}
                        disabled={loading}
                        className="action-btn"
                        title="Refresh support inbox"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-400' : ''} />
                        <span>Refresh</span>
                    </button>

                    <AdminExportButton 
                        moduleName="support-tickets"
                        filters={{
                            status: statusFilter,
                            priority: priorityFilter,
                            category: categoryFilter,
                            search: search.trim() || undefined,
                            startDate,
                            endDate
                        }}
                    />
                </div>
            </div>

            {/* ── 2. Metrics Overview Cards Grid ──────────────────────────────────── */}
            <div className="support-kpis-grid">
                <div className="kpi-stat-card variant-total">
                    <div className="card-header-mini">
                        <span className="card-label">Total Tickets</span>
                        <div className="icon-indicator">
                            <LifeBuoy size={14} />
                        </div>
                    </div>
                    <span className="card-value">{summary?.totalTickets?.toLocaleString() || 0}</span>
                </div>

                <div className="kpi-stat-card variant-open">
                    <div className="card-header-mini">
                        <span className="card-label">Open</span>
                        <div className="icon-indicator">
                            <Clock size={14} />
                        </div>
                    </div>
                    <span className="card-value">{summary?.openCount?.toLocaleString() || 0}</span>
                </div>

                <div className="kpi-stat-card variant-progress">
                    <div className="card-header-mini">
                        <span className="card-label">In Progress</span>
                        <div className="icon-indicator">
                            <RefreshCw size={14} />
                        </div>
                    </div>
                    <span className="card-value">{summary?.inProgressCount?.toLocaleString() || 0}</span>
                </div>

                <div className="kpi-stat-card variant-waiting">
                    <div className="card-header-mini">
                        <span className="card-label">Waiting on User</span>
                        <div className="icon-indicator">
                            <UserCheck size={14} />
                        </div>
                    </div>
                    <span className="card-value">{summary?.waitingCount?.toLocaleString() || 0}</span>
                </div>

                <div className="kpi-stat-card variant-resolved">
                    <div className="card-header-mini">
                        <span className="card-label">Resolved</span>
                        <div className="icon-indicator">
                            <CheckCircle2 size={14} />
                        </div>
                    </div>
                    <span className="card-value">{summary?.resolvedCount?.toLocaleString() || 0}</span>
                </div>

                <div className="kpi-stat-card variant-closed">
                    <div className="card-header-mini">
                        <span className="card-label">Closed</span>
                        <div className="icon-indicator">
                            <AlertCircle size={14} />
                        </div>
                    </div>
                    <span className="card-value">{summary?.closedCount?.toLocaleString() || 0}</span>
                </div>

                <div className="kpi-stat-card variant-urgent">
                    <div className="card-header-mini">
                        <span className="card-label">Urgent</span>
                        <div className="icon-indicator">
                            <AlertTriangle size={14} />
                        </div>
                    </div>
                    <span className="card-value">{summary?.urgentCount?.toLocaleString() || 0}</span>
                </div>
            </div>

            {/* ── 3. Filter Toolbar Card ──────────────────────────────────────────── */}
            <div className="support-filter-card">
                <div className="filter-grid">
                    {/* Search */}
                    <div className="search-box">
                        <Search size={14} className="search-icon" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search by Ticket ID, customer name, email, subject..."
                        />
                    </div>

                    {/* Status */}
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="filter-select"
                    >
                        <option value="">All Statuses</option>
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="WAITING_FOR_USER">Waiting for User</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                    </select>

                    {/* Priority */}
                    <select
                        value={priorityFilter}
                        onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                        className="filter-select"
                    >
                        <option value="">All Priorities</option>
                        <option value="Urgent">Urgent</option>
                        <option value="High">High</option>
                        <option value="Normal">Normal</option>
                        <option value="Low">Low</option>
                    </select>

                    {/* Category */}
                    <select
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                        className="filter-select"
                    >
                        <option value="">All Categories</option>
                        <option value="Technical Bug / Issue">Technical Bug</option>
                        <option value="Billing & Payments">Billing & Payments</option>
                        <option value="Account Access">Account Access</option>
                        <option value="Feature Request">Feature Request</option>
                        <option value="General Support">General Support</option>
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
                        <RotateCcw size={13} />
                        <span>Reset Filters</span>
                    </button>
                </div>
            </div>

            {/* ── 4. Main Data Table ──────────────────────────────────────────────── */}
            <div className="support-table-container">
                {loading ? (
                    <div className="table-loading-box">
                        <RefreshCw size={28} className="animate-spin text-cyan-400" />
                        <h4>Loading Support Inbox...</h4>
                        <p>Aggregating customer inquiries and resolution metrics.</p>
                    </div>
                ) : error ? (
                    <div className="table-error-box">
                        <AlertCircle size={28} className="text-rose-400" />
                        <h4>Failed to Load Tickets</h4>
                        <p>{error}</p>
                        <button onClick={fetchTickets} className="action-btn mt-2">
                            <RefreshCw size={12} /> Retry
                        </button>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="table-empty-box">
                        <LifeBuoy size={32} className="text-slate-600" />
                        <h4>No Support Tickets Found</h4>
                        <p>
                            {isFiltered 
                                ? 'No inquiries match your current filter parameters. Try clearing your filters.' 
                                : 'Your support inbox is currently clear of open customer inquiries.'}
                        </p>
                        {isFiltered && (
                            <button onClick={handleResetFilters} className="action-btn mt-2">
                                <RotateCcw size={12} /> Clear Filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="table-responsive-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Ticket ID</th>
                                    <th>Customer</th>
                                    <th>Subject & Category</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Assigned Staff</th>
                                    <th>Created</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.map((t) => (
                                    <tr key={t._id || t.ticketId}>
                                        <td className="ticket-id-col">
                                            <div className="flex items-center gap-1.5">
                                                <span>{t.ticketId}</span>
                                                <button
                                                    onClick={() => handleCopyId(t.ticketId)}
                                                    className="text-slate-500 hover:text-slate-300 transition"
                                                    title="Copy Ticket ID"
                                                >
                                                    {copiedId === t.ticketId ? (
                                                        <CheckCheck size={12} className="text-emerald-400" />
                                                    ) : (
                                                        <Copy size={12} />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="customer-cell">
                                                <span className="customer-name">
                                                    {t.name || 'Anonymous'}
                                                    {t.userId?.isDeleted && (
                                                        <span className="archived-tag">Archived</span>
                                                    )}
                                                </span>
                                                <span className="customer-email">
                                                    {t.email}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="subject-cell">
                                                <span className="subject-line" title={t.subject}>
                                                    {t.subject || 'Support Request'}
                                                </span>
                                                <span className="category-line">
                                                    {t.category || 'General Support'}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            {getPriorityBadge(t.priority)}
                                        </td>
                                        <td>
                                            {getStatusBadge(t.status)}
                                        </td>
                                        <td>
                                            <div className="assigned-cell">
                                                {t.assignedAdmin ? (
                                                    <span className="admin-pill">
                                                        <UserCheck size={13} className="text-cyan-400" />
                                                        {t.assignedAdmin.username}
                                                    </span>
                                                ) : (
                                                    <span className="unassigned-text">Unassigned</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="created-cell">
                                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString([], {
                                                month: 'short',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : '—'}
                                        </td>
                                        <td className="action-cell">
                                            <button
                                                onClick={() => handleOpenTicket(t.ticketId)}
                                                className="inspect-btn"
                                                title="Inspect conversation and triage"
                                            >
                                                <Eye size={13} />
                                                <span>Inspect</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {tickets.length > 0 && (
                    <div className="p-3 border-t border-slate-800/80">
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

            {/* ── 5. Slide-In Inspection & Triage Drawer ──────────────────────────── */}
            {(selectedTicketId || detailsLoading) && (
                <div className="support-drawer-backdrop" onClick={(e) => {
                    if (e.target === e.currentTarget) setSelectedTicketId(null);
                }}>
                    <div className="support-drawer-panel">
                        {/* Drawer Header */}
                        <div>
                            <div className="drawer-header">
                                <div className="drawer-title-group">
                                    <div className="header-icon">
                                        <LifeBuoy size={18} />
                                    </div>
                                    <div className="title-text">
                                        <div className="ticket-title-row">
                                            <h3>Ticket #{selectedTicketId}</h3>
                                            {ticketDetails && getStatusBadge(ticketDetails.status)}
                                        </div>
                                        <p>{ticketDetails?.subject || 'Support Ticket Details & Triage'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedTicketId(null)}
                                    className="close-drawer-btn"
                                    title="Close inspection drawer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Action Feedback Banner */}
                            {actionFeedback && (
                                <div style={{
                                    margin: '1rem 1.5rem 0 1.5rem',
                                    padding: '0.65rem 0.85rem',
                                    borderRadius: '0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    backgroundColor: actionFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                                    border: `1px solid ${actionFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)'}`,
                                    color: actionFeedback.type === 'success' ? '#6ee7b7' : '#fca5a5'
                                }}>
                                    <span>{actionFeedback.message}</span>
                                    <button onClick={() => setActionFeedback(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                                        <X size={13} />
                                    </button>
                                </div>
                            )}

                            {detailsLoading ? (
                                <div style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
                                    <RefreshCw size={28} className="animate-spin text-cyan-400 mx-auto mb-2" />
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Loading conversation history...</p>
                                </div>
                            ) : ticketDetails && (
                                <div className="drawer-body">
                                    {/* Quick Triage Controls */}
                                    <div className="triage-controls-strip">
                                        <div className="triage-field">
                                            <label>Status</label>
                                            <select
                                                value={ticketDetails.status}
                                                onChange={(e) => handleUpdateStatusOrPriority(e.target.value, null)}
                                            >
                                                <option value="OPEN">Open</option>
                                                <option value="IN_PROGRESS">In Progress</option>
                                                <option value="WAITING_FOR_USER">Waiting for User</option>
                                                <option value="RESOLVED">Resolved</option>
                                                <option value="CLOSED">Closed</option>
                                            </select>
                                        </div>

                                        <div className="triage-field">
                                            <label>Priority</label>
                                            <select
                                                value={ticketDetails.priority}
                                                onChange={(e) => handleUpdateStatusOrPriority(null, e.target.value)}
                                            >
                                                <option value="Low">Low</option>
                                                <option value="Normal">Normal</option>
                                                <option value="High">High</option>
                                                <option value="Urgent">Urgent</option>
                                            </select>
                                        </div>

                                        <div className="triage-field">
                                            <label>Assignee</label>
                                            <select
                                                value={ticketDetails.assignedAdmin?._id || ''}
                                                onChange={(e) => handleAssignTicket(e.target.value)}
                                            >
                                                <option value="">Unassigned</option>
                                                {adminUsers.map(admin => (
                                                    <option key={admin._id} value={admin._id}>
                                                        {admin.username} ({admin.email})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Customer Overview Card */}
                                    <div className="customer-card-box">
                                        <div className="customer-side">
                                            <span className="label-mini">Customer</span>
                                            <span className="name-val">{ticketDetails.name}</span>
                                            <span className="email-val">{ticketDetails.email}</span>
                                        </div>
                                        <div className="account-side">
                                            <span className="label-mini">Account Plan</span>
                                            <span className="plan-val">{ticketDetails.userId?.plan || 'Free'}</span>
                                            <span className="category-val">Category: {ticketDetails.category}</span>
                                        </div>
                                    </div>

                                    {/* Tabs */}
                                    <div className="drawer-tabs-row">
                                        <button
                                            type="button"
                                            onClick={() => setActiveDrawerTab('conversation')}
                                            className={`drawer-tab-btn ${activeDrawerTab === 'conversation' ? 'active' : ''}`}
                                        >
                                            <MessageSquare size={14} />
                                            <span>Customer Discussion ({ticketDetails.responseHistory?.length || 0})</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setActiveDrawerTab('notes')}
                                            className={`drawer-tab-btn notes-tab ${activeDrawerTab === 'notes' ? 'active' : ''}`}
                                        >
                                            <Lock size={14} />
                                            <span>Internal Staff Notes ({ticketDetails.internalNotes?.length || 0})</span>
                                        </button>
                                    </div>

                                    {/* TAB 1: Customer Conversation Stream */}
                                    {activeDrawerTab === 'conversation' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div className="conversation-stream">
                                                {/* Initial Ticket Message */}
                                                <div className="chat-bubble user-bubble">
                                                    <div className="bubble-meta">
                                                        <span className="author">
                                                            <User size={13} />
                                                            {ticketDetails.name} (Initial Inquiry)
                                                        </span>
                                                        <span className="timestamp">
                                                            {new Date(ticketDetails.createdAt).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <p>{ticketDetails.message}</p>
                                                </div>

                                                {/* Response History Entries */}
                                                {ticketDetails.responseHistory?.map((msg, idx) => {
                                                    const isAdmin = msg.senderType === 'admin';
                                                    return (
                                                        <div
                                                            key={msg._id || idx}
                                                            className={`chat-bubble ${isAdmin ? 'staff-bubble' : 'user-bubble'}`}
                                                        >
                                                            <div className="bubble-meta">
                                                                <span className="author">
                                                                    {isAdmin ? <Shield size={13} /> : <User size={13} />}
                                                                    {msg.senderName} {isAdmin && '(Support Staff)'}
                                                                </span>
                                                                <span className="timestamp">
                                                                    {new Date(msg.createdAt).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <p>{msg.message}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Reply Box */}
                                            <form onSubmit={handleSendReply} className="reply-form-box">
                                                <label>Send Verified Staff Reply</label>
                                                <textarea
                                                    rows={3}
                                                    value={replyMessage}
                                                    onChange={(e) => setReplyMessage(e.target.value)}
                                                    placeholder="Type official response to customer. Will be appended to the ticket thread..."
                                                    required
                                                />

                                                <div className="reply-actions-row">
                                                    <label className="email-toggle-check">
                                                        <input
                                                            type="checkbox"
                                                            checked={sendEmailNotify}
                                                            onChange={(e) => setSendEmailNotify(e.target.checked)}
                                                        />
                                                        <span>Dispatch verified email notification to customer</span>
                                                    </label>

                                                    <button
                                                        type="submit"
                                                        disabled={submittingReply || !replyMessage.trim()}
                                                        className="send-reply-btn"
                                                    >
                                                        <Send size={13} />
                                                        <span>{submittingReply ? 'Dispatching...' : 'Send Response'}</span>
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    )}

                                    {/* TAB 2: Private Internal Staff Notes */}
                                    {activeDrawerTab === 'notes' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div className="conversation-stream">
                                                {(!ticketDetails.internalNotes || ticketDetails.internalNotes.length === 0) ? (
                                                    <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.78rem' }}>
                                                        No internal notes recorded yet. Internal notes are private and never visible to the customer.
                                                    </div>
                                                ) : (
                                                    ticketDetails.internalNotes.map((note, idx) => (
                                                        <div key={note._id || idx} className="chat-bubble internal-note-bubble">
                                                            <div className="bubble-meta">
                                                                <span className="author">
                                                                    <Lock size={12} />
                                                                    {note.authorName} (Internal Note)
                                                                </span>
                                                                <span className="timestamp">
                                                                    {new Date(note.createdAt).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <p>{note.note}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* Add Note Form */}
                                            <form onSubmit={handleAddNote} className="reply-form-box">
                                                <label style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                    <Lock size={13} />
                                                    Add Private Internal Staff Note
                                                </label>
                                                <textarea
                                                    rows={2}
                                                    value={internalNoteText}
                                                    onChange={(e) => setInternalNoteText(e.target.value)}
                                                    placeholder="Log customer history, investigation observations, or escalation thoughts..."
                                                    required
                                                />
                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button
                                                        type="submit"
                                                        disabled={submittingNote || !internalNoteText.trim()}
                                                        className="send-reply-btn"
                                                        style={{ background: '#d97706' }}
                                                    >
                                                        <Lock size={12} />
                                                        <span>{submittingNote ? 'Saving...' : 'Add Private Note'}</span>
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="drawer-footer">
                            <button
                                onClick={() => setSelectedTicketId(null)}
                                className="drawer-close-btn"
                            >
                                Close Inspection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSupportTicketsTab;
