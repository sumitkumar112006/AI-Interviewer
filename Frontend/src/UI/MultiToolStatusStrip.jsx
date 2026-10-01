import React from 'react';
import { ToolBadge } from './ToolBadge';
import './ToolSymbols.scss';

/**
 * Multi-Tool Status Strip Component
 * Displays real-time parallel execution of multiple AI assistant tools.
 * 
 * @param {Object} props
 * @param {Array<{tool: string, query?: string, label?: string}>} props.activeTools - Currently running tools
 * @param {string} [props.statusMessage] - Custom status message
 * @param {string} [props.className] - Additional classes
 */
export function MultiToolStatusStrip({ 
    activeTools = [], 
    statusMessage = '', 
    className = '' 
}) {
    if (!activeTools || activeTools.length === 0) return null;

    return (
        <div className={`kivi-multitool-status-strip ${className}`} role="status">
            <div className="strip-header">
                <span className="live-pulse-dot" />
                <span>{statusMessage || 'Executing Parallel AI Tools'}</span>
            </div>

            <div className="strip-tools-list">
                {activeTools.map((toolItem, idx) => (
                    <ToolBadge
                        key={`${toolItem.tool}-${idx}`}
                        type={toolItem.tool}
                        label={toolItem.label}
                        query={toolItem.query}
                        isLoading={true}
                    />
                ))}
            </div>
        </div>
    );
}

export default MultiToolStatusStrip;
