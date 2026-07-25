import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { generateResumePdf, getInterviewReportById } from '../services/interview.api'
import { useInterview } from '../hooks/useInterview'
import { useAuth } from '../../Auth/hooks/useAuth'
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

/**
 * Module-level cache: interviewId → { blobUrl, report }
 * This survives React component unmount/remount so navigating away
 * and back does NOT trigger a redundant PDF regeneration.
 */
const pdfCache = new Map()

const Resume = () => {
    const { interviewId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { handleLogout } = useAuth()
    const { loading, setLoading } = useInterview()

    // ── Initialise state directly from cache to avoid blank flash on remount ──
    const _cached = pdfCache.get(interviewId)
    const [previewUrl, setPreviewUrl] = useState(_cached?.blobUrl ?? '')
    const [report, setReport] = useState(
        _cached?.report ?? location.state?.interviewReport ?? null
    )
    const [error, setError] = useState('')

    useEffect(() => {
        let isMounted = true

        async function loadResumePreview() {
            // ── Cache hit: reuse previously generated PDF ──────────────
            const cached = pdfCache.get(interviewId)
            if (cached) {
                // State already initialised from cache above — nothing to do
                return
            }

            // ── Cache miss: generate PDF from server ───────────────────
            setLoading(true)
            setError('')
            setPreviewUrl('')

            let objectUrl = ''
            try {
                const [pdfBlob, reportResponse] = await Promise.all([
                    generateResumePdf(interviewId),
                    getInterviewReportById(interviewId),
                ])

                if (!pdfBlob || !(pdfBlob instanceof Blob) || pdfBlob.size === 0) {
                    throw new Error('Generated resume PDF is empty or invalid.')
                }

                objectUrl = window.URL.createObjectURL(pdfBlob)

                if (!isMounted) return

                const fetchedReport = reportResponse?.interviewReport ?? null

                // Store in cache for future visits
                pdfCache.set(interviewId, { blobUrl: objectUrl, report: fetchedReport })

                console.debug('Resume preview blob', { size: pdfBlob.size, type: pdfBlob.type, url: objectUrl })
                setPreviewUrl(objectUrl)
                setReport(fetchedReport)
            } catch (err) {
                if (!isMounted) return
                // On error, clean up any partial blob url
                if (objectUrl) window.URL.revokeObjectURL(objectUrl)
                console.error('Resume preview error:', err)
                setError(err?.response?.data?.message || err?.message || 'Unable to generate the resume preview right now.')
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        void loadResumePreview()

        return () => {
            isMounted = false
            // NOTE: We intentionally do NOT revoke the blob URL on unmount
            // so the cached URL remains valid when the user navigates back.
        }
    }, [interviewId])

    const displayTitle = useMemo(() => {
        return report?.developerTitle || report?.Title || report?.title || 'Generated Resume'
    }, [report])

    const handleDownload = () => {
        if (!previewUrl) return

        const link = document.createElement('a')
        link.href = previewUrl
        link.download = `resume_${extractObjectId(interviewId) || 'preview'}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    /**
     * Force a fresh PDF regeneration for this interview (clears cache entry).
     * Useful if the user explicitly wants to refresh the resume.
     */
    const handleRefresh = () => {
        const cached = pdfCache.get(interviewId)
        if (cached?.blobUrl) {
            window.URL.revokeObjectURL(cached.blobUrl)
        }
        pdfCache.delete(interviewId)
        setPreviewUrl('')
        setReport(location.state?.interviewReport ?? null)
        setError('')
        // The useEffect won't re-run because interviewId didn't change,
        // so we trigger a manual reload by changing a key signal via a small trick:
        window.location.reload()
    }

    const onlogout = async () => {
        try {
            await handleLogout()
            navigate('/login')
        } catch (error) {
            console.log(error)
        }
    }

    if (loading) {
        return (
            <main>
                <LoadingPage />
            </main>
        )
    }

    return (
        <div className="resume-page">
            
            <div className="resume-shell">
                <div className="resume-header panel">
                    <div className="resume-heading">
                        <p className="eyebrow">Resume Studio</p>
                        <h1>{displayTitle}</h1>
                        <p className="intro">Preview the AI-generated resume and download the PDF when it looks right.</p>
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
                            className="ghost-btn"
                            onClick={handleRefresh}
                            title="Re-generate resume from scratch"
                        >
                            ↺ Refresh
                        </button>
                        <button
                            type="button"
                            className="primary-btn"
                            onClick={handleDownload}
                            disabled={!previewUrl || loading}
                        >
                            Download PDF
                        </button>
                    </div>
                </div>

                <div className="resume-preview panel">
                    {loading ? (
                        <div className="resume-feedback">Generating resume preview...</div>
                    ) : error ? (
                        <div className="resume-feedback error">{error}</div>
                    ) : previewUrl ? (
                        <div className="resume-frame-container">
                            <iframe
                                src={previewUrl}
                                title="Resume Preview"
                                className="resume-frame"
                                width="100%"
                            />
                        </div>
                    ) : (
                        <div className="resume-feedback">Nothing to preview yet.</div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Resume
