import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { generateResumePdf, getInterviewReportById, updateResumeHtml, rewriteResumeSection, getActiveJob } from '../services/interview.api'
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

// ── helper: validate that resume HTML is healthy and non-empty ────────────
function isHealthyResumeHtml(html) {
    if (!html || typeof html !== 'string') return false
    const stripped = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    // Reject 24-character hexadecimal IDs (MongoDB ObjectIds like 6a8365bd727464329cdbd674)
    if (/^[a-f0-9]{24}$/i.test(stripped)) return false
    // Reject empty or tiny fragments
    if (stripped.length < 30) return false
    return true
}

// ── Resume page ────────────────────────────────────────────────────────────
const Resume = () => {
    const { interviewId } = useParams()
    const navigate = useNavigate()
    const { report, loading, setLoading, getReoprtById, setReport } = useInterview()
    const { user, fetchUsage } = useAuth()

    const [error, setError]           = useState('')
    const [htmlContent, setHtmlContent] = useState('')
    const [dbLoading, setDbLoading]     = useState(true)
    const [aiGenerating, setAiGenerating] = useState(false)
    const [isDirty, setIsDirty]       = useState(false)
    const [saveLoading, setSaveLoading] = useState(false)
    const [printLoading, setPrintLoading] = useState(false)
    const [saveNotification, setSaveNotification] = useState(null) // { message: string, type: 'manual' | 'auto' }

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

    // ── Load resume HTML with health validation & DB fallback ─────────────
    useEffect(() => {
        let mounted = true
        async function init() {
            setDbLoading(true)
            setError('')

            // 1. Instant check: Do we have a healthy draft in localStorage from recent edits?
            let cachedDraft = null
            try {
                const stored = localStorage.getItem(`resume_draft_${interviewId}`)
                if (isHealthyResumeHtml(stored)) {
                    cachedDraft = stored
                    setHtmlContent(sanitizeResumeHtml(stored))
                    setDbLoading(false)
                }
            } catch (e) {
                console.warn('[Resume] Local draft read notice:', e)
            }

            try {
                // 2. Fetch current report from database
                const fetched = await getReoprtById(interviewId)
                if (!mounted) return

                // 3. Health check: Does DB already have a healthy generatedResumeHtml?
                if (isHealthyResumeHtml(fetched?.generatedResumeHtml)) {
                    const sanitized = sanitizeResumeHtml(fetched.generatedResumeHtml)
                    setHtmlContent(sanitized)
                    try {
                        localStorage.setItem(`resume_draft_${interviewId}`, sanitized)
                    } catch {}
                    setDbLoading(false)
                    return
                }

                // 4. If DB generatedResumeHtml is missing or corrupted, but we have a healthy local draft:
                if (cachedDraft) {
                    setHtmlContent(sanitizeResumeHtml(cachedDraft))
                    setDbLoading(false)
                    // Sync this draft to the database
                    updateResumeHtml(interviewId, { generatedResumeHtml: cachedDraft }).catch(err => {
                        console.warn('[Resume] Background draft recovery sync notice:', err.message)
                    })
                    return
                }

                // 5. Check if an active resume generation job is currently running on the server
                try {
                    const jobRes = await getActiveJob({ type: 'resume_html', resourceId: interviewId })
                    if (mounted && jobRes?.activeJob?.jobId) {
                        setDbLoading(false)
                        setAiGenerating(true)
                        const pollResult = await generateResumePdf(interviewId)
                        const reportWithHtml = pollResult?.interviewReport || pollResult
                        if (mounted && isHealthyResumeHtml(reportWithHtml?.generatedResumeHtml)) {
                            const sanitized = sanitizeResumeHtml(reportWithHtml.generatedResumeHtml)
                            setHtmlContent(sanitized)
                            try {
                                localStorage.setItem(`resume_draft_${interviewId}`, sanitized)
                            } catch {}
                            if (fetchUsage) fetchUsage()
                        }
                        if (mounted) setAiGenerating(false)
                        return
                    }
                } catch (jobErr) {
                    console.warn('[Resume] Active job check notice:', jobErr.message)
                }

                // 6. Fallback: If generatedResumeHtml is missing, use original DB resume text (if healthy)
                if (isHealthyResumeHtml(fetched?.resume)) {
                    const paragraphs = fetched.resume
                        .split(/\n{2,}/)
                        .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
                        .join('')
                    const fallbackHtml = `<h2>${fetched.developerTitle || 'Resume'}</h2>${paragraphs}`
                    const sanitized = sanitizeResumeHtml(fallbackHtml)
                    setHtmlContent(sanitized)
                    try {
                        localStorage.setItem(`resume_draft_${interviewId}`, sanitized)
                    } catch {}
                    setDbLoading(false)
                    return
                }

                // 7. If neither exists, trigger AI generation with force to guarantee clean generation
                setDbLoading(false)
                setAiGenerating(true)
                const genRes = await generateResumePdf(interviewId, { force: true })
                const freshReport = genRes?.interviewReport || genRes
                if (mounted && isHealthyResumeHtml(freshReport?.generatedResumeHtml)) {
                    const sanitized = sanitizeResumeHtml(freshReport.generatedResumeHtml)
                    setHtmlContent(sanitized)
                    try {
                        localStorage.setItem(`resume_draft_${interviewId}`, sanitized)
                    } catch {}
                    if (fetchUsage) fetchUsage()
                }
                if (mounted) setAiGenerating(false)

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

    // ── Unified Save & Auto-Save Function ──────────────────────────────────
    const saveResumeChanges = useCallback(async (isAuto = false) => {
        if (!editorRef.current) return
        const html = editorRef.current.getHtml()
        if (!isHealthyResumeHtml(html)) return

        if (!isAuto) {
            setSaveLoading(true)
        }
        setError('')

        // Immediately persist to localStorage
        try {
            localStorage.setItem(`resume_draft_${interviewId}`, html)
        } catch (e) {
            console.warn('[Resume] LocalStorage draft save warning:', e)
        }

        try {
            const res = await updateResumeHtml(interviewId, { generatedResumeHtml: html })
            if (res?.interviewReport && setReport) {
                setReport(res.interviewReport)
            }
            setHtmlContent(sanitizeResumeHtml(html))
            setIsDirty(false)
            if (fetchUsage) fetchUsage()

            setSaveNotification({
                message: isAuto
                    ? 'Auto-saved: Your latest resume changes have been saved to the database.'
                    : 'Saved: Your resume changes have been saved to the database successfully!',
                type: isAuto ? 'auto' : 'manual'
            })

            setTimeout(() => {
                setSaveNotification(null)
            }, 4500)
        } catch (err) {
            if (!isAuto) {
                setError(err?.response?.data?.message || err?.message || 'Failed to save resume.')
            } else {
                console.warn('[Auto-Save] Error saving draft:', err.message)
            }
        } finally {
            if (!isAuto) {
                setSaveLoading(false)
            }
        }
    }, [interviewId, setReport, fetchUsage])

    // ── Editor OnChange: Persist Draft Instantly ──────────────────────────
    const handleEditorChange = useCallback((updatedHtml) => {
        setIsDirty(true)
        const html = updatedHtml || editorRef.current?.getHtml()
        if (isHealthyResumeHtml(html)) {
            try {
                localStorage.setItem(`resume_draft_${interviewId}`, html)
            } catch {}
        }
    }, [interviewId])

    // ── 5-Minute Auto-Save Timer ──────────────────────────────────────────
    useEffect(() => {
        const AUTO_SAVE_INTERVAL = 5 * 60 * 1000 // 5 minutes
        const timer = setInterval(() => {
            if (isDirty) {
                saveResumeChanges(true)
            }
        }, AUTO_SAVE_INTERVAL)

        return () => clearInterval(timer)
    }, [isDirty, saveResumeChanges])

    // ── Manual Save Button Click ──────────────────────────────────────────
    const handleSave = useCallback(() => {
        saveResumeChanges(false)
    }, [saveResumeChanges])

    // ── Direct 1-Click PDF Export ─────────────────────────────────────────
    const handlePrint = useCallback(async () => {
        setPrintLoading(true)
        setError('')
        try {
            // Auto-save edits first if dirty
            if (isDirty && editorRef.current) {
                await saveResumeChanges(false)
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
    }, [isDirty, saveResumeChanges, displayTitle, fetchUsage])

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
            const currentResumeHtml = editorRef.current?.getHtml() || ''
            const res = await rewriteResumeSection({
                selectedText,
                instruction: msg,
                action: preset || 'enhance',
                message: msg,
                resourceId: interviewId,
                currentResumeHtml
            })
            if (fetchUsage) fetchUsage()
            const aiMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: res?.replyText || 'Here is the refined suggestion.',
                targetText: res?.targetText || selectedText || null,
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
    }, [chatInput, selectedText, interviewId, fetchUsage])

    // ── Apply Snippet In-Place or to Selection ──────────────────────────────
    const handleApplySnippet = useCallback((snippet, targetText = null) => {
        if (!snippet || !editorRef.current) return
        if (editorRef.current.replaceExactText) {
            const replaced = editorRef.current.replaceExactText(targetText, snippet)
            if (replaced) {
                setIsDirty(true)
                return
            }
        }
        if (editorRef.current.isFocused && editorRef.current.isFocused()) {
            editorRef.current.insertContent(snippet)
            setIsDirty(true)
        }
    }, [])

    // ── Listen for in-place replacement events from KIVI AI Assistant ───────
    useEffect(() => {
        const onKiviReplace = (e) => {
            const { targetText, snippet } = e.detail || {}
            if (snippet && editorRef.current) {
                if (editorRef.current.replaceExactText) {
                    const replaced = editorRef.current.replaceExactText(targetText, snippet)
                    if (replaced) {
                        setIsDirty(true)
                        if (typeof e.preventDefault === 'function') e.preventDefault()
                        return
                    }
                }
                if (editorRef.current.isFocused && editorRef.current.isFocused()) {
                    editorRef.current.insertContent(snippet)
                    setIsDirty(true)
                    if (typeof e.preventDefault === 'function') e.preventDefault()
                }
            }
        }
        window.addEventListener('kivi-replace-text', onKiviReplace)
        return () => window.removeEventListener('kivi-replace-text', onKiviReplace)
    }, [])

    const RESUME_STEPS = [
        { id: 1, label: "Analyzing profile & technical skills" },
        { id: 2, label: "Matching target job requirements" },
        { id: 3, label: "Structuring ATS-compliant sections" },
        { id: 4, label: "Polishing typography & design formatting" }
    ];

    if (aiGenerating) return <Loading steps={RESUME_STEPS} title="Resume Studio" subtitle="Drafting your document using AI..." />
    if (dbLoading && !htmlContent) return <ShimmerLoading type="resume" title="Loading Resume Studio..." />

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
                            onChange={handleEditorChange}
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

            {/* ── Floating Save & Auto-Save Notification Toast ───────── */}
            {saveNotification && (
                <div className={`rp-save-toast ${saveNotification.type}`} role="status" aria-live="polite">
                    <span className="toast-icon">{saveNotification.type === 'auto' ? '💾' : '✅'}</span>
                    <span className="toast-text">{saveNotification.message}</span>
                    <button
                        type="button"
                        className="toast-close-btn"
                        onClick={() => setSaveNotification(null)}
                        aria-label="Dismiss notification"
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    )
}

export default Resume
