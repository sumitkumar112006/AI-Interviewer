import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../Auth/hooks/useAuth';
import { useInterview } from '../../Interview/hooks/useInterview';
import { updateCareerProfile } from '../../Auth/services/auth.api';
import PageLoading from '../../Shared/components/PageLoading';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, Briefcase, Sparkles, Check, Trash2, Plus, AlertCircle } from 'lucide-react';
import { InvoicesTable } from '../../Subscription/components/InvoicesTable';
import '../style/profile.scss';

// Helper functions
function extractObjectId(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && '$oid' in v) return String(v.$oid ?? '').trim();
    return String(v).trim();
}

function extractDateValue(v) {
    if (!v) return '';
    if (typeof v === 'string' || v instanceof Date) return v;
    if (typeof v === 'object' && '$date' in v) return v.$date;
    return v;
}

function formatDate(v) {
    if (!v) return '—';
    const d = new Date(extractDateValue(v));
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function getTitle(r) {
    return (r?.developerTitle || r?.Title || r?.title || 'Assessment Report').trim();
}

function getScore(r) {
    const s = r?.matchScore ?? r?.score;
    if (s === undefined || s === null) return null;
    return typeof s === 'number' ? s : parseInt(String(s).replace('%', ''));
}

function getStatus(score) {
    if (score === null) return { label: '—', cls: 'status-na' };
    if (score >= 85) return { label: 'Excellent', cls: 'status-excellent' };
    if (score >= 75) return { label: 'Good', cls: 'status-good' };
    if (score >= 50) return { label: 'Average', cls: 'status-average' };
    return { label: 'Poor', cls: 'status-poor' };
}

function getScoreColorClass(score) {
    if (score === null) return 'score-na';
    if (score >= 85) return 'score-excellent';
    if (score >= 75) return 'score-good';
    if (score >= 50) return 'score-average';
    return 'score-poor';
}

const Profile = () => {
    const { user, setUser, loading: authLoading, handleLogout } = useAuth();
    const { loading: reportsLoading, reports, getReports } = useInterview();
    const navigate = useNavigate();

    // Career profile state
    const [careerForm, setCareerForm] = useState({
        targetRole: user?.careerProfile?.targetRole || 'Full Stack Developer',
        experienceLevel: user?.careerProfile?.experienceLevel || 'fresher',
        selfDescription: user?.careerProfile?.selfDescription || ''
    });
    const [presets, setPresets] = useState(user?.careerProfile?.savedDescriptions || []);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileFeedback, setProfileFeedback] = useState(null);

    // New preset modal/form
    const [showAddPreset, setShowAddPreset] = useState(false);
    const [newPresetTitle, setNewPresetTitle] = useState('');
    const [newPresetContent, setNewPresetContent] = useState('');
    const [savingPreset, setSavingPreset] = useState(false);

    useEffect(() => {
        if (user?.careerProfile) {
            setCareerForm({
                targetRole: user.careerProfile.targetRole || 'Full Stack Developer',
                experienceLevel: user.careerProfile.experienceLevel || 'fresher',
                selfDescription: user.careerProfile.selfDescription || ''
            });
            setPresets(user.careerProfile.savedDescriptions || []);
        }
    }, [user]);

    const handleCareerInputChange = (e) => {
        const { name, value } = e.target;
        setCareerForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveCareerProfile = async (e) => {
        if (e) e.preventDefault();
        setSavingProfile(true);
        setProfileFeedback(null);
        try {
            const res = await updateCareerProfile({
                targetRole: careerForm.targetRole,
                experienceLevel: careerForm.experienceLevel,
                selfDescription: careerForm.selfDescription
            });

            if (setUser && res?.careerProfile) {
                setUser(prev => prev ? ({ ...prev, careerProfile: res.careerProfile }) : prev);
            }
            setProfileFeedback({ type: 'success', text: 'Career profile saved successfully!' });
            setTimeout(() => setProfileFeedback(null), 4000);
        } catch (err) {
            console.error('Error saving career profile:', err);
            setProfileFeedback({ type: 'error', text: err?.response?.data?.message || 'Failed to save career profile.' });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleCreatePreset = async (e) => {
        if (e) e.preventDefault();
        if (!newPresetTitle.trim() || !newPresetContent.trim()) return;

        setSavingPreset(true);
        try {
            const res = await updateCareerProfile({
                newDescription: {
                    title: newPresetTitle.trim(),
                    content: newPresetContent.trim()
                }
            });

            if (res?.careerProfile?.savedDescriptions) {
                setPresets(res.careerProfile.savedDescriptions);
            } else {
                setPresets(prev => [...prev, { title: newPresetTitle.trim(), content: newPresetContent.trim() }]);
            }

            if (setUser && res?.careerProfile) {
                setUser(prev => prev ? ({ ...prev, careerProfile: res.careerProfile }) : prev);
            }

            setNewPresetTitle('');
            setNewPresetContent('');
            setShowAddPreset(false);
        } catch (err) {
            console.error('Error adding preset:', err);
        } finally {
            setSavingPreset(false);
        }
    };

    const handleDeletePreset = async (presetItem) => {
        try {
            const res = await updateCareerProfile({
                deleteDescriptionId: presetItem._id,
                deleteDescriptionTitle: presetItem.title
            });

            if (res?.careerProfile?.savedDescriptions) {
                setPresets(res.careerProfile.savedDescriptions);
            } else {
                setPresets(prev => prev.filter(p => p._id ? p._id !== presetItem._id : p.title !== presetItem.title));
            }

            if (setUser && res?.careerProfile) {
                setUser(prev => prev ? ({ ...prev, careerProfile: res.careerProfile }) : prev);
            }
        } catch (err) {
            console.error('Error deleting preset:', err);
        }
    };

    const handleSetPresetAsDefault = async (presetItem) => {
        setCareerForm(prev => ({ ...prev, selfDescription: presetItem.content }));
        try {
            const res = await updateCareerProfile({
                selfDescription: presetItem.content
            });
            if (setUser && res?.careerProfile) {
                setUser(prev => prev ? ({ ...prev, careerProfile: res.careerProfile }) : prev);
            }
            setProfileFeedback({ type: 'success', text: `Set "${presetItem.title}" as your default self-description!` });
            setTimeout(() => setProfileFeedback(null), 3000);
        } catch (err) {
            console.error('Error setting default:', err);
        }
    };

    const onProfileLogout = async () => {
        await handleLogout();
        navigate('/landing');
    };

    useEffect(() => {
        if (reports === null) {
            void getReports();
        }
    }, [reports, getReports]);

    const allReports = useMemo(() => Array.isArray(reports) ? reports : [], [reports]);

    // Compute key statistics
    const stats = useMemo(() => {
        const scores = allReports.map(getScore).filter(s => s !== null);
        const bestScore = scores.length ? Math.max(...scores) : 0;
        const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        return {
            total: allReports.length,
            bestScore,
            avgScore
        };
    }, [allReports]);

    if (authLoading || (reportsLoading && reports === null)) {
        return (
            <main>
                <PageLoading title="Loading Profile..." subtitle="Fetching account details and saved interview reports..." />
            </main>
        );
    }

    if (!user) {
        return (
            <div className="profile-page-container" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Please login to view your profile</p>
            </div>
        );
    }

    const firstLetter = (user.username || 'U')[0].toUpperCase();

    return (
        <div className="profile-page-container">
            <div className="profile-hero-section">
                {/* User Info Details Card */}
                <div className="user-info-card">
                    <div className="profile-avatar-large">{firstLetter}</div>
                    <h2>{user.username}</h2>
                    <p className="user-email-text">{user.email}</p>

                    <div className="user-details-list">
                        <div className="detail-item">
                            <span className="item-label">Account Tier</span>
                            <span className="item-value" style={{ color: '#10b981', textTransform: 'capitalize' }}>
                                {user.plan ? `${user.plan} Account` : 'Standard Account'}
                            </span>
                        </div>
                        <div className="detail-item">
                            <span className="item-label">Status</span>
                            <span className="item-value">Active</span>
                        </div>
                        <div className="detail-item">
                            <span className="item-label">Target Role</span>
                            <span className="item-value">{user?.careerProfile?.targetRole || 'Full Stack Developer'}</span>
                        </div>
                    </div>

                    <button 
                        type="button" 
                        onClick={onProfileLogout} 
                        className="profile-logout-btn" 
                        id="profile-signout-btn"
                        title="Sign out of your account"
                    >
                        <LogOut size={15} />
                        <span>Sign Out</span>
                    </button>
                </div>

                {/* Key Statistics Dashboard */}
                <div className="profile-stats-card">
                    <h3 className="stats-card-title">Performance Metrics</h3>
                    <div className="stats-grid">
                        <div className="stat-box">
                            <span className="stat-num">{stats.total}</span>
                            <span className="stat-lbl">Reports Generated</span>
                        </div>
                        <div className="stat-box">
                            <span className={`stat-num ${getScoreColorClass(stats.bestScore)}`}>
                                {stats.bestScore > 0 ? `${stats.bestScore}%` : '—'}
                            </span>
                            <span className="stat-lbl">Best Match Score</span>
                        </div>
                        <div className="stat-box">
                            <span className={`stat-num ${getScoreColorClass(stats.avgScore)}`}>
                                {stats.avgScore > 0 ? `${stats.avgScore}%` : '—'}
                            </span>
                            <span className="stat-lbl">Average Score</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Career Profile & Presets Management Section */}
            <div className="career-profile-section">
                <div className="section-header-row">
                    <div className="header-title-block">
                        <Briefcase size={20} className="section-icon" />
                        <div>
                            <h3>Career Profile & Self-Descriptions</h3>
                            <p className="section-subtitle">
                                Save your background pitch and target role. These are automatically used across reports, resumes, and interview assessments.
                            </p>
                        </div>
                    </div>
                </div>

                {profileFeedback && (
                    <div className={`profile-feedback-alert ${profileFeedback.type}`}>
                        {profileFeedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                        <span>{profileFeedback.text}</span>
                    </div>
                )}

                <div className="career-profile-grid">
                    {/* Main Career Profile Form */}
                    <form className="career-form-card" onSubmit={handleSaveCareerProfile}>
                        <h4>Default Candidate Pitch</h4>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="targetRole">Target Role</label>
                                <input
                                    type="text"
                                    id="targetRole"
                                    name="targetRole"
                                    value={careerForm.targetRole}
                                    onChange={handleCareerInputChange}
                                    placeholder="e.g. Senior Frontend Engineer"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="experienceLevel">Experience Level</label>
                                <select
                                    id="experienceLevel"
                                    name="experienceLevel"
                                    value={careerForm.experienceLevel}
                                    onChange={handleCareerInputChange}
                                >
                                    <option value="fresher">Fresher / Entry Level (0-2 yrs)</option>
                                    <option value="mid">Mid-Level (2-5 yrs)</option>
                                    <option value="senior">Senior (5+ yrs)</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="profileSelfDescription">Default Self Description</label>
                            <textarea
                                id="profileSelfDescription"
                                name="selfDescription"
                                rows={4}
                                value={careerForm.selfDescription}
                                onChange={handleCareerInputChange}
                                placeholder="Describe your technical background, key strengths, tech stack, and proud accomplishments..."
                            />
                            <span className="field-hint">
                                This will automatically pre-fill when generating interview reports or resumes.
                            </span>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="save-career-btn"
                                disabled={savingProfile}
                            >
                                <Sparkles size={15} />
                                <span>{savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                            </button>
                        </div>
                    </form>

                    {/* Saved Profile Presets Manager */}
                    <div className="presets-manager-card">
                        <div className="presets-card-header">
                            <div>
                                <h4>Saved Profile Presets</h4>
                                <span className="presets-subtitle">{presets.length} Presets Available</span>
                            </div>
                            <button
                                type="button"
                                className="add-preset-btn"
                                onClick={() => setShowAddPreset(!showAddPreset)}
                            >
                                <Plus size={14} />
                                <span>{showAddPreset ? 'Cancel' : 'New Preset'}</span>
                            </button>
                        </div>

                        {showAddPreset && (
                            <form className="new-preset-inline-form" onSubmit={handleCreatePreset}>
                                <input
                                    type="text"
                                    placeholder="Preset Label (e.g. Backend Go/Node, AI Engineer)..."
                                    value={newPresetTitle}
                                    onChange={(e) => setNewPresetTitle(e.target.value)}
                                    required
                                />
                                <textarea
                                    rows={3}
                                    placeholder="Enter candidate pitch for this preset..."
                                    value={newPresetContent}
                                    onChange={(e) => setNewPresetContent(e.target.value)}
                                    required
                                />
                                <button
                                    type="submit"
                                    className="save-new-preset-btn"
                                    disabled={savingPreset || !newPresetTitle.trim() || !newPresetContent.trim()}
                                >
                                    {savingPreset ? 'Saving...' : 'Add Preset'}
                                </button>
                            </form>
                        )}

                        <div className="presets-list-scroll">
                            {presets.length === 0 ? (
                                <div className="no-presets-box">
                                    <p>No presets saved yet. Create customized pitches for different job roles!</p>
                                </div>
                            ) : (
                                presets.map((p, idx) => {
                                    const isCurrentDefault = careerForm.selfDescription.trim() === p.content?.trim();
                                    return (
                                        <div key={p._id || idx} className={`preset-item-row ${isCurrentDefault ? 'active-default' : ''}`}>
                                            <div className="preset-info">
                                                <div className="preset-title-wrap">
                                                    <span className="preset-name">{p.title}</span>
                                                    {isCurrentDefault && (
                                                        <span className="default-badge">Active Default</span>
                                                    )}
                                                </div>
                                                <p className="preset-preview-text">{p.content}</p>
                                            </div>

                                            <div className="preset-actions">
                                                {!isCurrentDefault && (
                                                    <button
                                                        type="button"
                                                        className="set-default-btn"
                                                        onClick={() => handleSetPresetAsDefault(p)}
                                                        title="Use this preset as your main default self-description"
                                                    >
                                                        Set Default
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="delete-preset-icon-btn"
                                                    onClick={() => handleDeletePreset(p)}
                                                    title="Delete this preset"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Assessment Reports Grid */}
            <div className="reports-list-section">
                <div className="section-header-row">
                    <h3>Generated Assessments</h3>
                    <span className="reports-count-pill">{stats.total} Total</span>
                </div>

                {allReports.length > 0 ? (
                    <div className="reports-grid">
                        {allReports.map((reportItem) => {
                            const reportId = extractObjectId(reportItem._id);
                            const score = getScore(reportItem);
                            const status = getStatus(score);
                            const title = getTitle(reportItem);
                            const dateStr = formatDate(reportItem.createdAt);

                            return (
                                <div key={reportId} className="profile-report-card">
                                    <div className="card-top">
                                        <div className="report-info-block">
                                            <h4>{title}</h4>
                                            <span className="report-date">Generated on {dateStr}</span>
                                        </div>
                                        <div className={`score-circle-pill ${getScoreColorClass(score)}`}>
                                            {score !== null ? `${score}` : '—'}
                                        </div>
                                    </div>

                                    <div className="card-bottom">
                                        <span className={`report-status-badge ${status.cls}`}>
                                            {status.label}
                                        </span>
                                        <Link 
                                            to={`/interview/${reportId}`} 
                                            className="open-report-link"
                                            state={{ interviewReport: reportItem }}
                                        >
                                            View Workspace →
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-reports-panel">
                        <div className="empty-icon">📁</div>
                        <h3>No Generated Reports Found</h3>
                        <p>Generate your first AI-tailored interview assessment report from the dashboard to track your performance stats.</p>
                        <Link to="/" className="generate-btn">
                            Get Started
                        </Link>
                    </div>
                )}
            </div>

            {/* Invoices & Billing History Section */}
            <InvoicesTable />
        </div>
    );
};

export default Profile;