import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getUserById, adjustUserCredits, updateUserFeatureAccess, updateUserPlan, toggleUserBlock, deleteUser, sendAdminMessage } from '../services/admin.api';
import PageLoading from '../../Shared/components/PageLoading';
import ConfirmModal from '../../Shared/components/ConfirmModal';
import { User, Zap, Lock, Mail, FolderOpen, FileText, FileCode, BarChart2, CheckCircle, Copy, Eye, ArrowLeft, Trash2 } from 'lucide-react';
import '../styles/userEvaluation.scss';

const UserEvaluationPage = () => {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [reports, setReports] = useState([]);
    const [resumes, setResumes] = useState([]);
    const [coverLetters, setCoverLetters] = useState([]);
    const [activeDocTab, setActiveDocTab] = useState('reports'); // 'reports' | 'resumes' | 'coverLetters'
    const [previewModal, setPreviewModal] = useState(null); // { type: 'resume' | 'coverLetter', title: '', content: '' }

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState({ type: '', text: '' });

    // Direct Message state
    const [directMsg, setDirectMsg] = useState({ title: '', message: '' });
    const [directSubmitting, setDirectSubmitting] = useState(false);

    // Separate Credit Sliders & Inputs (Supports Negative Values)
    const [genBonusCredits, setGenBonusCredits] = useState(0);
    const [aiBonusCredits, setAiBonusCredits] = useState(0);
    const [creditSubmitting, setCreditSubmitting] = useState(false);

    // Feature toggles
    const [features, setFeatures] = useState({
        aiAssistant: false,
        resumeGeneration: false,
        coverLetterGeneration: false,
        interviewReports: false
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
                setFeatures(data.user.blockedFeatures || {
                    aiAssistant: false,
                    resumeGeneration: false,
                    coverLetterGeneration: false,
                    interviewReports: false
                });
            } else {
                setError('User data not found.');
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to fetch user evaluation details.');
        } finally {
            setLoading(false);
        }
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
            setMsg({ type: 'success', text: res.message });
            setUser(prev => prev ? {
                ...prev,
                customBonusCredits: res.user.customBonusCredits,
                customAiBonusCredits: res.user.customAiBonusCredits
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
        try {
            const res = await updateUserFeatureAccess(userId, features);
            setMsg({ type: 'success', text: res.message });
            setUser(prev => prev ? { ...prev, blockedFeatures: features } : prev);
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
                        <span className="new-val" style={{ color: '#818cf8' }}>{newPlan.toUpperCase()}</span>
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
                    setMsg({ type: 'success', text: res.message });
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
                        <span className="new-val" style={{ color: newBlockState ? '#ef4444' : '#22c55e' }}>
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
                    setMsg({ type: 'success', text: res.message });
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
                        <span className="new-val" style={{ color: '#ef4444' }}>{user.username}</span>
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
            setMsg({ type: 'error', text: 'Title and message text are required.' });
            return;
        }
        setDirectSubmitting(true);
        setMsg({ type: '', text: '' });
        try {
            const res = await sendAdminMessage({
                targetType: 'user',
                targetValue: userId,
                title: directMsg.title,
                message: directMsg.message
            });
            setMsg({ type: 'success', text: res.message });
            setDirectMsg({ title: '', message: '' });
        } catch (err) {
            setMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to send message.' });
        } finally {
            setDirectSubmitting(false);
        }
    };

    if (loading) {
        return <main><PageLoading title="Loading User Evaluation..." subtitle="Fetching profile permissions and credit stats..." /></main>;
    }

    if (error || !user) {
        return (
            <div className="admin-user-eval-root">
                <div className="eval-container">
                    <div className="eval-error-card">
                        <h3>⚠️ Evaluation Error</h3>
                        <p>{error || 'Unable to load specified user.'}</p>
                        <button className="eval-btn secondary" onClick={() => navigate('/admin-portal-dashboard-root')}>
                            ← Return to Admin Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const planCredits = user.plan === 'premium' ? 200 : user.plan === 'pro' ? 50 : 10;
    const bonusCredits = user.customBonusCredits || 0;
    const totalCredits = planCredits + bonusCredits;

    return (
        <div className="admin-user-eval-root">
            <div className="eval-container">
                {/* ── Top Header Bar ── */}
                <div className="eval-header-bar">
                    <div className="header-left">
                        <Link to="/admin-portal-dashboard-root" className="back-link">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5M12 19l-7-7 7-7"/>
                            </svg>
                            Back to Admin Dashboard
                        </Link>
                        <h1 className="eval-page-title">User Evaluation & Account Controls</h1>
                        <p className="eval-page-sub">Managing account parameters, credit allocations & feature permissions</p>
                    </div>

                    <div className="header-right-badges">
                        <span className={`status-badge ${user.isBlocked ? 'blocked' : 'active'}`}>
                            {user.isBlocked ? 'Blocked' : 'Active Account'}
                        </span>
                        <span className="role-badge">{user.role.toUpperCase()}</span>
                    </div>
                </div>

                {/* ── Global Alert Banner ── */}
                {msg.text && (
                    <div className={`eval-banner ${msg.type}`}>
                        <span>{msg.type === 'success' ? '✓ ' : '! '}{msg.text}</span>
                        <button className="banner-dismiss" onClick={() => setMsg({ type: '', text: '' })}>✕</button>
                    </div>
                )}

                {/* ── User Overview Stats Banner (Reports, Resumes, CV) ── */}
                <div className="eval-stats-summary-row">
                    <div className={`summary-stat-box reports ${activeDocTab === 'reports' ? 'active-highlight' : ''}`} onClick={() => setActiveDocTab('reports')}>
                        <div className="stat-icon"><BarChart2 size={22} /></div>
                        <div className="stat-info">
                            <div className="stat-value">{reports.length}</div>
                            <div className="stat-label">Total Interview Reports</div>
                        </div>
                        <span className="stat-badge">Inspect Reports →</span>
                    </div>
                    <div className={`summary-stat-box resumes ${activeDocTab === 'resumes' ? 'active-highlight' : ''}`} onClick={() => setActiveDocTab('resumes')}>
                        <div className="stat-icon"><FileText size={22} /></div>
                        <div className="stat-info">
                            <div className="stat-value">{resumes.length}</div>
                            <div className="stat-label">Total Resumes & CVs</div>
                        </div>
                        <span className="stat-badge">Inspect Resumes →</span>
                    </div>
                    <div className={`summary-stat-box cover-letters ${activeDocTab === 'coverLetters' ? 'active-highlight' : ''}`} onClick={() => setActiveDocTab('coverLetters')}>
                        <div className="stat-icon"><Mail size={22} /></div>
                        <div className="stat-info">
                            <div className="stat-value">{coverLetters.length}</div>
                            <div className="stat-label">Total Cover Letters / CV</div>
                        </div>
                        <span className="stat-badge">Inspect Letters →</span>
                    </div>
                </div>

                <div className="eval-grid">
                    {/* ── Card 1: Account Profile Summary ── */}
                    <div className="eval-card profile-card">
                        <div className="card-header">
                            <span className="card-icon"><User size={18} /></span>
                            <h3>Account Identity</h3>
                        </div>

                        <div className="profile-hero">
                            <div className="avatar-circle">
                                {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="user-hero-details">
                                <h4 className="user-display-name">{user.username}</h4>
                                <span className="user-email-text">{user.email}</span>
                                <span className="user-id-sub">ID: <code>{user._id}</code></span>
                            </div>
                        </div>

                        <div className="profile-fields-list">
                            <div className="profile-field">
                                <span className="field-label">Current Subscription Plan:</span>
                                <select 
                                    className="plan-select-input"
                                    value={user.plan}
                                    onChange={(e) => requestPlanChange(e.target.value)}
                                    disabled={planSubmitting}
                                >
                                    <option value="free">Free (10 Credits)</option>
                                    <option value="pro">Pro (50 Credits)</option>
                                    <option value="premium">Premium (200 Credits)</option>
                                </select>
                            </div>

                            <div className="profile-field">
                                <span className="field-label">Account Access Status:</span>
                                <button
                                    className={`eval-btn ${user.isBlocked ? 'success' : 'danger'}`}
                                    onClick={requestToggleBlock}
                                    disabled={blockSubmitting}
                                >
                                    {user.isBlocked ? 'Unblock User Account' : 'Block User Account'}
                                </button>
                            </div>

                            <div className="profile-field">
                                <span className="field-label">Danger Zone:</span>
                                <button
                                    type="button"
                                    className="eval-btn danger delete-btn"
                                    onClick={requestDeleteUser}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                >
                                    <Trash2 size={14} />
                                    <span>Delete User Account</span>
                                </button>
                            </div>

                            <div className="profile-field inline">
                                <span className="field-label">Member Since:</span>
                                <span className="field-val">
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Card 2: Interactive Credit Manager (Separate Sliders with Negative Support) ── */}
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
                                        Full Generations Bonus Offset:
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
                                        className="credit-range-slider gen-slider"
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
                                            className={`preset-pill ${amt < 0 ? 'negative' : ''}`}
                                            onClick={() => setGenBonusCredits(amt)}
                                        >
                                            {amt > 0 ? `+${amt}` : amt}
                                        </button>
                                    ))}
                                </div>
                                <div className="net-limit-preview">
                                    Current Available Generations: <strong>{Math.max(0, (user.plan === 'premium' ? 25 : user.plan === 'pro' ? 10 : 2) + Number(genBonusCredits))} / {user.plan === 'premium' ? 25 : user.plan === 'pro' ? 10 : 2} Gens/mo</strong>
                                </div>
                            </div>

                            <hr className="slider-divider" />

                            {/* --- Slider 2: AI Assistant Bonus --- */}
                            <div className="credit-slider-block">
                                <div className="slider-header">
                                    <label className="slider-label">
                                        AI Assistant & Writer Bonus Offset:
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
                                            className={`preset-pill ${amt < 0 ? 'negative' : ''}`}
                                            onClick={() => setAiBonusCredits(amt)}
                                        >
                                            {amt > 0 ? `+${amt}` : amt}
                                        </button>
                                    ))}
                                </div>
                                <div className="net-limit-preview">
                                    Current Available AI Requests: <strong>{Math.max(0, (user.plan === 'premium' ? 500 : user.plan === 'pro' ? 100 : 10) + Number(aiBonusCredits))} / {user.plan === 'premium' ? 500 : user.plan === 'pro' ? 100 : 10} AI/day</strong>
                                </div>
                            </div>

                            <div className="save-credits-action-row">
                                <button
                                    type="submit"
                                    className="eval-btn save-credits-btn"
                                    disabled={creditSubmitting}
                                >
                                    {creditSubmitting ? 'Saving Changes...' : 'Save Credit Changes'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* ── Card 3: Granular Feature Access Control Toggles ── */}
                    <div className="eval-card features-card">
                        <div className="card-header">
                            <span className="card-icon"><Lock size={18} /></span>
                            <h3>Feature Access Permissions</h3>
                        </div>

                        <form onSubmit={handleSaveFeatures} className="features-form">
                            <p className="features-desc">
                                Selectively enable or block core features for this account. Blocked features display restricted badges in the user's workspace.
                            </p>

                            <div className="feature-toggles-grid">
                                <div className="toggle-row">
                                    <div className="toggle-info">
                                        <span className="toggle-title">AI Assistant (Kivi)</span>
                                        <span className="toggle-subtitle">AI copilot, chat questions & inline resume suggestions</span>
                                    </div>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={features.aiAssistant}
                                            onChange={(e) => setFeatures({ ...features, aiAssistant: e.target.checked })}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>

                                <div className="toggle-row">
                                    <div className="toggle-info">
                                        <span className="toggle-title">Resume Generation</span>
                                        <span className="toggle-subtitle">ATS resume editor, PDF downloads & rewriting</span>
                                    </div>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={features.resumeGeneration}
                                            onChange={(e) => setFeatures({ ...features, resumeGeneration: e.target.checked })}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>

                                <div className="toggle-row">
                                    <div className="toggle-info">
                                        <span className="toggle-title">Cover Letter Generator</span>
                                        <span className="toggle-subtitle">Tailored AI cover letter drafting & exporting</span>
                                    </div>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={features.coverLetterGeneration}
                                            onChange={(e) => setFeatures({ ...features, coverLetterGeneration: e.target.checked })}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>

                                <div className="toggle-row">
                                    <div className="toggle-info">
                                        <span className="toggle-title">Interview Evaluation Reports</span>
                                        <span className="toggle-subtitle">Creation of detailed technical & behavioral interview feedback</span>
                                    </div>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={features.interviewReports}
                                            onChange={(e) => setFeatures({ ...features, interviewReports: e.target.checked })}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="eval-btn primary save-features-btn"
                                disabled={featureSubmitting}
                            >
                                {featureSubmitting ? 'Saving Permissions...' : 'Save Feature Permissions'}
                            </button>
                        </form>
                    </div>

                    {/* ── Card 4: Send Direct Message ── */}
                    <div className="eval-card message-card">
                        <div className="card-header">
                            <span className="card-icon msg-icon"><Mail size={18} /></span>
                            <h3>Send Direct Message to User</h3>
                        </div>

                        <form onSubmit={handleSendDirectMessage} className="direct-msg-form">
                            <p className="features-desc">
                                Dispatch an instant notification directly to this user's notification center.
                            </p>

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
                                    placeholder="Write message content for the user..."
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
                                {directSubmitting ? 'Sending Message...' : 'Send Direct Notification'}
                            </button>
                        </form>
                    </div>

                    {/* ── Card 5: User Documents & Content Explorer (Reports, Resumes, CV) ── */}
                    <div className="eval-card user-documents-card" style={{ gridColumn: '1 / -1' }}>
                        <div className="docs-tab-header">
                            <div className="docs-tab-title-group">
                                <span className="card-icon"><FolderOpen size={18} /></span>
                                <div>
                                    <h3>User Generated Reports, Resumes & Cover Letters</h3>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                                        Browse, inspect, and open all AI generation outputs created by this account
                                    </p>
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
                                    Cover Letters / CV ({coverLetters.length})
                                </button>
                            </div>
                        </div>

                        {/* Tab 1: Reports Content */}
                        {activeDocTab === 'reports' && (
                            <div className="doc-tab-content">
                                {reports.length === 0 ? (
                                    <div className="empty-docs-state">
                                        <div style={{ marginBottom: '0.5rem' }}><BarChart2 size={32} color="#818cf8" /></div>
                                        <h4>No Interview Reports Generated</h4>
                                        <p>This user has not generated any AI mock interview reports yet.</p>
                                    </div>
                                ) : (
                                    <div className="docs-table-wrapper">
                                        <table className="eval-docs-table">
                                            <thead>
                                              <tr>
                                                    <th>Developer / Job Role</th>
                                                    <th>Match Score</th>
                                                    <th>Generated Date</th>
                                                    <th>Job Description Snippet</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reports.map((r) => (
                                                    <tr key={r._id}>
                                                        <td>
                                                            <strong style={{ color: '#f8fafc', fontSize: '0.92rem' }}>{r.developerTitle || 'Software Engineer'}</strong>
                                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: <code>{r._id}</code></div>
                                                        </td>
                                                        <td>
                                                            <span className={`score-badge ${(r.matchScore || 0) >= 75 ? 'high' : (r.matchScore || 0) >= 50 ? 'mid' : 'low'}`}>
                                                                {r.matchScore || 0}%
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                                                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                        </td>
                                                        <td style={{ maxWidth: '280px' }}>
                                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#94a3b8' }} title={r.jobDescription}>
                                                                {r.jobDescription ? r.jobDescription.slice(0, 80) + '...' : 'No job description provided'}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <Link 
                                                                to={`/interview/${r._id}`} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                className="doc-action-btn view-btn"
                                                            >
                                                                View Report ↗
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
                                {resumes.length === 0 ? (
                                    <div className="empty-docs-state">
                                        <div style={{ marginBottom: '0.5rem' }}><FileText size={32} color="#34d399" /></div>
                                        <h4>No Resumes Generated</h4>
                                        <p>This user has not generated or tailored any resumes yet.</p>
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
                                                {resumes.map((res) => (
                                                    <tr key={res._id}>
                                                        <td>
                                                            <strong style={{ color: '#34d399', fontSize: '0.92rem' }}>{res.developerTitle || 'Resume'}</strong>
                                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: <code>{res._id}</code></div>
                                                        </td>
                                                        <td>
                                                            <span className="badge-pill active" style={{ fontSize: '0.75rem' }}>
                                                                {res.generatedResumeHtml ? 'ATS Optimized HTML' : 'Text Resume'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`score-badge ${(res.matchScore || 0) >= 75 ? 'high' : (res.matchScore || 0) >= 50 ? 'mid' : 'low'}`}>
                                                                {res.matchScore || 0}%
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                                                            {res.createdAt ? new Date(res.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                <Link 
                                                                    to={`/resume/${res._id}`} 
                                                                    target="_blank" 
                                                                    rel="noreferrer"
                                                                    className="doc-action-btn view-btn"
                                                                >
                                                                    ATS Live Editor ↗
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
                                                                        Preview
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
                                {coverLetters.length === 0 ? (
                                    <div className="empty-docs-state">
                                        <div style={{ marginBottom: '0.5rem' }}><Mail size={32} color="#c084fc" /></div>
                                        <h4>No Cover Letters Generated</h4>
                                        <p>This user has not generated any cover letters yet.</p>
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
                                                {coverLetters.map((cl) => (
                                                    <tr key={cl._id}>
                                                        <td>
                                                            <strong style={{ color: '#c084fc', fontSize: '0.92rem' }}>{cl.roleName || 'Custom Position'}</strong>
                                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: <code>{cl._id}</code></div>
                                                        </td>
                                                        <td>
                                                            <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                                                                {cl.companyName || 'General Application'}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                                                            {cl.createdAt ? new Date(cl.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                        </td>
                                                        <td style={{ maxWidth: '260px' }}>
                                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#94a3b8' }} title={cl.generatedContent}>
                                                                {cl.generatedContent ? cl.generatedContent.slice(0, 75) + '...' : 'No content'}
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
                                                                View Full Letter
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
            </div>

            {/* ── Document Quick Preview Modal ── */}
            {previewModal && (
                <div className="modal-overlay" onClick={() => setPreviewModal(null)}>
                    <div className="modal-card doc-preview-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px', width: '94%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ color: '#818cf8' }}>{previewModal.type === 'resume' ? <FileText size={20} /> : <Mail size={20} />}</span>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff' }}>{previewModal.title}</h3>
                            </div>
                            <button onClick={() => setPreviewModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div style={{ flexGrow: 1, overflowY: 'auto', background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.25rem', color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: previewModal.isHtml ? 'normal' : 'pre-wrap' }}>
                            {previewModal.isHtml ? (
                                <div dangerouslySetInnerHTML={{ __html: previewModal.content }} />
                            ) : (
                                previewModal.content
                            )}
                        </div>

                        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button 
                                type="button" 
                                className="eval-btn secondary" 
                                onClick={() => {
                                    navigator.clipboard.writeText(previewModal.content);
                                    setMsg({ type: 'success', text: 'Document content copied to clipboard!' });
                                }}
                            >
                                Copy Content
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
