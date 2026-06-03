import React from "react";
import "./Loading.scss";

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