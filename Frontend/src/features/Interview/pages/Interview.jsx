import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getInterviewReportById } from '../services/interview.api'
import { useInterview } from '../hooks/useInterview'
import { useAuth } from '../../Auth/hooks/useAuth'
import LoadingPage from '../Loading'
import '../style/interview.scss'

const sectionConfig = [
    { id: 'technical', label: 'Technical questions', eyebrow: 'Core depth' },
    { id: 'behavioral', label: 'Behavioral questions', eyebrow: 'Communication' },
    { id: 'roadmap', label: 'Road map', eyebrow: 'Preparation plan' }
]

function extractObjectId(value) {
    if (!value) {
        return ''
    }

    if (typeof value === 'string') {
        return value
    }

    if (typeof value === 'object' && '$oid' in value) {
        return String(value.$oid ?? '').trim()
    }

    return String(value).trim()
}

function extractDateValue(value) {
    if (!value) {
        return ''
    }

    if (typeof value === 'string' || value instanceof Date) {
        return value
    }

    if (typeof value === 'object' && '$date' in value) {
        return value.$date
    }

    return value
}

function parseJsonLikeValue(value) {
    if (typeof value !== 'string') {
        return value
    }

    const trimmedValue = value.trim()

    if (!trimmedValue) {
        return value
    }

    if (
        (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
        (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'))
    ) {
        try {
            return JSON.parse(trimmedValue)
        } catch {
            return value
        }
    }

    return value
}

function ensureArray(value) {
    const parsedValue = parseJsonLikeValue(value)

    if (Array.isArray(parsedValue)) {
        return parsedValue
    }

    if (parsedValue === undefined || parsedValue === null || parsedValue === '') {
        return []
    }

    return [parsedValue]
}

function formatDate(value) {
    if (!value) return 'Not available'

    const normalizedValue = extractDateValue(value)
    const date = new Date(normalizedValue)
    if (Number.isNaN(date.getTime())) {
        return 'Not available'
    }

    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date)
}

function getPreview(text, length = 190) {
    if (text === undefined || text === null) return 'Not available'
    const normalizedText = String(text).replace(/\s+/g, ' ').trim()

    if (!normalizedText) {
        return 'Not available'
    }

    if (normalizedText.length <= length) {
        return normalizedText
    }

    return `${normalizedText.slice(0, length).trim()}...`
}

function normalizeSeverity(severity) {
    if (!severity) return 'low'
    return String(severity).toLowerCase()
}

function normalizeQuestionItem(item) {
    const parsedItem = parseJsonLikeValue(item)

    if (parsedItem && typeof parsedItem === 'object' && !Array.isArray(parsedItem)) {
        const question = String(parsedItem.question ?? parsedItem.title ?? parsedItem.prompt ?? '').trim()

        if (!question) {
            return null
        }

        return {
            question,
            intention: String(parsedItem.intention ?? parsedItem.reason ?? 'Not available').trim() || 'Not available',
            answer: String(parsedItem.answer ?? parsedItem.sampleAnswer ?? parsedItem.guidance ?? 'Not available').trim() || 'Not available'
        }
    }

    const question = String(parsedItem ?? '').trim()

    if (!question) {
        return null
    }

    return {
        question,
        intention: 'Not available',
        answer: 'Not available'
    }
}

function normalizeQuestions(value) {
    return ensureArray(value)
        .map(normalizeQuestionItem)
        .filter(Boolean)
}

function normalizeSkillGapItem(item) {
    const parsedItem = parseJsonLikeValue(item)

    if (parsedItem && typeof parsedItem === 'object' && !Array.isArray(parsedItem)) {
        const skill = String(parsedItem.skill ?? parsedItem.name ?? parsedItem.gap ?? '').trim()

        if (!skill) {
            return null
        }

        return {
            skill,
            severity: normalizeSeverity(parsedItem.severity ?? 'medium')
        }
    }

    const skill = String(parsedItem ?? '').trim()

    if (!skill) {
        return null
    }

    return {
        skill,
        severity: 'medium'
    }
}

function normalizeSkillGaps(value) {
    return ensureArray(value)
        .map(normalizeSkillGapItem)
        .filter(Boolean)
}

function normalizePlanItem(item, index) {
    const parsedItem = parseJsonLikeValue(item)

    if (parsedItem && typeof parsedItem === 'object' && !Array.isArray(parsedItem)) {
        return {
            day: String(parsedItem.day ?? `Day ${index + 1}`).trim() || `Day ${index + 1}`,
            focus: String(parsedItem.focus ?? parsedItem.topic ?? parsedItem.title ?? 'Not available').trim() || 'Not available',
            tasks: ensureArray(parsedItem.tasks).map((task) => String(parseJsonLikeValue(task)).trim()).filter(Boolean)
        }
    }

    const focus = String(parsedItem ?? '').trim()

    if (!focus) {
        return null
    }

    return {
        day: `Day ${index + 1}`,
        focus,
        tasks: []
    }
}

function normalizePreparationPlan(value) {
    return ensureArray(value)
        .map((item, index) => normalizePlanItem(item, index))
        .filter(Boolean)
}

function normalizeReport(report) {
    if (!report) {
        return null
    }

    return {
        ...report,
        _id: extractObjectId(report._id),
        developerTitle: String(report.developerTitle ?? report.Title ?? report.title ?? '').trim(),
        createdAt: extractDateValue(report.createdAt),
        updatedAt: extractDateValue(report.updatedAt),
        technicalQuestions: normalizeQuestions(report.technicalQuestions ?? report.technicalQuestion),
        behavioralQuestion: normalizeQuestions(report.behavioralQuestion ?? report.behaviouralQuestion),
        skillGaps: normalizeSkillGaps(report.skillGaps),
        preparationPlan: normalizePreparationPlan(report.preparationPlan)
    }
}

function ChevronIcon({ isOpen }) {
    return (
        <span className={isOpen ? 'chevron open' : 'chevron'} aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
                <path d="M5 7.5L10 12.5L15 7.5" />
            </svg>
        </span>
    )
}

const Interview = () => {
    const { interviewId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { report: sharedReport } = useInterview()
    const { handleLogout } = useAuth()
    const [activeSection, setActiveSection] = useState(sectionConfig[0].id)
    const [report, setReport] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [expandedItems, setExpandedItems] = useState({
        jobDescription: false,
        selfDescription: false
    })

    const routeReport = location.state?.interviewReport ?? null
    const sharedReportMatchesRoute = extractObjectId(sharedReport?._id) === interviewId ? sharedReport : null
    const routeReportMatchesRoute = extractObjectId(routeReport?._id) === interviewId ? routeReport : null
    const fallbackReport = routeReportMatchesRoute ?? sharedReportMatchesRoute

    const toggleExpandedItem = (itemKey) => {
        setExpandedItems((currentItemsState) => ({
            ...currentItemsState,
            [itemKey]: !currentItemsState[itemKey]
        }))
    }

    const handleGenerateResume = () => {
        if (!interviewId) {
            return
        }

        navigate(`/resume/${interviewId}`, {
            state: {
                interviewReport: normalizedReport ?? report ?? null
            }
        })
    }

    useEffect(() => {
        if (fallbackReport) {
            setReport((currentReport) => currentReport ?? fallbackReport)
            setLoading(false)
        }
    }, [fallbackReport])

    useEffect(() => {
        setExpandedItems({
            jobDescription: false,
            selfDescription: false
        })
    }, [interviewId])

    useEffect(() => {
        let isMounted = true

        async function loadInterviewReport() {
            setLoading((currentLoading) => !fallbackReport || currentLoading)

            if (!fallbackReport) {
                setError('')
            }

            try {
                const response = await getInterviewReportById(interviewId)

                if (!isMounted) {
                    return
                }

                setReport(response?.interviewReport ?? fallbackReport ?? null)
                setError('')
            } catch (err) {
                if (!isMounted) {
                    return
                }

                if (!fallbackReport) {
                    setError(err?.response?.data?.message || 'Unable to load interview report right now.')
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        loadInterviewReport()

        return () => {
            isMounted = false
        }
    }, [fallbackReport, interviewId])

    const normalizedReport = useMemo(() => normalizeReport(report), [report])

    const sectionData = useMemo(() => {
        if (!normalizedReport) {
            return {
                technical: [],
                behavioral: [],
                roadmap: []
            }
        }

        return {
            technical: normalizedReport.technicalQuestions,
            behavioral: normalizedReport.behavioralQuestion,
            roadmap: normalizedReport.preparationPlan
        }
    }, [normalizedReport])

    const currentItems = sectionData[activeSection] ?? []

    const skillGaps = normalizedReport?.skillGaps ?? []
    const isJobDescriptionOpen = Boolean(expandedItems.jobDescription)
    const isSelfDescriptionOpen = Boolean(expandedItems.selfDescription)

    const onlogout = async () => {
        try {
            await handleLogout()
            navigate('/login')
        } catch (error) {
            console.log(error)
        }
    }

    if (!report) {
        return (
            <div className="interview-page">
                <button onClick={onlogout} className='button logout-btn'>Logout</button>
                <div className="interview-shell">
                    <div className="interview-overview">
                        <p className="eyebrow">Interview Services</p>
                        <h1>Interview assessment workspace</h1>
                        <p className="intro">
                            Review your generated report, practice likely questions, and focus on the skill gaps that will
                            improve your interview performance fastest.
                        </p>
                    </div>

                    {loading ? (
                        <div className="feedback-card">Loading interview report...</div>
                    ) : error ? (
                        <div className="feedback-card error">{error}</div>
                    ) : (
                        <div className="feedback-card">Interview report not found.</div>
                    )}
                </div>
            </div>
        )
    }

    const displayTitle = normalizedReport?.developerTitle || 'Interview assessment workspace'

    return (
        <div className="interview-page">
            <div className="interview-shell">
                <div className="interview-overview">
                    <p className="eyebrow">Interview Services</p>
                    <h1>{displayTitle}</h1>
                    <p className="intro">
                        Review your generated report, practice likely questions, and focus on the skill gaps that will
                        improve your interview performance fastest.
                    </p>
                </div>

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
                        <button
                            type="button"
                            className="summary-toggle"
                            onClick={() => toggleExpandedItem('jobDescription')}
                            aria-expanded={isJobDescriptionOpen}
                        >
                            <div className="toggle-copy">
                                <p className="summary-label">Job description</p>
                                <p className="toggle-hint">Role requirements and expectations</p>
                            </div>
                            <ChevronIcon isOpen={isJobDescriptionOpen} />
                        </button>
                        <p className={isJobDescriptionOpen ? 'summary-copy detail-copy' : 'summary-copy'}>
                            {isJobDescriptionOpen
                                ? normalizedReport?.jobDescription ?? 'Not available'
                                : getPreview(normalizedReport?.jobDescription)}
                        </p>
                    </article>

                    <article className="summary-card">
                        <button
                            type="button"
                            className="summary-toggle"
                            onClick={() => toggleExpandedItem('selfDescription')}
                            aria-expanded={isSelfDescriptionOpen}
                        >
                            <div className="toggle-copy">
                                <p className="summary-label">Self summary</p>
                                <p className="toggle-hint">Candidate background and strengths</p>
                            </div>
                            <ChevronIcon isOpen={isSelfDescriptionOpen} />
                        </button>
                        <p className={isSelfDescriptionOpen ? 'summary-copy detail-copy' : 'summary-copy'}>
                            {isSelfDescriptionOpen
                                ? normalizedReport?.selfDescription ?? 'Not available'
                                : getPreview(normalizedReport?.selfDescription)}
                        </p>
                    </article>
                </div>

                <div className="interview-layout">
                    <aside className="panel">
                        <p className="panel-label">Sections</p>
                        <div className="interview-nav">
                            <div className="nav-list">
                                {sectionConfig.map((section) => (
                                    <button
                                        key={section.id}
                                        type="button"
                                        className={activeSection === section.id ? 'nav-item active' : 'nav-item'}
                                        onClick={() => setActiveSection(section.id)}
                                    >
                                        <span>{section.label}</span>
                                        <small>{sectionData[section.id]?.length ?? 0}</small>
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                className="generate-resume"
                                onClick={handleGenerateResume}
                            >
                                <span className="generate-resume-icon" aria-hidden="true">
                                    <svg viewBox="0 0 20 20" focusable="false">
                                        <path d="M10 2.5L11.6 6.4L15.5 8L11.6 9.6L10 13.5L8.4 9.6L4.5 8L8.4 6.4L10 2.5Z" />
                                        <path d="M15 11.5L15.9 13.6L18 14.5L15.9 15.4L15 17.5L14.1 15.4L12 14.5L14.1 13.6L15 11.5Z" />
                                    </svg>
                                </span>
                                <span>Generate Resume</span>
                            </button>
                        </div>
                    </aside>

                    <main className="interview-main panel">
                        <div className="main-head">
                            <p className="panel-label">
                                {sectionConfig.find((section) => section.id === activeSection)?.eyebrow}
                            </p>
                            <h2>
                                {activeSection === 'technical' && 'Technical interview questions'}
                                {activeSection === 'behavioral' && 'Behavioral interview questions'}
                                {activeSection === 'roadmap' && 'Preparation roadmap'}
                            </h2>
                            <p>
                                {activeSection === 'technical' &&
                                    'Practice technical depth, implementation detail, and frontend decision-making.'}
                                {activeSection === 'behavioral' &&
                                    'Prepare concise stories that show ownership, teamwork, and growth.'}
                                {activeSection === 'roadmap' &&
                                    'Use the day-wise plan to structure focused preparation before the next round.'}
                            </p>
                        </div>

                        <div className="content-grid">
                            {activeSection !== 'roadmap' && currentItems.map((item, index) => {
                                const itemKey = `${activeSection}-${index}`
                                const isOpen = Boolean(expandedItems[itemKey])

                                return (
                                    <article key={`${item.question}-${index}`} className="content-card collapsible-card">
                                        <button
                                            type="button"
                                            className="card-toggle"
                                            onClick={() => toggleExpandedItem(itemKey)}
                                            aria-expanded={isOpen}
                                        >
                                            <div className="toggle-copy">
                                                <div className="card-index">Question {index + 1}</div>
                                                <h3>{item.question}</h3>
                                            </div>
                                            <ChevronIcon isOpen={isOpen} />
                                        </button>

                                        {isOpen && (
                                            <div className="card-body">
                                                <div className="info-block intention-block">
                                                    <p className="info-label emphasis-label intention-label">Intention</p>
                                                    <p className="detail-copy">{item.intention}</p>
                                                </div>
                                                <div className="info-block answer-block">
                                                    <p className="info-label emphasis-label answer-label">Answer</p>
                                                    <p className="detail-copy">{item.answer}</p>
                                                </div>
                                            </div>
                                        )}
                                    </article>
                                )
                            })}

                            {activeSection === 'roadmap' && currentItems.map((item, index) => (
                                <article key={`${item.day}-${index}`} className="content-card roadmap-card">
                                    <div className="card-index">{item.day}</div>
                                    <h3>{item.focus}</h3>
                                    <ul>
                                        {(item.tasks ?? []).length > 0 ? (
                                            item.tasks.map((task, taskIndex) => (
                                                <li key={`${task}-${taskIndex}`}>{task}</li>
                                            ))
                                        ) : (
                                            <li>No tasks available yet.</li>
                                        )}
                                    </ul>
                                </article>
                            ))}

                            {currentItems.length === 0 && (
                                <article className="content-card empty-card">
                                    <h3>No data available</h3>
                                    <p>This section does not have report items yet for this interview.</p>
                                </article>
                            )}
                        </div>
                    </main>

                    <aside className="interview-side panel">
                        <div className="side-block">
                            <div className="side-head">
                                <p className="panel-label">Skill gaps</p>
                                <h3>Focus areas to improve</h3>
                            </div>

                            <div className="chip-list">
                                {skillGaps.length > 0 ? (
                                    skillGaps.map((item, index) => (
                                        <span
                                            key={`${item.skill}-${index}`}
                                            className={`skill-chip ${normalizeSeverity(item.severity)}`}
                                        >
                                            {item.skill}
                                        </span>
                                    ))
                                ) : (
                                    <p className="side-copy">No skill gaps available yet. </p>
                                )}
                            </div>
                        </div>

                        <div className="side-block">
                            <div className="side-head">
                                <p className="panel-label">Source context</p>
                                <h3>Resume snapshot</h3>
                            </div>
                            <p className="side-copy">{getPreview(normalizedReport?.resume, 260)}</p>
                        </div>

                        <div className="side-note">
                            <p>
                                Stronger sections usually come from aligning your resume stories with the role
                                requirements and closing the highest severity gaps first.
                            </p>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}

export default Interview
