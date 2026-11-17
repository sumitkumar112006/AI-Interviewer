import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Search,
    Filter,
    SlidersHorizontal,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    ExternalLink,
    Shield,
    Lock,
    Unlock,
    Sliders,
    Eye,
    X,
    UserCheck,
    Clock,
    UserX
} from 'lucide-react';
import { getAnalyticsRecentUsers } from '../../services/admin.api';

export default function Dashboard01RecentUsersTable({ isSuperAdmin }) {
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
    const [loading, setLoading] = useState(true);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [planFilter, setPlanFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');

    // Column visibility toggle
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        profile: true,
        role: true,
        plan: true,
        status: true,
        lastActive: true,
        registered: true,
        credits: true,
        actions: true
    });

    // Selected user for details drawer
    const [selectedUser, setSelectedUser] = useState(null);

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const fetchUsers = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const res = await getAnalyticsRecentUsers({
                page,
                limit: 10,
                search: searchTerm,
                plan: planFilter,
                status: statusFilter,
                sortBy,
                sortOrder
            });
            if (res?.data) {
                setUsers(res.data.users || []);
                setPagination(res.data.pagination || { total: 0, page: 1, pages: 1, limit: 10 });
            }
        } catch (err) {
            console.error('Failed to load recent users analytics table:', err);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, planFilter, statusFilter, sortBy, sortOrder]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchUsers]);

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const formatLastActive = (dateVal, activityStatus) => {
        if (!dateVal) {
            return (
                <span className="activity-status-pill never" title="No authenticated activity recorded">
                    <span className="activity-indicator gray"></span>
                    Never
                </span>
            );
        }
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) {
            return <span className="activity-status-pill never">Never</span>;
        }

        if (activityStatus === 'online') {
            return (
                <span className="activity-status-pill online" title={`Active at ${d.toLocaleTimeString()}`}>
                    <span className="activity-indicator green pulse"></span>
                    Active Now
                </span>
            );
        }
        if (activityStatus === 'recent') {
            return (
                <span className="activity-status-pill recent" title={d.toLocaleString()}>
                    <span className="activity-indicator blue"></span>
                    Today
                </span>
            );
        }
        return (
            <span className="activity-status-pill idle" title={d.toLocaleDateString()}>
                <span className="activity-indicator gray"></span>
                {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
        );
    };

    return (
        <div className="dashboard-01-data-table-container">
            <div className="table-top-bar">
                <div className="table-title-group">
                    <div className="title-row">
                        <h3>Recent User Accounts</h3>
                        <span className="table-count-badge">
                            {pagination.total} registered users
                        </span>
                    </div>
                    <p className="table-subtitle">
                        Inspect registered users, role privileges, subscription tiers, and engagement status.
                    </p>
                </div>

                <div className="table-actions-toolbar">
                    {/* Search Input */}
                    <div className="table-search-box">
                        <Search size={14} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by username or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                className="search-clear-btn"
                                onClick={() => setSearchTerm('')}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Plan Filter */}
                    <div className="table-filter-select-wrapper">
                        <select
                            value={planFilter}
                            onChange={(e) => setPlanFilter(e.target.value)}
                            className="table-filter-select"
                        >
                            <option value="all">All Plans</option>
                            <option value="free">Free Tier</option>
                            <option value="pro">Pro Tier</option>
                            <option value="premium">Premium Tier</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="table-filter-select-wrapper">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="table-filter-select"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active Only</option>
                            <option value="blocked">Suspended Only</option>
                        </select>
                    </div>

                    {/* Column Visibility Menu */}
                    <div className="column-visibility-dropdown-wrapper">
                        <button
                            type="button"
                            className="column-toggle-btn"
                            onClick={() => setShowColumnMenu(prev => !prev)}
                            title="Customize visible columns"
                        >
                            <SlidersHorizontal size={14} />
                            <span>Columns</span>
                        </button>

                        {showColumnMenu && (
                            <div className="column-menu-popup">
                                <div className="menu-header">Toggle Columns</div>
                                {Object.keys(visibleColumns).map(col => (
                                    <label key={col} className="column-checkbox-row">
                                        <input
                                            type="checkbox"
                                            checked={visibleColumns[col]}
                                            onChange={() => toggleColumn(col)}
                                        />
                                        <span>{col.charAt(0).toUpperCase() + col.slice(1)}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="table-responsive-scroll">
                <table className="dashboard-01-table">
                    <thead>
                        <tr>
                            {visibleColumns.profile && (
                                <th onClick={() => handleSort('username')} className="sortable-th">
                                    <div className="th-content">
                                        <span>User Profile</span>
                                        <ArrowUpDown size={11} />
                                    </div>
                                </th>
                            )}
                            {visibleColumns.role && <th>Security Role</th>}
                            {visibleColumns.plan && (
                                <th onClick={() => handleSort('plan')} className="sortable-th">
                                    <div className="th-content">
                                        <span>Plan</span>
                                        <ArrowUpDown size={11} />
                                    </div>
                                </th>
                            )}
                            {visibleColumns.status && <th>Status</th>}
                            {visibleColumns.lastActive && (
                                <th onClick={() => handleSort('lastActiveAt')} className="sortable-th">
                                    <div className="th-content">
                                        <span>Last Active</span>
                                        <ArrowUpDown size={11} />
                                    </div>
                                </th>
                            )}
                            {visibleColumns.registered && (
                                <th onClick={() => handleSort('createdAt')} className="sortable-th">
                                    <div className="th-content">
                                        <span>Registered</span>
                                        <ArrowUpDown size={11} />
                                    </div>
                                </th>
                            )}
                            {visibleColumns.credits && <th>Bonus Credits</th>}
                            {visibleColumns.actions && <th className="actions-th">Inspect</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="8" className="table-empty-cell">
                                    <div className="loading-spinner-ring small"></div>
                                    <span>Fetching user directory...</span>
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="table-empty-cell">
                                    <UserX size={24} className="empty-icon" />
                                    <span>No accounts matching specified filter parameters.</span>
                                </td>
                            </tr>
                        ) : (
                            users.map((u) => (
                                <tr key={u._id} className="user-table-row">
                                    {visibleColumns.profile && (
                                        <td>
                                            <div className="user-cell" onClick={() => setSelectedUser(u)}>
                                                <div className="avatar-circle" style={['admin', 'super_admin'].includes(u.role) ? { background: 'linear-gradient(135deg, #ef4444, #f97316)' } : {}}>
                                                    {(u.username || 'U')[0].toUpperCase()}
                                                </div>
                                                <div className="user-details">
                                                    <div className="user-name">{u.username}</div>
                                                    <div className="user-email">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                    )}

                                    {visibleColumns.role && (
                                        <td>
                                            <span className={`role-badge ${u.role}`}>
                                                {u.role?.toUpperCase() || 'USER'}
                                            </span>
                                        </td>
                                    )}

                                    {visibleColumns.plan && (
                                        <td>
                                            <span className={`plan-pill ${u.plan?.toLowerCase() || 'free'}`}>
                                                {(u.plan || 'FREE').toUpperCase()}
                                            </span>
                                        </td>
                                    )}

                                    {visibleColumns.status && (
                                        <td>
                                            <span className={`badge-pill ${u.isBlocked ? 'blocked' : 'active'}`}>
                                                {u.isBlocked ? 'SUSPENDED' : 'ACTIVE'}
                                            </span>
                                        </td>
                                    )}

                                    {visibleColumns.lastActive && (
                                        <td>
                                            {formatLastActive(u.lastActiveAt, u.activityStatus)}
                                        </td>
                                    )}

                                    {visibleColumns.registered && (
                                        <td className="date-cell">
                                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Legacy'}
                                        </td>
                                    )}

                                    {visibleColumns.credits && (
                                        <td>
                                            <span className={`credits-tag ${u.customBonusCredits > 0 ? 'positive' : 'zero'}`}>
                                                +{u.customBonusCredits || 0}
                                            </span>
                                        </td>
                                    )}

                                    {visibleColumns.actions && (
                                        <td>
                                            <div className="row-actions-group">
                                                <button
                                                    type="button"
                                                    className="row-action-icon-btn"
                                                    onClick={() => setSelectedUser(u)}
                                                    title="Quick View Details Drawer"
                                                >
                                                    <Eye size={13} />
                                                </button>
                                                <Link
                                                    to={`/admin-portal-dashboard-root/user-evaluation/${u._id}`}
                                                    className="row-action-icon-btn link-eval"
                                                    title="Deep Inspect User Evaluation Page"
                                                >
                                                    <ExternalLink size={13} />
                                                </Link>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Table Footer with Pagination */}
            <div className="table-footer-pagination">
                <div className="pagination-info">
                    Showing page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong> ({pagination.total} total accounts)
                </div>

                <div className="pagination-buttons-group">
                    <button
                        type="button"
                        className="pagination-nav-btn"
                        onClick={() => fetchUsers(pagination.page - 1)}
                        disabled={pagination.page <= 1 || loading}
                    >
                        <ChevronLeft size={14} />
                        <span>Previous</span>
                    </button>
                    <button
                        type="button"
                        className="pagination-nav-btn"
                        onClick={() => fetchUsers(pagination.page + 1)}
                        disabled={pagination.page >= pagination.pages || loading}
                    >
                        <span>Next</span>
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Quick User Details Drawer / Modal */}
            {selectedUser && (
                <div className="user-drawer-overlay" onClick={() => setSelectedUser(null)}>
                    <div className="user-drawer-card" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div className="drawer-user-info">
                                <div className="avatar-circle big">
                                    {(selectedUser.username || 'U')[0].toUpperCase()}
                                </div>
                                <div>
                                    <h4>{selectedUser.username}</h4>
                                    <span className="drawer-email">{selectedUser.email}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="drawer-close-btn"
                                onClick={() => setSelectedUser(null)}
                            >
                                <X size={15} />
                            </button>
                        </div>

                        <div className="drawer-body">
                            <div className="drawer-meta-grid">
                                <div className="meta-box">
                                    <span className="meta-label">Plan Tier</span>
                                    <span className={`plan-pill ${selectedUser.plan || 'free'}`}>
                                        {(selectedUser.plan || 'FREE').toUpperCase()}
                                    </span>
                                </div>
                                <div className="meta-box">
                                    <span className="meta-label">Security Role</span>
                                    <span className={`role-badge ${selectedUser.role}`}>
                                        {selectedUser.role?.toUpperCase() || 'USER'}
                                    </span>
                                </div>
                                <div className="meta-box">
                                    <span className="meta-label">Account Status</span>
                                    <span className={`badge-pill ${selectedUser.isBlocked ? 'blocked' : 'active'}`}>
                                        {selectedUser.isBlocked ? 'SUSPENDED' : 'ACTIVE'}
                                    </span>
                                </div>
                                <div className="meta-box">
                                    <span className="meta-label">Bonus Credits</span>
                                    <span className="meta-val">+{selectedUser.customBonusCredits || 0}</span>
                                </div>
                                <div className="meta-box full">
                                    <span className="meta-label">Registered Date</span>
                                    <span className="meta-val">
                                        {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'Legacy'}
                                    </span>
                                </div>
                                <div className="meta-box full">
                                    <span className="meta-label">Last Active Telemetry</span>
                                    <span className="meta-val">
                                        {selectedUser.lastActiveAt ? new Date(selectedUser.lastActiveAt).toLocaleString() : 'Never logged in'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="drawer-footer">
                            <Link
                                to={`/admin-portal-dashboard-root/user-evaluation/${selectedUser._id}`}
                                className="drawer-full-link-btn"
                            >
                                <ExternalLink size={14} />
                                <span>Open Full Evaluation Dossier</span>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

