import React from 'react';
import './ShimmerLoading.scss';

const ShimmerLoading = ({ type = "workspace", title = "Loading content..." }) => {
    return (
        <div className="shimmer-loading-container">
            <div className="shimmer-header-bar">
                <div className="shimmer-box shimmer-title" />
                <div className="shimmer-actions">
                    <div className="shimmer-box shimmer-btn" />
                    <div className="shimmer-box shimmer-btn" />
                </div>
            </div>

            {type === "workspace" && (
                <div className="shimmer-workspace-layout">
                    <div className="shimmer-panel shimmer-side-panel">
                        <div className="shimmer-box shimmer-head" />
                        <div className="shimmer-box shimmer-line short" />
                        <div className="shimmer-box shimmer-line medium" />
                        <div className="shimmer-box shimmer-input" />
                        <div className="shimmer-box shimmer-input" />
                        <div className="shimmer-box shimmer-button" />
                    </div>
                    <div className="shimmer-panel shimmer-main-panel">
                        <div className="shimmer-box shimmer-doc-header" />
                        <div className="shimmer-box shimmer-line full" />
                        <div className="shimmer-box shimmer-line full" />
                        <div className="shimmer-box shimmer-line medium" />
                        <div className="shimmer-box shimmer-block" />
                        <div className="shimmer-box shimmer-line full" />
                        <div className="shimmer-box shimmer-line short" />
                    </div>
                </div>
            )}

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
