import React, { useEffect, useState, useCallback } from 'react';
import { getAdminAuditLogs } from '../services/admin.api';
import { 
  FileClock, 
  ArrowRight, 
  Search, 
  RotateCcw, 
  Eye, 
  Shield, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  X,
  Layers,
  Terminal,
  Clock,
  ExternalLink
} from 'lucide-react';
import AdminPagination from './AdminPagination';
import { AdminExportButton } from './AdminExportButton';

export const AdminAuditLogsTab = () => {
  const [source, setSource] = useState('system'); // 'system' (Admin Actions) | 'subscriptions' (Legacy transitions)
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 25 });

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Details Modal / Drawer State
  const [selectedEvent, setSelectedEvent] = useState(null);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        source,
        page,
        limit: 25
      };

      if (source === 'system') {
        if (search.trim()) params.search = search.trim();
        if (actionFilter) params.action = actionFilter;
        if (categoryFilter) params.category = categoryFilter;
        if (severityFilter) params.severity = severityFilter;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      } else {
        if (actionFilter) params.eventType = actionFilter;
      }

      const res = await getAdminAuditLogs(params);
      if (res.success) {
        setEvents(res.data || []);
        setPagination(res.pagination || { total: 0, pages: 1, limit: 25 });
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [source, page, search, actionFilter, categoryFilter, severityFilter, startDate, endDate]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleSourceChange = (newSource) => {
    setSource(newSource);
    setPage(1);
    setActionFilter('');
    setCategoryFilter('');
    setSeverityFilter('');
    setSearch('');
    setStartDate('');
    setEndDate('');
  };

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('');
    setCategoryFilter('');
    setSeverityFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getActionBadgeClass = (action = '') => {
    const act = action.toUpperCase();
    if (act.includes('SUSPEND') || act.includes('DELETE') || act.includes('CANCEL')) return 'blocked';
    if (act.includes('RESTORE') || act.includes('ACTIVATE') || act.includes('GRANT')) return 'active';
    if (act.includes('ROLE') || act.includes('PLAN') || act.includes('UPGRADE')) return 'premium';
    if (act.includes('LOGIN') || act.includes('AUTH') || act.includes('BROADCAST')) return 'pro';
    return 'free';
  };

  const getSeverityBadgeClass = (severity = '') => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
      case 'ERROR':
        return 'blocked';
      case 'WARN':
        return 'pro';
      case 'INFO':
      default:
        return 'free';
    }
  };

  return (
    <div className="admin-audit-logs-section">
      {/* Source Selector Tabs */}
      <div className="audit-source-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={() => handleSourceChange('system')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: source === 'system' ? '#6366f1' : 'rgba(255, 255, 255, 0.05)',
            color: source === 'system' ? '#ffffff' : '#94a3b8',
            transition: 'all 0.2s ease'
          }}
        >
          <Shield size={15} />
          Admin Actions & Security Trail
        </button>
        <button
          type="button"
          onClick={() => handleSourceChange('subscriptions')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: source === 'subscriptions' ? '#6366f1' : 'rgba(255, 255, 255, 0.05)',
            color: source === 'subscriptions' ? '#ffffff' : '#94a3b8',
            transition: 'all 0.2s ease'
          }}
        >
          <Layers size={15} />
          Subscription Transitions
        </button>
      </div>

      {/* Toolbar Filters */}
      <div className="users-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        {source === 'system' ? (
          <>
            <div className="search-box" style={{ minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search actor, target, summary..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            <div className="filter-group">
              <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
                <option value="">All Action Types</option>
                <option value="USER_ROLE_CHANGED">User Role Changed</option>
                <option value="USER_PLAN_CHANGED">User Plan Changed</option>
                <option value="USER_SUSPENDED">User Suspended</option>
                <option value="USER_RESTORED">User Restored</option>
                <option value="USER_DELETED">User Deleted</option>
                <option value="CREDITS_GRANTED">Credits Granted</option>
                <option value="CREDITS_ADJUSTED">Credits Adjusted</option>
                <option value="FEATURE_ACCESS_CHANGED">Feature Permissions</option>
                <option value="ADMIN_CREATED">Admin Account Created</option>
                <option value="ADMIN_LOGIN">Admin Login</option>
                <option value="ADMIN_LOGOUT">Admin Logout</option>
                <option value="BROADCAST_SENT">Broadcast Notification</option>
              </select>

              <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
                <option value="">All Categories</option>
                <option value="ADMIN">ADMIN</option>
                <option value="AUTH">AUTH</option>
                <option value="BILLING">BILLING</option>
                <option value="SECURITY">SECURITY</option>
                <option value="SYSTEM">SYSTEM</option>
              </select>

              <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}>
                <option value="">All Severities</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="action-select"
                  title="Filter from start date"
                  style={{ colorScheme: 'dark', padding: '0.35rem 0.6rem' }}
                />
                <span>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="action-select"
                  title="Filter to end date"
                  style={{ colorScheme: 'dark', padding: '0.35rem 0.6rem' }}
                />
              </div>

              {(search || actionFilter || categoryFilter || severityFilter || startDate || endDate) && (
                <button
                  type="button"
                  className="reset-filters-btn"
                  onClick={handleResetFilters}
                  title="Reset all active filters"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="filter-group">
            <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
              <option value="">All Subscription Transitions</option>
              <option value="ACTIVATED">ACTIVATED (New Sub)</option>
              <option value="UPGRADED">UPGRADED (Tier Bump)</option>
              <option value="DOWNGRADED">DOWNGRADED (Tier Drop)</option>
              <option value="RENEWED">RENEWED (Cycle Renewal)</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            {actionFilter && (
              <button
                type="button"
                className="reset-filters-btn"
                onClick={() => { setActionFilter(''); setPage(1); }}
              >
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
          <AdminExportButton
            moduleName="audit-logs"
            filters={{
              category: categoryFilter,
              action: actionFilter,
              severity: severityFilter,
              startDate,
              endDate,
              search
            }}
            label="Export Audit Trail"
          />
          <div className="toolbar-counter">
            Total <strong>{pagination.total}</strong> records
          </div>
        </div>
      </div>

      {/* Main Audit Log Table */}
      <div className="users-table-container">
        <table>
          <thead>
            {source === 'system' ? (
              <tr>
                <th>Timestamp</th>
                <th>Admin Actor</th>
                <th>Action Type</th>
                <th>Target Resource</th>
                <th>Change Summary</th>
                <th>Severity</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            ) : (
              <tr>
                <th>Timestamp</th>
                <th>User Account</th>
                <th>State Transition Event</th>
                <th>Tier Transition</th>
                <th>Settled Reference</th>
                <th>Actor Scope</th>
              </tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={source === 'system' ? 7 : 6} className="empty-table-cell">
                  Loading audit trail records...
                </td>
              </tr>
            ) : events.length > 0 ? (
              source === 'system' ? (
                events.map((e) => {
                  const actionName = e.details?.action || e.eventType || 'ACTION';
                  const summary = e.details?.changeSummary || '—';
                  const targetLabel = e.details?.targetIdentifier || (e.targetId ? `${e.targetId.username || ''} (${e.targetId.email || ''})` : '—');
                  const actorLabel = e.actorId?.username || e.actorRole || 'System';

                  return (
                    <tr key={e._id}>
                      <td className="timestamp-cell" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(e.createdAt).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span className="user-name" style={{ fontWeight: 600 }}>{actorLabel}</span>
                          <span className="mono-badge" style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>
                            {e.actorRole || e.actorId?.role || 'admin'}
                          </span>
                        </div>
                        {e.actorId?.email && (
                          <div className="user-email">{e.actorId.email}</div>
                        )}
                      </td>
                      <td>
                        <span className={`badge-pill ${getActionBadgeClass(actionName)}`}>
                          {actionName}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>
                          {targetLabel}
                        </div>
                        {e.targetType && (
                          <div className="cell-sub" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Type: {e.targetType}
                          </div>
                        )}
                      </td>
                      <td style={{ maxWidth: '340px' }}>
                        <span style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                          {summary}
                        </span>
                        {e.details?.reason && (
                          <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.2rem', fontStyle: 'italic' }}>
                            Reason: "{e.details.reason}"
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge-pill ${getSeverityBadgeClass(e.severity || 'INFO')}`}>
                          {e.severity || 'INFO'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="row-action-btn evaluate-btn"
                          onClick={() => setSelectedEvent(e)}
                          title="Inspect complete event diff and payload"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem' }}
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                events.map((e) => (
                  <tr key={e._id}>
                    <td className="timestamp-cell">
                      {new Date(e.createdAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </td>
                    <td>
                      <div className="user-name">{e.userId?.username || 'Unknown User'}</div>
                      <div className="user-email">{e.userId?.email || '—'}</div>
                    </td>
                    <td>
                      <span className={`badge-pill ${getActionBadgeClass(e.eventType)}`}>
                        {e.eventType}
                      </span>
                    </td>
                    <td>
                      <div className="transition-flow">
                        <span className={`badge-pill ${e.fromPlan || 'free'}`}>{(e.fromPlan || 'FREE').toUpperCase()}</span>
                        <ArrowRight size={12} className="flow-arrow" />
                        <span className={`badge-pill ${e.toPlan || 'pro'}`}>{(e.toPlan || 'PRO').toUpperCase()}</span>
                      </div>
                    </td>
                    <td>
                      {e.paymentOrderId ? (
                        <div>
                          <strong className="mono-code">₹{((e.paymentOrderId.amount || 0) / 100).toFixed(2)}</strong>
                          <div className="cell-sub">{e.paymentOrderId.gatewayOrderId || 'Gateway Settlement'}</div>
                        </div>
                      ) : (
                        <span className="cell-sub">Direct Admin Action</span>
                      )}
                    </td>
                    <td>
                      <span className="mono-badge">
                        {e.actorType || 'USER'}
                      </span>
                    </td>
                  </tr>
                ))
              )
            ) : (
              <tr>
                <td colSpan={source === 'system' ? 7 : 6} className="empty-table-cell">
                  No audit records found matching the active filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Server Pagination */}
      <AdminPagination
        page={page}
        pages={pagination.pages}
        total={pagination.total}
        limit={pagination.limit || 25}
        loading={loading}
        onPageChange={(newPage) => setPage(newPage)}
      />

      {/* Details Drawer / Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header-row" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileClock size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ffffff' }}>
                    {selectedEvent.details?.action || selectedEvent.eventType}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Event Record ID: <span className="mono-code" style={{ fontSize: '0.72rem' }}>{selectedEvent._id}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedEvent(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Event Summary Card */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                Execution Summary
              </div>
              <div style={{ fontSize: '0.92rem', color: '#f8fafc', fontWeight: 600, lineHeight: 1.5 }}>
                {selectedEvent.details?.changeSummary || selectedEvent.eventType}
              </div>
              {selectedEvent.details?.reason && (
                <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fbbf24', fontSize: '0.82rem' }}>
                  <strong>Admin Reason:</strong> "{selectedEvent.details.reason}"
                </div>
              )}
            </div>

            {/* Before vs After State Mutation Diff */}
            {(selectedEvent.details?.before || selectedEvent.details?.after) && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                  State Mutation Comparison (Before vs After)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>PREVIOUS STATE (BEFORE)</span>
                    </div>
                    <pre style={{ margin: 0, fontSize: '0.76rem', color: '#cbd5e1', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(selectedEvent.details?.before ?? { state: 'None' }, null, 2)}
                    </pre>
                  </div>

                  <div style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '8px', padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>UPDATED STATE (AFTER)</span>
                    </div>
                    <pre style={{ margin: 0, fontSize: '0.76rem', color: '#cbd5e1', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(selectedEvent.details?.after ?? { state: 'None' }, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Context & Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Administrator Actor</span>
                <div style={{ color: '#f1f5f9', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.2rem' }}>
                  {selectedEvent.actorId?.username || selectedEvent.actorRole || 'System'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  Role: {selectedEvent.actorRole || selectedEvent.actorId?.role || 'admin'}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Target Entity</span>
                <div style={{ color: '#f1f5f9', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.2rem' }}>
                  {selectedEvent.details?.targetIdentifier || selectedEvent.targetId?.username || '—'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  Type: {selectedEvent.targetType || 'User'}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Client Network (IP / UA)</span>
                <div style={{ color: '#f1f5f9', fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace', marginTop: '0.2rem' }}>
                  {selectedEvent.ipAddress || '127.0.0.1'}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedEvent.userAgent || '—'}>
                  {selectedEvent.userAgent ? selectedEvent.userAgent.slice(0, 45) + '...' : 'Internal API'}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Trace & Severity</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <span className={`badge-pill ${getSeverityBadgeClass(selectedEvent.severity || 'INFO')}`} style={{ fontSize: '0.7rem' }}>
                    {selectedEvent.severity || 'INFO'}
                  </span>
                  <span className="badge-pill free" style={{ fontSize: '0.7rem' }}>
                    {selectedEvent.category || 'ADMIN'}
                  </span>
                </div>
                {selectedEvent.traceId && (
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace', marginTop: '0.25rem' }}>
                    Trace: {selectedEvent.traceId.slice(0, 16)}...
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions" style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setSelectedEvent(null)}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
