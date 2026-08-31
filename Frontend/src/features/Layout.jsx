import React, { useEffect, useState } from "react";
import { useAuth } from "./Auth/hooks/useAuth";
import { useInterview } from "./Interview/hooks/useInterview";
import { getAiModelInfo } from "./Interview/services/interview.api";
import { KiviAiAssistant } from "./Shared/components/KiviAiAssistant";
import NotificationBell from "./Shared/components/NotificationBell";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import "./layout.scss";

const Layout = () => {
  const { user, usage, fetchUsage, handleLogout } = useAuth();
  const { reports, getReports } = useInterview();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  useEffect(() => {
    if (reports === null) {
      void getReports();
    }
  }, [reports, getReports]);

  const onlogout = async () => {
    await handleLogout();
    navigate("/login");
  };

  const recentReportId = reports && reports.length > 0 ? (reports[0]._id?.$oid || reports[0]._id) : null;

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
    breadcrumb = "Settings > Profile";
  } else if (path === "/privacy-policy") {
    activeMenu = "privacy-policy";
    breadcrumb = "Legal > Privacy Policy";
  } else if (path === "/terms-of-service") {
    activeMenu = "terms-of-service";
    breadcrumb = "Legal > Terms of Service";
  } else if (path === "/contact-us") {
    activeMenu = "contact-us";
    breadcrumb = "Support > Contact Us";
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
    <div className="app-shell dark-theme">
      {/* Sidebar Backdrop Overlay on Mobile */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* LEFT SIDEBAR */}
      <aside className={`app-sidebar ${isSidebarOpen ? "open" : ""}`}>
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

            <Link to="/coming-soon?feature=my-activity" className={`sidebar-link ${activeMenu === "my-activity" ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)}>
              <svg className="sidebar-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>My Activity</span>
            </Link>

            <Link to="/coming-soon?feature=saved-items" className={`sidebar-link ${activeMenu === "saved-items" ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)}>
              <svg className="sidebar-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span>Saved Items</span>
            </Link>
          </nav>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-section-title">SETTINGS</p>
          <nav className="sidebar-nav">
            <Link to="/pricing" className={`sidebar-link ${activeMenu === "pricing" ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)}>
              <svg className="sidebar-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Pricing & Plans</span>
            </Link>

            <Link to="/profile" className={`sidebar-link ${activeMenu === "profile" ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)}>
              <svg className="sidebar-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Profile</span>
            </Link>

            <Link to="/coming-soon?feature=preferences" className={`sidebar-link ${activeMenu === "preferences" ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)}>
              <svg className="sidebar-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Preferences</span>
            </Link>

            <Link to="/coming-soon?feature=help-support" className={`sidebar-link ${activeMenu === "help-support" ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)}>
              <svg className="sidebar-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Help & Support</span>
            </Link>

            <button onClick={() => { onlogout(); setIsSidebarOpen(false); }} className="sidebar-link logout-btn">
              <svg className="sidebar-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Logout</span>
            </button>
          </nav>
        </div>

        <div className="upgrade-card">
          <div className="upgrade-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
          <h3>Upgrade to Pro</h3>
          <p>Unlock advanced features and boost your interview prep.</p>
          <Link to="/pricing" className="upgrade-btn" onClick={() => setIsSidebarOpen(false)}>Upgrade Now</Link>
        </div>
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

            <div className="header-breadcrumb">{breadcrumb}</div>
            
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
                title={`Plan: ${user?.plan?.toUpperCase() || 'FREE'} | Full Generations (Monthly): ${usage?.fullGenerations?.remaining ?? 2}/${usage?.fullGenerations?.limit ?? 2} left | AI Assistant (Daily): ${usage?.aiAssistant?.remaining ?? 10}/${usage?.aiAssistant?.limit ?? 10} left`}
              >
                <span className="attempts-badge plan-badge">{user?.plan?.toUpperCase() || 'FREE'}</span>
                <span className="attempts-item" title="Full Resume & Cover Letter Generations (Monthly Reset)">
                  ⚡ {usage?.fullGenerations?.remaining ?? 2}/{usage?.fullGenerations?.limit ?? 2}<span className="attempts-unit"> Gens/mo</span>
                </span>
                <span className="attempts-divider">|</span>
                <span className="attempts-item" title="AI Assistant & Writer Rewrites (Daily 24h Reset)">
                  🤖 {usage?.aiAssistant?.remaining ?? 10}/{usage?.aiAssistant?.limit ?? 10}<span className="attempts-unit"> AI/day</span>
                </span>
              </div>

              {/* Dark Mode Icon */}
              <button className="header-icon-btn" title="Toggle theme">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </button>

              {/* Notifications Bell */}
              <NotificationBell />

              {/* User Profile Dropdown */}
              <div className="user-profile-dropdown" onClick={() => setDropdownOpen(!dropdownOpen)}>
                <div className="user-avatar">
                  {(user?.username || "U")[0].toUpperCase()}
                </div>
                <span className="user-name">{user?.username || "Profile"}</span>
                <svg className="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>

                {dropdownOpen && (
                  <div className="profile-dropdown-menu">
                    <Link to="/profile" className="dropdown-item">View Profile</Link>
                    <button onClick={onlogout} className="dropdown-item logout">Logout</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sub-tabs — visible only when in interview/resume/cover-letter context */}
          {showSubTabs && (
            <div className="layout-sub-tabs">
              <Link
                to={activeReportId ? `/interview/${activeReportId}` : "/"}
                className={`sub-tab-link ${path.startsWith("/interview/") ? "active" : ""}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                Preparation Plan
              </Link>

              <Link
                to={activeReportId ? `/resume/${activeReportId}` : "/"}
                className={`sub-tab-link ${path.startsWith("/resume/") ? "active" : ""}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Generate Resume
              </Link>

              <Link
                to={activeReportId ? `/cover-letter/${activeReportId}` : "/"}
                className={`sub-tab-link ${path.startsWith("/cover-letter/") ? "active" : ""}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                Cover Letter Builder
              </Link>
            </div>
          )}
        </header>

        <main className="app-main-content">
          <Outlet />
        </main>

        {/* KIVI AI Assistant (Protected Route Only) */}
        <KiviAiAssistant />

        {/* Global Footer */}
        <footer className="app-footer">
          <div className="app-footer__links">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-service">Terms of Service</Link>
            <Link to="/contact-us">Contact Us</Link>
            <Link to="/about-us">About KIVI-AI</Link>
          </div>
          <p className="app-footer__copy">© 2026 KIVI-AI. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
