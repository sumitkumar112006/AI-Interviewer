import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { generateResumePdf, getInterviewReportById } from '../services/interview.api'
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
    const [previewUrl, setPreviewUrl] = useState('')
    const [report, setReport] = useState(location.state?.interviewReport ?? null)
    const { loading, setLoading } = useInterview()
    const [error, setError] = useState('')

    useEffect(() => {
        let isMounted = true
        let objectUrl = ''

        async function loadResumePreview() {
            setLoading(true)
            setError('')

            try {
                const [pdfBlob, reportResponse] = await Promise.all([
                    generateResumePdf(interviewId),
                    getInterviewReportById(interviewId),
                ])

                objectUrl = window.URL.createObjectURL(pdfBlob)

                if (!isMounted) {
                    return
                }

                setPreviewUrl(objectUrl)
                setReport(reportResponse?.interviewReport ?? null)
            } catch (err) {
                if (!isMounted) {
                    return
                }

                setError(err?.response?.data?.message || 'Unable to generate the resume preview right now.')
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        void loadResumePreview()

        return () => {
            isMounted = false

            if (objectUrl) {
                window.URL.revokeObjectURL(objectUrl)
            }
        }
    }, [interviewId])

    const displayTitle = useMemo(() => {
        return report?.developerTitle || report?.Title || report?.title || 'Generated Resume'
    }, [report])

    const handleDownload = () => {
        if (!previewUrl) {
            return
        }

        const link = document.createElement('a')
        link.href = previewUrl
        link.download = `resume_${extractObjectId(interviewId) || 'preview'}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    if(loading) {
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
                    ) : (
                        <iframe
                            title="Resume PDF Preview"
                            src={previewUrl}
                            className="resume-frame"
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

export default Resume
