import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ToolSymbol } from './ToolSymbol';
import './ToolSymbols.scss';

/**
 * Tool Resource Card Component
 * Renders verified external resources (GitHub repos, LeetCode problems, YouTube tutorials, Web pages)
 * with verified badging and hover elevation.
 * 
 * @param {Object} props
 * @param {string} props.title - Resource title
 * @param {string} props.url - Verified external URL
 * @param {string} [props.snippet] - Brief summary or topic snippet
 * @param {'web'|'leetcode'|'video'|'github'|'docs'} [props.type='web'] - Resource type
 * @param {string} [props.className] - Additional classes
 */
export function ToolResourceCard({ 
    title, 
    url, 
    snippet = '', 
    type = 'web', 
    className = '' 
}) {
    if (!url) return null;

    // Infer type from URL if not explicitly supplied
    let detectedType = type;
    if (url.includes('leetcode.com')) detectedType = 'leetcode';
    else if (url.includes('youtube.com') || url.includes('youtu.be')) detectedType = 'video';
    else if (url.includes('github.com')) detectedType = 'github';
    else if (url.includes('developer.mozilla.org') || url.includes('docs.') || url.includes('react.dev')) detectedType = 'docs';

    return (
        <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className={`kivi-tool-resource-card theme-${detectedType} ${className}`}
        >
            <div className="card-symbol-wrap">
                <ToolSymbol type={detectedType} size="sm" />
            </div>
            
            <div className="card-content">
                <div className="card-title">
                    <span>{title || url}</span>
                </div>
                {snippet && <p className="card-snippet">{snippet}</p>}
            </div>

            <ExternalLink size={14} className="card-external-icon" />
        </a>
    );
}

export default ToolResourceCard;
