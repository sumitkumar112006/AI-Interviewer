import React from 'react';
import { Orb } from '@yogesharc/thinking-orbs';
import { ToolBadge } from './ToolBadge';
import './ToolSymbols.scss';

/**
 * Multi-Tool Status Strip Component
 * Displays real-time parallel execution of multiple AI assistant tools with animated Thinking Orbs.
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

    const hasSearch = activeTools.some(t => t.tool === 'web' || t.tool === 'docs' || t.tool === 'github');
    const orbState = hasSearch ? 'searching' : 'reasoning';
    const orbVariant = hasSearch ? 'lighthouse' : 'twins';

    return (
        <div className={`kivi-multitool-status-strip ${className}`} role="status">
            <div className="strip-header">
                <Orb 
                    state={orbState} 
                    variant={orbVariant} 
                    size={16} 
                    className={`strip-header-orb ${orbState}`} 
                />
                <span>{statusMessage || (hasSearch ? 'Searching...' : 'Planning...')}</span>
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
