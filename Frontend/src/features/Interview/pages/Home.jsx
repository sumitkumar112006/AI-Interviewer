import React, { useEffect, useRef, useState } from 'react'
import '../style/home.scss'
import { useInterview } from '../hooks/useInterview'
import { useNavigate } from 'react-router-dom'
import LoadingPage from '../Loading'
import ReportGenerationLoading from '../components/ReportGenerationLoading'

function extractObjectId(value) {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object' && '$oid' in value) return String(value.$oid ?? '').trim()
    return String(value).trim()
}

function extractDateValue(value) {
    if (!value) return ''
    if (typeof value === 'string' || value instanceof Date) return value
    if (typeof value === 'object' && '$date' in value) return value.$date
    return value
}

function formatDate(value) {
    if (!value) return 'Not available'
    const normalizedValue = extractDateValue(value)
    const date = new Date(normalizedValue)
    if (Number.isNaN(date.getTime())) return 'Not available'
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date)
}

function getMatchScoreColor(score) {
    if (!score) return '#6b7fa8'
    const num = parseInt(String(score).replace('%', ''))
    if (num >= 85) return '#22c55e'
    if (num >= 70) return '#f59e0b'
    return '#ef4444'
}

function getReportTitle(reportItem) {
    return (reportItem?.developerTitle || reportItem?.Title || reportItem?.title || 'Untitled Report').trim()
}

const Home = () => {
    const { loading, report, generateReport, reports, getReports, deleteReport } = useInterview()
    const [formData, setFormData] = useState({ jobDescription: '', selfDescription: '' })
    const [selectedFileName, setSelectedFileName] = useState('')
    const [isDragOver, setIsDragOver] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const resumeInputRef = useRef()
    const hasRequestedReportsRef = useRef(false)
    const navigate = useNavigate()

    const recentReports = Array.isArray(reports) ? reports : []

    const filteredReports = recentReports.filter(r =>
        getReportTitle(r).toLowerCase().includes(searchQuery.toLowerCase())
    )

    useEffect(() => {
        if (!report) return
        setFormData({
            jobDescription: report.jobDescription ?? '',
            selfDescription: report.selfDescription ?? ''
        })
    }, [report])

    useEffect(() => {
        if (reports !== null || hasRequestedReportsRef.current) return
        hasRequestedReportsRef.current = true
        void getReports()
    }, [getReports, reports])

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        setSelectedFileName(file ? file.name : '')
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file && (file.type === 'application/pdf' || file.name.endsWith('.docx'))) {
            const dt = new DataTransfer()
            dt.items.add(file)
            resumeInputRef.current.files = dt.files
            setSelectedFileName(file.name)
        }
    }

    const handleGenerateReport = async () => {
        try {
            const resumeFile = resumeInputRef.current.files[0]
            if (!resumeFile) { alert('Please upload a resume PDF file.'); return }
            if (!formData.jobDescription?.trim()) { alert('Please enter a job description.'); return }
            if (!formData.selfDescription?.trim()) { alert('Please enter a self description.'); return }

            const data = await generateReport({
                jobDescription: formData.jobDescription,
                selfDescription: formData.selfDescription,
                resumeFile
            })

            const interviewId = extractObjectId(data?._id)
            if (interviewId) {
                navigate(`/interview/${interviewId}`, { state: { interviewReport: data } })
            }
        } catch (error) {
            console.error('Generate report error:', error)
            const rawMsg = error?.response?.data?.message || error?.message || 'Unknown error'
            const userMessage = rawMsg.includes('validation failed') || rawMsg.includes('required')
                ? "The AI generated an incomplete response format. Please try clicking 'Generate' again."
                : rawMsg

            if (window.triggerGlobalError) {
                window.triggerGlobalError(userMessage, '', true)
            } else {
                alert(userMessage)
            }
        }
    }

    const handleDeleteReport = async (interviewId, e) => {
        e.stopPropagation()
        if (!window.confirm('Are you sure you want to delete this report?')) return
        try {
            await deleteReport(interviewId)
        } catch (error) {
            alert(error?.message || 'Failed to delete report.')
        }
    }

    const handleViewReport = (reportItem) => {
        const interviewId = extractObjectId(reportItem?._id)
        if (!interviewId) return
        navigate(`/interview/${interviewId}`, { state: { interviewReport: reportItem } })
    }

    // Stats derived from reports
    const totalReports = recentReports.length
    const avgMatchScore = recentReports.length > 0
        ? Math.round(
            recentReports.reduce((acc, r) => {
                const s = parseInt(String(r?.matchScore || '0').replace('%', ''))
                return acc + (isNaN(s) ? 0 : s)
            }, 0) / recentReports.length
        )
        : 0
    const resumesAdded = new Set(recentReports.map(r => r.resumeHash || r.resume || (r._id?.$oid || r._id))).size

    const isJobDescReady = formData.jobDescription.trim().split(/\s+/).length >= 30

    if (loading && reports === null) {
        return <main><LoadingPage /></main>
    }

    return (
        <div className='home'>
            <div className="workspace">

                {/* Stats Bar */}
                <div className="stats-bar">
                    <div className="stat-card">
                        <div className="stat-card__icon stat-card__icon--reports">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                        </div>
                        <div className="stat-card__info">
                            <span className="stat-card__label">Total Reports</span>
                            <span className="stat-card__value">{totalReports}</span>
                            <span className="stat-card__sub">Reports Generated</span>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-card__icon stat-card__icon--score">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                                <polyline points="16 7 22 7 22 13" />
                            </svg>
                        </div>
                        <div className="stat-card__info">
                            <span className="stat-card__label">Avg. Match Score</span>
                            <span className="stat-card__value stat-card__value--accent">{avgMatchScore > 0 ? `${avgMatchScore}%` : 'N/A'}</span>
                            <span className="stat-card__sub">Keep improving!</span>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-card__icon stat-card__icon--resume">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="12" y1="18" x2="12" y2="12" />
                                <line x1="9" y1="15" x2="15" y2="15" />
                            </svg>
                        </div>
                        <div className="stat-card__info">
                            <span className="stat-card__label">Resumes Added</span>
                            <span className="stat-card__value">{resumesAdded}</span>
                            <span className="stat-card__sub">Your documents</span>
                        </div>
                    </div>
                </div>

                {/* Workspace Header */}
                <div className="workspace-header">
                    <p className="eyebrow">Assessment Workspace</p>
                    <h1>Prepare your <span className="h1-accent">interview inputs</span></h1>
                    <p className="intro">
                        Add the role details, upload your resume, and include a short self summary for sharper
                        interview guidance.
                    </p>
                </div>

                {/* Main 3-col layout */}
                <div className="interview-input-group">

                    {/* LEFT: Job Description */}
                    <div className="col-left panel">
                        <div className="section-heading split">
                            <div>
                                <p className="section-kicker">Role Details</p>
                                <h3>Job Description</h3>
                            </div>
                            <span className="tag">Primary Input</span>
                        </div>
                        <p className="helper-copy">
                            Paste the responsibilities, qualifications, and key expectations for the role.
                        </p>
                        <textarea
                            value={formData.jobDescription}
                            onChange={handleInputChange}
                            name="jobDescription"
                            id="jobDescription"
                            placeholder='Paste the detailed job description here. Include responsibilities, qualifications, tools, and company expectations...'
                        />
                        <div className="field-footer">
                            <span>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px', verticalAlign: 'middle'}}>
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                Minimum 200 words recommended
                            </span>
                            {isJobDescReady
                                ? <span className="field-footer__ready">
                                    Ready for processing
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: '4px'}}>
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  </span>
                                : <span className="field-footer__warn">Add more detail</span>
                            }
                        </div>
                    </div>

                    {/* MIDDLE: Upload + Self Description + Button */}
                    <div className="col-mid">
                        <div className="panel input-group file-group">
                            <div className="section-heading">
                                <p className="section-kicker">Candidate Profile</p>
                                <h3>Upload Resume</h3>
                            </div>
                            <p className='highlight'>Use resume and self description together for better results.</p>
                            <label
                                className={`file-label ${isDragOver ? 'file-label--drag' : ''}`}
                                htmlFor="resume"
                                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={handleDrop}
                            >
                                <div className="file-label__inner">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="file-label__icon">
                                        <polyline points="16 16 12 12 8 16" />
                                        <line x1="12" y1="12" x2="12" y2="21" />
                                        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                                    </svg>
                                    <span className="file-label__text">
                                        {selectedFileName ? `✓ ${selectedFileName}` : 'Upload Resume'}
                                    </span>
                                    <span className="file-label__sub">PDF, DOCX (Max 10MB)</span>
                                </div>
                            </label>
                            <input
                                ref={resumeInputRef}
                                hidden
                                type="file"
                                name='resume'
                                id='resume'
                                accept='.pdf,.docx'
                                onChange={handleFileChange}
                            />
                        </div>

                        <div className="panel input-group textarea-group">
                            <div className="section-heading">
                                <label htmlFor="selfDescription">Self Description</label>
                            </div>
                            <p className="helper-copy">
                                Add a few lines about your strengths, experience, and career direction.
                            </p>
                            <textarea
                                value={formData.selfDescription}
                                onChange={handleInputChange}
                                name="selfDescription"
                                id="selfDescription"
                                placeholder='Enter your self description in a few sentences. Highlight your strengths and career goals...'
                            />
                        </div>

                        <button
                            onClick={handleGenerateReport}
                            className='generate-btn'
                            disabled={loading}
                        >
                            {loading
                                ? <><span className="btn-spinner" /> <span>Generating...</span></>
                                : <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                    </svg>
                                    <span>Generate Interview Report</span>
                                  </>
                            }
                        </button>
                    </div>

                    {/* RIGHT: Recent Reports Sidebar */}
                    <div id="reports-section" className="col-right panel reports-sidebar">
                        <div className="reports-sidebar__header">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b9d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                <polyline points="17 6 23 6 23 12" />
                            </svg>
                            <h2>Recent Reports</h2>
                        </div>

                        <div className="reports-search">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search by title..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="reports-search__input"
                            />
                            <span className="reports-search__label">Match Score</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <polyline points="19 12 12 19 5 12" />
                            </svg>
                        </div>

                        <div className="reports-list">
                            {filteredReports.length === 0 && (
                                <div className="reports-empty">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b7fa8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <p>{searchQuery ? 'No reports match your search.' : 'No reports yet. Generate your first one!'}</p>
                                </div>
                            )}
                            {filteredReports.map((reportItem, index) => {
                                const interviewId = extractObjectId(reportItem?._id)
                                const title = getReportTitle(reportItem)
                                const scoreColor = getMatchScoreColor(reportItem?.matchScore)

                                return (
                                    <div
                                        key={interviewId || `report-${index}`}
                                        className="report-row"
                                        onClick={() => handleViewReport(reportItem)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && handleViewReport(reportItem)}
                                        title={`View: ${title}`}
                                    >
                                        <div className="report-row__icon">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                            </svg>
                                        </div>
                                        <div className="report-row__info">
                                            <span className="report-row__title">{title.length > 22 ? `${title.slice(0, 22)}...` : title}</span>
                                            <span className="report-row__date">{formatDate(reportItem?.createdAt ?? reportItem?.updatedAt)}</span>
                                        </div>
                                        <div className="report-row__actions">
                                            {reportItem?.matchScore && (
                                                <span
                                                    className="report-row__score"
                                                    style={{ color: scoreColor, borderColor: `${scoreColor}40`, background: `${scoreColor}18` }}
                                                >
                                                    {reportItem.matchScore}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                className="report-row__delete"
                                                onClick={(e) => handleDeleteReport(interviewId, e)}
                                                disabled={!interviewId}
                                                title="Delete Report"
                                                aria-label="Delete Report"
                                            >
                                                <img src="/bin.png" alt="Delete" style={{ width: '13px', height: '13px', objectFit: 'contain', opacity: 0.7 }} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {filteredReports.length > 0 && (
                            <button className="view-all-btn" onClick={() => navigate('/reports')}>
                                View All Reports ({filteredReports.length})
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {loading && <ReportGenerationLoading />}
            </div>
        </div>
    )
}

export default Home
