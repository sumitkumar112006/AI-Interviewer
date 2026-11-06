import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useAuth } from "./Auth/hooks/useAuth";
import { useInterview } from "./Interview/hooks/useInterview";
import { getAiModelInfo } from "./Interview/services/interview.api";
import { KiviAiAssistant } from "./Shared/components/KiviAiAssistant";
import NotificationBell from "./Shared/components/NotificationBell";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { Zap, Bot, User, HelpCircle, LogOut, ChevronDown } from "lucide-react";
import Footer from "./Footer/components/Footer";
import UserCreditsPopup from "../components/userCreditsPopup";
import ConfirmModal from "./Shared/components/ConfirmModal";
import { useSidebarReports } from "./Interview/hooks/useSidebarReports";
import "./layout.scss";


function extractObjectId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '$oid' in value) return String(value.$oid ?? '').trim();
  return String(value).trim();
}

function extractDateValue(value) {
  if (!value) return '';
  if (typeof value === 'string' || value instanceof Date) return value;
  if (typeof value === 'object' && '$date' in value) return value.$date;
  return value;
}

function formatDate(value) {
  if (!value) return '';
  const normalizedValue = extractDateValue(value);
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short'
  }).format(date);
}

function getMatchScoreColor(score) {
  if (!score) return '#6b7fa8';
  const num = parseInt(String(score).replace('%', ''));
  if (num >= 85) return '#22c55e';
  if (num >= 70) return '#f59e0b';
  return '#ef4444';
}

function getReportTitle(reportItem) {
  return (reportItem?.developerTitle || reportItem?.Title || reportItem?.title || 'Untitled Report').trim();
}

const Layout = ({ children }) => {
  const { user, usage, fetchUsage, handleLogout } = useAuth();
  const { reports, deleteReport, setReport, report } = useInterview();

  // Dynamic server-side pagination & infinite scroll for recent reports
  const {
    reports: sidebarReports,
    totalCount: totalReportsCount,
    totalMatching,
    hasMore,
    isLoadingInitial,
    isLoadingMore,
    error: reportsError,
    searchQuery: sidebarSearchQuery,
    setSearchQuery: setSidebarSearchQuery,
    loadMore,
    retry,
    prependReport,
    removeReport
  } = useSidebarReports();

  const observerTargetRef = useRef(null);
  const listContainerRef = useRef(null);

  // IntersectionObserver to auto-fetch next 10 reports when scrolling near bottom
  useEffect(() => {
    const sentinel = observerTargetRef.current;
    const container = listContainerRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingInitial && !isLoadingMore) {
          loadMore();
        }
      },
      {
        root: container || null,
        rootMargin: '140px 0px 140px 0px',
        threshold: 0.01
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingInitial, isLoadingMore, loadMore]);

  // Robust scroll listeners: handles both container and sidebar scrolling
  const handleListScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      if (!el || isLoadingInitial || isLoadingMore || !hasMore) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 140) {
        loadMore();
      }
    },
    [isLoadingInitial, isLoadingMore, hasMore, loadMore]
  );

  const handleSidebarScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      if (!el || isLoadingInitial || isLoadingMore || !hasMore) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
        loadMore();
      }
    },
    [isLoadingInitial, isLoadingMore, hasMore, loadMore]
  );

  // Keep newly created active report prepended
  const prevReportIdRef = useRef(null);
  useEffect(() => {
    const currentId = extractObjectId(report?._id || report?.id);
    if (currentId && currentId !== prevReportIdRef.current) {
      prevReportIdRef.current = currentId;
      prependReport(report);
    }
  }, [report, prependReport]);

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    interviewId: null,
    title: '',
    loading: false
  });
  const [hoveredReport, setHoveredReport] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const hoverTimeoutRef = useRef(null);

  const handleOpenReport = (reportItem) => {
    const rId = extractObjectId(reportItem?._id || reportItem?.id || reportItem?.interviewId);
    if (!rId) return;

    if (setReport) {
      setReport(reportItem);
    }

    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredReport(null);
    setHoverPos(null);

    const currentPath = location.pathname;
    if (currentPath.startsWith('/interview/')) {
      navigate(`/interview/${rId}`);
    } else if (currentPath.startsWith('/cover-letter/')) {
      navigate(`/cover-letter/${rId}`);
    } else {
      navigate(`/resume/${rId}`);
    }

    setIsSidebarOpen(false);
  };

  const handleReportMouseEnter = (report, event) => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    const rect = event.currentTarget.getBoundingClientRect();
    const popoverHeight = 160;
    let top = rect.top;
    if (top + popoverHeight > window.innerHeight) {
      top = Math.max(16, window.innerHeight - popoverHeight - 16);
    }
    setHoverPos({ top, left: rect.right + 10 });
    setHoveredReport(report);
  };

  const handleReportMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredReport(null);
      setHoverPos(null);
    }, 70);
  };

  const handleDeleteSidebarReport = (interviewId, title) => {
    setDeleteModal({
      isOpen: true,
      interviewId,
      title: title || 'Interview Report',
      loading: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.interviewId) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      if (deleteReport) {
        await deleteReport(deleteModal.interviewId);
      }
      const deletedId = deleteModal.interviewId;
      removeReport(deletedId);
      setDeleteModal({ isOpen: false, interviewId: null, title: '', loading: false });
      if (activeReportId === deletedId) {
        navigate('/');
      }
    } catch (err) {
      console.error('Delete sidebar report error:', err);
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Click outside to close user profile dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  // Sidebar Width Drag & Resize
  const DEFAULT_SIDEBAR_WIDTH = 260;
  const MIN_SIDEBAR_WIDTH = 200;
  const MAX_SIDEBAR_WIDTH = 480;

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kivi_sidebar_width");
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
        return parsed;
      }
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setIsResizing(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, []);

  const resetSidebarWidth = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    if (typeof window !== "undefined") {
      localStorage.setItem("kivi_sidebar_width", String(DEFAULT_SIDEBAR_WIDTH));
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;
      const clampedWidth = Math.min(Math.max(e.clientX, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setSidebarWidth((current) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("kivi_sidebar_width", String(current));
        }
        return current;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kivi_theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('kivi_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Lock background scroll when mobile sidebar drawer is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isSidebarOpen]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [aiModelInfo, setAiModelInfo] = useState({
    label: "GPT-OSS 120B · Groq AI",
    fallbackModel: "Gemini 2.5 Flash"
  });

  useEffect(() => {
    let isMounted = true;
    const fetchInfo = () => {
      getAiModelInfo().then(data => {
        if (isMounted && data?.label) {
          setAiModelInfo(data);
        }
      });
    };
    fetchInfo();
    const interval = setInterval(fetchInfo, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (fetchUsage) {
      void fetchUsage();
    }
  }, [location.pathname, fetchUsage]);

  const onlogout = async () => {
    await handleLogout();
    navigate("/landing");
  };

  const recentReportId = sidebarReports && sidebarReports.length > 0
    ? extractObjectId(sidebarReports[0]._id || sidebarReports[0].id)
    : (reports && reports.length > 0 ? extractObjectId(reports[0]._id || reports[0].id) : null);

  // Determine active item and breadcrumb based on current pathname
  const path = location.pathname;
  let activeMenu = "dashboard";
  let breadcrumb = "Dashboard";

  const showSubTabs = path.startsWith("/interview/") || path.startsWith("/resume/") || path.startsWith("/cover-letter/");

  // Extract active report ID from path or query parameters, fallback to recentReportId
  let activeReportId = recentReportId;
  const match = path.match(/\/(interview|resume|cover-letter)\/([^/]+)/);
  if (match && match[2]) {
    activeReportId = match[2];
  } else {
    const params = new URLSearchParams(location.search);
    const reportIdParam = params.get("reportId");
    if (reportIdParam) {
      activeReportId = reportIdParam;
    }
  }

  const showInterviewPrep = path.startsWith("/interview/") || path.startsWith("/resume/") || path.startsWith("/cover-letter/");

  const showResumeAndCoverLetter = path.startsWith("/resume/") || path.startsWith("/cover-letter/");

  // Navigation options for Interview, Resume, and Cover Letter views
  const navOptions = useMemo(() => [
    {
      id: 'resume',
      label: 'Generate Resume',
      desc: 'Tailored ATS-optimized resume',
      target: activeReportId ? `/resume/${activeReportId}` : '/',
      match: (p) => p.startsWith('/resume/'),
      icon: '/resume.png'
    },
    {
      id: 'plan',
      label: 'Preparation Plan',
      desc: 'Interview questions & AI analysis',
      target: activeReportId ? `/interview/${activeReportId}` : '/',
      match: (p) => p.startsWith('/interview/'),
      icon: '/report.png'
    },
    {
      id: 'cover',
      label: 'Cover Letter Builder',
      desc: 'Role-aligned custom cover letter',
      target: activeReportId ? `/cover-letter/${activeReportId}` : '/',
      match: (p) => p.startsWith('/cover-letter/'),
      icon: '/cv.png'
    }
  ], [activeReportId]);

  const currentNavOption = useMemo(() => {
    return navOptions.find(o => o.match(path)) || navOptions[0];
  }, [navOptions, path]);

  const [navDropdownOpen, setNavDropdownOpen] = useState(false);
  const navDropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (navDropdownRef.current && !navDropdownRef.current.contains(e.target)) {
        setNavDropdownOpen(false);
      }
    };
    if (navDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [navDropdownOpen]);

  useEffect(() => {
    setNavDropdownOpen(false);
  }, [location.pathname]);

  if (path === "/" || path === "") {
    activeMenu = "dashboard";
    breadcrumb = "Dashboard";
  } else if (path.startsWith("/interview/")) {
    activeMenu = "interview-prep";
    breadcrumb = "Interview Prep > Technical Questions";
  } else if (path.startsWith("/resume/")) {
    activeMenu = "cv-generator";
    breadcrumb = "CV Generator > Resume Studio";
  } else if (path.startsWith("/cover-letter/")) {
    activeMenu = "cover-letter-builder";
    breadcrumb = "CV Generator > Cover Letter Builder";
  } else if (path === "/reports") {
    activeMenu = "analytics";
    breadcrumb = "Dashboard > View Analytics";
  } else if (path === "/pricing") {
    activeMenu = "pricing";
    breadcrumb = "Subscription > Pricing & Plans";
  } else if (path === "/profile") {
    activeMenu = "profile";
    breadcrumb = "Account > Profile";
  } else if (path === "/privacy-policy") {
    activeMenu = "privacy-policy";
    breadcrumb = "Legal > Privacy Policy";
  } else if (path === "/terms-of-service") {
    activeMenu = "terms-of-service";
    breadcrumb = "Legal > Terms of Service";
  } else if (path === "/contact-us") {
    activeMenu = "contact-us";
    breadcrumb = "Support > Contact Us";
  } else if (path === "/help-support") {
    activeMenu = "help-support";
    breadcrumb = "Support > Help & Support Center";
  } else if (path === "/about-us") {
    activeMenu = "about-us";
    breadcrumb = "Company > About KIVI-AI";
  } else if (path.startsWith("/coming-soon")) {
    const params = new URLSearchParams(location.search);
    const feature = params.get("feature") || "feature";
    activeMenu = feature;
    breadcrumb = `Feature > ${feature.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`;
  }

  return (
    <div
      className={`app-shell ${theme === 'light' ? 'light-theme' : 'dark-theme'}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` }}
    >
      {/* Sidebar Backdrop Overlay on Mobile */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* LEFT SIDEBAR */}
      <aside className={`app-sidebar ${isSidebarOpen ? "open" : ""}`} onScroll={handleSidebarScroll}>
        {/* Close button for Mobile drawer view */}
        <button 
          type="button" 
          className="sidebar-close-btn" 
          onClick={() => setIsSidebarOpen(false)}
          title="Close Menu"
        >
          ✕
        </button>

        <Link to="/" className="sidebar-brand" onClick={() => setIsSidebarOpen(false)}>
          <img src="/Logo.png" alt="KIVI-AI Logo" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">KIVI-AI</span>
            <span className="sidebar-brand-sub">Interview Intelligence</span>
          </div>
        </Link>

        <div className="sidebar-section">
          <p className="sidebar-section-title">MAIN MENU</p>
          <nav className="sidebar-nav">
            <Link to="/" className={`sidebar-link ${activeMenu === "dashboard" ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)}>
              <svg className="sidebar-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" />
                <rect x="14" y="3" width="7" height="5" />
                <rect x="14" y="12" width="7" height="9" />
                <rect x="3" y="16" width="7" height="5" />
              </svg>
              <span>Dashboard</span>
            </Link>

            <Link to="/reports" className={`sidebar-link ${activeMenu === "analytics" ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)}>
              <svg className="sidebar-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span>View Analytics</span>
            </Link>

            <Link to="/coming-soon?feature=find-jobs" className={`sidebar-link ${activeMenu === "find-jobs" ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)}>
              <svg className="sidebar-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Find Jobs</span>
            </Link>
          </nav>
        </div>

        {/* RECENT REPORTS SECTION */}
        <div className="sidebar-section sidebar-recent-section">
          <div className="sidebar-section-header">
            <p className="sidebar-section-title">RECENT REPORTS</p>
            {totalReportsCount > 0 && (
              <span className="sidebar-reports-count">{totalReportsCount}</span>
            )}
          </div>

          {(totalReportsCount > 3 || sidebarSearchQuery) && (
            <div className="sidebar-search-box">
              <svg className="sidebar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search reports..."
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                className="sidebar-search-input"
              />
              {sidebarSearchQuery && (
                <button
                  type="button"
                  className="sidebar-search-clear"
                  onClick={() => setSidebarSearchQuery('')}
                  title="Clear search"
                >
                  &times;
                </button>
              )}
            </div>
          )}

          <div className="sidebar-reports-list" ref={listContainerRef} onScroll={handleListScroll}>
            {isLoadingInitial ? (
              <div className="sidebar-reports-skeleton-list">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div key={idx} className="sidebar-report-skeleton">
                    <div className="skeleton-icon" />
                    <div className="skeleton-text">
                      <div className="skeleton-line-title" />
                      <div className="skeleton-line-date" />
                    </div>
                    <div className="skeleton-pill" />
                  </div>
                ))}
              </div>
            ) : sidebarReports.length === 0 ? (
              <div className="sidebar-reports-empty">
                {sidebarSearchQuery ? (
                  <>
                    <p>No reports match "{sidebarSearchQuery}"</p>
                    <button
                      type="button"
                      className="sidebar-empty-clear-btn"
                      onClick={() => setSidebarSearchQuery('')}
                    >
                      Clear Search
                    </button>
                  </>
                ) : (
                  <p>No reports yet.</p>
                )}
              </div>
            ) : (
              <>
                {sidebarReports.map((r, idx) => {
                  const rId = extractObjectId(r?._id || r?.id || r?.interviewId);
                  const title = getReportTitle(r);
                  const dateStr = formatDate(r?.createdAt ?? r?.updatedAt);
                  const scoreColor = getMatchScoreColor(r?.matchScore);
                  const isActive = activeReportId === rId;

                  return (
                    <div
                      key={rId || idx}
                      className={`sidebar-report-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleOpenReport(r)}
                      onMouseEnter={(e) => handleReportMouseEnter(r, e)}
                      onMouseLeave={handleReportMouseLeave}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleOpenReport(r);
                        }
                      }}
                      title=""
                    >
                      <div className="sidebar-report-left">
                        <svg className="sidebar-report-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div className="sidebar-report-meta">
                          <span className="sidebar-report-title">{title}</span>
                          {dateStr && <span className="sidebar-report-date">{dateStr}</span>}
                        </div>
                      </div>

                      <div className="sidebar-report-right">
                        {r?.matchScore !== undefined && r?.matchScore !== null && (
                          <span
                            className="sidebar-report-score"
                            style={{
                              color: scoreColor,
                              borderColor: `${scoreColor}40`,
                              background: `${scoreColor}18`
                            }}
                          >
                            {r.matchScore}
                          </span>
                        )}
                        <button
                          type="button"
                          className="sidebar-report-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSidebarReport(rId, title);
                          }}
                          title="Delete report"
                          aria-label="Delete report"
                        >
                          <img src="/bin.png" alt="Delete" style={{ width: '11px', height: '11px', objectFit: 'contain', opacity: 0.7 }} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Sentinel for IntersectionObserver to trigger infinite scroll */}
                <div ref={observerTargetRef} className="sidebar-scroll-sentinel" />

                {/* Bottom Loading More Indicator */}
                {isLoadingMore && (
                  <div className="sidebar-reports-loading-more">
                    <span className="mini-pulse-dot" />
                    <span>Loading next reports...</span>
                  </div>
                )}

                {/* Error state with Retry button */}
                {reportsError && (
                  <div className="sidebar-reports-error">
                    <span>{reportsError}</span>
                    <button type="button" onClick={retry} className="sidebar-retry-btn">
                      Retry
                    </button>
                  </div>
                )}

                {/* End of list marker */}
                {!hasMore && sidebarReports.length > 0 && !isLoadingMore && (
                  <div className="sidebar-reports-end">
                    <span>All {totalMatching} reports loaded</span>
                  </div>
                )}
              </>
            )}
          </div>

        </div>

        {totalReportsCount > 0 && (
          <div className="sidebar-footer">
            <Link
              to="/reports"
              className="sidebar-view-all-link"
              onClick={() => setIsSidebarOpen(false)}
              title="View all interview reports"
            >
              <span>View All Reports ({totalReportsCount})</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        )}

        {/* Draggable sidebar border to resize width */}
        <div
          className={`sidebar-resizer ${isResizing ? "resizing" : ""}`}
          onMouseDown={startResizing}
          onDoubleClick={resetSidebarWidth}
          title="Drag border to resize sidebar (double-click to reset)"
          aria-label="Resize sidebar width"
        />
      </aside>

      {/* RIGHT CONTENT WRAPPER */}
      <div className="app-content-wrapper">
        <header className="app-header">
          <div className="header-top-row">
            {/* Hamburger Menu Toggle on Mobile */}
            <button 
              type="button" 
              className="hamburger-menu-btn" 
              onClick={() => setIsSidebarOpen(true)}
              title="Open Navigation Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            {showSubTabs ? (
              <div className="navbar-view-dropdown-container" ref={navDropdownRef}>
                <button
                  type="button"
                  className={`navbar-view-dropdown-btn ${navDropdownOpen ? 'open' : ''}`}
                  onClick={() => setNavDropdownOpen(prev => !prev)}
                  aria-expanded={navDropdownOpen}
                  aria-haspopup="true"
                  title="Switch document view"
                >
                  <span className="navbar-view-category">
                    {path.startsWith('/interview/') ? 'Interview Prep' : 'CV Generator'}
                    <span className="navbar-view-separator">&gt;</span>
                  </span>
                  <span className="navbar-view-active-title">
                    <img src={currentNavOption.icon} alt="" className="navbar-view-active-icon" />
                    <span>{currentNavOption.label}</span>
                  </span>
                  <ChevronDown size={14} className={`navbar-view-arrow ${navDropdownOpen ? 'rotated' : ''}`} />
                </button>

                {navDropdownOpen && (
                  <div className="navbar-view-dropdown-menu">
                    <div className="navbar-view-menu-header">
                      <span>DOCUMENT &amp; PREPARATION VIEWS</span>
                    </div>
                    <div className="navbar-view-menu-items">
                      {navOptions.map((opt) => {
                        const isActive = opt.id === currentNavOption.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`navbar-view-menu-item ${isActive ? 'active' : ''}`}
                            onClick={() => {
                              setNavDropdownOpen(false);
                              if (path !== opt.target) {
                                navigate(opt.target);
                              }
                            }}
                          >
                            <div className="navbar-view-item-icon-box">
                              <img src={opt.icon} alt={opt.label} />
                            </div>
                            <div className="navbar-view-item-content">
                              <div className="navbar-view-item-main">
                                <span className="navbar-view-item-name">{opt.label}</span>
                                {isActive && <span className="navbar-view-current-pill">Active</span>}
                              </div>
                              <span className="navbar-view-item-sub">{opt.desc}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="header-breadcrumb">{breadcrumb}</div>
            )}
            
            <div className="header-actions">
              {/* Search Input */}
              <div className="header-search">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" placeholder="Search anything..." />
                <span className="search-badge">Ctrl + K</span>
              </div>

              {/* AI Connected Pill */}
              <div className="ai-engine-pill" title={`Active AI Model: ${aiModelInfo.label} (Fallback: ${aiModelInfo.fallbackModel || 'OpenRouter'})`}>
                <span className="pulse-dot"></span>
                <span className="ai-engine-name">{aiModelInfo.label}</span>
              </div>

              {/* Remaining Attempts Pills */}
              <div
                className="usage-attempts-pill"
                onClick={() => window.dispatchEvent(new CustomEvent('kivi:open-credits-popup'))}
                style={{ cursor: 'pointer' }}
                title={`Plan: ${user?.plan?.toUpperCase() || 'FREE'} | Full Generations (Monthly): ${usage?.fullGenerations?.remaining ?? 100}/${usage?.fullGenerations?.limit ?? 100} left | AI Assistant (Daily): ${usage?.aiAssistant?.remaining ?? 500}/${usage?.aiAssistant?.limit ?? 500} left (Click to view credit balance)`}
              >
                <span className="attempts-badge plan-badge">{user?.plan?.toUpperCase() || 'FREE'}</span>
                <span className="attempts-item" title="Full Resume & Cover Letter Generations (Monthly Reset)">
                  <Zap size={12} style={{ verticalAlign: '-1px', marginRight: '3px' }} />
                  {usage?.fullGenerations?.remaining ?? 100}/{usage?.fullGenerations?.limit ?? 100}<span className="attempts-unit"> Gens/mo</span>
                </span>
                <span className="attempts-divider">|</span>
                <span className="attempts-item" title="AI Assistant & Writer Rewrites (Daily 24h Reset)">
                  <Bot size={12} style={{ verticalAlign: '-1px', marginRight: '3px' }} />
                  {usage?.aiAssistant?.remaining ?? 500}/{usage?.aiAssistant?.limit ?? 500}<span className="attempts-unit"> AI/day</span>
                </span>
              </div>

              {/* Theme Toggle Button */}
              <button 
                type="button" 
                className="header-icon-btn theme-toggle-btn" 
                onClick={toggleTheme} 
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              >
                {theme === 'dark' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              {/* Notifications Bell */}
              <NotificationBell />

              {/* User Profile Dropdown */}
              <div 
                ref={dropdownRef}
                className="user-profile-dropdown" 
                onClick={() => setDropdownOpen(prev => !prev)}
              >
                <div className="user-avatar">
                  {(user?.username || "U")[0].toUpperCase()}
                </div>
                <span className="user-name">{user?.username || "Profile"}</span>
                <svg className="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>

                {dropdownOpen && (
                  <div className="profile-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                    <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <User size={15} className="dropdown-item-icon" />
                      <span>View Profile</span>
                    </Link>
                    <Link to="/help-support" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <HelpCircle size={15} className="dropdown-item-icon" />
                      <span>Help & Support</span>
                    </Link>
                    <div className="profile-dropdown-divider" />
                    <button 
                      onClick={() => {
                        setDropdownOpen(false);
                        onlogout();
                      }} 
                      className="dropdown-item logout"
                    >
                      <LogOut size={15} className="dropdown-item-icon" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="app-main-content">
          {children || <Outlet />}
        </main>

        {/* User Credits & Welcome Popup */}
        <UserCreditsPopup />

        {/* KIVI AI Assistant (Protected Route Only) */}
        <KiviAiAssistant />

        {/* Global Rich Footer */}
        <Footer theme={theme} />
      </div>
      {/* Confirm Modal for Deleting Report from Sidebar */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete Interview Report"
        message={`Are you sure you want to permanently delete "${deleteModal.title}"?`}
        details="This action cannot be undone. All questions, match scores, and interview analysis will be lost."
        confirmText="Delete Report"
        cancelText="Cancel"
        type="danger"
        loading={deleteModal.loading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Sleek Floating Hover Preview Popover for Recent Reports */}
      {hoveredReport && hoverPos && (
        <div
          className="sidebar-report-hover-card"
          style={{
            top: `${hoverPos.top}px`,
            left: `${hoverPos.left}px`
          }}
        >
          <div className="hover-card-header">
            <span className="hover-card-title">{getReportTitle(hoveredReport)}</span>
            {hoveredReport.matchScore && (
              <span
                className="hover-card-score"
                style={{
                  color: getMatchScoreColor(hoveredReport.matchScore),
                  borderColor: `${getMatchScoreColor(hoveredReport.matchScore)}40`,
                  background: `${getMatchScoreColor(hoveredReport.matchScore)}18`
                }}
              >
                {hoveredReport.matchScore}% Match
              </span>
            )}
          </div>

          {/* Missing Skills Tags or Target Role */}
          {Array.isArray(hoveredReport.skillGaps) && hoveredReport.skillGaps.length > 0 ? (
            <div className="hover-card-section">
              <span className="hover-section-label">Target Skill Gaps:</span>
              <div className="hover-skills-pills">
                {hoveredReport.skillGaps.slice(0, 3).map((gap, i) => {
                  const skillName = typeof gap === 'string' ? gap : (gap?.skill || gap?.name || 'Skill');
                  return (
                    <span key={i} className="hover-skill-pill">
                      {skillName}
                    </span>
                  );
                })}
                {hoveredReport.skillGaps.length > 3 && (
                  <span className="hover-skill-more">+{hoveredReport.skillGaps.length - 3} more</span>
                )}
              </div>
            </div>
          ) : (
            <div className="hover-card-section">
              <span className="hover-section-label">Target Role:</span>
              <span className="hover-section-value">{hoveredReport.developerTitle || 'Software Engineer'}</span>
            </div>
          )}

          {/* Prep Metrics & Date */}
          <div className="hover-card-footer">
            <div className="hover-metrics-row">
              <span className="hover-metric-item">
                <span className="metric-dot tech-dot" />
                {hoveredReport.counts?.technical ?? (hoveredReport.technicalQuestions?.length || 0)} Questions
              </span>
              <span className="hover-metric-item">
                <span className="metric-dot roadmap-dot" />
                {hoveredReport.counts?.roadmap ?? (hoveredReport.preparationPlan?.length || 0)} Steps
              </span>
            </div>
            <div className="hover-date-stamp">
              {formatDate(hoveredReport.createdAt ?? hoveredReport.updatedAt)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
