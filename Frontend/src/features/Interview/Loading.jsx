import React from "react";
import "./loading.scss";

const Loading = () => {
    return (
        <div className="loading-page">
            <div className="bg-glow"></div>

            <div className="loader-container">
                <div className="spinner"></div>

                <h1>Resume Builder</h1>

                <p>Crafting your professional story...</p>

                <div className="loading-bar">
                    <div className="progress"></div>
                </div>

                <div className="shimmer-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '24px auto', alignItems: 'center' }}>
                    <div className="shimmer" style={{ gap: '12px', justifyContent: 'center', width: '100%' }}>
                        <div className="shimmer-checkbox"></div>
                        <div className="shimmer-text"></div>
                    </div>
                    <div className="shimmer" style={{ gap: '12px', justifyContent: 'center', width: '100%' }}>
                        <div className="shimmer-checkbox"></div>
                        <div className="shimmer-text" style={{ width: '60%' }}></div>
                    </div>
                </div>

                <div className="badges">
                    <span>PDF</span>
                    <span>DOCX</span>
                    <span>ATS Friendly</span>
                </div>
            </div>
        </div>
    );
};

export default Loading;