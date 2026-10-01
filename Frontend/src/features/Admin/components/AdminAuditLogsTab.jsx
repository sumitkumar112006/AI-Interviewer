import React, { useEffect, useState, useCallback } from 'react';
import { getAdminAuditLogs } from '../services/admin.api';
import { FileClock, ArrowRight } from 'lucide-react';
import AdminPagination from './AdminPagination';

export const AdminAuditLogsTab = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 25 });

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdminAuditLogs({ page, eventType: eventFilter, limit: 25 });
      if (res.success) {
        setEvents(res.data);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const getEventBadgeClass = (eventType) => {
    switch (eventType) {
      case 'ACTIVATED': return 'active';
      case 'UPGRADED': return 'premium';
      case 'DOWNGRADED': return 'pro';
      case 'RENEWED': return 'active';
      case 'CANCELLED': return 'blocked';
      default: return 'free';
    }
  };

  return (
    <div className="admin-audit-logs-section">
      {/* Toolbar Filters */}
      <div className="users-toolbar">
        <div className="filter-group">
          <select value={eventFilter} onChange={(e) => { setEventFilter(e.target.value); setPage(1); }}>
            <option value="">All Event Transitions</option>
            <option value="ACTIVATED">ACTIVATED (New Sub)</option>
            <option value="UPGRADED">UPGRADED (Tier Bump)</option>
            <option value="DOWNGRADED">DOWNGRADED (Tier Drop)</option>
            <option value="RENEWED">RENEWED (Cycle Renewal)</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <div className="toolbar-counter">
          Showing <strong>{events.length}</strong> of <strong>{pagination.total}</strong> audit records
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="users-table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User Account</th>
              <th>State Transition Event</th>
              <th>Tier Transition</th>
              <th>Settled Reference</th>
              <th>Actor Scope</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="empty-table-cell">Loading system audit trail...</td>
              </tr>
            ) : events.length > 0 ? (
              events.map((e) => (
                <tr key={e._id}>
                  <td className="timestamp-cell">
                    {new Date(e.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </td>
                  <td>
                    <div className="user-name">{e.userId?.username || 'Unknown User'}</div>
                    <div className="user-email">{e.userId?.email || '—'}</div>
                  </td>
                  <td>
                    <span className={`badge-pill ${getEventBadgeClass(e.eventType)}`}>
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
            ) : (
              <tr>
                <td colSpan="6" className="empty-table-cell">
                  No audit logs recorded for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <AdminPagination
        page={page}
        pages={pagination.pages}
        total={pagination.total}
        limit={pagination.limit || 25}
        loading={loading}
        onPageChange={(newPage) => setPage(newPage)}
      />
    </div>
  );
};
