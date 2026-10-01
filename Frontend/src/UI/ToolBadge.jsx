import React from 'react';
import { ToolSymbol } from './ToolSymbol';
import './ToolSymbols.scss';

/**
 * Tool Badge Component
 * Renders an interactive pill for active tool calls with animated loading shimmer & query previews.
 * 
 * @param {Object} props
 * @param {'web'|'leetcode'|'video'|'github'|'docs'|'resume'|'roadmap'} props.type - Tool category
 * @param {string} [props.label] - Display name (e.g. "Google Search", "LeetCode DSA")
 * @param {string} [props.query] - Optional query string preview
 * @param {boolean} [props.isLoading=false] - Whether tool is currently fetching
 * @param {Function} [props.onClick] - Click handler
 * @param {string} [props.className] - Additional classes
 */
export function ToolBadge({ 
    type = 'web', 
    label = '', 
    query = '', 
    isLoading = false, 
    onClick = null, 
    className = '' 
}) {
    const defaultLabels = {
        web: 'Live Web',
        leetcode: 'LeetCode',
        video: 'YouTube',
        github: 'GitHub',
        docs: 'Official Docs',
        resume: 'Resume Context',
        roadmap: 'Roadmap'
    };

    const displayLabel = label || defaultLabels[type] || type;

    return (
        <span 
            className={`kivi-tool-badge theme-${type} ${isLoading ? 'is-loading' : ''} ${className}`}
            onClick={onClick}
            title={query ? `${displayLabel}: "${query}"` : displayLabel}
            role={onClick ? 'button' : 'status'}
        >
            <ToolSymbol type={type} size="xs" />
            <span className="badge-name">{displayLabel}</span>
            {query && <span className="badge-query">· {query}</span>}
        </span>
    );
}

export default ToolBadge;
