import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getUserById, adjustUserCredits, updateUserFeatureAccess, updateUserPlan, toggleUserBlock, sendAdminMessage } from '../services/admin.api';
import PageLoading from '../../Shared/components/PageLoading';
import '../styles/userEvaluation.scss';

const UserEvaluationPage = () => {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
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

    const handlePlanChange = async (newPlan) => {
        setPlanSubmitting(true);
        setMsg({ type: '', text: '' });
        try {
            const res = await updateUserPlan(userId, newPlan);
            setMsg({ type: 'success', text: res.message });
            setUser(prev => prev ? { ...prev, plan: newPlan } : prev);
        } catch (err) {
            setMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to update plan.' });
        } finally {
            setPlanSubmitting(false);
        }
    };

    const handleToggleBlock = async () => {
        if (!user) return;
        const newBlockState = !user.isBlocked;
        setBlockSubmitting(true);
        setMsg({ type: '', text: '' });
        try {
            const res = await toggleUserBlock(userId, newBlockState);
            setMsg({ type: 'success', text: res.message });
            setUser(prev => prev ? { ...prev, isBlocked: newBlockState } : prev);
        } catch (err) {
            setMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to change block status.' });
        } finally {
            setBlockSubmitting(false);
        }
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
                            {user.isBlocked ? '🚫 Blocked' : '✅ Active Account'}
                        </span>
                        <span className="role-badge">{user.role.toUpperCase()}</span>
                    </div>
                </div>

                {/* ── Global Alert Banner ── */}
                {msg.text && (
                    <div className={`eval-banner ${msg.type}`}>
                        <span>{msg.type === 'success' ? '✓ ' : '⚠️ '}{msg.text}</span>
                        <button className="banner-dismiss" onClick={() => setMsg({ type: '', text: '' })}>✕</button>
                    </div>
                )}

                <div className="eval-grid">
                    {/* ── Card 1: Account Profile Summary ── */}
                    <div className="eval-card profile-card">
                        <div className="card-header">
                            <span className="card-icon">👤</span>
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
                                    onChange={(e) => handlePlanChange(e.target.value)}
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
                                    onClick={handleToggleBlock}
                                    disabled={blockSubmitting}
                                >
                                    {user.isBlocked ? 'Unblock User Account' : 'Block User Account'}
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
                            <span className="card-icon">⚡</span>
                            <h3>Custom Credit Sliders & Limits</h3>
                        </div>

                        <form onSubmit={handleSaveCredits} className="credits-sliders-form">
                            {/* --- Slider 1: Full Generations Bonus --- */}
                            <div className="credit-slider-block">
                                <div className="slider-header">
                                    <label className="slider-label">
                                        ⚡ Full Generations Bonus Offset:
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
                                        🤖 AI Assistant & Writer Bonus Offset:
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
                                    {creditSubmitting ? 'Saving Changes...' : '💾 Save Credit Changes'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* ── Card 3: Granular Feature Access Control Toggles ── */}
                    <div className="eval-card features-card">
                        <div className="card-header">
                            <span className="card-icon">🔐</span>
                            <h3>Feature Access Permissions</h3>
                        </div>

                        <form onSubmit={handleSaveFeatures} className="features-form">
                            <p className="features-desc">
                                Selectively enable or block core features for this account. Blocked features display restricted badges in the user's workspace.
                            </p>

                            <div className="feature-toggles-grid">
                                <div className="toggle-row">
                                    <div className="toggle-info">
                                        <span className="toggle-title">🤖 AI Assistant (Kivi)</span>
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
                                        <span className="toggle-title">📄 Resume Generation</span>
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
                                        <span className="toggle-title">✉️ Cover Letter Generator</span>
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
                                        <span className="toggle-title">📊 Interview Evaluation Reports</span>
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
                                {featureSubmitting ? 'Saving Permissions...' : '💾 Save Feature Permissions'}
                            </button>
                        </form>
                    </div>

                    {/* ── Card 4: Send Direct Message ── */}
                    <div className="eval-card message-card">
                        <div className="card-header">
                            <span className="card-icon msg-icon">✉️</span>
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
                                {directSubmitting ? 'Sending Message...' : '🚀 Send Direct Notification'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserEvaluationPage;
