import React, { useEffect, useState } from 'react';
import '../style/reportLoading.scss';

const STEPS = [
    { id: 1, label: 'Extracting candidate resume & self-description...' },
    { id: 2, label: 'Analyzing target job requirements & skill match...' },
    { id: 3, label: 'Evaluating technical competencies & skill gaps...' },
    { id: 4, label: 'Synthesizing customized interview questions & roadmap...' }
];

const TIPS = [
    "Tip: Use the STAR framework (Situation, Task, Action, Result) for behavioral questions.",
    "Tip: Highlight quantifiable achievements and system metrics in your responses.",
    "Tip: Review your skill gap breakdown to prioritize areas for practice.",
    "Tip: Practice speaking your code explanations out loud to build confidence."
];

const ReportGenerationLoading = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [progress, setProgress] = useState(12);
    const [tipIndex, setTipIndex] = useState(0);

    useEffect(() => {
        const stepTimer = setInterval(() => {
            setCurrentStep((prev) => (prev < STEPS.length ? prev + 1 : prev));
        }, 2200);

        const progressTimer = setInterval(() => {
            setProgress((prev) => (prev < 92 ? prev + Math.floor(Math.random() * 8 + 4) : prev));
        }, 350);

        const tipTimer = setInterval(() => {
            setTipIndex((prev) => (prev + 1) % TIPS.length);
        }, 4500);

        return () => {
            clearInterval(stepTimer);
            clearInterval(progressTimer);
            clearInterval(tipTimer);
        };
    }, []);

    return (
        <div className="report-loading-overlay">
            <div className="report-loading-glow"></div>
            
            <div className="report-loading-card">
                {/* Header with Sparkle Icon */}
                <div className="report-loading-header">
                    <div className="sparkle-circle">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                    </div>
                    <h2>Generating Interview Report</h2>
                    <p className="subtitle">AI is analyzing your profile & generating custom interview questions</p>
                </div>

                {/* Progress Bar */}
                <div className="progress-section">
                    <div className="progress-bar-bg">
                        <div 
                            className="progress-bar-fill" 
                            style={{ width: `${Math.min(progress, 95)}%` }}
                        ></div>
                    </div>
                    <div className="progress-labels">
                        <span>Processing AI insights...</span>
                        <span className="progress-percentage">{Math.min(progress, 95)}%</span>
                    </div>
                </div>

                {/* Step-by-Step Operations Checklist */}
                <div className="operations-list">
                    {STEPS.map((step) => {
                        const isDone = currentStep > step.id;
                        const isActive = currentStep === step.id;
                        const isPending = currentStep < step.id;

                        return (
                            <div 
                                key={step.id} 
                                className={`operation-item ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}
                            >
                                <div className="status-indicator">
                                    {isDone && (
                                        <div className="icon-done">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                    )}
                                    {isActive && <div className="icon-active"><span className="pulse-ring"></span></div>}
                                    {isPending && <div className="icon-pending"></div>}
                                </div>
                                <span className="operation-label">{step.label}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Rotating Interview Tip */}
                <div className="loading-tip-box">
                    <div className="tip-icon">💡</div>
                    <div className="tip-text">{TIPS[tipIndex]}</div>
                </div>
            </div>
        </div>
    );
};

export default ReportGenerationLoading;
