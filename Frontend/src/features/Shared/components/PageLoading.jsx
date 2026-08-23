import React from 'react';
import './PageLoading.scss';

const PageLoading = ({
    title = "Loading Dashboard...",
    subtitle = "Preparing your workspace and syncing latest analytics...",
    inline = false,
    badge = "✦ Kivi AI Workspace"
}) => {
    return (
        <div className={`normal-loading-page ${inline ? "is-inline" : ""}`}>
            <div className="bg-glow-orb bg-glow-orb-1" />
            <div className="bg-glow-orb bg-glow-orb-2" />

            <div className="normal-loader-card">
                <div className="loader-badge">
                    <span className="badge-dot" />
                    <span className="badge-text">{badge}</span>
                </div>

                <div className="orbital-spinner-container">
                    <div className="orbital-ring ring-outer" />
                    <div className="orbital-ring ring-inner" />
                    <div className="orbital-core">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                    </div>
                </div>

                <div className="loader-text-group">
                    <h2 className="loader-title">{title}</h2>
                    <p className="loader-subtitle">{subtitle}</p>
                </div>

                <div className="shimmer-bar-container">
                    <div className="shimmer-bar" />
                </div>
            </div>
        </div>
    );
};

export default PageLoading;
