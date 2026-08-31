import React, { useEffect, useMemo } from 'react';
import { useAuth } from '../../Auth/hooks/useAuth';
import { useInterview } from '../../Interview/hooks/useInterview';
import PageLoading from '../../Shared/components/PageLoading';
import { Link } from 'react-router-dom';
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
    const { user, loading: authLoading } = useAuth();
    const { loading: reportsLoading, reports, getReports } = useInterview();

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
                            <span className="item-value" style={{ color: '#10b981' }}>Standard Account</span>
                        </div>
                        <div className="detail-item">
                            <span className="item-label">Status</span>
                            <span className="item-value">Active</span>
                        </div>
                        <div className="detail-item">
                            <span className="item-label">Member Since</span>
                            <span className="item-value">August 2026</span>
                        </div>
                    </div>
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