import React, { useEffect, useState, useCallback } from 'react';
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
    Calendar,
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
    FileText,
    ExternalLink
} from 'lucide-react';
import AdminPagination from './AdminPagination';
import { AdminExportButton } from './AdminExportButton';

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
                setActionFeedback({ type: 'success', message: res.message });
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
                setActionFeedback({ type: 'success', message: res.message });
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
                        ? 'Response posted and email notification sent to customer!' 
                        : 'Response posted successfully to ticket thread.'
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

    const getStatusBadge = (status) => {
        switch (status) {
            case 'OPEN':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        <Clock className="w-3.5 h-3.5" />
                        Open
                    </span>
                );
            case 'IN_PROGRESS':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <RefreshCw className="w-3.5 h-3.5" />
                        In Progress
                    </span>
                );
            case 'WAITING_FOR_USER':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                        <UserCheck className="w-3.5 h-3.5" />
                        Waiting for User
                    </span>
                );
            case 'RESOLVED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolved
                    </span>
                );
            case 'CLOSED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
                        Closed
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

    const getPriorityBadge = (priority) => {
        switch (priority) {
            case 'Urgent':
                return <span className="text-xs font-semibold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">Urgent</span>;
            case 'High':
                return <span className="text-xs font-semibold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">High</span>;
            case 'Normal':
                return <span className="text-xs font-medium text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">Normal</span>;
            case 'Low':
                return <span className="text-xs font-medium text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/50">Low</span>;
            default:
                return <span className="text-xs text-zinc-400">{priority}</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                        <LifeBuoy className="w-7 h-7 text-indigo-400" />
                        Support Ticket Inbox
                    </h1>
                    <p className="text-sm text-zinc-400 mt-1">
                        Manage customer inquiries, assign support staff, log internal notes, and deliver verified email responses.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchTickets}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium border border-zinc-700 transition"
                        title="Refresh tickets"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
                        Refresh
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

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Total Inquiries</span>
                    <div className="text-2xl font-bold text-white mt-1">
                        {summary?.totalTickets?.toLocaleString() || 0}
                    </div>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider block">Open</span>
                    <div className="text-2xl font-bold text-blue-400 mt-1">
                        {summary?.openCount?.toLocaleString() || 0}
                    </div>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">In Progress</span>
                    <div className="text-2xl font-bold text-amber-400 mt-1">
                        {summary?.inProgressCount?.toLocaleString() || 0}
                    </div>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-purple-400 uppercase tracking-wider block">Waiting on User</span>
                    <div className="text-2xl font-bold text-purple-400 mt-1">
                        {summary?.waitingCount?.toLocaleString() || 0}
                    </div>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">Resolved</span>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">
                        {summary?.resolvedCount?.toLocaleString() || 0}
                    </div>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Closed</span>
                    <div className="text-2xl font-bold text-zinc-400 mt-1">
                        {summary?.closedCount?.toLocaleString() || 0}
                    </div>
                </div>

                <div className="bg-zinc-900/70 border border-rose-900/40 rounded-xl p-3.5 bg-rose-500/5">
                    <span className="text-[11px] font-medium text-rose-400 uppercase tracking-wider block">Urgent Priority</span>
                    <div className="text-2xl font-bold text-rose-400 mt-1">
                        {summary?.urgentCount?.toLocaleString() || 0}
                    </div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                    {/* Search */}
                    <div className="relative lg:col-span-2">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search by Ticket ID, customer, email, subject..."
                            className="w-full pl-9 pr-3 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                        >
                            <option value="">All Statuses</option>
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="WAITING_FOR_USER">Waiting for User</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="CLOSED">Closed</option>
                        </select>
                    </div>

                    {/* Priority */}
                    <div>
                        <select
                            value={priorityFilter}
                            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                        >
                            <option value="">All Priorities</option>
                            <option value="Urgent">Urgent</option>
                            <option value="High">High</option>
                            <option value="Normal">Normal</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>

                    {/* Category */}
                    <div>
                        <select
                            value={categoryFilter}
                            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                        >
                            <option value="">All Categories</option>
                            <option value="Technical Bug / Issue">Technical Bug</option>
                            <option value="Billing & Payments">Billing & Payments</option>
                            <option value="Account Access">Account Access</option>
                            <option value="Feature Request">Feature Request</option>
                            <option value="General Support">General Support</option>
                        </select>
                    </div>

                    {/* Reset Button */}
                    <div>
                        <button
                            onClick={handleResetFilters}
                            className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium border border-zinc-700 transition"
                        >
                            Reset Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Tickets Table */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="py-20 text-center">
                        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
                        <p className="text-sm text-zinc-400">Loading support inbox...</p>
                    </div>
                ) : error ? (
                    <div className="py-16 text-center">
                        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
                        <p className="text-sm text-rose-300 mb-3">{error}</p>
                        <button
                            onClick={fetchTickets}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium border border-zinc-700 transition"
                        >
                            Retry
                        </button>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="py-16 text-center">
                        <LifeBuoy className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                        <p className="text-base font-medium text-zinc-300">No support tickets found</p>
                        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                            No tickets match your search or filter criteria. Try clearing your filters.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-900/90 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Ticket ID</th>
                                    <th className="py-3.5 px-4">Customer</th>
                                    <th className="py-3.5 px-4">Subject & Category</th>
                                    <th className="py-3.5 px-4">Priority</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4">Assigned Staff</th>
                                    <th className="py-3.5 px-4">Created</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 text-sm">
                                {tickets.map((t) => (
                                    <tr key={t._id || t.ticketId} className="hover:bg-zinc-800/30 transition">
                                        <td className="py-3.5 px-4 font-mono text-xs text-indigo-400 font-medium">
                                            {t.ticketId}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-zinc-200 flex items-center gap-1.5">
                                                    {t.name || 'Anonymous'}
                                                    {t.userId?.isDeleted && (
                                                        <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1 rounded">Archived</span>
                                                    )}
                                                </span>
                                                <span className="text-xs text-zinc-500">
                                                    {t.email}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 max-w-xs">
                                            <div className="font-medium text-zinc-200 truncate" title={t.subject}>
                                                {t.subject || 'Support Request'}
                                            </div>
                                            <div className="text-xs text-zinc-500">
                                                {t.category || 'General'}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {getPriorityBadge(t.priority)}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {getStatusBadge(t.status)}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {t.assignedAdmin ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                                                    <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                                                    {t.assignedAdmin.username}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-zinc-500 italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs text-zinc-400 whitespace-nowrap">
                                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString([], {
                                                month: 'short',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : '—'}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <button
                                                onClick={() => handleOpenTicket(t.ticketId)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700 transition"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                Inspect
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

            {/* Ticket Inspection & Response Drawer */}
            {(selectedTicketId || detailsLoading) && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-2xl bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto flex flex-col justify-between shadow-2xl">
                        {/* Drawer Header */}
                        <div>
                            <div className="p-5 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900/95 backdrop-blur z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                        <LifeBuoy className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-semibold text-white">
                                                Ticket {selectedTicketId}
                                            </h3>
                                            {ticketDetails && getStatusBadge(ticketDetails.status)}
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                            {ticketDetails?.subject || 'Support Ticket Details'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedTicketId(null)}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Action Feedback Banner */}
                            {actionFeedback && (
                                <div className={`m-4 p-3 rounded-lg border text-xs flex items-center justify-between ${
                                    actionFeedback.type === 'success'
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                }`}>
                                    <span>{actionFeedback.message}</span>
                                    <button onClick={() => setActionFeedback(null)}><X className="w-3.5 h-3.5" /></button>
                                </div>
                            )}

                            {detailsLoading ? (
                                <div className="py-24 text-center">
                                    <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
                                    <p className="text-xs text-zinc-400">Loading conversation history...</p>
                                </div>
                            ) : ticketDetails && (
                                <div className="p-5 space-y-5">
                                    {/* Quick Triage Controls */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-800/40 p-3.5 rounded-xl border border-zinc-800">
                                        {/* Status Selector */}
                                        <div>
                                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">Status</label>
                                            <select
                                                value={ticketDetails.status}
                                                onChange={(e) => handleUpdateStatusOrPriority(e.target.value, null)}
                                                className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="OPEN">Open</option>
                                                <option value="IN_PROGRESS">In Progress</option>
                                                <option value="WAITING_FOR_USER">Waiting for User</option>
                                                <option value="RESOLVED">Resolved</option>
                                                <option value="CLOSED">Closed</option>
                                            </select>
                                        </div>

                                        {/* Priority Selector */}
                                        <div>
                                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">Priority</label>
                                            <select
                                                value={ticketDetails.priority}
                                                onChange={(e) => handleUpdateStatusOrPriority(null, e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="Low">Low</option>
                                                <option value="Normal">Normal</option>
                                                <option value="High">High</option>
                                                <option value="Urgent">Urgent</option>
                                            </select>
                                        </div>

                                        {/* Assignee Selector */}
                                        <div>
                                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">Assignee</label>
                                            <select
                                                value={ticketDetails.assignedAdmin?._id || ''}
                                                onChange={(e) => handleAssignTicket(e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
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

                                    {/* Customer Profile Card */}
                                    <div className="bg-zinc-800/40 p-3.5 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="text-zinc-400 block">Customer</span>
                                            <span className="font-semibold text-zinc-200">{ticketDetails.name}</span>
                                            <span className="text-zinc-500 block">{ticketDetails.email}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-zinc-400 block">Account Plan</span>
                                            <span className="font-mono text-indigo-400 uppercase font-semibold">
                                                {ticketDetails.userId?.plan || 'Guest'}
                                            </span>
                                            <span className="text-zinc-500 block">
                                                Category: {ticketDetails.category}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Tab Navigation: Conversation vs Internal Staff Notes */}
                                    <div className="border-b border-zinc-800 flex gap-4 text-xs font-semibold">
                                        <button
                                            onClick={() => setActiveDrawerTab('conversation')}
                                            className={`pb-2.5 flex items-center gap-1.5 transition ${
                                                activeDrawerTab === 'conversation'
                                                    ? 'text-indigo-400 border-b-2 border-indigo-500'
                                                    : 'text-zinc-400 hover:text-white'
                                            }`}
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            Customer Discussion ({ticketDetails.responseHistory?.length || 0})
                                        </button>

                                        <button
                                            onClick={() => setActiveDrawerTab('notes')}
                                            className={`pb-2.5 flex items-center gap-1.5 transition ${
                                                activeDrawerTab === 'notes'
                                                    ? 'text-amber-400 border-b-2 border-amber-500'
                                                    : 'text-zinc-400 hover:text-white'
                                            }`}
                                        >
                                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                                            Staff Internal Notes ({ticketDetails.internalNotes?.length || 0})
                                        </button>
                                    </div>

                                    {/* TAB 1: Customer Conversation Stream */}
                                    {activeDrawerTab === 'conversation' && (
                                        <div className="space-y-4">
                                            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                                {/* Initial Ticket Message */}
                                                <div className="bg-zinc-800/60 p-3.5 rounded-xl border border-zinc-800">
                                                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                                                        <span className="font-medium text-zinc-300 flex items-center gap-1">
                                                            <User className="w-3.5 h-3.5 text-zinc-400" />
                                                            {ticketDetails.name} (Initial Request)
                                                        </span>
                                                        <span>{new Date(ticketDetails.createdAt).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                                                        {ticketDetails.message}
                                                    </p>
                                                </div>

                                                {/* Response History Entries */}
                                                {ticketDetails.responseHistory?.map((msg, idx) => {
                                                    const isAdmin = msg.senderType === 'admin';
                                                    return (
                                                        <div
                                                            key={msg._id || idx}
                                                            className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                                                                isAdmin
                                                                    ? 'bg-indigo-950/20 border-indigo-500/30 ml-4'
                                                                    : 'bg-zinc-800/40 border-zinc-800 mr-4'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-1 text-[11px]">
                                                                <span className={`font-semibold flex items-center gap-1 ${isAdmin ? 'text-indigo-400' : 'text-zinc-300'}`}>
                                                                    {isAdmin ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                                                                    {msg.senderName} {isAdmin && '(Support Staff)'}
                                                                </span>
                                                                <span className="text-zinc-500">
                                                                    {new Date(msg.createdAt).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <p className="text-zinc-200 whitespace-pre-wrap">
                                                                {msg.message}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Reply Box */}
                                            <form onSubmit={handleSendReply} className="pt-3 border-t border-zinc-800 space-y-3">
                                                <div>
                                                    <label className="text-xs font-medium text-zinc-300 block mb-1">
                                                        Send Reply to Customer
                                                    </label>
                                                    <textarea
                                                        rows={3}
                                                        value={replyMessage}
                                                        onChange={(e) => setReplyMessage(e.target.value)}
                                                        placeholder="Type your official response to the customer..."
                                                        className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                                                        required
                                                    />
                                                </div>

                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={sendEmailNotify}
                                                            onChange={(e) => setSendEmailNotify(e.target.checked)}
                                                            className="rounded border-zinc-700 text-indigo-600 focus:ring-0"
                                                        />
                                                        <span>Send verified email notification to customer</span>
                                                    </label>

                                                    <button
                                                        type="submit"
                                                        disabled={submittingReply || !replyMessage.trim()}
                                                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
                                                    >
                                                        <Send className="w-3.5 h-3.5" />
                                                        {submittingReply ? 'Sending...' : 'Send Response'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    )}

                                    {/* TAB 2: Private Internal Staff Notes */}
                                    {activeDrawerTab === 'notes' && (
                                        <div className="space-y-4">
                                            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                                                {ticketDetails.internalNotes?.length === 0 ? (
                                                    <div className="p-8 text-center text-xs text-zinc-500">
                                                        No internal notes recorded yet. Notes are only visible to administrators.
                                                    </div>
                                                ) : (
                                                    ticketDetails.internalNotes?.map((note, idx) => (
                                                        <div key={note._id || idx} className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg text-xs">
                                                            <div className="flex items-center justify-between mb-1 text-[11px] text-amber-400 font-medium">
                                                                <span>{note.authorName}</span>
                                                                <span className="text-zinc-500">{new Date(note.createdAt).toLocaleString()}</span>
                                                            </div>
                                                            <p className="text-zinc-300 whitespace-pre-wrap">{note.note}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* New Note Form */}
                                            <form onSubmit={handleAddNote} className="pt-3 border-t border-zinc-800 space-y-2">
                                                <label className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                                                    <Lock className="w-3.5 h-3.5" />
                                                    Add Private Internal Staff Note
                                                </label>
                                                <textarea
                                                    rows={2}
                                                    value={internalNoteText}
                                                    onChange={(e) => setInternalNoteText(e.target.value)}
                                                    placeholder="Log private investigation details, customer history, or escalation thoughts..."
                                                    className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
                                                    required
                                                />
                                                <div className="flex justify-end">
                                                    <button
                                                        type="submit"
                                                        disabled={submittingNote || !internalNoteText.trim()}
                                                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition"
                                                    >
                                                        {submittingNote ? 'Saving...' : 'Add Note'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-4 border-t border-zinc-800 flex justify-end bg-zinc-900/90">
                            <button
                                onClick={() => setSelectedTicketId(null)}
                                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-700 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSupportTicketsTab;

