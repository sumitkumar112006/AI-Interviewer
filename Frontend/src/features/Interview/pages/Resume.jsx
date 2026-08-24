import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { generateResumePdf, getInterviewReportById, updateResumeHtml, rewriteResumeSection } from '../services/interview.api'
import { useInterview } from '../hooks/useInterview'
import { useAuth } from '../../Auth/hooks/useAuth'
import ShimmerLoading from '../../Shared/components/ShimmerLoading'
import Loading from '../Loading'
import ResumeEditor from '../components/ResumeEditor'
import { exportElementToPdf } from '../utils/exportToPdf'
import { sanitizeResumeHtml } from '../utils/sanitizeResumeHtml'
import '../style/resume.scss'

// ── helper: normalise MongoDB ObjectId ────────────────────────────────────
function extractObjectId(value) {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object' && '$oid' in value) return String(value.$oid ?? '').trim()
    return String(value).trim()
}

// ── Resume page ────────────────────────────────────────────────────────────
const Resume = () => {
    const { interviewId } = useParams()
    const navigate = useNavigate()
    const { report, loading, setLoading, getReoprtById, updateNewResume } = useInterview()
    const { user, fetchUsage } = useAuth()

    const [error, setError]           = useState('')
    const [htmlContent, setHtmlContent] = useState('')
    const [dbLoading, setDbLoading]     = useState(true)
    const [aiGenerating, setAiGenerating] = useState(false)
    const [isDirty, setIsDirty]       = useState(false)
    const [saveLoading, setSaveLoading] = useState(false)
    const [printLoading, setPrintLoading] = useState(false)

    // AI Copilot state
    const [isAiOpen, setIsAiOpen]     = useState(false)
    const [selectedText, setSelectedText] = useState('')
    const [chatMessages, setChatMessages] = useState([
        { id: 1, sender: 'ai', text: '👋 Hi! I\'m your AI Resume Copilot. Select any text in the editor, then send me instructions to refine it.' }
    ])
    const [chatInput, setChatInput]   = useState('')
    const [chatLoading, setChatLoading] = useState(false)

    const editorRef  = useRef(null)
    const chatEndRef = useRef(null)

    // ── Load resume HTML ──────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true
        async function init() {
            setDbLoading(true)
            setError('')
            try {
                const fetched = await getReoprtById(interviewId)
                if (!mounted) return

                if (fetched?.generatedResumeHtml) {
                    setHtmlContent(sanitizeResumeHtml(fetched.generatedResumeHtml))
                    setDbLoading(false)
                } else {
                    // Trigger AI HTML generation on backend
                    setDbLoading(false)
                    setAiGenerating(true)
                    await generateResumePdf(interviewId)
                    const updated = await getReoprtById(interviewId)
                    if (mounted && updated?.generatedResumeHtml) {
                        setHtmlContent(sanitizeResumeHtml(updated.generatedResumeHtml))
                        if (fetchUsage) fetchUsage()
                    }
                    if (mounted) setAiGenerating(false)
                }
            } catch (err) {
                if (mounted) setError(err?.response?.data?.message || err?.message || 'Failed to load resume.')
                if (mounted) {
                    setDbLoading(false)
                    setAiGenerating(false)
                }
            }
        }
        init()
        return () => { mounted = false }
    }, [interviewId])

    // Scroll AI chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages, chatLoading])

    // Listen to editor selection changes
    useEffect(() => {
        const onMouseUp = () => {
            const sel = window.getSelection()
            if (sel && sel.toString().trim().length > 3) {
                setSelectedText(sel.toString().trim())
            }
        }
        document.addEventListener('mouseup', onMouseUp)
        return () => document.removeEventListener('mouseup', onMouseUp)
    }, [])

    const displayTitle = useMemo(() => {
        if (!report) return 'Resume'
        return report.developerTitle || report?.Title || report?.title || 'Generated Resume'
    }, [report])

    // ── Save ───────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!editorRef.current) return
        setSaveLoading(true)
        setError('')
        try {
            const html = editorRef.current.getHtml()
            await updateResumeHtml(interviewId, html)
            updateNewResume(interviewId, html)
            setHtmlContent(sanitizeResumeHtml(html))
            setIsDirty(false)
            if (fetchUsage) fetchUsage()
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to save resume.')
        } finally {
            setSaveLoading(false)
        }
    }, [interviewId, updateNewResume, fetchUsage])

    // ── Direct 1-Click PDF Export ─────────────────────────────────────────
    const handlePrint = useCallback(async () => {
        setPrintLoading(true)
        setError('')
        try {
            // Auto-save edits first if dirty
            if (isDirty && editorRef.current) {
                const html = editorRef.current.getHtml()
                await updateResumeHtml(interviewId, html)
                updateNewResume(interviewId, html)
                setIsDirty(false)
            }
            const el = document.querySelector('.tiptap-a4-page')
            const safeTitle = (displayTitle || 'Resume').replace(/[^a-z0-9_-]/gi, '_')
            await exportElementToPdf(el, `${safeTitle}_Resume.pdf`)
            if (fetchUsage) fetchUsage()
        } catch (err) {
            console.error('PDF Download Error:', err)
            setError(err?.message || 'Failed to generate PDF download.')
        } finally {
            setPrintLoading(false)
        }
    }, [isDirty, interviewId, updateNewResume, displayTitle, fetchUsage])

    const isResumeBlocked = Boolean(user?.blockedFeatures?.resumeGeneration)

    // ── Regenerate ─────────────────────────────────────────────────────────
    const handleRegenerate = useCallback(async () => {
        if (isResumeBlocked) return
        if (!window.confirm('Regenerate the resume from scratch with AI? Your manual edits will be discarded.')) return
        setAiGenerating(true)
        setError('')
        try {
            const response = await generateResumePdf(interviewId, { force: true })
            const newReport = response?.interviewReport || response
            if (newReport?.generatedResumeHtml) {
                const sanitized = sanitizeResumeHtml(newReport.generatedResumeHtml)
                setHtmlContent(sanitized)
                if (editorRef.current) {
                    editorRef.current.setContent(sanitized)
                }
                setIsDirty(false)
                if (fetchUsage) fetchUsage()
            } else {
                throw new Error('Failed to generate fresh resume content.')
            }
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to regenerate resume.')
        } finally {
            setAiGenerating(false)
        }
    }, [interviewId, isResumeBlocked, fetchUsage])

    // ── AI Copilot ─────────────────────────────────────────────────────────
    const handleSendAi = useCallback(async (e, preset = null) => {
        if (e) e.preventDefault()
        const msg = preset || chatInput
        if (!msg.trim()) return

        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: msg,
            ctx: selectedText || null
        }
        setChatMessages(prev => [...prev, userMsg])
        if (!preset) setChatInput('')
        setChatLoading(true)

        try {
            const res = await rewriteResumeSection({
                selectedText,
                instruction: msg,
                action: preset || 'enhance',
                message: msg
            })
            if (fetchUsage) fetchUsage()
            const aiMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: res?.replyText || 'Here is the refined suggestion.',
                snippet: res?.suggestedSnippet || res?.rewrittenText || null
            }
            setChatMessages(prev => [...prev, aiMsg])
        } catch {
            setChatMessages(prev => [...prev, {
                id: Date.now() + 1,
                sender: 'ai',
                text: '⚠️ Something went wrong. Please try again.'
            }])
        } finally {
            setChatLoading(false)
        }
    }, [chatInput, selectedText, fetchUsage])

    const handleApplySnippet = useCallback((snippet) => {
        if (!snippet || !editorRef.current) return
        editorRef.current.insertContent(snippet)
        setIsDirty(true)
    }, [])

    const RESUME_STEPS = [
        { id: 1, label: "Analyzing profile & technical skills" },
        { id: 2, label: "Matching target job requirements" },
        { id: 3, label: "Structuring ATS-compliant sections" },
        { id: 4, label: "Polishing typography & design formatting" }
    ];

    if (aiGenerating) return <Loading steps={RESUME_STEPS} title="Resume Studio" subtitle="Drafting your document using AI..." />
    if (dbLoading && !htmlContent) return <ShimmerLoading type="workspace" title="Loading Resume Studio..." />

    return (
        <div className="resume-page">
            {Boolean(user?.blockedFeatures?.resumeGeneration) && (
                <div className="blocked-feature-banner" style={{ margin: '1rem 1.5rem 0 1.5rem' }}>
                    <span className="banner-icon">🔒</span>
                    <div className="banner-text">
                        <strong>Resume Generation Restricted</strong>
                        <p>Resume generation has been disabled for your account by an administrator.</p>
                    </div>
                </div>
            )}
            {/* ── Header bar ─────────────────────────────────────────── */}
            <header className="rp-header">
                <div className="rp-header-left">
                    <span className="rp-eyebrow">Resume Studio</span>
                    <h1 className="rp-title">{displayTitle}</h1>
                    {isDirty && <span className="rp-unsaved-badge">● Unsaved</span>}
                </div>

                <nav className="rp-actions" aria-label="Resume actions">
                    <button
                        type="button"
                        className="rp-btn rp-btn-ghost"
                        onClick={() => navigate(`/interview/${interviewId}`, { state: { interviewReport: report } })}
                    >
                        ← Back
                    </button>

                    <button
                        type="button"
                        className="rp-btn rp-btn-save"
                        onClick={handleSave}
                        disabled={saveLoading || !isDirty}
                    >
                        {saveLoading ? 'Saving…' : '💾 Save'}
                    </button>

                    <button
                        type="button"
                        className={`rp-btn ${isResumeBlocked ? 'rp-btn-disabled' : 'rp-btn-ghost'}`}
                        onClick={handleRegenerate}
                        disabled={loading || saveLoading || isResumeBlocked}
                        style={isResumeBlocked ? { background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', cursor: 'not-allowed' } : {}}
                        title={isResumeBlocked ? "Resume generation disabled by administrator" : "Regenerate from scratch"}
                    >
                        {isResumeBlocked ? '🔒 Locked' : '↺ Regenerate'}
                    </button>

                    <button
                        type="button"
                        className="rp-btn rp-btn-primary"
                        onClick={handlePrint}
                        disabled={printLoading || loading || !htmlContent}
                        title="Download PDF directly"
                    >
                        {printLoading ? 'Generating PDF…' : '📥 Download PDF'}
                    </button>
                </nav>
            </header>

            {/* ── Error banner ───────────────────────────────────────── */}
            {error && (
                <div className="rp-error-bar" role="alert">
                    <span>❌ {error}</span>
                    <button type="button" onClick={() => setError('')} aria-label="Dismiss error">✕</button>
                </div>
            )}

            {/* ── Main workspace ─────────────────────────────────────── */}
            <div className="rp-workspace">
                {/* Center: TipTap editor */}
                <main className="rp-editor-col">
                    {htmlContent ? (
                        <ResumeEditor
                            ref={editorRef}
                            initialHtml={htmlContent}
                            placeholder="Your resume content will appear here. Start editing!"
                            onChange={() => setIsDirty(true)}
                        />
                    ) : (
                        <Loading
                            inline={true}
                            title="Resume Studio"
                            subtitle="Drafting your ATS resume using Gemini AI..."
                            steps={[
                                { id: 1, label: "Analyzing interview report & candidate profile" },
                                { id: 2, label: "Extracting core technical skills & accomplishments" },
                                { id: 3, label: "Structuring ATS-compliant A4 layout & sections" },
                                { id: 4, label: "Polishing typography & design formatting" }
                            ]}
                        />
                    )}
                </main>
            </div>
        </div>
    )
}

export default Resume
