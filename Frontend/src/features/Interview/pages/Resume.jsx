import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { generateResumePdf, getInterviewReportById, updateResumeHtml } from '../services/interview.api'
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
    const { loading, setLoading } = useInterview()

    const [report, setReport] = useState(location.state?.interviewReport ?? null)
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

    useEffect(() => {
        let isMounted = true

        async function initData() {
            setLoading(true)
            setError('')
            try {
                const reportRes = await getInterviewReportById(interviewId)
                const fetchedReport = reportRes?.interviewReport ?? null

                if (isMounted) {
                    setReport(fetchedReport)
                }

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
                        const updatedReportRes = await getInterviewReportById(interviewId)
                        const updatedReport = updatedReportRes?.interviewReport ?? null
                        if (isMounted) {
                            setReport(updatedReport)
                            if (updatedReport?.generatedResumeHtml) {
                                setIframeContent(updatedReport.generatedResumeHtml)
                                editedContentRef.current = updatedReport.generatedResumeHtml
                            }
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
            savedRangeRef.current = sel.getRangeAt(0)
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
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
        if (iframeDoc && iframeDoc.body) {
            iframeDoc.body.contentEditable = "true"
            iframeDoc.body.style.outline = "none"
            iframeDoc.body.style.cursor = "text"
            
            iframeDoc.body.addEventListener('input', () => {
                const updatedContent = iframeDoc.documentElement.outerHTML
                editedContentRef.current = updatedContent
                setIsDirty(true)
            })

            // Keep track of text selection
            iframeDoc.addEventListener('mouseup', saveSelection)
            iframeDoc.addEventListener('keyup', saveSelection)
            iframeDoc.addEventListener('selectionchange', saveSelection)
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
            const res = await updateResumeHtml(interviewId, {
                generatedResumeHtml: editedContentRef.current
            })
            setReport(res.interviewReport)
            setIframeContent(res.interviewReport.generatedResumeHtml)
            setIsDirty(false)
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
                const res = await updateResumeHtml(interviewId, {
                    generatedResumeHtml: editedContentRef.current
                })
                setReport(res.interviewReport)
                setIframeContent(res.interviewReport.generatedResumeHtml)
                setIsDirty(false)
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
            await updateResumeHtml(interviewId, { generatedResumeHtml: "" })
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
                        <p className="eyebrow">Resume Studio</p>
                        <h1>{displayTitle}</h1>
                        <p className="intro">Edit your AI-generated resume directly on the sheet and download the A4 PDF.</p>
                    </div>

                    <div className="resume-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            type="button"
                            className="ghost-btn"
                            onClick={() => navigate(`/interview/${interviewId}`, { state: { interviewReport: report } })}
                        >
                            Back To Report
                        </button>
                        
                        <button
                            type="button"
                            className="primary-btn"
                            onClick={handleSaveChanges}
                            disabled={saveLoading || !isDirty}
                            style={{ background: 'var(--success-color)' }}
                        >
                            {saveLoading ? 'Saving...' : '💾 Save Changes'}
                        </button>

                        {isDirty && (
                            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: '600', marginRight: '0.5rem' }}>
                                ⚠️ Unsaved changes
                            </span>
                        )}

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
                            className="primary-btn"
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

                <div className="resume-preview panel" style={{ marginTop: '1rem' }}>
                    {loading && !iframeContent ? (
                        <div className="resume-feedback" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <span className="pulse-dot"></span>
                            <p style={{ color: 'var(--muted)' }}>Drafting and formatting your ATS resume using Gemini AI...</p>
                        </div>
                    ) : iframeContent ? (
                        <div className="resume-frame-container" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
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

                            <iframe
                                ref={iframeRef}
                                srcDoc={iframeContent}
                                onLoad={handleIframeLoad}
                                title="Resume Preview"
                                className="resume-frame"
                            />
                        </div>
                    ) : (
                        <div className="resume-feedback">Nothing to preview yet.</div>
                    )}
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
