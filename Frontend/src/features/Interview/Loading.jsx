import React, { useState, useEffect } from "react";
import "./loading.scss";

const DEFAULT_STEPS = [
    { id: 1, label: "Analyzing profile & technical skills" },
    { id: 2, label: "Matching target job requirements" },
    { id: 3, label: "Structuring ATS-compliant sections" },
    { id: 4, label: "Polishing typography & design formatting" }
];

const Loading = ({ 
    steps = DEFAULT_STEPS, 
    title = "Resume Studio", 
    subtitle = "Drafting your document using AI...",
    inline = false 
}) => {
    const [currentStep, setCurrentStep] = useState(1);

    useEffect(() => {
        setCurrentStep(1);
        const interval = setInterval(() => {
            setCurrentStep((prev) => (prev < steps.length ? prev + 1 : prev));
        }, 1800);

        return () => clearInterval(interval);
    }, [steps]);

    return (
        <div className={`loading-page ${inline ? "is-inline" : ""}`}>
            <div className="bg-glow"></div>

            <div className="loader-card">
                <div className="loader-header">
                    <span className="eyebrow">✦ AI Processing</span>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>

                <div className="operations-list">
                    {steps.map((step, idx) => {
                        const stepNum = idx + 1;
                        const isDone = stepNum < currentStep;
                        const isActive = stepNum === currentStep;

                        return (
                            <div
                                key={step.id || idx}
                                className={`op-step ${isDone ? "is-done" : ""} ${isActive ? "is-active" : ""} ${stepNum > currentStep ? "is-pending" : ""}`}
                            >
                                <div className="op-icon">
                                    {isDone && <span className="icon-done">✓</span>}
                                    {isActive && <span className="icon-active" />}
                                    {stepNum > currentStep && <span className="icon-pending" />}
                                </div>
                                <span className="op-label">{step.label}</span>
                            </div>
                        );
                    })}
                </div>

                <div className="loading-bar">
                    <div className="progress"></div>
                </div>
            </div>
        </div>
    );
};

export default Loading;