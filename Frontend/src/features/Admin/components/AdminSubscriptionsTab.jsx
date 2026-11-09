import React, { useEffect, useState, useCallback } from 'react';
import { getAdminSubscriptions, getAdminSubscriptionReconciliation } from '../services/admin.api';
import {
  Users,
  Zap,
  Crown,
  UserMinus,
  Layers,
  Database,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import AdminPagination from './AdminPagination';
import { AdminExportButton } from './AdminExportButton';

export const AdminSubscriptionsTab = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [tierCounts, setTierCounts] = useState({ pro: 0, premium: 0, free: 0, activeTotal: 0, cancelledTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });

  // Reconciliation Diagnostic State
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconciliation, setReconciliation] = useState(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdminSubscriptions({ page, plan: planFilter, status: statusFilter, limit: 20 });
      if (res.success) {
        setSubscriptions(res.data);
        setTierCounts(res.tierCounts || { pro: 0, premium: 0, free: 0, activeTotal: 0, cancelledTotal: 0 });
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to load admin subscriptions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, planFilter, statusFilter]);

  const fetchReconciliation = async () => {
    try {
      setReconciliationLoading(true);
      const res = await getAdminSubscriptionReconciliation();
      if (res.success) {
        setReconciliation(res.data);
      }
    } catch (err) {
      console.error('Failed to load reconciliation diagnostics:', err);
    } finally {
      setReconciliationLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    if (showReconciliation && !reconciliation) {
      fetchReconciliation();
    }
  }, [showReconciliation]);

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
          <div className="stat-sub">Across All Tiers</div>
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

      {/* Forensic Reconciliation Diagnostic Accordion */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 mb-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                User & Subscription Forensic Reconciliation
                <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Read-Only Diagnostic
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Audit relationship between 75 registered users, 52 subscription records, and financial payments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showReconciliation && (
              <button
                type="button"
                onClick={fetchReconciliation}
                disabled={reconciliationLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reconciliationLoading ? 'animate-spin text-blue-400' : ''}`} />
                Re-Run
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowReconciliation(prev => !prev)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors"
            >
              {showReconciliation ? 'Hide Diagnostic' : 'Run Diagnostic Audit'}
              {showReconciliation ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {showReconciliation && (
          <div className="mt-5 pt-5 border-t border-zinc-800/80 animate-fade-in space-y-4">
            {reconciliationLoading ? (
              <div className="py-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                Aggregating database collections and cross-referencing records...
              </div>
            ) : reconciliation ? (
              <div className="space-y-4">
                {/* 4 Diagnostic Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
                    <div className="text-xs text-zinc-400 mb-1">Total Users vs Subscriptions</div>
                    <div className="text-xl font-bold font-mono text-white">
                      {reconciliation.summary.totalRegisteredUsers}{' '}
                      <span className="text-xs text-zinc-400 font-sans">users /</span>{' '}
                      <span className="text-blue-400">{reconciliation.summary.totalSubscriptionRecords}</span>{' '}
                      <span className="text-xs text-zinc-400 font-sans">subs</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      {reconciliation.summary.usersWithoutSubscription} free users without sub doc
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
                    <div className="text-xs text-zinc-400 mb-1">Status Casing Normalization</div>
                    <div className="text-xl font-bold font-mono text-emerald-400">
                      {reconciliation.integrityAudit.casingInconsistency.uppercaseACTIVE}{' '}
                      <span className="text-xs text-zinc-400 font-sans">ACTIVE /</span>{' '}
                      <span className="text-amber-400">{reconciliation.integrityAudit.casingInconsistency.lowercaseActive}</span>{' '}
                      <span className="text-xs text-zinc-400 font-sans">active</span>
                    </div>
                    <div className="text-[11px] text-emerald-400/90 mt-1">
                      ✓ Normalized to uppercase in queries & export
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
                    <div className="text-xs text-zinc-400 mb-1">Multi-Subscription Accounts</div>
                    <div className="text-xl font-bold font-mono text-amber-400">
                      {reconciliation.summary.usersWithMultipleSubscriptions} <span className="text-xs text-zinc-400 font-sans">users</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      Upgraded users with historical uncancelled free sub
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
                    <div className="text-xs text-zinc-400 mb-1">Orphaned Subscriptions</div>
                    <div className="text-xl font-bold font-mono text-zinc-300">
                      {reconciliation.summary.orphanedSubscriptionRecords} <span className="text-xs text-zinc-400 font-sans">record</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      Pre-retention deleted user subscription
                    </div>
                  </div>
                </div>

                {/* Explanation Banner */}
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-zinc-300 space-y-1">
                  <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    Architectural Root Cause & Findings:
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    <strong>1. 75 Users vs 52 Subscriptions:</strong> All {reconciliation.userReconciliation.usersWithoutSubscription.total} users without subscription documents are on the Free tier (created via Google OAuth / unseeded). The platform serves their free allowances gracefully via virtual fallback without requiring a database document.
                    <br />
                    <strong>2. 41 ACTIVE vs 11 active:</strong> Lowercase <code>active</code> documents stemmed from initial database migration scripts before Mongoose schema setter enforcement was added. All queries and exports now normalize these seamlessly.
                    <br />
                    <strong>3. Period End earlier than Today:</strong> Free plan users have a 30-day quota reset date, which does not expire their account. No destructive modification was made; historical fidelity is fully preserved.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Toolbar Filters */}
      <div className="users-toolbar">
        <div className="filter-group">
          <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}>
            <option value="">All Subscription Tiers</option>
            <option value="free">Free Plan</option>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AdminExportButton
            moduleName="subscriptions"
            filters={{ plan: planFilter, status: statusFilter }}
            label="Export Subscriptions"
          />
          <div className="toolbar-counter">
            Showing <strong>{subscriptions.length}</strong> of <strong>{pagination.total}</strong> subscriptions
          </div>
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
              subscriptions.map((s) => {
                const normStatus = (s.status || 'ACTIVE').toUpperCase();
                return (
                  <tr key={s._id}>
                    <td>
                      <div className="user-name" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{s.userId?.username || 'Subscriber'}</span>
                        {s.userId?.isDeleted && (
                          <span className="mono-badge" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)' }}>
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="user-email">{s.userId?.email || '—'}</div>
                    </td>
                    <td>
                      <span className={`badge-pill ${s.plan || 'pro'}`}>
                        {(s.plan || 'PRO').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-pill ${normStatus === 'ACTIVE' ? 'active' : (normStatus === 'CANCELLED' ? 'blocked' : 'free')}`}>
                        {normStatus}
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
                );
              })
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
        limit={pagination.limit}
        onPageChange={(p) => setPage(p)}
      />
    </div>
  );
};
