import React, { useEffect, useState, useCallback } from 'react';
import { getAdminInvoices, downloadAdminInvoiceHtml } from '../services/admin.api';
import { 
    Receipt, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    RotateCcw, 
    Search, 
    Calendar, 
    ExternalLink, 
    Download, 
    Eye, 
    FileText, 
    X, 
    User, 
    CreditCard, 
    ShieldAlert,
    Building2,
    Hash
} from 'lucide-react';
import AdminPagination from './AdminPagination';
import { AdminExportButton } from './AdminExportButton';
import ShadcnDatePicker from './ShadcnDatePicker';

export const AdminInvoicesTab = () => {
    const [invoices, setInvoices] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters & Pagination
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });

    // Active Drawer State for deep inspection
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);

    const fetchInvoices = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getAdminInvoices({
                page,
                limit: 20,
                status: statusFilter,
                search: search.trim() || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            });

            if (res.success) {
                setInvoices(res.data || []);
                setSummary(res.summary || null);
                setPagination(res.pagination || { total: 0, pages: 1, limit: 20 });
            } else {
                setError(res.message || 'Failed to retrieve invoice ledger.');
            }
        } catch (err) {
            console.error('Failed to load admin invoices:', err);
            setError(err?.response?.data?.message || err?.message || 'Failed to load invoices.');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, search, startDate, endDate]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    const handleResetFilters = () => {
        setSearch('');
        setStatusFilter('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const handleViewPrintable = async (inv) => {
        const invId = inv._id || inv.id;
        try {
            setDownloadingId(invId);
            const blob = await downloadAdminInvoiceHtml(invId);
            const fileURL = window.URL.createObjectURL(new Blob([blob], { type: 'text/html' }));
            window.open(fileURL, '_blank');
        } catch (err) {
            console.error('Failed to open printable invoice:', err);
            alert('Failed to generate printable invoice preview.');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDownloadDocument = async (inv) => {
        const invId = inv._id || inv.id;
        const invNumber = inv.invoiceNumber || 'INV';
        try {
            setDownloadingId(invId);
            const blob = await downloadAdminInvoiceHtml(invId);
            const fileURL = window.URL.createObjectURL(new Blob([blob], { type: 'text/html' }));
            const link = document.createElement('a');
            link.href = fileURL;
            link.download = `${invNumber}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(fileURL);
        } catch (err) {
            console.error('Failed to download invoice:', err);
            alert('Failed to download invoice document.');
        } finally {
            setDownloadingId(null);
        }
    };

    const getStatusBadge = (status) => {
        switch ((status || '').toUpperCase()) {
            case 'PAID':
                return <span className="badge-pill role-super" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' }}>PAID</span>;
            case 'ISSUED':
                return <span className="badge-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>ISSUED</span>;
            case 'VOID':
                return <span className="badge-pill" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>VOID</span>;
            default:
                return <span className="badge-pill">{status || 'UNKNOWN'}</span>;
        }
    };

    return (
        <div className="admin-invoices-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 1. Metric Summary Cards */}
            <div className="stats-cards-grid">
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Invoiced Revenue</span>
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(52, 211, 153, 0.12)', color: '#34d399' }}>
                            <Receipt size={17} />
                        </div>
                    </div>
                    <div className="stat-value" style={{ color: '#34d399' }}>
                        ₹{summary ? summary.totalRevenueRupees : '0.00'}
                    </div>
                    <div className="stat-sub">Total Settled Invoices</div>
                </div>

                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Paid Invoices</span>
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
                            <CheckCircle2 size={17} />
                        </div>
                    </div>
                    <div className="stat-value">{summary?.paidCount || 0}</div>
                    <div className="stat-sub">Tax Compliant Receipts</div>
                </div>

                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Issued / Pending</span>
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                            <Clock size={17} />
                        </div>
                    </div>
                    <div className="stat-value" style={{ color: '#38bdf8' }}>{summary?.issuedCount || 0}</div>
                    <div className="stat-sub">Awaiting Settlement</div>
                </div>

                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Voided Invoices</span>
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
                            <AlertCircle size={17} />
                        </div>
                    </div>
                    <div className="stat-value" style={{ color: '#f87171' }}>{summary?.voidCount || 0}</div>
                    <div className="stat-sub">Cancelled Records</div>
                </div>
            </div>

            {/* 2. Filter & Search Toolbar */}
            <div className="users-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                <div className="filter-group" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Search Input */}
                    <div style={{ position: 'relative', minWidth: '240px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            type="text"
                            placeholder="Invoice #, user, email..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            style={{
                                width: '100%',
                                padding: '0.45rem 0.6rem 0.45rem 2rem',
                                background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: '#f8fafc',
                                fontSize: '0.85rem'
                            }}
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        style={{
                            padding: '0.45rem 0.75rem',
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            color: '#f8fafc',
                            fontSize: '0.85rem'
                        }}
                    >
                        <option value="">All Invoice Statuses</option>
                        <option value="PAID">Paid Only</option>
                        <option value="ISSUED">Issued (Pending)</option>
                        <option value="VOID">Voided Only</option>
                    </select>

                    {/* Date Range Filters */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.8rem', minWidth: '310px' }}>
                        <ShadcnDatePicker
                            value={startDate}
                            onChange={(val) => { setStartDate(val); setPage(1); }}
                            placeholder="Start date"
                            maxDate={endDate}
                            ariaLabel="Filter invoice start date"
                        />
                        <span>to</span>
                        <ShadcnDatePicker
                            value={endDate}
                            onChange={(val) => { setEndDate(val); setPage(1); }}
                            placeholder="End date"
                            minDate={startDate}
                            ariaLabel="Filter invoice end date"
                        />
                    </div>

                    {/* Reset Filters */}
                    {(search || statusFilter || startDate || endDate) && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="reset-filters-btn"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.4rem 0.75rem',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                            title="Reset all filters"
                        >
                            <RotateCcw size={12} /> Reset
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <AdminExportButton
                        moduleName="invoices"
                        filters={{ status: statusFilter, search, startDate, endDate }}
                        label="Export Invoices"
                    />
                    <div className="toolbar-counter" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        Showing <strong>{invoices.length}</strong> of <strong>{pagination.total}</strong> tax invoices
                    </div>
                </div>
            </div>

            {/* 3. Error Banner */}
            {error && (
                <div style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    color: '#f87171',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={fetchInvoices}
                        style={{
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            padding: '0.3rem 0.75rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* 4. High-Density Invoices Table */}
            <div className="users-table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Invoice Number</th>
                            <th>Issued Date</th>
                            <th>Associated Account</th>
                            <th>Billed To</th>
                            <th>Description / Plan</th>
                            <th>Amount (INR)</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="8" className="empty-table-cell" style={{ textAlign: 'center', padding: '3rem 0', color: '#6366f1' }}>
                                    Loading tax invoices directory...
                                </td>
                            </tr>
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="empty-table-cell" style={{ textAlign: 'center', padding: '3rem 0' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                        <FileText size={32} style={{ color: '#64748b', opacity: 0.5 }} />
                                        <span style={{ color: '#94a3b8' }}>No tax invoices found matching specified filters.</span>
                                        {(search || statusFilter || startDate || endDate) && (
                                            <button
                                                type="button"
                                                onClick={handleResetFilters}
                                                style={{
                                                    marginTop: '0.5rem',
                                                    background: 'rgba(99, 102, 241, 0.15)',
                                                    color: '#818cf8',
                                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                                    padding: '0.4rem 0.8rem',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                Clear Active Filters
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => {
                                const user = inv.userId;
                                const isUserDeleted = user?.isDeleted;
                                const totalRupees = (inv.totalAmount / 100).toFixed(2);
                                const isDownloading = downloadingId === inv._id;

                                return (
                                    <tr key={inv._id}>
                                        {/* Invoice Number */}
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <Receipt size={14} style={{ color: '#818cf8' }} />
                                                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f8fafc' }}>
                                                    {inv.invoiceNumber}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Issued Date */}
                                        <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                                            {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            }) : 'N/A'}
                                        </td>

                                        {/* Associated Account */}
                                        <td>
                                            {user ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontWeight: 500, color: '#f8fafc' }}>
                                                        {user.username || 'Candidate'}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                            {user.email}
                                                        </span>
                                                        {isUserDeleted && (
                                                            <span style={{
                                                                fontSize: '0.65rem',
                                                                background: 'rgba(239, 68, 68, 0.15)',
                                                                color: '#f87171',
                                                                padding: '1px 4px',
                                                                borderRadius: '4px'
                                                            }}>
                                                                Archived
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                                    Archived User
                                                </span>
                                            )}
                                        </td>

                                        {/* Billed To Snapshot */}
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
                                                    {inv.billTo?.name || 'Customer'}
                                                </span>
                                                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                    {inv.billTo?.email || '—'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Line Items / Plan */}
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    textTransform: 'uppercase',
                                                    padding: '2px 6px',
                                                    background: 'rgba(99, 102, 241, 0.1)',
                                                    color: '#a5b4fc',
                                                    borderRadius: '4px',
                                                    fontWeight: 600
                                                }}>
                                                    {inv.planKey || 'PRO'}
                                                </span>
                                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                                    {inv.billingCycle || 'MONTHLY'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Total Amount */}
                                        <td>
                                            <div style={{ fontWeight: 700, color: '#34d399' }}>
                                                ₹{totalRupees}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                GST incl.
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td>
                                            {getStatusBadge(inv.status)}
                                        </td>

                                        {/* Actions */}
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                                {/* View Printable */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewPrintable(inv)}
                                                    disabled={isDownloading}
                                                    title="Open printable tax invoice in new tab"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem',
                                                        padding: '0.35rem 0.6rem',
                                                        background: 'rgba(99, 102, 241, 0.15)',
                                                        color: '#818cf8',
                                                        border: '1px solid rgba(99, 102, 241, 0.3)',
                                                        borderRadius: '6px',
                                                        cursor: isDownloading ? 'wait' : 'pointer',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    <ExternalLink size={12} />
                                                    <span>View</span>
                                                </button>

                                                {/* Download HTML File */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadDocument(inv)}
                                                    disabled={isDownloading}
                                                    title="Download invoice HTML file"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '0.35rem 0.5rem',
                                                        background: 'rgba(255, 255, 255, 0.05)',
                                                        color: '#cbd5e1',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        borderRadius: '6px',
                                                        cursor: isDownloading ? 'wait' : 'pointer',
                                                        fontSize: '0.75rem'
                                                    }}
                                                >
                                                    <Download size={12} />
                                                </button>

                                                {/* Deep Inspect */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedInvoice(inv)}
                                                    title="Inspect invoice details & ledger references"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '0.35rem 0.5rem',
                                                        background: 'rgba(255, 255, 255, 0.05)',
                                                        color: '#cbd5e1',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem'
                                                    }}
                                                >
                                                    <Eye size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* 5. Server-Side Pagination */}
            <AdminPagination
                page={pagination.page}
                pages={pagination.pages}
                total={pagination.total}
                limit={pagination.limit || 20}
                loading={loading}
                onPageChange={(newPage) => setPage(newPage)}
            />

            {/* 6. Invoice Details Drawer Modal */}
            {selectedInvoice && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)',
                    padding: '1rem'
                }} onClick={() => setSelectedInvoice(null)}>
                    <div style={{
                        backgroundColor: '#0d1322',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '14px',
                        width: '100%',
                        maxWidth: '680px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '1.75rem',
                        color: '#f8fafc',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                    }} onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '0.5rem', borderRadius: '8px' }}>
                                    <Receipt size={20} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                                        Tax Invoice: {selectedInvoice.invoiceNumber}
                                    </h3>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                        Issued {new Date(selectedInvoice.issuedAt).toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                {getStatusBadge(selectedInvoice.status)}
                                <button
                                    type="button"
                                    onClick={() => setSelectedInvoice(null)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#94a3b8',
                                        cursor: 'pointer',
                                        padding: '4px'
                                    }}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Customer & Billing Snapshot */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>
                                    Associated Account
                                </span>
                                <div style={{ marginTop: '0.4rem', fontSize: '0.9rem', fontWeight: 600 }}>
                                    {selectedInvoice.userId?.username || 'Archived User'}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                    {selectedInvoice.userId?.email || 'N/A'}
                                </div>
                                {selectedInvoice.userId?.isDeleted && (
                                    <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', color: '#f87171' }}>
                                        ⚠ Account was archived/deleted per retention policy
                                    </div>
                                )}
                            </div>

                            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>
                                    Billed To (Invoice Snapshot)
                                </span>
                                <div style={{ marginTop: '0.4rem', fontSize: '0.9rem', fontWeight: 600 }}>
                                    {selectedInvoice.billTo?.name || 'Customer'}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                    {selectedInvoice.billTo?.email || 'N/A'}
                                </div>
                                {selectedInvoice.billTo?.address && (
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                                        {selectedInvoice.billTo.address}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Line Items Table */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem' }}>
                                Invoiced Line Items
                            </span>
                            <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8' }}>Description</th>
                                            <th style={{ textAlign: 'center', padding: '8px 12px', color: '#94a3b8' }}>Qty</th>
                                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#94a3b8' }}>Rate</th>
                                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#94a3b8' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedInvoice.items || []).map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                                                <td style={{ padding: '10px 12px', color: '#f8fafc' }}>{item.description}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>{item.quantity}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>₹{(item.unitAmount / 100).toFixed(2)}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#f8fafc' }}>₹{(item.amount / 100).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Tax & Financial Breakdown */}
                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                                <span>Subtotal (Net of Taxes):</span>
                                <span>₹{((selectedInvoice.totalAmount - (selectedInvoice.taxAmount || 0)) / 100).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                                <span>Integrated GST (18% inclusive):</span>
                                <span>₹{((selectedInvoice.taxAmount || 0) / 100).toFixed(2)}</span>
                            </div>
                            {selectedInvoice.discountAmount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#34d399' }}>
                                    <span>Discount Applied:</span>
                                    <span>-₹{(selectedInvoice.discountAmount / 100).toFixed(2)}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0 0', marginTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '1rem', fontWeight: 700, color: '#34d399' }}>
                                <span>Grand Total Paid ({selectedInvoice.currency || 'INR'}):</span>
                                <span>₹{(selectedInvoice.totalAmount / 100).toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Audit & Gateway References */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b', marginBottom: '1.5rem', fontFamily: 'monospace' }}>
                            <div><strong>Payment Ref:</strong> {selectedInvoice.paymentId || 'N/A'}</div>
                            <div><strong>Order Ref:</strong> {selectedInvoice.orderId || 'N/A'}</div>
                            <div><strong>Billing Cycle:</strong> {selectedInvoice.billingCycle || 'MONTHLY'}</div>
                            <div><strong>Plan Tier:</strong> {selectedInvoice.planKey || 'PRO'}</div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                type="button"
                                onClick={() => setSelectedInvoice(null)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: '#cbd5e1',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDownloadDocument(selectedInvoice)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: '#f8fafc',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <Download size={14} /> Download File
                            </button>
                            <button
                                type="button"
                                onClick={() => handleViewPrintable(selectedInvoice)}
                                style={{
                                    padding: '0.5rem 1.2rem',
                                    background: '#6366f1',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    fontWeight: 600,
                                    fontSize: '0.85rem'
                                }}
                            >
                                <ExternalLink size={14} /> View Printable
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

