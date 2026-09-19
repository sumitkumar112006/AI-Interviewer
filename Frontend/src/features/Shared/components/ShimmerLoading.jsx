import React from 'react';
import './ShimmerLoading.scss';

const ShimmerLoading = ({ type = "resume", title = "Loading Resume Studio..." }) => {
    return (
        <div className="shimmer-loading-container">
            {/* Top Workspace Header Bar */}
            <div className="shimmer-header-bar">
                <div className="shimmer-header-left">
                    <div className="shimmer-box shimmer-eyebrow" />
                    <div className="shimmer-box shimmer-title" />
                </div>
                <div className="shimmer-actions">
                    <div className="shimmer-box shimmer-btn ghost" />
                    <div className="shimmer-box shimmer-btn" />
                    <div className="shimmer-box shimmer-btn" />
                    <div className="shimmer-box shimmer-btn primary" />
                </div>
            </div>

            {/* Single A4 Resume Sheet Preview Layout (Default & Document) */}
            {(type === "resume" || type === "workspace") && (
                <div className="shimmer-a4-workspace">
                    <div className="shimmer-a4-sheet">
                        {/* Header: Candidate Name, Title, Contact Row */}
                        <div className="shimmer-resume-header">
                            <div className="shimmer-box shimmer-name" />
                            <div className="shimmer-box shimmer-candidate-title" />
                            <div className="shimmer-contact-row">
                                <div className="shimmer-box shimmer-contact-pill" />
                                <div className="shimmer-box shimmer-contact-pill" />
                                <div className="shimmer-box shimmer-contact-pill" />
                                <div className="shimmer-box shimmer-contact-pill" />
                            </div>
                        </div>

                        <div className="shimmer-doc-divider" />

                        {/* Professional Summary */}
                        <div className="shimmer-resume-section">
                            <div className="shimmer-box shimmer-section-heading" />
                            <div className="shimmer-text-group">
                                <div className="shimmer-box shimmer-line full" />
                                <div className="shimmer-box shimmer-line full" />
                                <div className="shimmer-box shimmer-line medium" />
                            </div>
                        </div>

                        {/* Work Experience */}
                        <div className="shimmer-resume-section">
                            <div className="shimmer-box shimmer-section-heading" />
                            
                            {/* Role 1 */}
                            <div className="shimmer-exp-block">
                                <div className="shimmer-exp-top">
                                    <div className="shimmer-box shimmer-role-name" />
                                    <div className="shimmer-box shimmer-date-range" />
                                </div>
                                <div className="shimmer-box shimmer-company-name" />
                                <div className="shimmer-bullets-list">
                                    <div className="shimmer-bullet-item">
                                        <span className="shimmer-bullet-dot" />
                                        <div className="shimmer-box shimmer-line full" />
                                    </div>
                                    <div className="shimmer-bullet-item">
                                        <span className="shimmer-bullet-dot" />
                                        <div className="shimmer-box shimmer-line full" />
                                    </div>
                                    <div className="shimmer-bullet-item">
                                        <span className="shimmer-bullet-dot" />
                                        <div className="shimmer-box shimmer-line medium" />
                                    </div>
                                </div>
                            </div>

                            {/* Role 2 */}
                            <div className="shimmer-exp-block">
                                <div className="shimmer-exp-top">
                                    <div className="shimmer-box shimmer-role-name" />
                                    <div className="shimmer-box shimmer-date-range" />
                                </div>
                                <div className="shimmer-box shimmer-company-name" />
                                <div className="shimmer-bullets-list">
                                    <div className="shimmer-bullet-item">
                                        <span className="shimmer-bullet-dot" />
                                        <div className="shimmer-box shimmer-line full" />
                                    </div>
                                    <div className="shimmer-bullet-item">
                                        <span className="shimmer-bullet-dot" />
                                        <div className="shimmer-box shimmer-line short" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Technical Skills */}
                        <div className="shimmer-resume-section">
                            <div className="shimmer-box shimmer-section-heading" />
                            <div className="shimmer-skills-grid">
                                <div className="shimmer-box shimmer-skill-tag" />
                                <div className="shimmer-box shimmer-skill-tag" />
                                <div className="shimmer-box shimmer-skill-tag" />
                                <div className="shimmer-box shimmer-skill-tag" />
                                <div className="shimmer-box shimmer-skill-tag" />
                                <div className="shimmer-box shimmer-skill-tag" />
                                <div className="shimmer-box shimmer-skill-tag" />
                                <div className="shimmer-box shimmer-skill-tag" />
                            </div>
                        </div>

                        {/* Education & Certifications */}
                        <div className="shimmer-resume-section">
                            <div className="shimmer-box shimmer-section-heading" />
                            <div className="shimmer-exp-top">
                                <div className="shimmer-box shimmer-role-name" />
                                <div className="shimmer-box shimmer-date-range" />
                            </div>
                            <div className="shimmer-box shimmer-company-name" />
                        </div>
                    </div>
                </div>
            )}

            {/* Dashboard / Analytics Layout */}
            {type === "dashboard" && (
                <div className="shimmer-dashboard-layout">
                    <div className="shimmer-cards-grid">
                        <div className="shimmer-box shimmer-card" />
                        <div className="shimmer-box shimmer-card" />
                        <div className="shimmer-box shimmer-card" />
                    </div>
                    <div className="shimmer-box shimmer-table" />
                </div>
            )}
        </div>
    );
};

export default ShimmerLoading;

