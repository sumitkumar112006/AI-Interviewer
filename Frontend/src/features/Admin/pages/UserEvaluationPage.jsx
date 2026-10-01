import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { 
    getUserById, 
    adjustUserCredits, 
    updateUserFeatureAccess, 
    updateUserPlan, 
    toggleUserBlock, 
    deleteUser, 
    sendAdminMessage 
} from '../services/admin.api';
import PageLoading from '../../Shared/components/PageLoading';
import ConfirmModal from '../../Shared/components/ConfirmModal';
import { 
    User, 
    Zap, 
    Lock, 
    Unlock, 
    Mail, 
    FolderOpen, 
    FileText, 
    FileCode, 
    BarChart2, 
    CheckCircle2, 
    AlertCircle, 
    Copy, 
    Check, 
    Eye, 
    ArrowLeft, 
    Trash2, 
    Send, 
    Sparkles, 
    Shield, 
    Crown, 
    ExternalLink, 
    RefreshCw, 
    Sliders, 
    Search,
    Bot,
    Minus,
    Plus
} from 'lucide-react';
import '../styles/userEvaluation.scss';

const UserEvaluationPage = () => {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [reports, setReports] = useState([]);
    const [resumes, setResumes] = useState([]);
    const [coverLetters, setCoverLetters] = useState([]);
    const [activeDocTab, setActiveDocTab] = useState('reports'); // 'reports' | 'resumes' | 'coverLetters'
    const [docSearchQuery, setDocSearchQuery] = useState('');
    const [previewModal, setPreviewModal] = useState(null); // { type: 'resume' | 'coverLetter', title: '', content: '' }

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [copiedId, setCopiedId] = useState(false);

    // Direct Message state
    const [directMsg, setDirectMsg] = useState({ title: '', message: '' });
    const [directSubmitting, setDirectSubmitting] = useState(false);

    // Separate Credit Sliders & Inputs (Supports Negative Values)
    const [genBonusCredits, setGenBonusCredits] = useState(0);
    const [aiBonusCredits, setAiBonusCredits] = useState(0);
    const [creditSubmitting, setCreditSubmitting] = useState(false);

    // Feature toggles: true = feature enabled, false = feature blocked
    const [featureEnabledState, setFeatureEnabledState] = useState({
        aiAssistant: true,
        resumeGeneration: true,
        coverLetterGeneration: true,
        interviewReports: true
    });
    const [featureSubmitting, setFeatureSubmitting] = useState(false);

    // Plan & Block states
    const [planSubmitting, setPlanSubmitting] = useState(false);
    const [blockSubmitting, setBlockSubmitting] = useState(false);

    useEffect(() => {
        fetchUserDetails();
    }, [userId]);

    const fetchUserDetails = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getUserById(userId);
            if (data?.user) {
                setUser(data.user);
                setReports(data.reports || []);
                setResumes(data.resumes || (data.reports ? data.reports.filter(r => r.generatedResumeHtml || r.resume) : []));
                setCoverLetters(data.coverLetters || []);
                setGenBonusCredits(data.user.customBonusCredits || 0);
                setAiBonusCredits(data.user.customAiBonusCredits !== undefined ? data.user.customAiBonusCredits : ((data.user.customBonusCredits || 0) * 3));
                
                // Map blockedFeatures in DB (true=blocked) to featureEnabledState (true=enabled)
                const bf = data.user.blockedFeatures || {};
                setFeatureEnabledState({
                    aiAssistant: !bf.aiAssistant,
                    resumeGeneration: !bf.resumeGeneration,
                    coverLetterGeneration: !bf.coverLetterGeneration,
                    interviewReports: !bf.interviewReports
                });
            } else {
                setError('User account data not found.');
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to fetch user evaluation details.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyUserId = () => {
        if (!user?._id) return;
        navigator.clipboard.writeText(user._id);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
    };

    const handleSaveCredits = async (e) => {
        if (e) e.preventDefault();
        setCreditSubmitting(true);
        setMsg({ type: '', text: '' });
        try {
            const res = await adjustUserCredits(userId, {
                customBonusCredits: Number(genBonusCredits),
                customAiBonusCredits: Number(aiBonusCredits)
            });
            setMsg({ type: 'success', text: res.message || 'Custom credit limits updated successfully!' });
            setUser(prev => prev ? {
                ...prev,
                customBonusCredits: res.user?.customBonusCredits !== undefined ? res.user.customBonusCredits : Number(genBonusCredits),
                customAiBonusCredits: res.user?.customAiBonusCredits !== undefined ? res.user.customAiBonusCredits : Number(aiBonusCredits)
            } : prev);
        } catch (err) {
            setMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to update user credits.' });
        } finally {
            setCreditSubmitting(false);
        }
    };

    const handleSaveFeatures = async (e) => {
        e.preventDefault();
        setFeatureSubmitting(true);
        setMsg({ type: '', text: '' });

        // Convert UI enabled state (true=enabled) back to DB blocked state (true=blocked)
        const updatedBlockedFeatures = {
            aiAssistant: !featureEnabledState.aiAssistant,
            resumeGeneration: !featureEnabledState.resumeGeneration,
            coverLetterGeneration: !featureEnabledState.coverLetterGeneration,
            interviewReports: !featureEnabledState.interviewReports
        };

        try {
            const res = await updateUserFeatureAccess(userId, updatedBlockedFeatures);
            setMsg({ type: 'success', text: res.message || 'Feature permissions saved successfully!' });
            setUser(prev => prev ? { ...prev, blockedFeatures: updatedBlockedFeatures } : prev);
        } catch (err) {
            setMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to update feature permissions.' });
        } finally {
            setFeatureSubmitting(false);
        }
    };

    // Action Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        details: null,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        type: 'warning',
        loading: false,
        onConfirm: null
    });

    const requestPlanChange = (newPlan) => {
        if (!user || user.plan === newPlan) return;
        setConfirmModal({
            isOpen: true,
            title: 'Confirm Subscription Plan Change',
            message: `Are you sure you want to change the subscription plan for "${user.username}"?`,
            details: (
                <div className="change-preview-row">
                    <span className="change-label">Subscription Tier:</span>
                    <span className="change-value">
                        <span className="old-val">{user.plan?.toUpperCase() || 'FREE'}</span>
                        <span className="arrow">→</span>
                        <span className="new-val" style={{ color: '#818cf8', fontWeight: 700 }}>{newPlan.toUpperCase()}</span>
                    </span>
                </div>
            ),
            confirmText: 'Update Plan',
            cancelText: 'Cancel',
            type: newPlan === 'free' ? 'warning' : 'info',
            loading: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, loading: true }));
                setPlanSubmitting(true);
                setMsg({ type: '', text: '' });
                try {
                    const res = await updateUserPlan(userId, newPlan);
                    setMsg({ type: 'success', text: res.message || `Plan updated to ${newPlan.toUpperCase()}` });
                    setUser(prev => prev ? { ...prev, plan: newPlan } : prev);
                    setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
                } catch (err) {
                    setMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to update plan.' });
                    setConfirmModal(prev => ({ ...prev, loading: false }));
                } finally {
                    setPlanSubmitting(false);
                }
            }
        });
    };

    const requestToggleBlock = () => {
        if (!user) return;
        const newBlockState = !user.isBlocked;
        setConfirmModal({
            isOpen: true,
            title: newBlockState ? 'Confirm Account Block' : 'Confirm Account Unblock',
            message: newBlockState
                ? `Are you sure you want to BLOCK "${user.username}"? They will lose access to interview practice and generations.`
                : `Are you sure you want to UNBLOCK "${user.username}"? Their full platform access will be restored.`,
            details: (
                <div className="change-preview-row">
                    <span className="change-label">Account Status:</span>
                    <span className="change-value">
                        <span className="old-val">{user.isBlocked ? 'BLOCKED' : 'ACTIVE'}</span>
                        <span className="arrow">→</span>
                        <span className="new-val" style={{ color: newBlockState ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
                            {newBlockState ? 'BLOCKED' : 'ACTIVE'}
                        </span>
                    </span>
                </div>
            ),
            confirmText: newBlockState ? 'Yes, Block Account' : 'Yes, Unblock Account',
            cancelText: 'Cancel',
            type: newBlockState ? 'danger' : 'success',
            loading: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, loading: true }));
                setBlockSubmitting(true);
                setMsg({ type: '', text: '' });
                try {
                    const res = await toggleUserBlock(userId, newBlockState);
                    setMsg({ type: 'success', text: res.message || (newBlockState ? 'User account blocked' : 'User account unblocked') });
                    setUser(prev => prev ? { ...prev, isBlocked: newBlockState } : prev);
                    setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
                } catch (err) {
                    setMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to change block status.' });
                    setConfirmModal(prev => ({ ...prev, loading: false }));
                } finally {
                    setBlockSubmitting(false);
                }
            }
        });
    };

    const requestDeleteUser = () => {
        if (!user) return;
        setConfirmModal({
            isOpen: true,
            title: 'Delete User Account Permanently',
            message: `Are you sure you want to permanently delete user "${user.username}" (${user.email})? This action CANNOT be undone and will permanently purge all their interview reports, resumes, cover letters, and subscriptions.`,
            details: (
                <div className="change-preview-row">
                    <span className="change-label">Purge Target:</span>
                    <span className="change-value">
                        <span className="new-val" style={{ color: '#ef4444', fontWeight: 700 }}>{user.username}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}> ({user.email})</span>
                    </span>
                </div>
            ),
            confirmText: 'Yes, Delete Permanently',
            cancelText: 'Cancel',
            type: 'danger',
            loading: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, loading: true }));
                try {
                    await deleteUser(userId);
                    navigate('/admin-portal-dashboard-root');
                } catch (err) {
                    setMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to delete user.' });
                    setConfirmModal(prev => ({ ...prev, loading: false, isOpen: false }));
                }
            }
        });
    };

    const handleSendDirectMessage = async (e) => {
        e.preventDefault();
        if (!directMsg.title.trim() || !directMsg.message.trim()) {
            setMsg({ type: 'error', text: 'Both notification title and message content are required.' });
            return;
        }
        setDirectSubmitting(true);
        setMsg({ type: '', text: '' });
        try {
            const res = await sendAdminMessage({
                targetType: 'user',
                targetValue: userId,
                title: directMsg.title.trim(),
                message: directMsg.message.trim()
            });
            setMsg({ type: 'success', text: res.message || 'Notification dispatched to user successfully!' });
            setDirectMsg({ title: '', message: '' });
        } catch (err) {
            setMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to send message.' });
        } finally {
            setDirectSubmitting(false);
        }
    };

    const applyMessageTemplate = (tplTitle, tplBody) => {
        setDirectMsg({ title: tplTitle, message: tplBody });
    };

    if (loading) {
        return <main><PageLoading title="Loading User Evaluation..." subtitle="Fetching profile permissions and credit stats..." /></main>;
    }

    if (error || !user) {
        return (
            <div className="admin-user-eval-root">
                <div className="eval-container">
                    <div className="eval-banner error">
                        <div className="banner-content">
                            <AlertCircle size={18} />
                            <span>{error || 'Unable to load specified user account.'}</span>
                        </div>
                    </div>
                    <button className="eval-btn secondary" onClick={() => navigate('/admin-portal-dashboard-root')} style={{ width: 'fit-content' }}>
                        <ArrowLeft size={16} />
                        <span>Return to Admin Dashboard</span>
                    </button>
                </div>
            </div>
        );
    }

    const baseGenerations = user.plan === 'premium' ? 25 : user.plan === 'pro' ? 10 : 2;
    const availableGenerations = Math.max(0, baseGenerations + Number(genBonusCredits));

    const baseAiRequests = user.plan === 'premium' ? 500 : user.plan === 'pro' ? 100 : 10;
    const availableAiRequests = Math.max(0, baseAiRequests + Number(aiBonusCredits));

    // Filter documents by search
    const filteredReports = reports.filter(r => {
        if (!docSearchQuery.trim()) return true;
        const q = docSearchQuery.toLowerCase();
        return (r.developerTitle && r.developerTitle.toLowerCase().includes(q)) ||
               (r.jobDescription && r.jobDescription.toLowerCase().includes(q));
    });

    const filteredResumes = resumes.filter(res => {
        if (!docSearchQuery.trim()) return true;
        const q = docSearchQuery.toLowerCase();
        return (res.developerTitle && res.developerTitle.toLowerCase().includes(q));
    });

    const filteredCoverLetters = coverLetters.filter(cl => {
        if (!docSearchQuery.trim()) return true;
        const q = docSearchQuery.toLowerCase();
        return (cl.roleName && cl.roleName.toLowerCase().includes(q)) ||
               (cl.companyName && cl.companyName.toLowerCase().includes(q));
    });

    return (
        <div className="admin-user-eval-root">
            <div className="eval-container">
                {/* ── Top Header Bar ── */}
                <div className="eval-header-bar">
                    <div className="header-left">
                        <Link to="/admin-portal-dashboard-root" className="back-link">
                            <ArrowLeft size={16} />
                            <span>Back to Admin Dashboard</span>
                        </Link>
                        <h1 className="eval-page-title">User Evaluation & Account Controls</h1>
                        <p className="eval-page-sub">Managing account parameters, credit allocations & feature permissions</p>
                    </div>

                    <div className="header-right-badges">
                        <span className={`status-badge ${user.isBlocked ? 'blocked' : 'active'}`}>
                            <span className="badge-dot"></span>
                            <span>{user.isBlocked ? 'Suspended' : 'Active Account'}</span>
                        </span>
                        <span className={`role-badge ${user.role === 'super_admin' ? 'super' : ''}`}>
                            <Shield size={13} />
                            <span>{user.role?.toUpperCase() || 'USER'}</span>
                        </span>
                    </div>
                </div>

                {/* ── Global Alert Banner ── */}
                {msg.text && (
                    <div className={`eval-banner ${msg.type}`}>
                        <div className="banner-content">
                            {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            <span>{msg.text}</span>
                        </div>
                        <button className="banner-dismiss" onClick={() => setMsg({ type: '', text: '' })}>✕</button>
                    </div>
                )}

                {/* ── User Overview Stats Banner (Reports, Resumes, CV) ── */}
                <div className="eval-stats-summary-row">
                    <div 
                        className={`summary-stat-box reports ${activeDocTab === 'reports' ? 'active-highlight' : ''}`} 
                        onClick={() => setActiveDocTab('reports')}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="stat-main">
                            <div className="stat-icon"><BarChart2 size={24} /></div>
                            <div className="stat-info">
                                <div className="stat-value">{reports.length}</div>
                                <div className="stat-label">Interview Reports</div>
                            </div>
                        </div>
                        <span className="stat-badge">Inspect Reports →</span>
                    </div>

                    <div 
                        className={`summary-stat-box resumes ${activeDocTab === 'resumes' ? 'active-highlight' : ''}`} 
                        onClick={() => setActiveDocTab('resumes')}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="stat-main">
                            <div className="stat-icon"><FileText size={24} /></div>
                            <div className="stat-info">
                                <div className="stat-value">{resumes.length}</div>
                                <div className="stat-label">Resumes & CVs</div>
                            </div>
                        </div>
                        <span className="stat-badge">Inspect Resumes →</span>
                    </div>

                    <div 
                        className={`summary-stat-box cover-letters ${activeDocTab === 'coverLetters' ? 'active-highlight' : ''}`} 
                        onClick={() => setActiveDocTab('coverLetters')}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="stat-main">
                            <div className="stat-icon"><Mail size={24} /></div>
                            <div className="stat-info">
                                <div className="stat-value">{coverLetters.length}</div>
                                <div className="stat-label">Cover Letters</div>
                            </div>
                        </div>
                        <span className="stat-badge">Inspect Letters →</span>
                    </div>
                </div>

                {/* ── 3-Column Core Management Grid ── */}
                <div className="eval-grid">
                    {/* ── Card 1: Account Profile Summary ── */}
                    <div className="eval-card profile-card">
                        <div className="card-header">
                            <span className="card-icon"><User size={18} /></span>
                            <h3>Account Identity</h3>
                        </div>

                        <div className="profile-hero">
                            <div className="avatar-circle">
                                {(user.username || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="user-hero-details">
                                <h4 className="user-display-name">{user.username}</h4>
                                <span className="user-email-text">{user.email}</span>
                                <div className="user-id-row">
                                    <span>ID:</span>
                                    <code>{user._id}</code>
                                    <button
                                        type="button"
                                        className="copy-id-btn"
                                        onClick={handleCopyUserId}
                                        title={copiedId ? 'Copied!' : 'Copy user ID'}
                                    >
                                        {copiedId ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="profile-fields-list">
                            <div className="profile-field">
                                <span className="field-label">Current Subscription Plan</span>
                                <div className="plan-select-wrapper">
                                    <select
                                        value={user.plan || 'free'}
                                        onChange={(e) => requestPlanChange(e.target.value)}
                                        disabled={planSubmitting}
                                    >
                                        <option value="free">Free Plan (10 Credits / mo)</option>
                                        <option value="pro">Pro Plan (50 Credits / mo)</option>
                                        <option value="premium">Premium Plan (200 Credits / mo)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="profile-field">
                                <span className="field-label">Account Access Status</span>
                                <button
                                    type="button"
                                    className={`eval-btn ${user.isBlocked ? 'success' : 'danger'}`}
                                    onClick={requestToggleBlock}
                                    disabled={blockSubmitting}
                                >
                                    {user.isBlocked ? <Unlock size={14} /> : <Lock size={14} />}
                                    <span>{user.isBlocked ? 'Restore / Unblock Account' : 'Suspend / Block Account'}</span>
                                </button>
                            </div>

                            <div className="profile-field">
                                <span className="field-label">Danger Zone</span>
                                <button
                                    type="button"
                                    className="eval-btn danger delete-btn"
                                    onClick={requestDeleteUser}
                                >
                                    <Trash2 size={14} />
                                    <span>Delete User Account</span>
                                </button>
                            </div>

                            <div className="profile-field inline-meta">
                                <span className="field-label">Member Since</span>
                                <span className="meta-val">
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                </span>
                            </div>

                            <div className="profile-field inline-meta">
                                <span className="field-label">Generations Used</span>
                                <span className="meta-val">
                                    {user.generationsUsed || 0} generations
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Card 2: Interactive Credit Manager ── */}
                    <div className="eval-card credits-card">
                        <div className="card-header">
                            <span className="card-icon"><Zap size={18} /></span>
                            <h3>Custom Credit Sliders & Limits</h3>
                        </div>

                        <form onSubmit={handleSaveCredits} className="credits-sliders-form">
                            {/* --- Slider 1: Full Generations Bonus --- */}
                            <div className="credit-slider-block">
                                <div className="slider-header">
                                    <label className="slider-label">
                                        <Sparkles size={14} color="#818cf8" />
                                        <span>Full Generations Bonus Offset:</span>
                                    </label>
                                    <div className="slider-val-badge">
                                        <span className={`val-num ${genBonusCredits < 0 ? 'negative' : genBonusCredits > 0 ? 'positive' : 'zero'}`}>
                                            {genBonusCredits > 0 ? `+${genBonusCredits}` : genBonusCredits}
                                        </span>
                                        <span className="val-unit">Gens/mo</span>
                                    </div>
                                </div>

                                <div className="slider-controls-row">
                                    <input
                                        type="range"
                                        min="-25"
                                        max="100"
                                        step="1"
                                        className="credit-range-slider"
                                        value={genBonusCredits}
                                        onChange={(e) => setGenBonusCredits(Number(e.target.value))}
                                    />
                                    <input
                                        type="number"
                                        className="credit-number-input"
                                        value={genBonusCredits}
                                        onChange={(e) => setGenBonusCredits(Number(e.target.value))}
                                    />
                                </div>

                                <div className="presets-row">
                                    {[-10, -5, -2, -1, 0, 5, 10, 25].map(amt => (
                                        <button
                                            key={amt}
                                            type="button"
                                            className={`preset-pill ${amt < 0 ? 'negative' : ''} ${genBonusCredits === amt ? 'active' : ''}`}
                                            onClick={() => setGenBonusCredits(amt)}
                                        >
                                            {amt > 0 ? `+${amt}` : amt}
                                        </button>
                                    ))}
                                </div>
                                <div className="net-limit-preview">
                                    Current Available Generations: <strong>{availableGenerations} / {baseGenerations} Gens/mo</strong>
                                </div>
                            </div>

                            {/* --- Slider 2: AI Assistant Bonus --- */}
                            <div className="credit-slider-block">
                                <div className="slider-header">
                                    <label className="slider-label">
                                        <Bot size={14} color="#38bdf8" />
                                        <span>AI Assistant & Writer Bonus Offset:</span>
                                    </label>
                                    <div className="slider-val-badge">
                                        <span className={`val-num ${aiBonusCredits < 0 ? 'negative' : aiBonusCredits > 0 ? 'positive' : 'zero'}`}>
                                            {aiBonusCredits > 0 ? `+${aiBonusCredits}` : aiBonusCredits}
                                        </span>
                                        <span className="val-unit">AI/day</span>
                                    </div>
                                </div>

                                <div className="slider-controls-row">
                                    <input
                                        type="range"
                                        min="-100"
                                        max="500"
                                        step="5"
                                        className="credit-range-slider ai-slider"
                                        value={aiBonusCredits}
                                        onChange={(e) => setAiBonusCredits(Number(e.target.value))}
                                    />
                                    <input
                                        type="number"
                                        className="credit-number-input"
                                        value={aiBonusCredits}
                                        onChange={(e) => setAiBonusCredits(Number(e.target.value))}
                                    />
                                </div>

                                <div className="presets-row">
                                    {[-50, -20, -10, 0, 20, 50, 100, 250].map(amt => (
                                        <button
                                            key={amt}
                                            type="button"
                                            className={`preset-pill ${amt < 0 ? 'negative' : ''} ${aiBonusCredits === amt ? 'active' : ''}`}
                                            onClick={() => setAiBonusCredits(amt)}
                                        >
                                            {amt > 0 ? `+${amt}` : amt}
                                        </button>
                                    ))}
                                </div>
                                <div className="net-limit-preview">
                                    Current Available AI Requests: <strong>{availableAiRequests} / {baseAiRequests} AI/day</strong>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="save-credits-btn"
                                disabled={creditSubmitting}
                            >
                                <Zap size={15} />
                                <span>{creditSubmitting ? 'Saving Changes...' : 'Save Credit Changes'}</span>
                            </button>
                        </form>
                    </div>

                    {/* ── Card 3: Granular Feature Access Control Toggles ── */}
                    <div className="eval-card features-card">
                        <div className="card-header">
                            <span className="card-icon"><Lock size={18} /></span>
                            <h3>Feature Access Permissions</h3>
                        </div>

                        <form onSubmit={handleSaveFeatures}>
                            <p className="features-desc">
                                Selectively enable or block core platform features for this account.
                            </p>

                            <div className="feature-toggles-grid">
                                {/* Feature 1: AI Assistant */}
                                <div className={`toggle-row ${featureEnabledState.aiAssistant ? 'is-enabled' : 'is-blocked'}`}>
                                    <div className="toggle-info">
                                        <div className="toggle-title-row">
                                            <span className="toggle-title">AI Assistant (Kivi)</span>
                                            <span className={`toggle-status-pill ${featureEnabledState.aiAssistant ? 'enabled' : 'blocked'}`}>
                                                {featureEnabledState.aiAssistant ? 'ENABLED' : 'BLOCKED'}
                                            </span>
                                        </div>
                                        <span className="toggle-subtitle">AI copilot, chat questions & suggestions</span>
                                    </div>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={featureEnabledState.aiAssistant}
                                            onChange={(e) => setFeatureEnabledState({ ...featureEnabledState, aiAssistant: e.target.checked })}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>

                                {/* Feature 2: Resume Generation */}
                                <div className={`toggle-row ${featureEnabledState.resumeGeneration ? 'is-enabled' : 'is-blocked'}`}>
                                    <div className="toggle-info">
                                        <div className="toggle-title-row">
                                            <span className="toggle-title">Resume Generation</span>
                                            <span className={`toggle-status-pill ${featureEnabledState.resumeGeneration ? 'enabled' : 'blocked'}`}>
                                                {featureEnabledState.resumeGeneration ? 'ENABLED' : 'BLOCKED'}
                                            </span>
                                        </div>
                                        <span className="toggle-subtitle">ATS resume editor & PDF downloads</span>
                                    </div>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={featureEnabledState.resumeGeneration}
                                            onChange={(e) => setFeatureEnabledState({ ...featureEnabledState, resumeGeneration: e.target.checked })}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>

                                {/* Feature 3: Cover Letter Generator */}
                                <div className={`toggle-row ${featureEnabledState.coverLetterGeneration ? 'is-enabled' : 'is-blocked'}`}>
                                    <div className="toggle-info">
                                        <div className="toggle-title-row">
                                            <span className="toggle-title">Cover Letter Generator</span>
                                            <span className={`toggle-status-pill ${featureEnabledState.coverLetterGeneration ? 'enabled' : 'blocked'}`}>
                                                {featureEnabledState.coverLetterGeneration ? 'ENABLED' : 'BLOCKED'}
                                            </span>
                                        </div>
                                        <span className="toggle-subtitle">AI cover letter drafting & exporting</span>
                                    </div>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={featureEnabledState.coverLetterGeneration}
                                            onChange={(e) => setFeatureEnabledState({ ...featureEnabledState, coverLetterGeneration: e.target.checked })}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>

                                {/* Feature 4: Interview Evaluation Reports */}
                                <div className={`toggle-row ${featureEnabledState.interviewReports ? 'is-enabled' : 'is-blocked'}`}>
                                    <div className="toggle-info">
                                        <div className="toggle-title-row">
                                            <span className="toggle-title">Interview Reports</span>
                                            <span className={`toggle-status-pill ${featureEnabledState.interviewReports ? 'enabled' : 'blocked'}`}>
                                                {featureEnabledState.interviewReports ? 'ENABLED' : 'BLOCKED'}
                                            </span>
                                        </div>
                                        <span className="toggle-subtitle">Technical & behavioral feedback reports</span>
                                    </div>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={featureEnabledState.interviewReports}
                                            onChange={(e) => setFeatureEnabledState({ ...featureEnabledState, interviewReports: e.target.checked })}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="save-features-btn"
                                disabled={featureSubmitting}
                            >
                                <Lock size={15} />
                                <span>{featureSubmitting ? 'Saving Permissions...' : 'Save Feature Permissions'}</span>
                            </button>
                        </form>
                    </div>
                </div>

                {/* ── Secondary Row: Direct Message ── */}
                <div className="eval-secondary-row">
                    <div className="eval-card message-card">
                        <div className="card-header">
                            <span className="card-icon"><Mail size={18} /></span>
                            <h3>Send Direct Message to User</h3>
                        </div>

                        {/* Quick Message Templates */}
                        <div className="template-chips-row">
                            <span className="template-label">Quick Templates:</span>
                            <button
                                type="button"
                                className="msg-template-btn"
                                onClick={() => applyMessageTemplate(
                                    'Bonus Credits Granted ✨',
                                    'We have credited your account with additional bonus credits. You can now generate more resumes and practice mock interviews!'
                                )}
                            >
                                ✨ Bonus Credits
                            </button>
                            <button
                                type="button"
                                className="msg-template-btn"
                                onClick={() => applyMessageTemplate(
                                    'Account Tier Upgrade ⭐',
                                    'Your account subscription tier has been upgraded by system administrators. Enjoy elevated generation limits!'
                                )}
                            >
                                ⭐ Plan Upgrade
                            </button>
                            <button
                                type="button"
                                className="msg-template-btn"
                                onClick={() => applyMessageTemplate(
                                    'Important Account Notice ⚠️',
                                    'Please review your account details or contact support if you need assistance with any feature.'
                                )}
                            >
                                ⚠️ Notice
                            </button>
                        </div>

                        <form onSubmit={handleSendDirectMessage} className="direct-msg-form">
                            <div className="eval-form-group">
                                <label className="eval-label">Notification Title</label>
                                <input
                                    type="text"
                                    className="eval-input"
                                    placeholder="e.g. Account Update / Important Notice"
                                    value={directMsg.title}
                                    onChange={(e) => setDirectMsg({ ...directMsg, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="eval-form-group">
                                <label className="eval-label">Message Content</label>
                                <textarea
                                    rows="3"
                                    className="eval-textarea"
                                    placeholder="Write message content to dispatch to this user's notification bell..."
                                    value={directMsg.message}
                                    onChange={(e) => setDirectMsg({ ...directMsg, message: e.target.value })}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="send-msg-btn"
                                disabled={directSubmitting}
                            >
                                <Send size={14} />
                                <span>{directSubmitting ? 'Sending...' : 'Send Direct Notification'}</span>
                            </button>
                        </form>
                    </div>
                </div>

                {/* ── Card 5: User Documents & Content Explorer (Reports, Resumes, CV) ── */}
                <div className="eval-card user-documents-card">
                    <div className="docs-tab-header">
                        <div className="docs-tab-title-group">
                            <span className="card-icon"><FolderOpen size={18} /></span>
                            <div>
                                <h3>User Generated Content & Documents</h3>
                                <p>Browse, inspect, and preview all AI artifacts created by this account</p>
                            </div>
                        </div>

                        <div className="docs-nav-tabs">
                            <button
                                type="button"
                                className={`doc-nav-tab ${activeDocTab === 'reports' ? 'active' : ''}`}
                                onClick={() => setActiveDocTab('reports')}
                            >
                                Interview Reports ({reports.length})
                            </button>
                            <button
                                type="button"
                                className={`doc-nav-tab ${activeDocTab === 'resumes' ? 'active' : ''}`}
                                onClick={() => setActiveDocTab('resumes')}
                            >
                                Resumes ({resumes.length})
                            </button>
                            <button
                                type="button"
                                className={`doc-nav-tab ${activeDocTab === 'coverLetters' ? 'active' : ''}`}
                                onClick={() => setActiveDocTab('coverLetters')}
                            >
                                Cover Letters ({coverLetters.length})
                            </button>
                        </div>
                    </div>

                    {/* Filter search box */}
                    <div className="docs-search-bar">
                        <Search size={14} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Filter documents by role or company..."
                            value={docSearchQuery}
                            onChange={(e) => setDocSearchQuery(e.target.value)}
                        />
                        {docSearchQuery && (
                            <button
                                type="button"
                                onClick={() => setDocSearchQuery('')}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Tab 1: Reports Content */}
                    {activeDocTab === 'reports' && (
                        <div className="doc-tab-content">
                            {filteredReports.length === 0 ? (
                                <div className="empty-docs-state">
                                    <BarChart2 size={36} color="#818cf8" />
                                    <h4>No Interview Reports Found</h4>
                                    <p>{docSearchQuery ? 'No reports matched your search filter.' : 'This user has not generated any AI mock interview reports yet.'}</p>
                                </div>
                            ) : (
                                <div className="docs-table-wrapper">
                                    <table className="eval-docs-table">
                                        <thead>
                                            <tr>
                                                <th>Target Job Role</th>
                                                <th>Match Score</th>
                                                <th>Generated Date</th>
                                                <th>Job Description Snippet</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredReports.map((r) => (
                                                <tr key={r._id}>
                                                    <td>
                                                        <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>{r.developerTitle || 'Software Engineer'}</strong>
                                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>ID: <code>{r._id}</code></div>
                                                    </td>
                                                    <td>
                                                        <span className={`score-badge ${(r.matchScore || 0) >= 75 ? 'high' : (r.matchScore || 0) >= 50 ? 'mid' : 'low'}`}>
                                                            {r.matchScore || 0}%
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                                                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                                    </td>
                                                    <td style={{ maxWidth: '280px' }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#94a3b8' }} title={r.jobDescription}>
                                                            {r.jobDescription ? r.jobDescription.slice(0, 75) + '...' : 'General role'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <Link
                                                            to={`/interview/${r._id}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="doc-action-btn view-btn"
                                                        >
                                                            <span>View Report</span>
                                                            <ExternalLink size={12} />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Resumes Content */}
                    {activeDocTab === 'resumes' && (
                        <div className="doc-tab-content">
                            {filteredResumes.length === 0 ? (
                                <div className="empty-docs-state">
                                    <FileText size={36} color="#34d399" />
                                    <h4>No Resumes Found</h4>
                                    <p>{docSearchQuery ? 'No resumes matched your search filter.' : 'This user has not generated or tailored any resumes yet.'}</p>
                                </div>
                            ) : (
                                <div className="docs-table-wrapper">
                                    <table className="eval-docs-table">
                                        <thead>
                                            <tr>
                                                <th>Target Role / Title</th>
                                                <th>Resume Format</th>
                                                <th>Match Score</th>
                                                <th>Generated Date</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredResumes.map((res) => (
                                                <tr key={res._id}>
                                                    <td>
                                                        <strong style={{ color: '#34d399', fontSize: '0.88rem' }}>{res.developerTitle || 'Resume'}</strong>
                                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>ID: <code>{res._id}</code></div>
                                                    </td>
                                                    <td>
                                                        <span className="score-badge high" style={{ fontSize: '0.72rem' }}>
                                                            {res.generatedResumeHtml ? 'ATS HTML' : 'Text'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`score-badge ${(res.matchScore || 0) >= 75 ? 'high' : (res.matchScore || 0) >= 50 ? 'mid' : 'low'}`}>
                                                            {res.matchScore || 0}%
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                                                        {res.createdAt ? new Date(res.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.45rem' }}>
                                                            <Link
                                                                to={`/resume/${res._id}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="doc-action-btn view-btn"
                                                            >
                                                                <span>ATS Editor</span>
                                                                <ExternalLink size={12} />
                                                            </Link>
                                                            {(res.generatedResumeHtml || res.resume) && (
                                                                <button
                                                                    type="button"
                                                                    className="doc-action-btn preview-btn"
                                                                    onClick={() => setPreviewModal({
                                                                        type: 'resume',
                                                                        title: `${res.developerTitle || 'User'} Resume`,
                                                                        content: res.generatedResumeHtml || res.resume,
                                                                        isHtml: !!res.generatedResumeHtml
                                                                    })}
                                                                >
                                                                    <Eye size={12} />
                                                                    <span>Preview</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 3: Cover Letters / CV Content */}
                    {activeDocTab === 'coverLetters' && (
                        <div className="doc-tab-content">
                            {filteredCoverLetters.length === 0 ? (
                                <div className="empty-docs-state">
                                    <Mail size={36} color="#c084fc" />
                                    <h4>No Cover Letters Found</h4>
                                    <p>{docSearchQuery ? 'No cover letters matched your search filter.' : 'This user has not generated any cover letters yet.'}</p>
                                </div>
                            ) : (
                                <div className="docs-table-wrapper">
                                    <table className="eval-docs-table">
                                        <thead>
                                            <tr>
                                                <th>Role & Position</th>
                                                <th>Target Company</th>
                                                <th>Generated Date</th>
                                                <th>Content Preview</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCoverLetters.map((cl) => (
                                                <tr key={cl._id}>
                                                    <td>
                                                        <strong style={{ color: '#c084fc', fontSize: '0.88rem' }}>{cl.roleName || 'Position'}</strong>
                                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>ID: <code>{cl._id}</code></div>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                                                            {cl.companyName || 'General Application'}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                                                        {cl.createdAt ? new Date(cl.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                                    </td>
                                                    <td style={{ maxWidth: '260px' }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#94a3b8' }} title={cl.generatedContent}>
                                                            {cl.generatedContent ? cl.generatedContent.slice(0, 70) + '...' : 'No content'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="doc-action-btn preview-btn"
                                                            onClick={() => setPreviewModal({
                                                                type: 'coverLetter',
                                                                title: `Cover Letter - ${cl.roleName || 'Position'} (${cl.companyName || 'Company'})`,
                                                                content: cl.generatedContent,
                                                                isHtml: false
                                                            })}
                                                        >
                                                            <Eye size={12} />
                                                            <span>View Letter</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Document Quick Preview Modal ── */}
            {previewModal && (
                <div className="modal-overlay" onClick={() => setPreviewModal(null)}>
                    <div className="modal-card doc-preview-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px', width: '94%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ color: '#818cf8' }}>{previewModal.type === 'resume' ? <FileText size={20} /> : <Mail size={20} />}</span>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ffffff' }}>{previewModal.title}</h3>
                            </div>
                            <button onClick={() => setPreviewModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div style={{ flexGrow: 1, overflowY: 'auto', background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.25rem', color: '#e2e8f0', fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: previewModal.isHtml ? 'normal' : 'pre-wrap' }}>
                            {previewModal.isHtml ? (
                                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewModal.content) }} />
                            ) : (
                                previewModal.content
                            )}
                        </div>

                        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                type="button"
                                className="eval-btn secondary"
                                onClick={() => {
                                    navigator.clipboard.writeText(previewModal.content)
                                        .then(() => setMsg({ type: 'success', text: 'Document content copied to clipboard!' }))
                                        .catch(() => setMsg({ type: 'error', text: 'Unable to copy content to clipboard.' }));
                                }}
                            >
                                <Copy size={14} />
                                <span>Copy Content</span>
                            </button>
                            <button type="button" className="eval-btn primary" onClick={() => setPreviewModal(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Confirmation Modal */}
            <ConfirmModal
                {...confirmModal}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};

export default UserEvaluationPage;
