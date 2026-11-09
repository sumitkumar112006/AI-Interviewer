import React, { useState, useEffect } from 'react';
import {
    Ticket,
    Plus,
    RefreshCw,
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Calendar,
    Users,
    DollarSign,
    Layers,
    Tag,
    Edit2,
    Eye,
    Percent,
    Lock,
    Unlock,
    Info,
    X
} from 'lucide-react';
import {
    getAdminCoupons,
    createAdminCoupon,
    updateAdminCoupon,
    toggleAdminCouponStatus,
    getAdminCouponDetails
} from '../services/admin.api';
import AdminPagination from './AdminPagination';

export function AdminCouponsTab() {
    const [coupons, setCoupons] = useState([]);
    const [stats, setStats] = useState({ totalCoupons: 0, activeCoupons: 0, totalRedemptions: 0, totalDiscountSaved: 0 });
    const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState(null);
    const [viewingCouponDetails, setViewingCouponDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Form state
    const initialFormState = {
        code: '',
        discountType: 'PERCENTAGE',
        discountValue: '',
        maxDiscountAmountRupees: '',
        minOrderValueRupees: '',
        startDate: '',
        expirationDate: '',
        usageLimit: '',
        perUserLimit: '1',
        eligiblePlans: ['pro', 'premium'],
        isActive: true,
        description: ''
    };
    const [formData, setFormData] = useState(initialFormState);
    const [formSubmitting, setFormSubmitting] = useState(false);

    const fetchCoupons = async (page = 1) => {
        setLoading(true);
        setStatusMsg({ type: '', text: '' });
        try {
            const params = {
                page,
                limit: pagination.limit,
                search: search.trim() || undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined
            };
            const res = await getAdminCoupons(params);
            if (res.success && res.data) {
                setCoupons(res.data.coupons || []);
                setPagination(res.data.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
                if (res.data.stats) {
                    setStats(res.data.stats);
                }
            }
        } catch (err) {
            setStatusMsg({
                type: 'error',
                text: err?.response?.data?.message || 'Failed to load coupons.'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCoupons(1);
    }, [statusFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchCoupons(1);
    };

    const handleOpenCreateModal = () => {
        setEditingCoupon(null);
        setFormData(initialFormState);
        setIsCreateModalOpen(true);
    };

    const handleOpenEditModal = (coupon) => {
        setEditingCoupon(coupon);
        setFormData({
            code: coupon.code,
            discountType: coupon.discountType || 'PERCENTAGE',
            discountValue: coupon.discountType === 'FIXED' ? (coupon.discountValue / 100).toString() : coupon.discountValue.toString(),
            maxDiscountAmountRupees: coupon.maxDiscountAmount ? (coupon.maxDiscountAmount / 100).toString() : '',
            minOrderValueRupees: coupon.minOrderValue ? (coupon.minOrderValue / 100).toString() : '',
            startDate: coupon.startDate ? new Date(coupon.startDate).toISOString().slice(0, 16) : '',
            expirationDate: coupon.expirationDate ? new Date(coupon.expirationDate).toISOString().slice(0, 16) : '',
            usageLimit: coupon.usageLimit ? coupon.usageLimit.toString() : '',
            perUserLimit: coupon.perUserLimit ? coupon.perUserLimit.toString() : '1',
            eligiblePlans: coupon.eligiblePlans || ['pro', 'premium'],
            isActive: coupon.isActive !== false,
            description: coupon.description || ''
        });
        setIsCreateModalOpen(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setFormSubmitting(true);
        setStatusMsg({ type: '', text: '' });

        try {
            const payload = {
                code: formData.code.trim().toUpperCase(),
                discountType: formData.discountType,
                discountValue: formData.discountType === 'FIXED'
                    ? Math.round(parseFloat(formData.discountValue) * 100)
                    : parseInt(formData.discountValue, 10),
                maxDiscountAmount: formData.maxDiscountAmountRupees ? Math.round(parseFloat(formData.maxDiscountAmountRupees) * 100) : null,
                minOrderValue: formData.minOrderValueRupees ? Math.round(parseFloat(formData.minOrderValueRupees) * 100) : 0,
                startDate: formData.startDate ? new Date(formData.startDate) : undefined,
                expirationDate: formData.expirationDate ? new Date(formData.expirationDate) : null,
                usageLimit: formData.usageLimit ? parseInt(formData.usageLimit, 10) : null,
                perUserLimit: formData.perUserLimit ? parseInt(formData.perUserLimit, 10) : 1,
                eligiblePlans: formData.eligiblePlans,
                isActive: formData.isActive,
                description: formData.description.trim()
            };

            if (editingCoupon) {
                await updateAdminCoupon(editingCoupon._id, payload);
                setStatusMsg({ type: 'success', text: `Coupon "${payload.code}" updated successfully.` });
            } else {
                await createAdminCoupon(payload);
                setStatusMsg({ type: 'success', text: `Coupon "${payload.code}" created successfully.` });
            }

            setIsCreateModalOpen(false);
            fetchCoupons(pagination.page);
        } catch (err) {
            setStatusMsg({
                type: 'error',
                text: err?.response?.data?.message || 'Failed to save coupon.'
            });
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleToggleStatus = async (coupon) => {
        const nextState = !coupon.isActive;
        try {
            await toggleAdminCouponStatus(coupon._id, nextState);
            setCoupons(prev => prev.map(c => c._id === coupon._id ? { ...c, isActive: nextState } : c));
            setStatusMsg({
                type: 'success',
                text: `Coupon "${coupon.code}" is now ${nextState ? 'active' : 'inactive'}.`
            });
            setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
        } catch (err) {
            setStatusMsg({
                type: 'error',
                text: err?.response?.data?.message || 'Failed to update coupon status.'
            });
        }
    };

    const handleViewDetails = async (couponId) => {
        setDetailsLoading(true);
        setViewingCouponDetails(null);
        try {
            const res = await getAdminCouponDetails(couponId);
            if (res.success && res.data) {
                setViewingCouponDetails(res.data);
            }
        } catch (err) {
            setStatusMsg({
                type: 'error',
                text: err?.response?.data?.message || 'Failed to retrieve coupon redemptions.'
            });
        } finally {
            setDetailsLoading(false);
        }
    };

    return (
        <div className="admin-coupons-container" style={{ padding: '4px', maxWidth: '1300px', margin: '0 auto' }}>
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Ticket className="text-amber-400" size={26} />
                        Coupon & Discount Engine
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '4px' }}>
                        Manage promotional codes, percentage/fixed discounts, usage limits, and redemption audit trails.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={() => fetchCoupons(pagination.page)}
                        disabled={loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#e2e8f0',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 18px',
                            background: '#d97706',
                            border: '1px solid #f59e0b',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)'
                        }}
                    >
                        <Plus size={16} />
                        Create Coupon
                    </button>
                </div>
            </div>

            {/* Notification Toast */}
            {statusMsg.text && (
                <div
                    style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '0.875rem',
                        background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        border: `1px solid ${statusMsg.type === 'error' ? '#ef4444' : '#10b981'}`,
                        color: statusMsg.type === 'error' ? '#fca5a5' : '#6ee7b7'
                    }}
                >
                    {statusMsg.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{statusMsg.text}</span>
                </div>
            )}

            {/* High-Level Analytics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>TOTAL COUPONS</span>
                        <Tag size={18} className="text-amber-400" />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#f8fafc', marginTop: '8px' }}>
                        {stats.totalCoupons}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Configured promotional rules</span>
                </div>

                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>ACTIVE COUPONS</span>
                        <CheckCircle2 size={18} className="text-emerald-400" />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#34d399', marginTop: '8px' }}>
                        {stats.activeCoupons}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Currently redeemable</span>
                </div>

                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>TOTAL REDEMPTIONS</span>
                        <Users size={18} className="text-indigo-400" />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#818cf8', marginTop: '8px' }}>
                        {stats.totalRedemptions}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Applied checkout discounts</span>
                </div>

                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>DISCOUNTS GRANTED</span>
                        <DollarSign size={18} className="text-emerald-400" />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#10b981', marginTop: '8px' }}>
                        ₹{(stats.totalDiscountSaved / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Verified user savings</span>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: '1', minWidth: '260px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            type="text"
                            placeholder="Search by coupon code or description..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 34px',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: '#f1f5f9',
                                fontSize: '0.85rem'
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        style={{
                            padding: '8px 14px',
                            background: '#334155',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#e2e8f0',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        Search
                    </button>
                </form>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Status:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#f1f5f9',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Inactive Only</option>
                        <option value="expired">Expired Only</option>
                    </select>
                </div>
            </div>

            {/* Coupons Table */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                                <th style={{ padding: '12px 16px' }}>COUPON CODE</th>
                                <th style={{ padding: '12px 16px' }}>DISCOUNT</th>
                                <th style={{ padding: '12px 16px' }}>RULES & LIMITS</th>
                                <th style={{ padding: '12px 16px' }}>ELIGIBLE PLANS</th>
                                <th style={{ padding: '12px 16px' }}>VALIDITY</th>
                                <th style={{ padding: '12px 16px' }}>REDEMPTIONS</th>
                                <th style={{ padding: '12px 16px' }}>STATUS</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                        <RefreshCw size={24} className="animate-spin text-amber-400 mx-auto mb-2" />
                                        Loading coupons...
                                    </td>
                                </tr>
                            ) : coupons.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                        <Tag size={28} className="text-slate-600 mx-auto mb-2" />
                                        No coupons found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                coupons.map((c) => {
                                    const isExpired = c.expirationDate && new Date(c.expirationDate).getTime() < Date.now();
                                    const isExhausted = c.usageLimit && c.usedCount >= c.usageLimit;

                                    return (
                                        <tr key={c._id} style={{ borderBottom: '1px solid #1e293b', transition: 'background 0.15s' }}>
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '0.95rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                                                        {c.code}
                                                    </span>
                                                </div>
                                                {c.description && (
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                                        {c.description}
                                                    </div>
                                                )}
                                            </td>

                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ fontWeight: '600', color: '#f1f5f9' }}>
                                                    {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `₹${(c.discountValue / 100).toFixed(2)} FLAT`}
                                                </div>
                                                {c.discountType === 'PERCENTAGE' && c.maxDiscountAmount && (
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        Cap: ₹{(c.maxDiscountAmount / 100).toFixed(2)}
                                                    </div>
                                                )}
                                            </td>

                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ color: '#cbd5e1' }}>
                                                    {c.minOrderValue > 0 ? `Min: ₹${(c.minOrderValue / 100).toFixed(2)}` : 'No Min Order'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    Max {c.perUserLimit || 1}x per user
                                                </div>
                                            </td>

                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    {c.eligiblePlans?.map(p => (
                                                        <span key={p} style={{ fontSize: '0.7rem', padding: '2px 6px', background: p === 'premium' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: p === 'premium' ? '#c084fc' : '#60a5fa', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
                                                            {p}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>

                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                                                    {c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : 'Never expires'}
                                                </div>
                                                {isExpired && (
                                                    <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: '600' }}>
                                                        Expired
                                                    </span>
                                                )}
                                            </td>

                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ fontWeight: '600', color: isExhausted ? '#ef4444' : '#f1f5f9' }}>
                                                    {c.usedCount} / {c.usageLimit || '∞'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    {c.usageLimit ? `${Math.round((c.usedCount / c.usageLimit) * 100)}% consumed` : 'Unlimited'}
                                                </div>
                                            </td>

                                            <td style={{ padding: '14px 16px' }}>
                                                {isExpired ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '500' }}>
                                                        <Clock size={12} /> Expired
                                                    </span>
                                                ) : isExhausted ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '500' }}>
                                                        <XCircle size={12} /> Exhausted
                                                    </span>
                                                ) : c.isActive ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '500' }}>
                                                        <CheckCircle2 size={12} /> Active
                                                    </span>
                                                ) : (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'rgba(100, 116, 139, 0.1)', color: '#94a3b8', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '500' }}>
                                                        <Lock size={12} /> Inactive
                                                    </span>
                                                )}
                                            </td>

                                            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetails(c._id)}
                                                        title="View Redemptions"
                                                        style={{ padding: '6px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer' }}
                                                    >
                                                        <Eye size={14} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(c)}
                                                        title="Edit Coupon"
                                                        style={{ padding: '6px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer' }}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleStatus(c)}
                                                        title={c.isActive ? 'Deactivate Coupon' : 'Activate Coupon'}
                                                        style={{ padding: '6px', background: c.isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: `1px solid ${c.isActive ? '#ef4444' : '#10b981'}`, borderRadius: '6px', color: c.isActive ? '#ef4444' : '#10b981', cursor: 'pointer' }}
                                                    >
                                                        {c.isActive ? <Lock size={14} /> : <Unlock size={14} />}
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

                {pagination.pages > 1 && (
                    <div style={{ padding: '14px 16px', borderTop: '1px solid #1e293b' }}>
                        <AdminPagination
                            pagination={pagination}
                            onPageChange={(p) => fetchCoupons(p)}
                        />
                    </div>
                )}
            </div>

            {/* Create & Edit Modal */}
            {isCreateModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
                    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '14px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                <Ticket className="text-amber-400" size={20} />
                                {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Promotional Coupon'}
                            </h3>
                            <button type="button" onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleFormSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Coupon Code *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        disabled={!!editingCoupon}
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        placeholder="e.g. FLASH30"
                                        style={{ width: '100%', padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontWeight: '600', textTransform: 'uppercase' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Discount Type *
                                    </label>
                                    <select
                                        disabled={!!editingCoupon}
                                        value={formData.discountType}
                                        onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    >
                                        <option value="PERCENTAGE">Percentage (%) Off</option>
                                        <option value="FIXED">Fixed Amount (₹) Off</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        {formData.discountType === 'PERCENTAGE' ? 'Discount Percentage (%) *' : 'Discount Amount (₹) *'}
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        max={formData.discountType === 'PERCENTAGE' ? 100 : undefined}
                                        step={formData.discountType === 'FIXED' ? '0.01' : '1'}
                                        disabled={!!editingCoupon}
                                        value={formData.discountValue}
                                        onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                                        placeholder={formData.discountType === 'PERCENTAGE' ? 'e.g. 25' : 'e.g. 50.00'}
                                        style={{ width: '100%', padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Max Discount Cap (₹) (Optional)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.maxDiscountAmountRupees}
                                        onChange={(e) => setFormData({ ...formData, maxDiscountAmountRupees: e.target.value })}
                                        placeholder="e.g. 100.00"
                                        style={{ width: '100%', padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Minimum Order Value (₹)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.minOrderValueRupees}
                                        onChange={(e) => setFormData({ ...formData, minOrderValueRupees: e.target.value })}
                                        placeholder="e.g. 199.00"
                                        style={{ width: '100%', padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Per-User Limit
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.perUserLimit}
                                        onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
                                        placeholder="e.g. 1"
                                        style={{ width: '100%', padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Start Date
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Expiration Date (Optional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.expirationDate}
                                        onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Total Usage Limit (Optional)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.usageLimit}
                                        onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                                        placeholder="Unlimited if empty"
                                        style={{ width: '100%', padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Eligible Plans
                                    </label>
                                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', height: '42px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.eligiblePlans.includes('pro')}
                                                onChange={(e) => {
                                                    const plans = e.target.checked
                                                        ? [...formData.eligiblePlans, 'pro']
                                                        : formData.eligiblePlans.filter(p => p !== 'pro');
                                                    setFormData({ ...formData, eligiblePlans: plans });
                                                }}
                                            />
                                            Pro Plan
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.eligiblePlans.includes('premium')}
                                                onChange={(e) => {
                                                    const plans = e.target.checked
                                                        ? [...formData.eligiblePlans, 'premium']
                                                        : formData.eligiblePlans.filter(p => p !== 'premium');
                                                    setFormData({ ...formData, eligiblePlans: plans });
                                                }}
                                            />
                                            Premium Plan
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                    Internal Description / Campaign Notes
                                </label>
                                <textarea
                                    rows="2"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="e.g. Diwali promotional campaign 2026"
                                    style={{ width: '100%', padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    style={{ padding: '9px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#cbd5e1', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formSubmitting}
                                    style={{ padding: '9px 20px', background: '#d97706', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: formSubmitting ? 'not-allowed' : 'pointer' }}
                                >
                                    {formSubmitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Redemption Details Modal */}
            {viewingCouponDetails && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
                    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '14px', maxWidth: '750px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                                    Redemption Ledger: <span style={{ color: '#f59e0b' }}>{viewingCouponDetails.coupon.code}</span>
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0' }}>
                                    Total Redemptions: {viewingCouponDetails.coupon.usedCount}
                                </p>
                            </div>
                            <button type="button" onClick={() => setViewingCouponDetails(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {viewingCouponDetails.redemptions?.length === 0 ? (
                            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                                No redemptions recorded for this coupon yet.
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ background: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                                        <th style={{ padding: '10px' }}>USER</th>
                                        <th style={{ padding: '10px' }}>DISCOUNT</th>
                                        <th style={{ padding: '10px' }}>FINAL PAID</th>
                                        <th style={{ padding: '10px' }}>STATUS</th>
                                        <th style={{ padding: '10px' }}>DATE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewingCouponDetails.redemptions.map(r => (
                                        <tr key={r._id} style={{ borderBottom: '1px solid #1e293b' }}>
                                            <td style={{ padding: '10px' }}>
                                                <div style={{ fontWeight: '500', color: '#f1f5f9' }}>{r.userId?.username || 'User'}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.userId?.email || 'N/A'}</div>
                                            </td>
                                            <td style={{ padding: '10px', color: '#10b981', fontWeight: '600' }}>
                                                -₹{(r.discountAmount / 100).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '10px', color: '#f8fafc', fontWeight: '600' }}>
                                                ₹{(r.finalAmount / 100).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: r.status === 'APPLIED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)', color: r.status === 'APPLIED' ? '#34d399' : '#facc15' }}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                {new Date(r.redeemedAt || r.createdAt).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

