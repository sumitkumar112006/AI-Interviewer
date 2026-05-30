import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getInterviewReport } from '../services/interview.api'
import '../style/interview.scss'

const sectionConfig = [
    { id: 'technical', label: 'Technical questions', eyebrow: 'Core depth' },
    { id: 'behavioral', label: 'Behavioral questions', eyebrow: 'Communication' },
    { id: 'roadmap', label: 'Road map', eyebrow: 'Preparation plan' }
]

function formatDate(value) {
    if (!value) return 'Not available'

    const date = new Date(value)
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
    if (!text) return 'Not available'
    const normalizedText = text.replace(/\s+/g, ' ').trim()
    if (normalizedText.length <= length) {
        return normalizedText
    }

    return `${normalizedText.slice(0, length).trim()}...`
}

function normalizeSeverity(severity) {
    if (!severity) return 'low'
    return String(severity).toLowerCase()
}

const Interview = () => {
    const { interviewId } = useParams()
    const [activeSection, setActiveSection] = useState(sectionConfig[0].id)
    const [report, setReport] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let isMounted = true

        async function loadInterviewReport() {
            setLoading(true)
            setError('')

            try {
                const response = await getInterviewReport(interviewId)

                if (!isMounted) {
                    return
                }

                setReport(response?.interviewReport ?? null)
            } catch (err) {
                if (!isMounted) {
                    return
                }

                setError(err?.response?.data?.message || 'Unable to load interview report right now.')
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
    }, [interviewId])

    const sectionData = useMemo(() => {
        if (!report) {
            return {
                technical: [],
                behavioral: [],
                roadmap: []
            }
        }

        return {
            technical: report.technicalQuestions ?? [],
            behavioral: report.behavioralQuestion ?? [],
            roadmap: report.preparationPlan ?? []
        }
    }, [report])

    const currentItems = sectionData[activeSection] ?? []

    return (
        <div className="interview-page">
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
                ) : !report ? (
                    <div className="feedback-card">Interview report not found.</div>
                ) : (
                    <>
                        <div className="summary-grid">
                            <article className="summary-card accent-card">
                                <p className="summary-label">Match score</p>
                                <div className="score-row">
                                    <strong>{report.matchScore ?? '--'}</strong>
                                    <span>/100</span>
                                </div>
                                <p className="summary-copy">
                                    Generated on {formatDate(report.createdAt)} for the current application profile.
                                </p>
                            </article>

                            <article className="summary-card">
                                <p className="summary-label">Job description</p>
                                <p className="summary-copy">{getPreview(report.jobDescription)}</p>
                            </article>

                            <article className="summary-card">
                                <p className="summary-label">Self summary</p>
                                <p className="summary-copy">{getPreview(report.selfDescription)}</p>
                            </article>
                        </div>

                        <div className="interview-layout">
                            <aside className="interview-nav panel">
                                <p className="panel-label">Sections</p>
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
                                    {activeSection !== 'roadmap' && currentItems.map((item, index) => (
                                        <article key={`${item.question}-${index}`} className="content-card">
                                            <div className="card-index">Question {index + 1}</div>
                                            <h3>{item.question}</h3>
                                            <div className="info-block">
                                                <p className="info-label">What they are checking</p>
                                                <p>{item.intention}</p>
                                            </div>
                                            <div className="info-block">
                                                <p className="info-label">Answer direction</p>
                                                <p>{item.answer}</p>
                                            </div>
                                        </article>
                                    ))}

                                    {activeSection === 'roadmap' && currentItems.map((item, index) => (
                                        <article key={`${item.day}-${index}`} className="content-card roadmap-card">
                                            <div className="card-index">{item.day}</div>
                                            <h3>{item.focus}</h3>
                                            <ul>
                                                {(item.tasks ?? []).map((task, taskIndex) => (
                                                    <li key={`${task}-${taskIndex}`}>{task}</li>
                                                ))}
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
                                        {(report.skillGaps ?? []).map((item, index) => (
                                            <span
                                                key={`${item.skill}-${index}`}
                                                className={`skill-chip ${normalizeSeverity(item.severity)}`}
                                            >
                                                {item.skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="side-block">
                                    <div className="side-head">
                                        <p className="panel-label">Source context</p>
                                        <h3>Resume snapshot</h3>
                                    </div>
                                    <p className="side-copy">{getPreview(report.resume, 260)}</p>
                                </div>

                                <div className="side-note">
                                    <p>
                                        Stronger sections usually come from aligning your resume stories with the role
                                        requirements and closing the highest severity gaps first.
                                    </p>
                                </div>
                            </aside>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default Interview
