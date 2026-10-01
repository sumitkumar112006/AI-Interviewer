import React, { useEffect, useState, useCallback } from 'react';
import { getAdminPayments } from '../services/admin.api';
import { CreditCard, CheckCircle2, AlertCircle, RotateCcw, Filter, Search } from 'lucide-react';
import AdminPagination from './AdminPagination';

export const AdminPaymentsTab = () => {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdminPayments({ page, status: statusFilter, limit: 20 });
      if (res.success) {
        setPayments(res.data);
        setSummary(res.summary);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to load admin payments:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return (
    <div className="admin-payments-section">
      {/* Revenue Summary Cards */}
      <div className="stats-cards-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Settled Revenue</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(52, 211, 153, 0.12)', color: '#34d399' }}>
              <CreditCard size={17} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#34d399' }}>
            ₹{summary ? summary.totalRevenueRupees : '0.00'}
          </div>
          <div className="stat-sub">INR Gross Collected</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Completed Orders</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="stat-value">{summary?.successCount || 0}</div>
          <div className="stat-sub">Verified Transactions</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Failed / Abandoned</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
              <AlertCircle size={17} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#f87171' }}>{summary?.failedCount || 0}</div>
          <div className="stat-sub">Gateway Drops</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Refunds</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }}>
              <RotateCcw size={17} />
            </div>
          </div>
          <div className="stat-value">{summary?.refundedCount || 0}</div>
          <div className="stat-sub">Reversals</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="users-toolbar">
        <div className="filter-group">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Payment Statuses</option>
            <option value="SUCCESS">Success (Paid)</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
          </select>
        </div>
        <div className="toolbar-counter">
          Showing <strong>{payments.length}</strong> of <strong>{pagination.total}</strong> records
        </div>
      </div>

      {/* Payments Table */}
      <div className="users-table-container">
        <table>
          <thead>
            <tr>
              <th>Transaction Reference</th>
              <th>Customer</th>
              <th>Tier & Cycle</th>
              <th>Settled Amount</th>
              <th>Payment Rail</th>
              <th>Status</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="empty-table-cell">Loading payments ledger...</td>
              </tr>
            ) : payments.length > 0 ? (
              payments.map((p) => (
                <tr key={p._id}>
                  <td>
                    <strong className="mono-code">{p.gatewayPaymentId || p._id}</strong>
                    <div className="cell-sub">{p.gateway || 'Razorpay'} {p.gatewayOrderId ? `• ${p.gatewayOrderId}` : ''}</div>
                  </td>
                  <td>
                    <div className="user-name">{p.userId?.username || 'Customer'}</div>
                    <div className="user-email">{p.userId?.email || '—'}</div>
                  </td>
                  <td>
                    <span className={`badge-pill ${p.orderId?.planKey || 'pro'}`}>
                      {(p.orderId?.planKey || 'PRO').toUpperCase()}
                    </span>
                    <span className="cycle-sub">
                      {p.orderId?.billingCycle || 'MONTHLY'}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: '#ffffff', fontSize: '0.92rem' }}>₹{(p.amount / 100).toFixed(2)}</strong>
                  </td>
                  <td>
                    <span className="mono-badge">
                      {p.paymentMethod || 'UPI/CARD'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-pill ${p.status === 'SUCCESS' ? 'active' : (p.status === 'FAILED' ? 'blocked' : 'free')}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="timestamp-cell">
                    {new Date(p.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="empty-table-cell">
                  No payment records found matching the selected filter.
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
