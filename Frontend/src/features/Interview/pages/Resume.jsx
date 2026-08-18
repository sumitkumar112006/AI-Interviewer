import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { generateResumePdf, getInterviewReportById, updateResumeHtml, rewriteResumeSection } from '../services/interview.api'
import { useInterview } from '../hooks/useInterview'
import LoadingPage from '../Loading'
import '../style/resume.scss'

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

const Resume = () => {
    const { interviewId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { 
        loading, 
        setLoading, 
        report, 
        getReoprtById,
        previousResume,
        jobDescription,
        newResume,
        updateNewResume
    } = useInterview()

    const [error, setError] = useState('')

    // Inline Editing State
    const [iframeContent, setIframeContent] = useState('')
    const [isDirty, setIsDirty] = useState(false)
    const [saveLoading, setSaveLoading] = useState(false)
    const editedContentRef = React.useRef('')
    const iframeRef = React.useRef(null)
    const savedRangeRef = React.useRef(null)

    // Custom Link Modal State
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
    const [linkText, setLinkText] = useState('')
    const [linkUrl, setLinkUrl] = useState('')

    // Scale factor for mobile responsiveness
    const [scaleFactor, setScaleFactor] = useState(1)

    useEffect(() => {
        const handleResize = () => {
            const wrapper = document.querySelector('.resume-iframe-wrapper')
            if (wrapper) {
                const width = wrapper.clientWidth
                const availableWidth = width - 32 // 16px padding left & right
                if (availableWidth < 794) {
                    setScaleFactor(availableWidth / 794)
                } else {
                    setScaleFactor(1)
                }
            }
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        const timer = setTimeout(handleResize, 150)

        return () => {
            window.removeEventListener('resize', handleResize)
            clearTimeout(timer)
        }
    }, [iframeContent, loading])

    // KIVI Floating Assistant & Idle Nudge State
    const [isKiviOpen, setIsKiviOpen] = useState(false)
    const [showIdleNudge, setShowIdleNudge] = useState(false)
    const idleTimerRef = React.useRef(null)

    // Proactive Idle Nudge effect (triggers nudge after 6s of inactivity)
    useEffect(() => {
        const resetIdleTimer = () => {
            setShowIdleNudge(false)
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
            idleTimerRef.current = setTimeout(() => {
                setShowIdleNudge(true)
            }, 6000)
        }

        resetIdleTimer()

        window.addEventListener('mousemove', resetIdleTimer)
        window.addEventListener('keydown', resetIdleTimer)
        window.addEventListener('click', resetIdleTimer)

        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
            window.removeEventListener('mousemove', resetIdleTimer)
            window.removeEventListener('keydown', resetIdleTimer)
            window.removeEventListener('click', resetIdleTimer)
        }
    }, [])

    // AI Resume Chat Copilot State
    const [selectedSnippet, setSelectedSnippet] = useState('')
    const [chatMessages, setChatMessages] = useState([
        {
            id: 1,
            sender: 'ai',
            text: '👋 Hi! I am your AI Resume Copilot. Highlight any text on your resume to refine it, or ask me for suggestions!'
        }
    ])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const chatEndRef = React.useRef(null)

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [chatMessages, chatLoading])

    const handleSendChatMessage = async (e, customText = null, actionPreset = null) => {
        if (e) e.preventDefault()
        const messageToSend = customText || chatInput
        if (!messageToSend.trim() && !selectedSnippet && !actionPreset) return

        const userMsgText = messageToSend.trim() || (actionPreset ? `Apply preset: ${actionPreset}` : 'Refine selection')
        
        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: userMsgText,
            highlightedContext: selectedSnippet ? selectedSnippet : null
        }

        setChatMessages(prev => [...prev, userMsg])
        if (!customText) setChatInput('')
        setChatLoading(true)

        try {
            const res = await rewriteResumeSection({
                selectedText: selectedSnippet,
                instruction: messageToSend,
                action: actionPreset || 'enhance',
                message: messageToSend
            })

            const aiMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: res?.replyText || 'Here is the refined suggestion for your resume.',
                suggestedSnippet: res?.suggestedSnippet || res?.rewrittenText || null
            }
            setChatMessages(prev => [...prev, aiMsg])
        } catch (err) {
            console.error("AI Chat error:", err)
            const errorMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: '⚠️ Sorry, I encountered an issue. Please try clicking the action button or sending your message again.'
            }
            setChatMessages(prev => [...prev, errorMsg])
        } finally {
            setChatLoading(false)
        }
    }

    const handleApplySuggestedSnippet = (snippet) => {
        if (!snippet) return
        applyFormat('insertText', snippet)
        setIsDirty(true)
    }

    useEffect(() => {
        let isMounted = true

        async function initData() {
            setLoading(true)
            setError('')
            try {
                const fetchedReport = await getReoprtById(interviewId)

                if (fetchedReport) {
                    if (fetchedReport.generatedResumeHtml) {
                        if (isMounted) {
                            setIframeContent(fetchedReport.generatedResumeHtml)
                            editedContentRef.current = fetchedReport.generatedResumeHtml
                        }
                    } else {
                        // Generate resume initial HTML
                        await generateResumePdf(interviewId)
                        // Refetch report to get the saved HTML
                        const updatedReport = await getReoprtById(interviewId)
                        if (isMounted && updatedReport?.generatedResumeHtml) {
                            setIframeContent(updatedReport.generatedResumeHtml)
                            editedContentRef.current = updatedReport.generatedResumeHtml
                        }
                    }
                }
            } catch (err) {
                console.error("Error loading resume details:", err)
                if (isMounted) {
                    setError(err?.response?.data?.message || err?.message || 'Failed to load resume details.')
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        initData()

        return () => {
            isMounted = false
        }
    }, [interviewId])

    const displayTitle = useMemo(() => {
        return report?.developerTitle || report?.Title || report?.title || 'Generated Resume'
    }, [report])

    const saveSelection = () => {
        const iframe = iframeRef.current
        if (!iframe) return
        const win = iframe.contentWindow
        if (!win) return
        const sel = win.getSelection()
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0)
            savedRangeRef.current = range
            const text = sel.toString().trim()
            if (text && text.length > 0) {
                setSelectedSnippet(text)
                setIsKiviOpen(true)
            }
        }
    }

    const restoreSelection = () => {
        const iframe = iframeRef.current
        if (!iframe) return
        const win = iframe.contentWindow
        if (!win) return
        const sel = win.getSelection()
        if (savedRangeRef.current && sel) {
            sel.removeAllRanges()
            sel.addRange(savedRangeRef.current)
        }
    }

    const applyFormat = (command, value = null) => {
        const iframe = iframeRef.current
        if (!iframe) return
        const doc = iframe.contentDocument || iframe.contentWindow.document
        if (doc) {
            restoreSelection()
            if (iframe.contentWindow) {
                iframe.contentWindow.focus()
            }
            doc.execCommand(command, false, value)
            
            // Re-save selection
            saveSelection()

            // Trigger input event
            const event = new Event('input', { bubbles: true })
            doc.body.dispatchEvent(event)
        }
    }

    const handleIframeLoad = (e) => {
        const iframe = e.target
        const iframeWin = iframe.contentWindow
        const iframeDoc = iframe.contentDocument || iframeWin?.document
        if (iframeDoc && iframeDoc.body) {
            iframeDoc.body.contentEditable = "true"
            iframeDoc.body.style.outline = "none"
            iframeDoc.body.style.cursor = "text"
            
            iframeDoc.body.addEventListener('input', () => {
                const updatedContent = iframeDoc.documentElement.outerHTML
                editedContentRef.current = updatedContent
                setIsDirty(true)
            })

            // Keep track of text selection live on selectionchange, mouseup, and keyup
            const onSelectUpdate = () => {
                setTimeout(saveSelection, 10)
            }

            iframeDoc.addEventListener('mouseup', onSelectUpdate)
            iframeDoc.addEventListener('keyup', onSelectUpdate)
            iframeDoc.addEventListener('selectionchange', onSelectUpdate)
            if (iframeWin) {
                iframeWin.addEventListener('mouseup', onSelectUpdate)
            }
        }
    }

    const handleInsertLinkClick = (e) => {
        e.preventDefault()
        restoreSelection()
        const iframe = iframeRef.current
        if (!iframe) return
        const win = iframe.contentWindow
        if (!win) return
        
        const sel = win.getSelection()
        let selectedText = ""
        if (sel && sel.rangeCount > 0) {
            selectedText = sel.toString().trim()
        }
        
        setLinkText(selectedText || 'Link')
        setLinkUrl('https://')
        setIsLinkModalOpen(true)
    }

    const handleLinkSubmit = (e) => {
        e.preventDefault()
        if (!linkText.trim() || !linkUrl.trim()) return

        const formattedUrl = /^https?:\/\//i.test(linkUrl) ? linkUrl : `https://${linkUrl}`
        const anchorHtml = `<a href="${formattedUrl}" target="_blank" style="color: #6366f1; text-decoration: underline; font-weight: bold;">${linkText}</a>`
        
        applyFormat('insertHTML', anchorHtml)
        setIsLinkModalOpen(false)
        setLinkText('')
        setLinkUrl('')
    }

    const handleSaveChanges = async () => {
        setSaveLoading(true)
        setError('')
        try {
            const updatedReport = await updateNewResume(editedContentRef.current)
            if (updatedReport) {
                setIframeContent(updatedReport.generatedResumeHtml)
                setIsDirty(false)
            }
        } catch (err) {
            console.error("Error saving resume changes:", err)
            setError(err?.response?.data?.message || err?.message || 'Failed to save changes.')
        } finally {
            setSaveLoading(false)
        }
    }

    const handleDownloadPdf = async () => {
        setLoading(true)
        setError('')
        try {
            // Auto-save changes first if dirty
            if (isDirty) {
                const updatedReport = await updateNewResume(editedContentRef.current)
                if (updatedReport) {
                    setIframeContent(updatedReport.generatedResumeHtml)
                    setIsDirty(false)
                }
            }

            const pdfBlob = await generateResumePdf(interviewId, editedContentRef.current)
            const objectUrl = window.URL.createObjectURL(pdfBlob)
            const link = document.createElement('a')
            link.href = objectUrl
            link.download = `resume_${report?.developerTitle ? report.developerTitle.replace(/\s+/g, '_') : 'studio'}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(objectUrl)
        } catch (err) {
            console.error("Error downloading resume PDF:", err)
            setError(err?.message || 'Failed to download resume PDF.')
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = async () => {
        if (!window.confirm("Are you sure you want to regenerate the resume from scratch? This will discard your current edits.")) {
            return
        }
        setLoading(true)
        setError('')
        try {
            await updateNewResume("")
            window.location.reload()
        } catch (err) {
            console.error("Error regenerating resume:", err)
            setError(err?.message || "Failed to regenerate resume.")
            setLoading(false)
        }
    }

    return (
        <div className="resume-page">
            <div className="resume-shell">
                <div className="resume-header panel">
                    <div className="resume-heading">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <p className="eyebrow">Resume Studio</p>
                            {isDirty && (
                                <span className="unsaved-badge">
                                    ● Unsaved Changes
                                </span>
                            )}
                        </div>
                        <h1>{displayTitle}</h1>
                        <p className="intro">Edit your AI-generated resume directly on the sheet and download the A4 PDF.</p>
                    </div>

                    <div className="resume-actions">
                        <button
                            type="button"
                            className="ghost-btn"
                            onClick={() => navigate(`/interview/${interviewId}`, { state: { interviewReport: report } })}
                        >
                            Back To Report
                        </button>
                        
                        <button
                            type="button"
                            className="primary-btn save-btn"
                            onClick={handleSaveChanges}
                            disabled={saveLoading || !isDirty}
                        >
                            {saveLoading ? 'Saving...' : '💾 Save Changes'}
                        </button>

                        <button
                            type="button"
                            className="ghost-btn"
                            onClick={handleRefresh}
                            disabled={loading || saveLoading}
                            title="Re-generate resume from scratch"
                        >
                            ↺ Regenerate
                        </button>

                        <button
                            type="button"
                            className="primary-btn download-btn"
                            onClick={handleDownloadPdf}
                            disabled={loading || saveLoading || !iframeContent}
                        >
                            {loading ? 'Preparing...' : '📥 Download PDF'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="feedback-message error-message" style={{ minHeight: 'auto', padding: '1.2rem 1.5rem', background: '#180e15', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.75rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', boxShadow: '0 0 25px rgba(239, 68, 68, 0.15)' }}>
                        <p style={{ margin: 0, color: '#f87171', fontSize: '0.9rem', lineHeight: '1.5', fontWeight: '500' }}>❌ {error}</p>
                        <button 
                            type="button" 
                            onClick={() => setError('')} 
                            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', padding: '0.2rem' }}
                            title="Dismiss"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Full-Width Resume Studio Workspace */}
                <div className="resume-workspace-layout">
                    <div className="resume-preview-column panel">
                        {loading && !iframeContent ? (
                            <div className="resume-feedback" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
                                <div className="shimmer" style={{ gap: '12px', width: '100%', justifyContent: 'center' }}>
                                    <div className="shimmer-checkbox"></div>
                                    <div className="shimmer-text"></div>
                                </div>
                                <div className="shimmer" style={{ gap: '12px', width: '100%', justifyContent: 'center' }}>
                                    <div className="shimmer-checkbox"></div>
                                    <div className="shimmer-text" style={{ width: '60%' }}></div>
                                </div>
                                <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>Drafting and formatting your ATS resume using Gemini AI...</p>
                            </div>
                        ) : iframeContent ? (
                            <div className="resume-frame-container">
                                <div className="formatting-toolbar">
                                    <button 
                                        type="button" 
                                        className="toolbar-btn" 
                                        onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }}
                                        title="Bold"
                                        style={{ fontWeight: 'bold' }}
                                    >
                                        B
                                    </button>
                                    <button 
                                        type="button" 
                                        className="toolbar-btn" 
                                        onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }}
                                        title="Italic"
                                        style={{ fontStyle: 'italic' }}
                                    >
                                        I
                                    </button>
                                    <button 
                                        type="button" 
                                        className="toolbar-btn" 
                                        onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }}
                                        title="Underline"
                                        style={{ textDecoration: 'underline' }}
                                    >
                                        U
                                    </button>
                                    <div className="toolbar-divider" />
                                    <button 
                                        type="button" 
                                        className="toolbar-btn" 
                                        onMouseDown={handleInsertLinkClick}
                                        title="Insert Link"
                                    >
                                        🔗 Link
                                    </button>
                                    <div className="toolbar-divider" />
                                    <div className="toolbar-select-container">
                                        <label htmlFor="fontSizeSelect" style={{ fontSize: '0.75rem', color: 'var(--muted)', marginRight: '0.4rem' }}>Size:</label>
                                        <select 
                                            id="fontSizeSelect"
                                            onChange={(e) => applyFormat('fontSize', e.target.value)}
                                            defaultValue="3"
                                            className="toolbar-select"
                                        >
                                            <option value="2">Small</option>
                                            <option value="3">Normal</option>
                                            <option value="4">Medium</option>
                                            <option value="5">Large</option>
                                            <option value="6">X-Large</option>
                                        </select>
                                    </div>
                                </div>

                                 <div className="resume-iframe-wrapper" style={{ overflowX: 'hidden' }}>
                                    <div 
                                        className="resume-scaler-container" 
                                        style={{ 
                                            width: '100%', 
                                            height: `${1123 * scaleFactor}px`, 
                                            display: 'flex', 
                                            justifyContent: 'center', 
                                            alignItems: 'flex-start',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div 
                                            className="resume-frame-scaler" 
                                            style={{ 
                                                width: '794px', 
                                                height: '1123px',
                                                transform: `scale(${scaleFactor})`,
                                                transformOrigin: 'top center',
                                                transition: 'transform 0.2s ease',
                                                flexShrink: 0
                                            }}
                                        >
                                            <iframe
                                                ref={iframeRef}
                                                srcDoc={iframeContent}
                                                onLoad={handleIframeLoad}
                                                title="Resume Preview"
                                                className="resume-frame"
                                                style={{ width: '100%', height: '100%', border: 'none', margin: 0 }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="resume-feedback">Nothing to preview yet.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Link Modal */}
            {isLinkModalOpen && (
                <div className="link-modal-overlay">
                    <div className="link-modal-card">
                        <button 
                            type="button" 
                            className="modal-close-btn"
                            onClick={() => setIsLinkModalOpen(false)}
                        >
                            ✕
                        </button>
                        
                        <div className="modal-header">
                            <span className="modal-icon">🔗</span>
                            <div>
                                <h3>Insert Hyperlink</h3>
                                <p>Add a clickable link to your resume.</p>
                            </div>
                        </div>

                        <form onSubmit={handleLinkSubmit} className="modal-form">
                            <div className="modal-input-field">
                                <label htmlFor="modalLinkText">Display Text</label>
                                <input 
                                    type="text" 
                                    id="modalLinkText" 
                                    value={linkText}
                                    onChange={(e) => setLinkText(e.target.value)}
                                    placeholder="e.g. GitHub, LinkedIn, Portfolio"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="modal-input-field">
                                <label htmlFor="modalLinkUrl">URL Link</label>
                                <input 
                                    type="text" 
                                    id="modalLinkUrl" 
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="e.g. https://github.com/yourusername"
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button 
                                    type="button" 
                                    className="modal-btn modal-btn-secondary"
                                    onClick={() => setIsLinkModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="modal-btn modal-btn-primary"
                                >
                                    Insert Link
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Resume
