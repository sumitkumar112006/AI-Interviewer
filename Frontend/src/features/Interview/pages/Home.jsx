import React, { useEffect, useRef, useState } from 'react'
import '../style/home.scss'
import { useInterview } from '../hooks/useInterview'
import { useNavigate } from 'react-router-dom'

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

const Home = () => {
    const { loading, report, generateReport } = useInterview()
    const [formData, setFormData] = useState({
        jobDescription: '',
        selfDescription: ''
    })
    const resumeInputRef = useRef()

    const navigate = useNavigate()

    useEffect(() => {
        if (!report) {
            return
        }

        setFormData({
            jobDescription: report.jobDescription ?? '',
            selfDescription: report.selfDescription ?? ''
        })
    }, [report])

    const handleInputChange = (e) => {
        const { name, value } = e.target

        setFormData((currentFormData) => ({
            ...currentFormData,
            [name]: value
        }))
    }

    const handleGenerateReport = async () => {
        const resumeFile = resumeInputRef.current.files[0]
        const data = await generateReport({
            jobDescription: formData.jobDescription,
            selfDescription: formData.selfDescription,
            resumeFile
        })

        const interviewId = extractObjectId(data?._id)

        if (interviewId) {
            navigate(`/interview/${interviewId}`, {
                state: {
                    interviewReport: data
                }
            })
        }

    }

    if (loading) {
        return (
            <main>
                <h1>Interview Plan is Generating...</h1>
            </main>
        )
    }


    return (
        <div className='home'>
            <div className="workspace">
                <div className="workspace-header">
                    <p className="eyebrow">Assessment Workspace</p>
                    <h1>Prepare your interview inputs</h1>
                    <p className="intro">
                        Add the role details, upload your resume, and include a short self summary for sharper
                        interview guidance.
                    </p>
                </div>

                <div className="interview-input-group">
                    <div className="left panel">
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
                            <span>Minimum 200 words recommended</span>
                            <span>Ready for processing</span>
                        </div>
                    </div>

                    <div className="right">
                        <div className="panel input-group file-group">
                            <div className="section-heading">
                                <p className="section-kicker">Candidate Profile</p>
                                <h3>Resume</h3>
                            </div>
                            <p className='highlight'>Use resume and self description together for better results.</p>
                            <label className='file-label' htmlFor="resume">Upload Resume</label>
                            <input ref={resumeInputRef} hidden type="file" name='resume' id='resume' accept='.pdf' />
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
                            className='button primary-btn'
                            disabled={loading}
                        >
                            {loading ? 'Generating...' : 'Generate Interview Report'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Home
