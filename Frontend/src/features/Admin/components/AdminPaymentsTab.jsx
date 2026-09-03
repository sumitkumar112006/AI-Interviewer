import React, { useEffect, useState, useCallback } from 'react';
import { getAdminPayments } from '../services/admin.api';
import { TrendingUp, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';

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
      <div className="stats-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Total Revenue</span>
          </div>
          <div className="stat-value" style={{ color: '#34d399' }}>
            ₹{summary ? summary.totalRevenueRupees : '0.00'}
          </div>
          <div className="stat-sub">From Settled Transactions</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Successful Payments</span>
          </div>
          <div className="stat-value">{summary?.successCount || 0}</div>
          <div className="stat-sub">Captured & Verified</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Failed Payments</span>
          </div>
          <div className="stat-value" style={{ color: '#f87171' }}>{summary?.failedCount || 0}</div>
          <div className="stat-sub">Gateway Abandoned/Declined</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Refunds</span>
          </div>
          <div className="stat-value">{summary?.refundedCount || 0}</div>
          <div className="stat-sub">Processed Refunds</div>
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
        <div style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '13px' }}>
          Showing {payments.length} of {pagination.total} transactions
        </div>
      </div>

      {/* Payments Table */}
      <div className="users-table-container">
        <table>
          <thead>
            <tr>
              <th>Payment ID / Gateway</th>
              <th>Customer</th>
              <th>Plan & Cycle</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>Loading payments...</td>
              </tr>
            ) : payments.length > 0 ? (
              payments.map((p) => (
                <tr key={p._id}>
                  <td>
                    <strong>{p.gatewayPaymentId || p._id}</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{p.gateway} • {p.gatewayOrderId || 'N/A'}</div>
                  </td>
                  <td>
                    <div><strong>{p.userId?.username || 'Unknown'}</strong></div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{p.userId?.email || '—'}</div>
                  </td>
                  <td>
                    <span className={`badge-pill ${p.orderId?.planKey || 'pro'}`}>
                      {(p.orderId?.planKey || 'PRO').toUpperCase()}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                      {p.orderId?.billingCycle || 'MONTHLY'}
                    </span>
                  </td>
                  <td>
                    <strong>₹{(p.amount / 100).toFixed(2)}</strong>
                  </td>
                  <td>
                    <span style={{ textTransform: 'uppercase', fontSize: '12px', color: '#cbd5e1' }}>
                      {p.paymentMethod || 'UPI/CARD'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-pill ${p.status === 'SUCCESS' ? 'active' : (p.status === 'FAILED' ? 'blocked' : 'free')}`}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: '#94a3b8' }}>
                    {new Date(p.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  No payment records found matching the selected filter.
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
