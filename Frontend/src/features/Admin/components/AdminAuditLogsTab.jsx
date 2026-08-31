import React, { useEffect, useState, useCallback } from 'react';
import { getAdminAuditLogs } from '../services/admin.api';

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
        <div style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '13px' }}>
          Showing {events.length} of {pagination.total} audit records
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="users-table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Event Type</th>
              <th>Transition</th>
              <th>Payment Reference</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>Loading audit logs...</td>
              </tr>
            ) : events.length > 0 ? (
              events.map((e) => (
                <tr key={e._id}>
                  <td style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    {new Date(e.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </td>
                  <td>
                    <div><strong>{e.userId?.username || 'Unknown'}</strong></div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{e.userId?.email || '—'}</div>
                  </td>
                  <td>
                    <span className={`badge-pill ${getEventBadgeClass(e.eventType)}`}>
                      {e.eventType}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <span className={`badge-pill ${e.fromPlan || 'free'}`}>{(e.fromPlan || 'FREE').toUpperCase()}</span>
                      <span style={{ color: '#94a3b8' }}>→</span>
                      <span className={`badge-pill ${e.toPlan || 'pro'}`}>{(e.toPlan || 'PRO').toUpperCase()}</span>
                    </div>
                  </td>
                  <td>
                    {e.paymentOrderId ? (
                      <div style={{ fontSize: '12px' }}>
                        <strong>₹{((e.paymentOrderId.amount || 0) / 100).toFixed(2)}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{e.paymentOrderId.gatewayOrderId || 'Gateway Order'}</div>
                      </div>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '12px' }}>N/A (System / Admin)</span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>
                      {e.actorType || 'USER'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  No audit logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination.pages > 1 && (
        <div className="pagination-wrapper" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="tab-btn"
            style={{ padding: '6px 14px' }}
          >
            ← Previous
          </button>
          <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>
            Page {page} of {pagination.pages}
          </span>
          <button
            type="button"
            disabled={page >= pagination.pages}
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            className="tab-btn"
            style={{ padding: '6px 14px' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
