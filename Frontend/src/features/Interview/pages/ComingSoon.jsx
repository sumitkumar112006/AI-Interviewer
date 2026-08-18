import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '../style/comingsoon.scss';

const ComingSoon = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const feature = searchParams.get('feature') || 'Feature';

    const getFormattedName = (name) => {
        return name
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    return (
        <div className="coming-soon-container">
            <div className="coming-soon-card">
                <div className="coming-soon-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 2 22 22 22 12 2" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>
                <h1>{getFormattedName(feature)} is Coming Soon</h1>
                <p>
                    We are currently building this capability to enhance your interview intelligence workspace.
                    Our AI models will soon power this section to give you deep career insights.
                </p>
                <div className="ai-badge">
                    <span className="pulse-dot"></span>
                    <span>AI Engine Connected: GPT-OSS 120B · Groq</span>
                </div>
                <button className="back-home-btn" onClick={() => navigate('/')}>
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
};

export default ComingSoon;
