import React from 'react';
import './ShimmerLoading.scss';

const ShimmerLoading = ({ type = "resume", title = "Loading Resume Studio..." }) => {
    return (
        <div className={`shimmer-loading-container ${type === 'questions' || type === 'interview' || type === 'technical' ? 'shimmer-questions-view' : ''}`}>
            {/* Top Workspace Header Bar (Only for Resume/Doc views) */}
            {type === "resume" && (
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
            )}

            {/* Technical Questions & Interview Tab Shimmer Layout */}
            {(type === "questions" || type === "interview" || type === "technical") && (
                <div className="shimmer-questions-layout">
                    {/* Top Collapsible Context Panel Skeleton */}
                    <div className="shimmer-context-panel">
                        <div className="shimmer-context-left">
                            <div className="shimmer-box shimmer-context-eyebrow" />
                            <div className="shimmer-box shimmer-context-title" />
                        </div>
                        <div className="shimmer-context-right">
                            <div className="shimmer-box shimmer-score-badge" />
                            <div className="shimmer-box shimmer-chevron" />
                        </div>
                    </div>

                    {/* Tab Navigation Pill Bar Skeleton */}
                    <div className="shimmer-tabs-bar">
                        <div className="shimmer-box shimmer-tab-btn active" />
                        <div className="shimmer-box shimmer-tab-btn" />
                        <div className="shimmer-box shimmer-tab-btn" />
                    </div>

                    {/* Premium Header Banner Skeleton */}
                    <div className="shimmer-questions-banner">
                        <div className="shimmer-banner-text">
                            <div className="shimmer-box shimmer-back-link" />
                            <div className="shimmer-box shimmer-banner-title" />
                            <div className="shimmer-box shimmer-banner-desc" />
                        </div>
                        <div className="shimmer-banner-icon-box">
                            <span className="code-icon-tag">&lt;/&gt;</span>
                        </div>
                    </div>

                    {/* Filter & Search Bar Skeleton */}
                    <div className="shimmer-filter-bar">
                        <div className="shimmer-pills-row">
                            <div className="shimmer-box shimmer-topic-pill active" style={{ width: '110px' }} />
                            <div className="shimmer-box shimmer-topic-pill" style={{ width: '120px' }} />
                            <div className="shimmer-box shimmer-topic-pill" style={{ width: '90px' }} />
                            <div className="shimmer-box shimmer-topic-pill" style={{ width: '135px' }} />
                        </div>
                        <div className="shimmer-search-row">
                            <div className="shimmer-box shimmer-search-input" />
                            <div className="shimmer-box shimmer-filter-btn" />
                        </div>
                    </div>

                    {/* Accordion Questions Rows Skeleton (5 Rows) */}
                    <div className="shimmer-questions-list">
                        {[
                            { width: '84%', num: 1 },
                            { width: '92%', num: 2 },
                            { width: '78%', num: 3 },
                            { width: '89%', num: 4 },
                            { width: '74%', num: 5 }
                        ].map((item, idx) => (
                            <div key={idx} className="shimmer-question-row-card">
                                <div className="shimmer-row-left">
                                    <div className="shimmer-index-badge">{item.num}</div>
                                    <div className="shimmer-box shimmer-question-title" style={{ width: item.width }} />
                                </div>
                                <div className="shimmer-row-right">
                                    <span className="shimmer-expand-plus">+</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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

