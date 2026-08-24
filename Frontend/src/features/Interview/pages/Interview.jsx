import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getInterviewReportById } from '../services/interview.api';
import { useInterview } from '../hooks/useInterview';
import { useAuth } from '../../Auth/hooks/useAuth';
import PageLoading from '../../Shared/components/PageLoading';
import ShimmerLoading from '../../Shared/components/ShimmerLoading';
import TechnicalQuestionsTab from './TechnicalQuestionsTab';
import BehavioralQuestionsTab from './BehavioralQuestionsTab';
import TechnicalRoadmapTab from './TechnicalRoadmapTab';
import '../style/interview.scss';

function extractObjectId(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && '$oid' in value) return String(value.$oid ?? '').trim();
    return String(value).trim();
}

function extractDateValue(value) {
    if (!value) return '';
    if (typeof value === 'string' || value instanceof Date) return value;
    if (typeof value === 'object' && '$date' in value) return value.$date;
    return value;
}

function parseJsonLikeValue(value) {
    if (typeof value !== 'string') return value;
    const trimmedValue = value.trim();
    if (!trimmedValue) return value;
    if (
        (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
        (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'))
    ) {
        try {
            return JSON.parse(trimmedValue);
        } catch {
            return value;
        }
    }
    return value;
}

function ensureArray(value) {
    const parsedValue = parseJsonLikeValue(value);
    if (Array.isArray(parsedValue)) return parsedValue;
    if (parsedValue === undefined || parsedValue === null || parsedValue === '') return [];
    return [parsedValue];
}

function formatDate(value) {
    if (!value) return 'Not available';
    const normalizedValue = extractDateValue(value);
    const date = new Date(normalizedValue);
    if (Number.isNaN(date.getTime())) return 'Not available';
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function getPreview(text, length = 190) {
    if (text === undefined || text === null) return 'Not available';
    const normalizedText = String(text).replace(/\s+/g, ' ').trim();
    if (!normalizedText) return 'Not available';
    if (normalizedText.length <= length) return normalizedText;
    return `${normalizedText.slice(0, length).trim()}...`;
}

function normalizeSeverity(severity) {
    if (!severity) return 'low';
    return String(severity).toLowerCase();
}

function normalizeQuestionItem(item) {
    const parsedItem = parseJsonLikeValue(item);
    if (parsedItem && typeof parsedItem === 'object' && !Array.isArray(parsedItem)) {
        const question = String(parsedItem.question ?? parsedItem.title ?? parsedItem.prompt ?? '').trim();
        if (!question) return null;
        return {
            question,
            intention: String(parsedItem.intention ?? parsedItem.reason ?? 'Not available').trim() || 'Not available',
            answer: String(parsedItem.answer ?? parsedItem.sampleAnswer ?? parsedItem.guidance ?? 'Not available').trim() || 'Not available',
            userResponse: String(parsedItem.userResponse ?? '').trim()
        };
    }
    const question = String(parsedItem ?? '').trim();
    if (!question) return null;
    return {
        question,
        intention: 'Not available',
        answer: 'Not available',
        userResponse: ''
    };
}

function normalizeQuestions(value) {
    return ensureArray(value).map(normalizeQuestionItem).filter(Boolean);
}

function normalizeSkillGapItem(item) {
    const parsedItem = parseJsonLikeValue(item);
    if (parsedItem && typeof parsedItem === 'object' && !Array.isArray(parsedItem)) {
        const skill = String(parsedItem.skill ?? parsedItem.name ?? parsedItem.gap ?? '').trim();
        if (!skill) return null;
        return {
            skill,
            severity: normalizeSeverity(parsedItem.severity ?? 'medium')
        };
    }
    const skill = String(parsedItem ?? '').trim();
    if (!skill) return null;
    return {
        skill,
        severity: 'medium'
    };
}

function normalizeSkillGaps(value) {
    return ensureArray(value).map(normalizeSkillGapItem).filter(Boolean);
}

function normalizePlanItem(item, index) {
    const parsedItem = parseJsonLikeValue(item);
    if (parsedItem && typeof parsedItem === 'object' && !Array.isArray(parsedItem)) {
        return {
            day: String(parsedItem.day ?? `Day ${index + 1}`).trim() || `Day ${index + 1}`,
            focus: String(parsedItem.focus ?? parsedItem.topic ?? parsedItem.title ?? 'Not available').trim() || 'Not available',
            tasks: ensureArray(parsedItem.tasks).map((task) => String(parseJsonLikeValue(task)).trim()).filter(Boolean)
        };
    }
    const focus = String(parsedItem ?? '').trim();
    if (!focus) return null;
    return {
        day: `Day ${index + 1}`,
        focus,
        tasks: []
    };
}

function normalizePreparationPlan(value) {
    return ensureArray(value).map((item, index) => normalizePlanItem(item, index)).filter(Boolean);
}

function normalizeReport(report) {
    if (!report) return null;
    return {
        ...report,
        _id: extractObjectId(report._id),
        developerTitle: String(report.developerTitle ?? report.Title ?? report.title ?? '').trim(),
        createdAt: extractDateValue(report.createdAt),
        updatedAt: extractDateValue(report.updatedAt),
        technicalQuestions: normalizeQuestions(report.technicalQuestions ?? report.technicalQuestion),
        behavioralQuestion: normalizeQuestions(report.behavioralQuestion ?? report.behaviouralQuestion),
        skillGaps: normalizeSkillGaps(report.skillGaps),
        preparationPlan: normalizePreparationPlan(report.preparationPlan),
        completedTasks: ensureArray(report.completedTasks || [])
    };
}

function ChevronIcon({ isOpen }) {
    return (
        <span className={isOpen ? 'chevron open' : 'chevron'} aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
                <path d="M5 7.5L10 12.5L15 7.5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
        </span>
    );
}

const Interview = () => {
    const { interviewId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'technical';

    const { report: sharedReport } = useInterview();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [summaryOpen, setSummaryOpen] = useState(false);

    const routeReport = location.state?.interviewReport ?? null;
    const sharedReportMatchesRoute = extractObjectId(sharedReport?._id) === interviewId ? sharedReport : null;
    const routeReportMatchesRoute = extractObjectId(routeReport?._id) === interviewId ? routeReport : null;
    const fallbackReport = routeReportMatchesRoute ?? sharedReportMatchesRoute;

    const handleUpdateReport = (updatedReport) => {
        setReport(updatedReport);
    };

    useEffect(() => {
        if (fallbackReport) {
            setReport((currentReport) => currentReport ?? fallbackReport);
            setLoading(false);
        }
    }, [fallbackReport]);

    useEffect(() => {
        let isMounted = true;
        async function loadInterviewReport() {
            setLoading((currentLoading) => !fallbackReport || currentLoading);
            if (!fallbackReport) {
                setError('');
            }
            try {
                const response = await getInterviewReportById(interviewId);
                if (!isMounted) return;
                setReport(response?.interviewReport ?? fallbackReport ?? null);
                setError('');
            } catch (err) {
                if (!isMounted) return;
                if (!fallbackReport) {
                    setError(err?.response?.data?.message || 'Unable to load interview report right now.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }
        loadInterviewReport();
        return () => {
            isMounted = false;
        };
    }, [fallbackReport, interviewId]);

    const normalizedReport = useMemo(() => normalizeReport(report), [report]);

    if (loading && !report) {
        return <main><ShimmerLoading type="workspace" title="Loading Interview Prep..." /></main>;
    }

    if (error && !report) {
        return (
            <div className="interview-page">
                <div className="interview-shell">
                    <div className="feedback-card error">{error}</div>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="interview-page">
                <div className="interview-shell">
                    <div className="feedback-card">Interview report not found.</div>
                </div>
            </div>
        );
    }

    const displayTitle = normalizedReport?.developerTitle || 'Interview assessment workspace';

    return (
        <div className="interview-page">
            <div className="interview-shell">
                
                {/* Collapsible Overview Header */}
                <div className="summary-collapsible-panel">
                    <button 
                        className="summary-collapsible-toggle" 
                        onClick={() => setSummaryOpen(!summaryOpen)}
                    >
                        <div className="toggle-text-left">
                            <span className="eyebrow">Workspace context</span>
                            <h2>{displayTitle} — Assessment Summary</h2>
                        </div>
                        <div className="toggle-badge-right">
                            <span className="match-score-pill">Score: {normalizedReport?.matchScore ?? '--'}/100</span>
                            <ChevronIcon isOpen={summaryOpen} />
                        </div>
                    </button>

                    {summaryOpen && (
                        <div className="summary-collapsible-content">
                            <div className="summary-grid">
                                <article className="summary-card accent-card">
                                    <p className="summary-label">Match score</p>
                                    <div className="score-row">
                                        <strong>{normalizedReport?.matchScore ?? '--'}</strong>
                                        <span>/100</span>
                                    </div>
                                    <p className="summary-copy">
                                        Generated on {formatDate(normalizedReport?.createdAt)} for the current application profile.
                                    </p>
                                </article>

                                <article className="summary-card">
                                    <p className="summary-label">Job description</p>
                                    <p className="summary-copy detail-copy scrollable-summary">
                                        {normalizedReport?.jobDescription ?? 'Not available'}
                                    </p>
                                </article>

                                <article className="summary-card">
                                    <p className="summary-label">Self summary</p>
                                    <p className="summary-copy detail-copy scrollable-summary">
                                        {normalizedReport?.selfDescription ?? 'Not available'}
                                    </p>
                                </article>
                            </div>

                            <div className="gaps-snapshot-row">
                                <div className="gaps-block">
                                    <h4>Inferred Skill Gaps:</h4>
                                    <div className="chip-list">
                                        {normalizedReport?.skillGaps && normalizedReport.skillGaps.length > 0 ? (
                                            normalizedReport.skillGaps.map((item, index) => (
                                                <span
                                                    key={`${item.skill}-${index}`}
                                                    className={`skill-chip ${normalizeSeverity(item.severity)}`}
                                                >
                                                    {item.skill}
                                                </span>
                                            ))
                                        ) : (
                                            <p className="side-copy">No skill gaps identified.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="resume-snapshot-block">
                                    <h4>Resume Profile Snapshot:</h4>
                                    <p className="snapshot-preview">{getPreview(normalizedReport?.resume, 160)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sub-Page Navigation Tabs */}
                <div className="interview-pages-tabs-nav">
                    <button
                        className={`page-tab-nav-btn ${activeTab === 'technical' ? 'active' : ''}`}
                        onClick={() => setSearchParams({ tab: 'technical' })}
                    >
                        Technical Questions
                    </button>
                    <button
                        className={`page-tab-nav-btn ${activeTab === 'behavioral' ? 'active' : ''}`}
                        onClick={() => setSearchParams({ tab: 'behavioral' })}
                    >
                        Behavioral Questions
                    </button>
                    <button
                        className={`page-tab-nav-btn ${activeTab === 'roadmap' ? 'active' : ''}`}
                        onClick={() => setSearchParams({ tab: 'roadmap' })}
                    >
                        Technical Roadmap
                    </button>
                </div>

                {/* Active Tab Page Content */}
                <main className="tab-page-content-wrapper">
                    {activeTab === 'technical' && (
                        <TechnicalQuestionsTab
                            interviewId={interviewId}
                            initialQuestions={normalizedReport.technicalQuestions}
                            onUpdateReport={handleUpdateReport}
                        />
                    )}

                    {activeTab === 'behavioral' && (
                        <BehavioralQuestionsTab
                            interviewId={interviewId}
                            initialQuestions={normalizedReport.behavioralQuestion}
                            onUpdateReport={handleUpdateReport}
                        />
                    )}

                    {activeTab === 'roadmap' && (
                        <TechnicalRoadmapTab
                            interviewId={interviewId}
                            preparationPlan={normalizedReport.preparationPlan}
                            completedTasks={normalizedReport.completedTasks || []}
                            onUpdateReport={handleUpdateReport}
                        />
                    )}
                </main>

            </div>
        </div>
    );
};

export default Interview;
