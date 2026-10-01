import React, { useEffect, useState, useCallback } from 'react';
import { getAdminSubscriptions } from '../services/admin.api';
import { Users, Zap, Crown, UserMinus, Layers } from 'lucide-react';
import AdminPagination from './AdminPagination';

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
      <div className="stats-cards-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Active Subscribers</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(52, 211, 153, 0.12)', color: '#34d399' }}>
              <Layers size={17} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#34d399' }}>{tierCounts.activeTotal}</div>
          <div className="stat-sub">Across Paid Tiers</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Pro Tier</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(129, 140, 248, 0.12)', color: '#818cf8' }}>
              <Zap size={17} />
            </div>
          </div>
          <div className="stat-value">{tierCounts.pro}</div>
          <div className="stat-sub">₹99/mo Active</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Premium Tier</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(192, 132, 252, 0.12)', color: '#c084fc' }}>
              <Crown size={17} />
            </div>
          </div>
          <div className="stat-value">{tierCounts.premium}</div>
          <div className="stat-sub">₹199/mo Active</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Churned / Cancelled</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
              <UserMinus size={17} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#f87171' }}>{tierCounts.cancelledTotal}</div>
          <div className="stat-sub">Inactive Subscriptions</div>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="users-toolbar">
        <div className="filter-group">
          <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}>
            <option value="">All Subscription Tiers</option>
            <option value="pro">Pro Plan</option>
            <option value="premium">Premium Plan</option>
          </select>

          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
        <div className="toolbar-counter">
          Showing <strong>{subscriptions.length}</strong> of <strong>{pagination.total}</strong> subscriptions
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="users-table-container">
        <table>
          <thead>
            <tr>
              <th>Subscriber</th>
              <th>Current Tier</th>
              <th>Subscription Status</th>
              <th>Started On</th>
              <th>Current Period End</th>
              <th>Auto-Renewal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="empty-table-cell">Loading active subscriptions...</td>
              </tr>
            ) : subscriptions.length > 0 ? (
              subscriptions.map((s) => (
                <tr key={s._id}>
                  <td>
                    <div className="user-name">{s.userId?.username || 'Subscriber'}</div>
                    <div className="user-email">{s.userId?.email || '—'}</div>
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
                  <td className="timestamp-cell">
                    {new Date(s.startedAt || s.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </td>
                  <td className="timestamp-cell">
                    {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    }) : '—'}
                  </td>
                  <td>
                    <span className={`renewal-badge ${s.cancelAtPeriodEnd ? 'cancelling' : 'active'}`}>
                      {s.cancelAtPeriodEnd ? 'Expires at end' : 'Auto-Renews'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="empty-table-cell">
                  No subscriptions found matching the filter.
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
        limit={pagination.limit || 20}
        loading={loading}
        onPageChange={(newPage) => setPage(newPage)}
      />
    </div>
  );
};
