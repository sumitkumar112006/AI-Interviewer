import React, { useEffect, useState, useCallback } from 'react';
import { getAdminSubscriptions } from '../services/admin.api';

export const AdminSubscriptionsTab = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [tierCounts, setTierCounts] = useState({ pro: 0, premium: 0, activeTotal: 0, cancelledTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdminSubscriptions({ page, plan: planFilter, status: statusFilter, limit: 20 });
      if (res.success) {
        setSubscriptions(res.data);
        setTierCounts(res.tierCounts || { pro: 0, premium: 0, activeTotal: 0, cancelledTotal: 0 });
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to load admin subscriptions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, planFilter, statusFilter]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  return (
    <div className="admin-subscriptions-section">
      {/* Tier Summary Cards */}
      <div className="stats-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Active Subscribers</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>👥</div>
          </div>
          <div className="stat-value" style={{ color: '#34d399' }}>{tierCounts.activeTotal}</div>
          <div className="stat-sub">Across All Paid Tiers</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Pro Tier</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>⚡</div>
          </div>
          <div className="stat-value">{tierCounts.pro}</div>
          <div className="stat-sub">₹199/mo Subscribers</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Premium Tier</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc' }}>👑</div>
          </div>
          <div className="stat-value">{tierCounts.premium}</div>
          <div className="stat-sub">₹349/mo Subscribers</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Cancelled / Churned</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>📉</div>
          </div>
          <div className="stat-value" style={{ color: '#f87171' }}>{tierCounts.cancelledTotal}</div>
          <div className="stat-sub">Inactive Subscriptions</div>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="users-toolbar">
        <div className="filter-group">
          <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}>
            <option value="">All Plans</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
          </select>

          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
        <div style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '13px' }}>
          Showing {subscriptions.length} of {pagination.total} subscriptions
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="users-table-container">
        <table>
          <thead>
            <tr>
              <th>Subscriber</th>
              <th>Current Tier</th>
              <th>Status</th>
              <th>Started On</th>
              <th>Period End</th>
              <th>Auto-Renew</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>Loading subscriptions...</td>
              </tr>
            ) : subscriptions.length > 0 ? (
              subscriptions.map((s) => (
                <tr key={s._id}>
                  <td>
                    <div><strong>{s.userId?.username || 'Unknown'}</strong></div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{s.userId?.email || '—'}</div>
                  </td>
                  <td>
                    <span className={`badge-pill ${s.plan || 'pro'}`}>
                      {(s.plan || 'PRO').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-pill ${s.status === 'ACTIVE' ? 'active' : (s.status === 'CANCELLED' ? 'blocked' : 'free')}`}>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: '#cbd5e1' }}>
                    {new Date(s.startedAt || s.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </td>
                  <td style={{ fontSize: '13px', color: '#cbd5e1' }}>
                    {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    }) : '—'}
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: s.cancelAtPeriodEnd ? '#f87171' : '#34d399', fontWeight: 600 }}>
                      {s.cancelAtPeriodEnd ? 'Cancels at end' : 'Active Auto-Renew'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  No subscriptions found matching the filter.
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
