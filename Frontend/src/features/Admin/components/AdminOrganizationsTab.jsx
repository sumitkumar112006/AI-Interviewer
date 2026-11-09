import React, { useState, useEffect } from 'react';
import {
    Building2,
    GraduationCap,
    Briefcase,
    Users,
    Search,
    RefreshCw,
    Plus,
    Edit2,
    ShieldAlert,
    ShieldCheck,
    AlertTriangle,
    CheckCircle2,
    X,
    Eye,
    TrendingUp,
    FileText,
    Bot,
    ExternalLink,
    UserCheck,
    UserX,
    Clock
} from 'lucide-react';
import {
    getAdminOrganizations,
    getAdminOrganizationDetails,
    createAdminOrganization,
    updateAdminOrganization,
    setAdminOrganizationStatus,
    getAdminOrganizationStats,
    getAdminOrganizationMembers,
    assignAdminOrgAdmin,
    removeAdminOrgAdmin,
    addAdminOrgMember,
    removeAdminOrgMember
} from '../services/admin.api';

export const AdminOrganizationsTab = () => {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Modal States
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState(null);
    const [inspectingOrgId, setInspectingOrgId] = useState(null);
    const [inspectData, setInspectData] = useState({ org: null, stats: null, members: [], membersTotal: 0 });
    const [inspectTab, setInspectTab] = useState('overview'); // 'overview' | 'members' | 'admins'
    const [inspectLoading, setInspectLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'college',
        contactPerson: '',
        email: '',
        phone: '',
        website: '',
        tier: 'standard',
        maxSeats: 50,
        monthlyInterviewQuota: 500,
        monthlyResumeQuota: 500,
        allowedEmailDomains: ''
    });

    // Submitting State
    const [submitting, setSubmitting] = useState(false);
    const [actionTargetId, setActionTargetId] = useState(null);

    // New member/admin inputs
    const [newUserId, setNewUserId] = useState('');

    const fetchOrganizations = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getAdminOrganizations({
                search,
                type: typeFilter,
                status: statusFilter,
                page,
                limit: 15
            });
            if (data?.success) {
                setOrganizations(data.organizations || []);
                setTotal(data.total || 0);
                setTotalPages(data.totalPages || 1);
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to load organizations.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrganizations();
    }, [page, typeFilter, statusFilter]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchOrganizations();
    };

    const handleOpenCreate = () => {
        setEditingOrg(null);
        setFormData({
            name: '',
            type: 'college',
            contactPerson: '',
            email: '',
            phone: '',
            website: '',
            tier: 'standard',
            maxSeats: 50,
            monthlyInterviewQuota: 500,
            monthlyResumeQuota: 500,
            allowedEmailDomains: ''
        });
        setCreateModalOpen(true);
    };

    const handleOpenEdit = (org) => {
        setEditingOrg(org);
        setFormData({
            name: org.name || '',
            type: org.type || 'college',
            contactPerson: org.contact?.contactPerson || '',
            email: org.contact?.email || '',
            phone: org.contact?.phone || '',
            website: org.contact?.website || '',
            tier: org.agreement?.tier || 'standard',
            maxSeats: org.agreement?.maxSeats || 50,
            monthlyInterviewQuota: org.agreement?.monthlyInterviewQuota || 500,
            monthlyResumeQuota: org.agreement?.monthlyResumeQuota || 500,
            allowedEmailDomains: (org.settings?.allowedEmailDomains || []).join(', ')
        });
        setCreateModalOpen(true);
    };

    const handleSaveOrganization = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        const domains = formData.allowedEmailDomains
            ? formData.allowedEmailDomains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
            : [];

        const payload = {
            name: formData.name,
            type: formData.type,
            contact: {
                contactPerson: formData.contactPerson,
                email: formData.email,
                phone: formData.phone,
                website: formData.website
            },
            agreement: {
                tier: formData.tier,
                maxSeats: Number(formData.maxSeats) || 50,
                monthlyInterviewQuota: Number(formData.monthlyInterviewQuota) || 500,
                monthlyResumeQuota: Number(formData.monthlyResumeQuota) || 500
            },
            settings: {
                allowedEmailDomains: domains
            }
        };

        try {
            if (editingOrg) {
                await updateAdminOrganization(editingOrg._id, payload);
                setSuccessMsg(`Organization "${formData.name}" updated successfully.`);
            } else {
                await createAdminOrganization(payload);
                setSuccessMsg(`Organization "${formData.name}" created successfully.`);
            }
            setCreateModalOpen(false);
            setTimeout(() => setSuccessMsg(''), 4000);
            fetchOrganizations();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to save organization.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = async (org) => {
        const newStatus = org.status === 'active' ? 'suspended' : 'active';
        const actionLabel = newStatus === 'suspended' ? 'SUSPEND' : 'ACTIVATE';
        if (!window.confirm(`Are you sure you want to ${actionLabel} "${org.name}"?`)) return;

        const reason = window.prompt(`Enter reason for ${actionLabel}:`, 'Administrative status update');
        if (reason === null) return;

        try {
            setActionTargetId(org._id);
            await setAdminOrganizationStatus(org._id, newStatus, reason || 'Administrative action');
            setSuccessMsg(`Organization "${org.name}" is now ${newStatus}.`);
            setTimeout(() => setSuccessMsg(''), 4000);
            fetchOrganizations();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to update organization status.');
        } finally {
            setActionTargetId(null);
        }
    };

    // Open detail inspector
    const handleInspect = async (orgId) => {
        setInspectingOrgId(orgId);
        setInspectLoading(true);
        setInspectTab('overview');
        try {
            const [orgRes, statsRes, membersRes] = await Promise.all([
                getAdminOrganizationDetails(orgId),
                getAdminOrganizationStats(orgId),
                getAdminOrganizationMembers(orgId, { limit: 10 })
            ]);

            setInspectData({
                org: orgRes?.organization || null,
                stats: statsRes?.stats || null,
                members: membersRes?.members || [],
                membersTotal: membersRes?.total || 0
            });
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to load organization details.');
        } finally {
            setInspectLoading(false);
        }
    };

    const handleAddMember = async () => {
        if (!newUserId.trim() || !inspectingOrgId) return;
        try {
            setSubmitting(true);
            await addAdminOrgMember(inspectingOrgId, newUserId.trim());
            setNewUserId('');
            handleInspect(inspectingOrgId);
            setSuccessMsg('Candidate added to organization.');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to add candidate.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm('Remove candidate from this organization cohort?')) return;
        try {
            await removeAdminOrgMember(inspectingOrgId, userId);
            handleInspect(inspectingOrgId);
            setSuccessMsg('Candidate unlinked from organization.');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to remove candidate.');
        }
    };

    const handleAssignAdmin = async () => {
        if (!newUserId.trim() || !inspectingOrgId) return;
        try {
            setSubmitting(true);
            await assignAdminOrgAdmin(inspectingOrgId, newUserId.trim());
            setNewUserId('');
            handleInspect(inspectingOrgId);
            setSuccessMsg('Assigned Organization Administrator.');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to assign administrator.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveAdmin = async (userId) => {
        if (!window.confirm('Revoke Organization Administrator privileges for this user?')) return;
        try {
            await removeAdminOrgAdmin(inspectingOrgId, userId);
            handleInspect(inspectingOrgId);
            setSuccessMsg('Organization Administrator revoked.');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to remove administrator.');
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'college':
            case 'placement_cell':
                return <GraduationCap size={16} style={{ color: '#3b82f6' }} />;
            case 'recruiter':
                return <Briefcase size={16} style={{ color: '#8b5cf6' }} />;
            case 'corporate_partner':
                return <Building2 size={16} style={{ color: '#10b981' }} />;
            default:
                return <Users size={16} style={{ color: '#f59e0b' }} />;
        }
    };

    const formatTypeLabel = (type) => {
        return (type || 'college').replace('_', ' ').toUpperCase();
    };

    return (
        <div className="admin-tab-container" style={{ padding: '1.5rem', color: '#f8fafc' }}>
            {/* Header & Registration CTA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Building2 size={24} style={{ color: '#6366f1' }} />
                        B2B Partners & Organization Management
                    </h2>
                    <p style={{ margin: '0.35rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                        Manage campus placement cells, universities, corporate hiring partners, seat quotas, and tenant isolation.
                    </p>
                </div>

                <button
                    onClick={handleOpenCreate}
                    style={{
                        padding: '0.55rem 1.1rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)',
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}
                >
                    <Plus size={16} />
                    <span>Register Organization</span>
                </button>
            </div>

            {error && (
                <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <AlertTriangle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {successMsg && (
                <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <CheckCircle2 size={16} />
                    <span>{successMsg}</span>
                </div>
            )}

            {/* Toolbar Filters */}
            <div style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
                        <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                        <input
                            type="text"
                            placeholder="Search by name, email, or slug..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                width: '100%',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '6px',
                                color: '#f8fafc',
                                padding: '0.45rem 0.65rem 0.45rem 2rem',
                                fontSize: '0.85rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        style={{
                            background: '#334155',
                            border: 'none',
                            color: '#f8fafc',
                            padding: '0.45rem 0.85rem',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        Search
                    </button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Type:</span>
                        <select
                            value={typeFilter}
                            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                            style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#f8fafc',
                                borderRadius: '6px',
                                padding: '0.4rem 0.65rem',
                                fontSize: '0.8rem'
                            }}
                        >
                            <option value="ALL">All Types</option>
                            <option value="college">College</option>
                            <option value="placement_cell">Placement Cell</option>
                            <option value="recruiter">Recruiter</option>
                            <option value="corporate_partner">Corporate</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Status:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#f8fafc',
                                borderRadius: '6px',
                                padding: '0.4rem 0.65rem',
                                fontSize: '0.8rem'
                            }}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>

                    <button
                        onClick={fetchOrganizations}
                        disabled={loading}
                        style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#cbd5e1',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                        }}
                    >
                        <RefreshCw size={13} className={loading ? 'spin' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Organizations Table */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                    <thead>
                        <tr style={{ background: '#1e293b', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                            <th style={{ padding: '0.85rem 1rem' }}>Organization</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Type</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Contact</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Seats & Quota</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Agreement Tier</th>
                            <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && organizations.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                    Loading partner organizations...
                                </td>
                            </tr>
                        ) : organizations.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                    No organizations found matching current filters.
                                </td>
                            </tr>
                        ) : (
                            organizations.map((org) => {
                                const maxSeats = org.agreement?.maxSeats || 50;
                                const usedSeats = org.stats?.totalMembers || 0;
                                const seatPercent = Math.min(100, Math.round((usedSeats / maxSeats) * 100));

                                return (
                                    <tr key={org._id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <div style={{
                                                    padding: '0.45rem',
                                                    borderRadius: '8px',
                                                    background: 'rgba(255, 255, 255, 0.05)'
                                                }}>
                                                    {getTypeIcon(org.type)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{org.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>/{org.slug}</div>
                                                </div>
                                            </div>
                                        </td>

                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '0.2rem 0.55rem',
                                                borderRadius: '12px',
                                                fontWeight: 600,
                                                background: 'rgba(99, 102, 241, 0.15)',
                                                color: '#818cf8',
                                                border: '1px solid rgba(99, 102, 241, 0.3)'
                                            }}>
                                                {formatTypeLabel(org.type)}
                                            </span>
                                        </td>

                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '0.2rem 0.55rem',
                                                borderRadius: '12px',
                                                fontWeight: 600,
                                                background: org.status === 'active' 
                                                    ? 'rgba(34, 197, 94, 0.15)' 
                                                    : org.status === 'suspended'
                                                        ? 'rgba(239, 68, 68, 0.15)'
                                                        : 'rgba(245, 158, 11, 0.15)',
                                                color: org.status === 'active' ? '#22c55e' : org.status === 'suspended' ? '#ef4444' : '#f59e0b',
                                                border: org.status === 'active' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                                            }}>
                                                {org.status.toUpperCase()}
                                            </span>
                                        </td>

                                        <td style={{ padding: '1rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                            <div>{org.contact?.contactPerson || '—'}</div>
                                            <div style={{ color: '#64748b' }}>{org.contact?.email}</div>
                                        </td>

                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ width: '120px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                                    <span style={{ color: '#cbd5e1' }}>{usedSeats} / {maxSeats}</span>
                                                    <span style={{ color: seatPercent >= 90 ? '#ef4444' : '#10b981' }}>{seatPercent}%</span>
                                                </div>
                                                <div style={{ height: '6px', background: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${seatPercent}%`,
                                                        background: seatPercent >= 90 ? '#ef4444' : '#10b981',
                                                        borderRadius: '3px'
                                                    }} />
                                                </div>
                                            </div>
                                        </td>

                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                textTransform: 'uppercase',
                                                fontWeight: 600,
                                                color: '#e2e8f0'
                                            }}>
                                                {org.agreement?.tier || 'standard'}
                                            </span>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                {org.agreement?.monthlyInterviewQuota || 500} mocks/mo
                                            </div>
                                        </td>

                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                                <button
                                                    onClick={() => handleInspect(org._id)}
                                                    style={{
                                                        padding: '0.35rem 0.65rem',
                                                        borderRadius: '6px',
                                                        border: '1px solid #334155',
                                                        background: 'transparent',
                                                        color: '#818cf8',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.3rem',
                                                        fontSize: '0.75rem'
                                                    }}
                                                    title="View Organization Dashboard & Cohort"
                                                >
                                                    <Eye size={13} />
                                                    <span>Cohort</span>
                                                </button>

                                                <button
                                                    onClick={() => handleOpenEdit(org)}
                                                    style={{
                                                        padding: '0.35rem 0.6rem',
                                                        borderRadius: '6px',
                                                        border: '1px solid #334155',
                                                        background: 'transparent',
                                                        color: '#cbd5e1',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem'
                                                    }}
                                                    title="Edit Agreement & Details"
                                                >
                                                    <Edit2 size={13} />
                                                </button>

                                                <button
                                                    onClick={() => handleToggleStatus(org)}
                                                    disabled={actionTargetId === org._id}
                                                    style={{
                                                        padding: '0.35rem 0.6rem',
                                                        borderRadius: '6px',
                                                        border: org.status === 'active' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
                                                        background: 'transparent',
                                                        color: org.status === 'active' ? '#ef4444' : '#22c55e',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem'
                                                    }}
                                                    title={org.status === 'active' ? 'Suspend Organization' : 'Activate Organization'}
                                                >
                                                    {org.status === 'active' ? 'Suspend' : 'Activate'}
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

            {/* Detail Inspector Modal */}
            {inspectingOrgId && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div style={{
                        maxWidth: '840px',
                        width: '100%',
                        background: '#0d1322',
                        border: '1px solid #334155',
                        borderRadius: '16px',
                        padding: '1.75rem',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
                        boxSizing: 'border-box'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                                        {inspectData.org?.name || 'Partner Details'}
                                    </h3>
                                    <span style={{ fontSize: '0.75rem', color: '#818cf8', background: 'rgba(99, 102, 241, 0.15)', padding: '0.15rem 0.5rem', borderRadius: '10px' }}>
                                        {formatTypeLabel(inspectData.org?.type)}
                                    </span>
                                </div>
                                <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                                    Primary Contact: {inspectData.org?.contact?.email || 'N/A'} • Contract ID: {inspectData.org?.agreement?.contractId || 'N/A'}
                                </p>
                            </div>

                            <button
                                onClick={() => setInspectingOrgId(null)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Inspector Navigation Tabs */}
                        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                            <button
                                onClick={() => setInspectTab('overview')}
                                style={{
                                    padding: '0.4rem 0.85rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: inspectTab === 'overview' ? '#6366f1' : 'transparent',
                                    color: inspectTab === 'overview' ? '#ffffff' : '#94a3b8',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Overview & Quotas
                            </button>
                            <button
                                onClick={() => setInspectTab('members')}
                                style={{
                                    padding: '0.4rem 0.85rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: inspectTab === 'members' ? '#6366f1' : 'transparent',
                                    color: inspectTab === 'members' ? '#ffffff' : '#94a3b8',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Candidate Cohort ({inspectData.membersTotal || inspectData.members.length})
                            </button>
                            <button
                                onClick={() => setInspectTab('admins')}
                                style={{
                                    padding: '0.4rem 0.85rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: inspectTab === 'admins' ? '#6366f1' : 'transparent',
                                    color: inspectTab === 'admins' ? '#ffffff' : '#94a3b8',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Organization Admins ({inspectData.org?.orgAdmins?.length || 0})
                            </button>
                        </div>

                        {inspectLoading ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                Loading organization metrics...
                            </div>
                        ) : inspectTab === 'overview' ? (
                            /* Overview & Metrics */
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Enrolled Candidates</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
                                            {inspectData.stats?.seats?.used || 0} / {inspectData.stats?.seats?.total || 50}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.2rem' }}>
                                            {inspectData.stats?.seats?.usagePercent || 0}% capacity
                                        </div>
                                    </div>

                                    <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Monthly Mock Interviews</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
                                            {inspectData.stats?.interviews?.monthlyUsed || 0} / {inspectData.stats?.interviews?.monthlyQuota || 500}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem' }}>
                                            {inspectData.stats?.interviews?.allTimeTotal || 0} all-time
                                        </div>
                                    </div>

                                    <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Monthly Resumes / CVs</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
                                            {inspectData.stats?.resumes?.monthlyUsed || 0} / {inspectData.stats?.resumes?.monthlyQuota || 500}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.2rem' }}>
                                            {inspectData.stats?.resumes?.usagePercent || 0}% used
                                        </div>
                                    </div>

                                    <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cohort Average Match</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
                                            {inspectData.stats?.atsPerformance?.averageScore || 0}%
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#a855f7', marginTop: '0.2rem' }}>
                                            High: {inspectData.stats?.atsPerformance?.highestScore || 0}% • Low: {inspectData.stats?.atsPerformance?.lowestScore || 0}%
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: '10px', border: '1px solid #1e293b' }}>
                                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#f1f5f9' }}>Settings & Access Governance</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
                                        <div>
                                            <span style={{ color: '#64748b' }}>Allowed Domains:</span>
                                            <div style={{ color: '#cbd5e1', fontWeight: 500 }}>
                                                {inspectData.org?.settings?.allowedEmailDomains?.length > 0
                                                    ? inspectData.org.settings.allowedEmailDomains.join(', ')
                                                    : 'None (manual candidate assignment only)'}
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748b' }}>Candidate Data Export:</span>
                                            <div style={{ color: inspectData.org?.settings?.allowCandidateExports ? '#22c55e' : '#ef4444', fontWeight: 500 }}>
                                                {inspectData.org?.settings?.allowCandidateExports ? 'Enabled' : 'Restricted'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : inspectTab === 'members' ? (
                            /* Candidate Cohort Roster */
                            <div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Add Candidate by User ID..."
                                        value={newUserId}
                                        onChange={(e) => setNewUserId(e.target.value)}
                                        style={{
                                            flex: 1,
                                            background: '#1e293b',
                                            border: '1px solid #334155',
                                            borderRadius: '6px',
                                            color: '#f8fafc',
                                            padding: '0.45rem 0.75rem',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                    <button
                                        onClick={handleAddMember}
                                        disabled={submitting || !newUserId.trim()}
                                        style={{
                                            background: '#10b981',
                                            border: 'none',
                                            color: '#ffffff',
                                            borderRadius: '6px',
                                            padding: '0.45rem 0.85rem',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Enroll Candidate
                                    </button>
                                </div>

                                <div style={{ background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ background: '#334155', color: '#94a3b8' }}>
                                                <th style={{ padding: '0.65rem 0.85rem' }}>Candidate</th>
                                                <th style={{ padding: '0.65rem 0.85rem' }}>Email</th>
                                                <th style={{ padding: '0.65rem 0.85rem' }}>Org Role</th>
                                                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inspectData.members.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                        No candidates currently enrolled in this cohort.
                                                    </td>
                                                </tr>
                                            ) : (
                                                inspectData.members.map(member => (
                                                    <tr key={member._id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                                                            {member.username}
                                                        </td>
                                                        <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>
                                                            {member.email}
                                                        </td>
                                                        <td style={{ padding: '0.65rem 0.85rem' }}>
                                                            <span style={{ fontSize: '0.75rem', color: member.organizationRole === 'admin' ? '#818cf8' : '#94a3b8' }}>
                                                                {member.organizationRole || 'member'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                                                            <button
                                                                onClick={() => handleRemoveMember(member._id)}
                                                                style={{
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: '#ef4444',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.8rem'
                                                                }}
                                                            >
                                                                Unlink
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            /* Organization Admins */
                            <div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Assign Org Admin by User ID..."
                                        value={newUserId}
                                        onChange={(e) => setNewUserId(e.target.value)}
                                        style={{
                                            flex: 1,
                                            background: '#1e293b',
                                            border: '1px solid #334155',
                                            borderRadius: '6px',
                                            color: '#f8fafc',
                                            padding: '0.45rem 0.75rem',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                    <button
                                        onClick={handleAssignAdmin}
                                        disabled={submitting || !newUserId.trim()}
                                        style={{
                                            background: '#6366f1',
                                            border: 'none',
                                            color: '#ffffff',
                                            borderRadius: '6px',
                                            padding: '0.45rem 0.85rem',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Assign Admin
                                    </button>
                                </div>

                                <div style={{ background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ background: '#334155', color: '#94a3b8' }}>
                                                <th style={{ padding: '0.65rem 0.85rem' }}>Administrator</th>
                                                <th style={{ padding: '0.65rem 0.85rem' }}>Email</th>
                                                <th style={{ padding: '0.65rem 0.85rem' }}>Status</th>
                                                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(!inspectData.org?.orgAdmins || inspectData.org.orgAdmins.length === 0) ? (
                                                <tr>
                                                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                        No administrators assigned to this organization.
                                                    </td>
                                                </tr>
                                            ) : (
                                                inspectData.org.orgAdmins.map(admin => (
                                                    <tr key={admin._id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                                                            {admin.username}
                                                        </td>
                                                        <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>
                                                            {admin.email}
                                                        </td>
                                                        <td style={{ padding: '0.65rem 0.85rem' }}>
                                                            <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600 }}>
                                                                Org Admin
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                                                            <button
                                                                onClick={() => handleRemoveAdmin(admin._id)}
                                                                style={{
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: '#ef4444',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.8rem'
                                                                }}
                                                            >
                                                                Revoke
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create / Edit Organization Modal */}
            {createModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div style={{
                        maxWidth: '640px',
                        width: '100%',
                        background: '#0d1322',
                        border: '1px solid #334155',
                        borderRadius: '16px',
                        padding: '1.75rem',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
                        boxSizing: 'border-box'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                                {editingOrg ? `Edit Partner: ${editingOrg.name}` : 'Register New B2B Partner'}
                            </h3>
                            <button
                                onClick={() => setCreateModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveOrganization}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Organization Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. IIT Delhi Placement Cell"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', padding: '0.45rem 0.65rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Organization Type <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', padding: '0.45rem 0.65rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                    >
                                        <option value="college">College / University</option>
                                        <option value="placement_cell">Placement Cell</option>
                                        <option value="recruiter">Recruitment Agency</option>
                                        <option value="corporate_partner">Corporate Hiring Partner</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Primary Contact Email <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="placements@university.edu"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', padding: '0.45rem 0.65rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Contact Person
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Prof. R. Sharma"
                                        value={formData.contactPerson}
                                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', padding: '0.45rem 0.65rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Agreement Tier
                                    </label>
                                    <select
                                        value={formData.tier}
                                        onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', padding: '0.45rem 0.65rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                    >
                                        <option value="starter">Starter</option>
                                        <option value="standard">Standard Institutional</option>
                                        <option value="enterprise">Enterprise Custom</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Maximum Candidate Seats
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.maxSeats}
                                        onChange={(e) => setFormData({ ...formData, maxSeats: e.target.value })}
                                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', padding: '0.45rem 0.65rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Monthly Mock Interview Quota
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.monthlyInterviewQuota}
                                        onChange={(e) => setFormData({ ...formData, monthlyInterviewQuota: e.target.value })}
                                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', padding: '0.45rem 0.65rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Monthly Resume Quota
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.monthlyResumeQuota}
                                        onChange={(e) => setFormData({ ...formData, monthlyResumeQuota: e.target.value })}
                                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', padding: '0.45rem 0.65rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                                    Allowed Email Domains (Comma-separated)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. iitd.ac.in, alumni.iitd.ac.in"
                                    value={formData.allowedEmailDomains}
                                    onChange={(e) => setFormData({ ...formData, allowedEmailDomains: e.target.value })}
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', padding: '0.45rem 0.65rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setCreateModalOpen(false)}
                                    style={{ background: 'transparent', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{ background: '#6366f1', border: 'none', color: '#ffffff', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    {submitting ? 'Saving...' : editingOrg ? 'Update Partner' : 'Create Organization'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

