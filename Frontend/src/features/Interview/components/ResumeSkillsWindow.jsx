import React, { useState, useMemo, useRef, useEffect } from 'react';
import '../style/skillsWindow.scss';

/**
 * Clean display string for raw skill names (e.g. "- Languages: C++" -> "C++")
 * Preserves actual skills like "Operating Systems" or "Database" if there is no suffix.
 */
function cleanSkillName(name) {
    if (!name || typeof name !== 'string') return '';
    let cleaned = name.replace(/^[-•*–—\s]+/, '').replace(/[\s\r\n]+/g, ' ').trim();
    
    // Check if it has a category prefix followed by separator and content, e.g. "Languages: C++" or "Languages C++"
    const categoryPrefixRegex = /^(languages?|databases?|operating\s+systems?|tools?|frameworks?|libraries|technologies|skills|competencies)\s*[:\-–—]\s*(.+)$/i;
    const match = cleaned.match(categoryPrefixRegex);
    if (match && match[2] && match[2].trim()) {
        cleaned = match[2].trim();
    }
    return cleaned;
}

/**
 * ResumeSkillsWindow
 * 
 * Side-by-side flex window split into two distinct sub-windows:
 * 1. Current Resume Skills (Capsules: New skills in green #10b981, Retained in blue #3b82f6)
 * 2. Older / Original Resume Skills (Capsules: Retained in blue #3b82f6, Omitted / Not in resume in VIBRANT RED #ef4444)
 * 
 * Features:
 * - Each window has its own '>' icon to open and collapse independently
 * - Color diff: Green (New), Blue (Retained), Red (Not in Current Resume)
 * - Top header with collapse button
 * - Live filter and search bar
 */
export default function ResumeSkillsWindow({
    isOpen = true,
    onToggle,
    olderSkills = [],
    currentSkills = { all: [], newSkills: [], previousSkills: [] },
    stats = {},
    loading = false
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'new' | 'previous' | 'omitted' | 'older'
    
    // Independent collapse/open states for both windows with dropdown button
    const [isCurrentOpen, setIsCurrentOpen] = useState(true);
    const [isOlderOpen, setIsOlderOpen] = useState(true);

    // Dynamic width slider management (resizable edge)
    const [windowWidth, setWindowWidth] = useState(() => {
        try {
            const saved = localStorage.getItem('kivi_skills_window_width');
            return saved ? Math.max(280, Math.min(760, parseInt(saved, 10))) : 420;
        } catch {
            return 420;
        }
    });
    const [isResizing, setIsResizing] = useState(false);
    const asideRef = useRef(null);
    const startPosRef = useRef({ startX: 0, startWidth: 420 });

    const handleMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const currentWidth = asideRef.current 
            ? Math.round(asideRef.current.getBoundingClientRect().width) 
            : windowWidth;

        startPosRef.current = {
            startX: e.clientX,
            startWidth: currentWidth
        };
        setIsResizing(true);
    };

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e) => {
            const delta = e.clientX - startPosRef.current.startX;
            const targetWidth = Math.round(startPosRef.current.startWidth + delta);
            const maxWidth = Math.min(760, Math.floor(window.innerWidth * 0.55));
            const clampedWidth = Math.max(280, Math.min(maxWidth, targetWidth));
            setWindowWidth(clampedWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            setWindowWidth(current => {
                try {
                    localStorage.setItem('kivi_skills_window_width', String(current));
                } catch {}
                return current;
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);

    // Normalize inputs
    const olderList = useMemo(() => {
        return Array.isArray(olderSkills) ? olderSkills : [];
    }, [olderSkills]);

    const allCurrent = useMemo(() => {
        return Array.isArray(currentSkills?.all) ? currentSkills.all : [];
    }, [currentSkills]);

    const newSkillsList = useMemo(() => {
        return Array.isArray(currentSkills?.newSkills) ? currentSkills.newSkills : [];
    }, [currentSkills]);

    const prevSkillsList = useMemo(() => {
        return Array.isArray(currentSkills?.previousSkills) ? currentSkills.previousSkills : [];
    }, [currentSkills]);

    // Map to check which older skills are still retained in the current resume (matches both raw and cleaned)
    const currentSkillsLowerSet = useMemo(() => {
        const set = new Set();
        allCurrent.forEach(sk => {
            const raw = (sk?.name || '').trim().toLowerCase();
            const cleaned = cleanSkillName(sk?.name || '').trim().toLowerCase();
            if (raw) set.add(raw);
            if (cleaned) set.add(cleaned);
        });
        return set;
    }, [allCurrent]);

    // Search filtering
    const cleanSearch = searchTerm.trim().toLowerCase();

    const filteredCurrent = useMemo(() => {
        let list = allCurrent;
        if (activeFilter === 'new') {
            list = newSkillsList;
        } else if (activeFilter === 'previous') {
            list = prevSkillsList;
        }

        if (!cleanSearch) return list;
        return list.filter(item => {
            const raw = (item?.name || '').toLowerCase();
            const clean = cleanSkillName(item?.name || '').toLowerCase();
            return raw.includes(cleanSearch) || clean.includes(cleanSearch);
        });
    }, [allCurrent, newSkillsList, prevSkillsList, activeFilter, cleanSearch]);

    const filteredOlder = useMemo(() => {
        let list = olderList;
        if (activeFilter === 'omitted') {
            list = olderList.filter(sk => {
                const rawLower = String(sk || '').trim().toLowerCase();
                const cleanedLower = cleanSkillName(sk).trim().toLowerCase();
                const isRetained = currentSkillsLowerSet.has(rawLower) || (cleanedLower && currentSkillsLowerSet.has(cleanedLower));
                return !isRetained;
            });
        } else if (activeFilter === 'previous') {
            list = olderList.filter(sk => {
                const rawLower = String(sk || '').trim().toLowerCase();
                const cleanedLower = cleanSkillName(sk).trim().toLowerCase();
                const isRetained = currentSkillsLowerSet.has(rawLower) || (cleanedLower && currentSkillsLowerSet.has(cleanedLower));
                return isRetained;
            });
        }

        if (!cleanSearch) return list;
        return list.filter(sk => {
            const rawLower = String(sk || '').toLowerCase();
            const clean = cleanSkillName(sk).toLowerCase();
            return rawLower.includes(cleanSearch) || clean.includes(cleanSearch);
        });
    }, [olderList, activeFilter, currentSkillsLowerSet, cleanSearch]);

    // Counts
    const newCount = newSkillsList.length;
    const previousCount = prevSkillsList.length;
    const olderCount = olderList.length;
    const totalCurrentCount = allCurrent.length;

    const omittedCount = useMemo(() => {
        return olderList.filter(sk => {
            const rawLower = String(sk || '').trim().toLowerCase();
            const cleanedLower = cleanSkillName(sk).trim().toLowerCase();
            const isRetained = currentSkillsLowerSet.has(rawLower) || (cleanedLower && currentSkillsLowerSet.has(cleanedLower));
            return !isRetained;
        }).length;
    }, [olderList, currentSkillsLowerSet]);

    return (
        <aside 
            ref={asideRef}
            className={`rp-skills-window ${isOpen ? 'open' : 'closed'} ${isResizing ? 'is-resizing' : ''}`}
            style={isOpen ? { 
                width: `${windowWidth}px`, 
                minWidth: `${windowWidth}px`, 
                maxWidth: `${windowWidth}px`,
                flex: `0 0 ${windowWidth}px`
            } : {}}
            aria-label="Resume Skills Comparison"
        >
            {/* ── Toggle Handle / Chevron Trigger (Always accessible on left edge when closed) ── */}
            <button
                type="button"
                className={`skills-docked-toggle-btn ${isOpen ? 'is-open' : 'is-closed'}`}
                onClick={onToggle}
                title={isOpen ? "Collapse Skills Difference Window (<)" : "Open Skills Difference Window (>)"}
                aria-expanded={isOpen}
            >
                <span className="toggle-chevron">&gt;</span>
                {!isOpen && (
                    <span className="toggle-label-vertical">
                        <span className="toggle-dot">●</span>
                        Open Skills Difference {newCount > 0 ? `(+${newCount})` : ''}
                    </span>
                )}
            </button>

            {/* ── Main Skills Window Content (Visible when open) ── */}
            <div className="skills-window-inner">
                {/* ── Top Header ── */}
                <div className="skills-window-header">
                    <div className="header-info">
                        <div className="header-eyebrow">
                            <span className="eyebrow-dot">●</span>
                            <span>SKILLS INTELLIGENCE</span>
                        </div>
                        <h2 className="header-title">Skills Evolution</h2>
                        <p className="header-subtitle">
                            Tracking new additions vs. original uploaded resume
                        </p>
                    </div>

                    <div className="header-controls">
                        <div className="header-filter-dropdown">
                            <select 
                                className="header-filter-select"
                                value={activeFilter}
                                onChange={(e) => setActiveFilter(e.target.value)}
                                title="Filter skills"
                                aria-label="Filter skills"
                            >
                                <option value="all">All Skills</option>
                                <option value="new">New Added (+{newCount})</option>
                                <option value="previous">Retained ({previousCount})</option>
                                <option value="omitted">Not in Resume ({omittedCount})</option>
                                <option value="older">Original Baseline ({olderCount})</option>
                            </select>
                            <span className="select-chevron">▾</span>
                        </div>

                        <button
                            type="button"
                            className="skills-close-btn"
                            onClick={onToggle}
                            title="Collapse Skills Window (<)"
                            aria-label="Collapse Skills Window"
                        >
                            <span className="close-chevron">&lt;</span>
                        </button>
                    </div>
                </div>

                {/* ── Metric Summary Pill Bar ── */}
                <div className="skills-metrics-strip">
                    <div 
                        className={`metric-chip new-metric ${activeFilter === 'new' ? 'active' : ''}`}
                        onClick={() => setActiveFilter(activeFilter === 'new' ? 'all' : 'new')}
                        title="Filter by newly added skills (Green)"
                    >
                        <span className="chip-badge-dot green"></span>
                        <span className="chip-label">New Added</span>
                        <span className="chip-count green">+{newCount}</span>
                    </div>

                    <div 
                        className={`metric-chip prev-metric ${activeFilter === 'previous' ? 'active' : ''}`}
                        onClick={() => setActiveFilter(activeFilter === 'previous' ? 'all' : 'previous')}
                        title="Filter by retained original skills (Blue)"
                    >
                        <span className="chip-badge-dot blue"></span>
                        <span className="chip-label">Retained</span>
                        <span className="chip-count blue">{previousCount}</span>
                    </div>

                    <div 
                        className={`metric-chip omitted-metric ${activeFilter === 'omitted' ? 'active' : ''}`}
                        onClick={() => setActiveFilter(activeFilter === 'omitted' ? 'all' : 'omitted')}
                        title="Filter by skills not in current resume (Red)"
                    >
                        <span className="chip-badge-dot red"></span>
                        <span className="chip-label">Not in Resume</span>
                        <span className="chip-count red">{omittedCount}</span>
                    </div>

                    <div 
                        className={`metric-chip older-metric ${activeFilter === 'older' ? 'active' : ''}`}
                        onClick={() => setActiveFilter(activeFilter === 'older' ? 'all' : 'older')}
                        title="Filter by all original baseline skills"
                    >
                        <span className="chip-badge-dot neutral"></span>
                        <span className="chip-label">Original</span>
                        <span className="chip-count neutral">{olderCount}</span>
                    </div>
                </div>

                {/* ── Search & Filter Input ── */}
                <div className="skills-search-bar">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="skills-search-input"
                        placeholder="Search skills in both windows..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button 
                            type="button" 
                            className="search-clear-btn"
                            onClick={() => setSearchTerm('')}
                            title="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* ── Sub-Windows Split via Flexbox (Two Separate Sections) ── */}
                <div className="skills-subwindows-container">
                    {/* ══════════════════════════════════════════════════════
                        SUB-WINDOW 1: Current Resume Skills (New & Retained)
                       ══════════════════════════════════════════════════════ */}
                    {(activeFilter !== 'older' && activeFilter !== 'omitted') && (
                        <section className="skills-card-subwindow current-window">
                            <div 
                                className="subwindow-header"
                                onClick={() => setIsCurrentOpen(prev => !prev)}
                                title={isCurrentOpen ? "Click to collapse window" : "Click to expand window"}
                            >
                                <div className="subwindow-header-left">
                                    <span className="subwindow-icon">⚡</span>
                                    <div className="subwindow-title-group">
                                        <h3 className="subwindow-title">Current Resume Skills</h3>
                                        <span className="subwindow-counter">
                                            {filteredCurrent.length} of {totalCurrentCount} Skills
                                        </span>
                                    </div>
                                </div>

                                <div className="subwindow-header-right">
                                    <button 
                                        type="button" 
                                        className={`subwindow-dropdown-btn ${isCurrentOpen ? 'is-open' : 'is-closed'}`}
                                        onClick={(e) => { e.stopPropagation(); setIsCurrentOpen(prev => !prev); }}
                                        title={isCurrentOpen ? "Collapse section" : "Expand section"}
                                        aria-label={isCurrentOpen ? "Collapse Current Skills Window" : "Expand Current Skills Window"}
                                    >
                                        <svg className="dropdown-chevron-icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {isCurrentOpen && (
                                <div className="capsules-scroll-area">
                                    {loading ? (
                                        <div className="capsules-loading-state">
                                            <span className="capsules-spinner"></span>
                                            <span>Analyzing resume skills...</span>
                                        </div>
                                    ) : filteredCurrent.length === 0 ? (
                                        <div className="capsules-empty-state">
                                            <span className="empty-icon">🌱</span>
                                            <p>
                                                {searchTerm 
                                                    ? `No current skills match "${searchTerm}"`
                                                    : "No skills detected yet. Type skills in your resume to see them appear live!"}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="capsules-flex-grid">
                                            {filteredCurrent.map((skill, idx) => {
                                                const isNew = Boolean(skill.isNewlyAdded || skill.isNew || skill.color === 'green');
                                                const displayName = cleanSkillName(skill.name);
                                                return (
                                                    <div
                                                        key={`${skill.name}-${idx}`}
                                                        className={`skill-capsule ${isNew ? 'capsule-new' : 'capsule-previous'}`}
                                                        title={isNew ? `"${displayName}" was newly introduced in this resume version` : `"${displayName}" carried over from original resume`}
                                                    >
                                                        <span className={`capsule-indicator-dot ${isNew ? 'green' : 'blue'}`}></span>
                                                        <span className="capsule-text">{displayName || skill.name}</span>
                                                        <span className={`capsule-badge-pill ${isNew ? 'badge-new' : 'badge-prev'}`}>
                                                            {isNew ? '+ New' : 'Retained'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        SUB-WINDOW 2: Older / Original Uploaded Skills
                       ══════════════════════════════════════════════════════ */}
                    {(activeFilter === 'all' || activeFilter === 'older' || activeFilter === 'omitted') && (
                        <section className="skills-card-subwindow older-window">
                            <div 
                                className="subwindow-header"
                                onClick={() => setIsOlderOpen(prev => !prev)}
                                title={isOlderOpen ? "Click to collapse window" : "Click to expand window"}
                            >
                                <div className="subwindow-header-left">
                                    <span className="subwindow-icon">📁</span>
                                    <div className="subwindow-title-group">
                                        <h3 className="subwindow-title">Original Resume Skills</h3>
                                        <span className="subwindow-counter">
                                            {filteredOlder.length} Baseline Skills
                                        </span>
                                    </div>
                                </div>

                                <div className="subwindow-header-right">
                                    <button 
                                        type="button" 
                                        className={`subwindow-dropdown-btn ${isOlderOpen ? 'is-open' : 'is-closed'}`}
                                        onClick={(e) => { e.stopPropagation(); setIsOlderOpen(prev => !prev); }}
                                        title={isOlderOpen ? "Collapse section" : "Expand section"}
                                        aria-label={isOlderOpen ? "Collapse Original Skills Window" : "Expand Original Skills Window"}
                                    >
                                        <svg className="dropdown-chevron-icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {isOlderOpen && (
                                <div className="capsules-scroll-area">
                                    {loading ? (
                                        <div className="capsules-loading-state">
                                            <span className="capsules-spinner"></span>
                                            <span>Loading original skills...</span>
                                        </div>
                                    ) : filteredOlder.length === 0 ? (
                                        <div className="capsules-empty-state">
                                            <span className="empty-icon">📄</span>
                                            <p>No original skills found matching this filter.</p>
                                        </div>
                                    ) : (
                                        <div className="capsules-flex-grid">
                                            {filteredOlder.map((rawSkillName, idx) => {
                                                const rawLower = String(rawSkillName || '').trim().toLowerCase();
                                                const skillName = cleanSkillName(rawSkillName);
                                                const cleanedLower = skillName.trim().toLowerCase();
                                                const isRetained = currentSkillsLowerSet.has(rawLower) || (cleanedLower && currentSkillsLowerSet.has(cleanedLower));
                                                return (
                                                    <div
                                                        key={`${rawSkillName}-${idx}`}
                                                        className={`skill-capsule capsule-older ${isRetained ? 'capsule-retained is-retained' : 'capsule-omitted is-omitted'}`}
                                                        title={isRetained 
                                                            ? `"${skillName || rawSkillName}" is active in the current resume (Retained)` 
                                                            : `"${skillName || rawSkillName}" is NOT in the current resume (Omitted)`}
                                                    >
                                                        <span className={`capsule-indicator-dot ${isRetained ? 'blue' : 'red'}`}></span>
                                                        <span className="capsule-text">{skillName || rawSkillName}</span>
                                                        <span className={`capsule-badge-pill ${isRetained ? 'badge-kept' : 'badge-omitted'}`}>
                                                            {isRetained ? '✓ In Resume' : 'Not in Resume'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* ── Footer Status Bar ── */}
                <div className="skills-window-footer">
                    <span className="footer-status-text">
                        Runtime extraction syncs automatically with edits
                    </span>
                    <span className="footer-version-tag">KIVI AI Diff Engine</span>
                </div>
            </div>

            {/* ── Slider Edge (Draggable right border to resize width) ── */}
            {isOpen && (
                <div 
                    className={`skills-window-slider-edge ${isResizing ? 'active' : ''}`}
                    onMouseDown={handleMouseDown}
                    onDoubleClick={() => setWindowWidth(460)}
                    title="Drag slider edge to manage width (Double-click to reset)"
                    role="separator"
                    aria-orientation="vertical"
                >
                    <div className="slider-handle-bar">
                        <span className="slider-grip-dot"></span>
                        <span className="slider-grip-dot"></span>
                        <span className="slider-grip-dot"></span>
                    </div>
                </div>
            )}
        </aside>
    );
}
