function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

import React, { useEffect, useRef, useState } from 'react'
import '../style/home.scss'
import { useInterview } from '../hooks/useInterview'
import { useAuth } from '../../Auth/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import PageLoading from '../../Shared/components/PageLoading'
import ReportGenerationLoading from '../components/ReportGenerationLoading'
import ConfirmModal from '../../Shared/components/ConfirmModal'
import { getActiveJob, pollJobUntilComplete } from '../services/interview.api'
import { updateCareerProfile } from '../../Auth/services/auth.api'

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
    const { user, setUser } = useAuth()
    const { loading, setLoading, report, setReport, generateReport, reports, getReports, deleteReport } = useInterview()
    const isReportsBlocked = Boolean(user?.blockedFeatures?.interviewReports)
    const isResumeBlocked = Boolean(user?.blockedFeatures?.resumeGeneration)
    const isGenerationBlocked = isReportsBlocked || isResumeBlocked

    const [formData, setFormData] = useState({ jobDescription: '' })
    const [selectedFileName, setSelectedFileName] = useState('')
    const [selectedFile, setSelectedFile] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)
    const [isDragOver, setIsDragOver] = useState(false)

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        details: null,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        type: 'danger',
        loading: false,
        onConfirm: () => {}
    })

    const resumeInputRef = useRef()
    const hasRequestedReportsRef = useRef(false)
    const navigate = useNavigate()

    const recentReports = Array.isArray(reports) ? reports : []
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl)
        }
    }, [previewUrl])


    useEffect(() => {
        if (!report) return
        setFormData({
            jobDescription: report.jobDescription ?? ''
        })
    }, [report])

    // Check for active background generation job on mount
    useEffect(() => {
        let isMounted = true;
        getActiveJob({ type: 'interview_report' }).then(res => {
            if (isMounted && res?.activeJob?.jobId) {
                setLoading(true);
                pollJobUntilComplete(res.activeJob.jobId).then(data => {
                    if (isMounted && data) {
                        setReport(data);
                        setLoading(false);
                        const interviewId = extractObjectId(data?._id);
                        if (interviewId) {
                            navigate(`/interview/${interviewId}`, { state: { interviewReport: data } });
                        }
                    }
                }).catch(err => {
                    if (isMounted) setLoading(false);
                    console.error("Active job tracking error:", err);
                });
            }
        }).catch(() => {});

        return () => { isMounted = false; };
    }, [navigate, setReport, setLoading]);

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
        if (file) {
            setSelectedFileName(file.name)
            setSelectedFile(file)
            if (file.type === 'application/pdf') {
                if (previewUrl) URL.revokeObjectURL(previewUrl)
                setPreviewUrl(URL.createObjectURL(file))
            } else {
                setPreviewUrl(null)
            }
        }
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
            setSelectedFile(file)
            if (file.type === 'application/pdf') {
                if (previewUrl) URL.revokeObjectURL(previewUrl)
                setPreviewUrl(URL.createObjectURL(file))
            } else {
                setPreviewUrl(null)
            }
        }
    }

    const handleRemoveFile = (e) => {
        e?.stopPropagation()
        if (resumeInputRef.current) {
            resumeInputRef.current.value = ''
        }
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
        }
        setSelectedFileName('')
        setSelectedFile(null)
        setPreviewUrl(null)
    }



    const handleGenerateReport = async () => {
        if (isGenerationBlocked) return
        try {
            const resumeFile = resumeInputRef.current.files[0]
            if (!resumeFile) {
                setConfirmModal({
                    isOpen: true,
                    title: 'Resume Required',
                    message: 'Please upload your resume (PDF or DOCX) before generating an interview report.',
                    details: null,
                    confirmText: 'Upload Resume',
                    cancelText: 'Cancel',
                    type: 'warning',
                    loading: false,
                    onConfirm: () => {
                        setConfirmModal(prev => ({ ...prev, isOpen: false }))
                        resumeInputRef.current?.click()
                    }
                })
                return
            }
            if (!formData.jobDescription?.trim()) {
                setConfirmModal({
                    isOpen: true,
                    title: 'Job Description Required',
                    message: 'Please paste the target job description to match against your skills.',
                    details: null,
                    confirmText: 'Got it',
                    cancelText: 'Close',
                    type: 'warning',
                    loading: false,
                    onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                })
                return
            }
            const data = await generateReport({
                jobDescription: formData.jobDescription,
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
                setConfirmModal({
                    isOpen: true,
                    title: 'Generation Error',
                    message: userMessage,
                    details: null,
                    confirmText: 'Dismiss',
                    cancelText: 'Close',
                    type: 'danger',
                    loading: false,
                    onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                })
            }
        }
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
        return <main><PageLoading title="Loading Dashboard..." subtitle="Syncing your interview analytics and recent sessions..." /></main>
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
                        </div>
                    </div>
                </div>

                {/* Workspace Header */}
                <div className="workspace-header">
                    <h1>Prepare Interview Inputs</h1>
                </div>

                {isReportsBlocked && (
                    <div className="blocked-feature-banner">
                        <span className="banner-icon">🔒</span>
                        <div className="banner-text">
                            <strong>Mock Interview & Report Generation Restricted</strong>
                            <p>Generation has been disabled for your account by an administrator. Please contact support to restore access.</p>
                        </div>
                    </div>
                )}

                {/* Main 3-col layout */}
                <div className="interview-input-group">

                    {/* LEFT: Job Description */}
                    <div className="col-left panel">
                        <div className="section-heading">
                            <h3>Job Description</h3>
                        </div>
                        <textarea
                            value={formData.jobDescription}
                            onChange={handleInputChange}
                            name="jobDescription"
                            id="jobDescription"
                            placeholder='Paste the job description (responsibilities, qualifications, and requirements)...'
                        />
                        <div className="field-footer">
                            <span>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px', verticalAlign: 'middle'}}>
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                Recommended: 200+ words
                            </span>
                            {isJobDescReady
                                ? <span className="field-footer__ready">
                                    Ready
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: '4px'}}>
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  </span>
                                : <span className="field-footer__warn">Add more detail</span>
                            }
                        </div>
                    </div>

                    {/* MIDDLE: Upload Resume + Generate Button */}
                    <div className="col-mid">
                        <div className="panel input-group file-group">
                            <div className="section-heading split">
                                <h3>{selectedFile ? 'Uploaded Resume' : 'Upload Resume'}</h3>
                                {selectedFile && (
                                    <div className="file-header-actions">
                                        <button
                                            type="button"
                                            className="file-change-btn"
                                            onClick={() => resumeInputRef.current?.click()}
                                            title="Choose a different resume file"
                                        >
                                            Change
                                        </button>
                                        <button
                                            type="button"
                                            className="file-remove-btn"
                                            onClick={handleRemoveFile}
                                            title="Remove uploaded resume"
                                            aria-label="Remove uploaded resume"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>

                            {selectedFile ? (
                                <div className="resume-uploaded-view">
                                    <div className="resume-file-info-bar">
                                        <div className="resume-file-meta">
                                            <svg className="resume-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                            </svg>
                                            <span className="resume-file-name" title={selectedFile.name}>
                                                {selectedFile.name}
                                            </span>
                                        </div>
                                        <span className="resume-file-size">
                                            {formatFileSize(selectedFile.size)}
                                        </span>
                                    </div>

                                    {previewUrl ? (
                                        <div className="resume-preview-frame-container">
                                            <iframe
                                                src={`${previewUrl}#toolbar=0&navpanes=0`}
                                                title="Uploaded Resume Preview"
                                                className="uploaded-resume-preview-frame"
                                            />
                                        </div>
                                    ) : (
                                        <div className="resume-docx-placeholder">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                                <line x1="16" y1="13" x2="8" y2="13" />
                                                <line x1="16" y1="17" x2="8" y2="17" />
                                                <polyline points="10 9 9 9 8 9" />
                                            </svg>
                                            <p className="docx-label">Word Document (.docx) Ready</p>
                                            <span className="docx-sub">Text will be extracted automatically during analysis</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
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
                                        <span className="file-label__text">Upload Resume</span>
                                        <span className="file-label__sub">PDF, DOCX (Max 10MB)</span>
                                    </div>
                                </label>
                            )}

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



                        <button
                            onClick={handleGenerateReport}
                            className='generate-btn'
                            disabled={loading || isGenerationBlocked}
                            style={isGenerationBlocked ? { background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', cursor: 'not-allowed' } : {}}
                            title={isGenerationBlocked ? "Disabled by Administrator" : ""}
                        >
                            {isGenerationBlocked ? (
                                <span>🔒 Locked by Admin</span>
                            ) : loading ? (
                                <><span className="btn-spinner" /> <span>Generating...</span></>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                    </svg>
                                    <span>Generate Interview Report</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {loading && <ReportGenerationLoading />}
            </div>

            {/* Custom Glassmorphism Confirm / Alert Modal */}
            <ConfirmModal
                {...confirmModal}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    )
}

export default Home
