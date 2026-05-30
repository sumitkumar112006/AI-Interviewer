import React from 'react'
import '../style/home.scss'

const Home = () => {
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
                            name="jobDescripton"
                            id="jobDescription"
                            placeholder='Paste the detailed job description here. Include responsibilities, qualifications, tools, and company expectations...'
                        >

                        </textarea>
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
                            <input hidden type="file" name='resume' id='resume' accept='.pdf' />
                        </div>

                        <div className="panel input-group textarea-group">
                            <div className="section-heading">
                                <label htmlFor="selfDescription">Self Description</label>
                            </div>
                            <p className="helper-copy">
                                Add a few lines about your strengths, experience, and career direction.
                            </p>
                            <textarea
                                name="selfDescription"
                                id="selfDescription"
                                placeholder='Enter your self description in a few sentences. Highlight your strengths and career goals...'
                            >

                            </textarea>
                        </div>

                        <button className='button primary-btn'>Generate Interview Report</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Home
