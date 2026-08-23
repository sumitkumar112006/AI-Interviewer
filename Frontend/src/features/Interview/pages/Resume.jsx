import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { generateResumePdf, getInterviewReportById, updateResumeHtml, rewriteResumeSection } from '../services/interview.api'
import { useInterview } from '../hooks/useInterview'
import { useAuth } from '../../Auth/hooks/useAuth'
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
    const { loading, setLoading, report, getReoprtById, updateNewResume } = useInterview()
    const { fetchUsage } = useAuth()

    const [error, setError]           = useState('')
    const [htmlContent, setHtmlContent] = useState('')
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
            setLoading(true)
            setError('')
            try {
                const fetched = await getReoprtById(interviewId)
                if (!mounted) return

                if (fetched?.generatedResumeHtml) {
                    setHtmlContent(sanitizeResumeHtml(fetched.generatedResumeHtml))
                } else {
                    // Trigger AI HTML generation on backend
                    await generateResumePdf(interviewId)
                    const updated = await getReoprtById(interviewId)
                    if (mounted && updated?.generatedResumeHtml) {
                        setHtmlContent(sanitizeResumeHtml(updated.generatedResumeHtml))
                    }
                }
            } catch (err) {
                if (mounted) setError(err?.response?.data?.message || err?.message || 'Failed to load resume.')
            } finally {
                if (mounted) setLoading(false)
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

    const displayTitle = useMemo(() =>
        report?.developerTitle || report?.Title || report?.title || 'Generated Resume'
    , [report])

    // ── Save ───────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!editorRef.current) return
        setSaveLoading(true)
        setError('')
        try {
            const html = editorRef.current.getHtml()
            await updateNewResume(html)
            setHtmlContent(html)
            setIsDirty(false)
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to save.')
        } finally {
            setSaveLoading(false)
        }
    }, [updateNewResume])

    // ── Direct 1-Click PDF Export ─────────────────────────────────────────
    const handlePrint = useCallback(async () => {
        setPrintLoading(true)
        setError('')
        try {
            // Auto-save edits first if dirty
            if (isDirty && editorRef.current) {
                const html = editorRef.current.getHtml()
                await updateNewResume(html)
                setHtmlContent(html)
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
    }, [isDirty, updateNewResume, displayTitle, fetchUsage])

    // ── Regenerate ─────────────────────────────────────────────────────────
    const handleRegenerate = useCallback(async () => {
        if (!window.confirm('Regenerate the resume from scratch? Your edits will be discarded.')) return
        setLoading(true)
        setError('')
        try {
            await updateNewResume('')
            window.location.reload()
        } catch (err) {
            setError(err?.message || 'Failed to regenerate.')
            setLoading(false)
        }
    }, [updateNewResume, setLoading])

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
    }, [chatInput, selectedText])

    const handleApplySnippet = useCallback((snippet) => {
        if (!snippet || !editorRef.current) return
        editorRef.current.insertContent(snippet)
        setIsDirty(true)
    }, [])

    if (loading && !htmlContent) return <Loading />

    return (
        <div className="resume-page">
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
                        className="rp-btn rp-btn-ghost"
                        onClick={handleRegenerate}
                        disabled={loading || saveLoading}
                        title="Regenerate from scratch"
                    >
                        ↺ Regenerate
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
