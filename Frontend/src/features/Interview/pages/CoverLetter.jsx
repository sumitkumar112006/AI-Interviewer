import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    generateCoverLetterFromReport,
    getCoverLetterByReportId,
    deleteCoverLetter,
    updateCoverLetter
} from '../services/coverletter.api'
import { useInterview } from '../hooks/useInterview'
import { useAuth } from '../../Auth/hooks/useAuth'
import Loading from '../Loading'
import ResumeEditor from '../components/ResumeEditor'
import { exportElementToPdf } from '../utils/exportToPdf'
import { sanitizeResumeHtml, htmlToPlainText } from '../utils/sanitizeResumeHtml'
import '../style/coverletter.scss'

const CoverLetter = () => {
    const { user } = useAuth()
    const { interviewId } = useParams()
    const navigate = useNavigate()
    const { report, getReoprtById } = useInterview()

    const [pageLoading, setPageLoading] = useState(true)
    const [genLoading, setGenLoading]   = useState(false)
    const [saveLoading, setSaveLoading] = useState(false)
    const [error, setError]             = useState('')

    const [coverLetter, setCoverLetter] = useState(null)
    const [htmlContent, setHtmlContent] = useState('')
    const [isDirty, setIsDirty]         = useState(false)
    const [isCopied, setIsCopied]       = useState(false)

    // Form inputs
    const [companyName, setCompanyName] = useState('')
    const [roleName, setRoleName]       = useState('')

    const editorRef = useRef(null)

    // ── Initial data fetch ────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true
        async function init() {
            setPageLoading(true)
            setError('')
            try {
                await getReoprtById(interviewId)
                const res = await getCoverLetterByReportId(interviewId)
                if (mounted && res?.coverLetter) {
                    setCoverLetter(res.coverLetter)
                    setHtmlContent(sanitizeResumeHtml(res.coverLetter.generatedContent))
                    setCompanyName(res.coverLetter.companyName || '')
                    setRoleName(res.coverLetter.roleName || '')
                }
            } catch (err) {
                if (mounted) setError(err?.response?.data?.message || err?.message || 'Failed to load data.')
            } finally {
                if (mounted) setPageLoading(false)
            }
        }
        init()
        return () => { mounted = false }
    }, [interviewId])

    // ── Generate / Regenerate ─────────────────────────────────────────────
    const handleGenerate = useCallback(async (e) => {
        e.preventDefault()
        setGenLoading(true)
        setError('')
        try {
            const res = await generateCoverLetterFromReport(interviewId, {
                companyName: companyName.trim(),
                roleName: roleName.trim()
            })
            const cl = res.coverLetter
            setCoverLetter(cl)
            setHtmlContent(sanitizeResumeHtml(cl.generatedContent))
            setIsDirty(false)
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to generate cover letter.')
        } finally {
            setGenLoading(false)
        }
    }, [interviewId, companyName, roleName])

    // ── Save ──────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!coverLetter?._id || !editorRef.current) return
        setSaveLoading(true)
        setError('')
        try {
            const html = editorRef.current.getHtml()
            const res = await updateCoverLetter(coverLetter._id, { generatedContent: html })
            setCoverLetter(res.coverLetter)
            setHtmlContent(sanitizeResumeHtml(res.coverLetter.generatedContent))
            setIsDirty(false)
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to save.')
        } finally {
            setSaveLoading(false)
        }
    }, [coverLetter])

    // ── Direct 1-Click PDF Export ─────────────────────────────────────────
    const handlePrint = useCallback(async () => {
        setError('')
        try {
            if (isDirty && coverLetter?._id && editorRef.current) {
                const html = editorRef.current.getHtml()
                await updateCoverLetter(coverLetter._id, { generatedContent: html })
                setIsDirty(false)
            }
            const el = document.querySelector('.tiptap-a4-page')
            const safeRole = (roleName || companyName || 'CoverLetter').replace(/[^a-z0-9_-]/gi, '_')
            await exportElementToPdf(el, `CoverLetter_${safeRole}.pdf`)
        } catch (err) {
            console.error('Cover Letter PDF Error:', err)
            setError(err?.message || 'Failed to download Cover Letter PDF.')
        }
    }, [isDirty, coverLetter, roleName, companyName])

    // ── Copy plain text ───────────────────────────────────────────────────
    const handleCopy = useCallback(() => {
        if (!editorRef.current) return
        const text = htmlToPlainText(editorRef.current.getHtml())
        navigator.clipboard.writeText(text).then(() => {
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        })
    }, [])

    // ── Delete ────────────────────────────────────────────────────────────
    const handleDelete = useCallback(async () => {
        if (!coverLetter?._id) return
        if (!window.confirm('Delete this cover letter? This cannot be undone.')) return
        try {
            await deleteCoverLetter(coverLetter._id)
            setCoverLetter(null)
            setHtmlContent('')
            setCompanyName('')
            setRoleName('')
            setIsDirty(false)
        } catch (err) {
            setError(err?.message || 'Failed to delete.')
        }
    }, [coverLetter])

    if (pageLoading) return <main><Loading /></main>

    const reportTitle = report?.developerTitle || 'Developer'

    return (
        <div className="cl-page">
            {/* ── Header ──────────────────────────────────────────────── */}
            <header className="cl-header">
                <div className="cl-header-left">
                    <span className="cl-eyebrow">Cover Letter Builder</span>
                    <h1 className="cl-title">Cover Letter — {reportTitle}</h1>
                    {isDirty && <span className="cl-unsaved-badge">● Unsaved</span>}
                </div>

                <nav className="cl-actions">
                    <button
                        type="button"
                        className="cl-btn cl-btn-ghost"
                        onClick={() => navigate(`/interview/${interviewId}`, { state: { interviewReport: report } })}
                    >
                        ← Back
                    </button>

                    {coverLetter && (
                        <>
                            <button type="button" className="cl-btn cl-btn-ghost" onClick={handleCopy}>
                                {isCopied ? '✓ Copied' : '📋 Copy'}
                            </button>
                            <button
                                type="button"
                                className="cl-btn cl-btn-save"
                                onClick={handleSave}
                                disabled={saveLoading || !isDirty}
                            >
                                {saveLoading ? 'Saving…' : '💾 Save'}
                            </button>
                            <button
                                type="button"
                                className="cl-btn cl-btn-primary"
                                onClick={handlePrint}
                                disabled={saveLoading}
                            >
                                📥 Download PDF
                            </button>
                        </>
                    )}
                </nav>
            </header>

            {/* ── Error banner ─────────────────────────────────────────── */}
            {error && (
                <div className="cl-error-bar" role="alert">
                    <span>❌ {error}</span>
                    <button type="button" onClick={() => setError('')}>✕</button>
                </div>
            )}

            {Boolean(user?.blockedFeatures?.coverLetterGeneration) && (
                <div className="blocked-feature-banner" style={{ margin: '1rem 1.5rem 0 1.5rem' }}>
                    <span className="banner-icon">🔒</span>
                    <div className="banner-text">
                        <strong>Cover Letter & CV Generation Restricted</strong>
                        <p>Cover Letter generation has been disabled for your account by an administrator.</p>
                    </div>
                </div>
            )}

            {/* ── Workspace ────────────────────────────────────────────── */}
            <div className="cl-workspace">
                {/* Left: Form panel */}
                <aside className="cl-form-panel">
                    <div className="cl-panel-section">
                        <h2 className="cl-panel-heading">
                            {coverLetter ? 'Regenerate' : 'Generate Cover Letter'}
                        </h2>
                        <p className="cl-panel-sub">
                            {coverLetter
                                ? 'Update the details below and regenerate to customise.'
                                : 'Fill in optional details to personalise your letter.'}
                        </p>

                        <form onSubmit={handleGenerate} className="cl-form">
                            <div className="cl-field">
                                <label htmlFor="cl-company">Company Name</label>
                                <input
                                    type="text"
                                    id="cl-company"
                                    value={companyName}
                                    onChange={e => setCompanyName(e.target.value)}
                                    placeholder="e.g. Google, Stripe"
                                    disabled={genLoading}
                                    autoComplete="organization"
                                />
                            </div>
                            <div className="cl-field">
                                <label htmlFor="cl-role">Role / Position</label>
                                <input
                                    type="text"
                                    id="cl-role"
                                    value={roleName}
                                    onChange={e => setRoleName(e.target.value)}
                                    placeholder="e.g. Senior Software Engineer"
                                    disabled={genLoading}
                                    autoComplete="off"
                                />
                            </div>
                            <button
                                type="submit"
                                className="cl-generate-btn"
                                disabled={genLoading || Boolean(user?.blockedFeatures?.coverLetterGeneration)}
                                style={Boolean(user?.blockedFeatures?.coverLetterGeneration) ? { background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', cursor: 'not-allowed' } : {}}
                            >
                                {Boolean(user?.blockedFeatures?.coverLetterGeneration)
                                    ? '❌ Disabled by Admin'
                                    : genLoading
                                        ? 'Generating…'
                                        : coverLetter
                                            ? '↺ Regenerate with AI'
                                            : '✦ Generate Cover Letter'}
                            </button>
                        </form>
                    </div>

                    {/* Tips */}
                    <div className="cl-warn-card">
                        ⚠️ <span>AI can make mistakes.</span> Review all details carefully before downloading.
                    </div>

                    {coverLetter && (
                        <div className="cl-panel-section" style={{ paddingTop: 0 }}>
                            <button
                                type="button"
                                className="cl-btn cl-btn-danger"
                                onClick={handleDelete}
                                disabled={genLoading || saveLoading}
                            >
                                🗑 Delete Cover Letter
                            </button>
                        </div>
                    )}
                </aside>

                {/* Right: Editor / Empty state */}
                <main className="cl-editor-col">
                    {genLoading && !coverLetter ? (
                        <Loading
                            inline={true}
                            title="Cover Letter Builder"
                            subtitle="Crafting your tailored cover letter using AI..."
                            steps={[
                                { id: 1, label: "Analyzing job description & target role requirements" },
                                { id: 2, label: "Matching candidate profile with key role expectations" },
                                { id: 3, label: "Drafting persuasive & humanized cover letter text" },
                                { id: 4, label: "Formatting document layout & finalizing typography" }
                            ]}
                        />
                    ) : coverLetter ? (
                        <ResumeEditor
                            ref={editorRef}
                            initialHtml={htmlContent}
                            placeholder="Your cover letter will appear here."
                            onChange={() => setIsDirty(true)}
                        />
                    ) : (
                        <div className="cl-empty-state">
                            <div className="cl-empty-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                </svg>
                            </div>
                            <h3>No Cover Letter Yet</h3>
                            <p>Fill in the details on the left and click <strong>Generate Cover Letter</strong>.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}

export default CoverLetter
