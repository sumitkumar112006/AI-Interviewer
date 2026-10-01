import React from 'react';
import { Link } from 'react-router-dom';
import {
    Menu,
    Search,
    RefreshCw,
    Megaphone,
    Sparkles,
    UserPlus,
    ExternalLink,
    LogOut,
    CheckCircle2,
    X
} from 'lucide-react';

export default function AdminTopNav({
    activeTab,
    searchTerm,
    setSearchTerm,
    onRefresh,
    isRefreshing,
    onOpenBroadcastModal,
    onOpenCreditsModal,
    onOpenAdminModal,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    adminUser,
    onLogout
}) {
    const tabLabels = {
        'overview': 'Overview & Metrics',
        'table': 'User Directory',
        'feature-matrix': 'Feature Access Matrix',
        'payments': 'Payments Ledger',
        'subscriptions': 'Subscriptions',
        'audit-logs': 'Audit Trail',
        'broadcast': 'Broadcast & Alerts',
        'admins': 'Admin Accounts',
        'credits': 'Grant Bonus Credits',
        'summary': 'System Summary'
    };

    return (
        <header className="admin-top-nav">
            {/* Left Section: Mobile Menu + Breadcrumb */}
            <div className="top-nav-left">
                <button
                    type="button"
                    className="mobile-sidebar-toggle"
                    onClick={() => setIsSidebarCollapsed(prev => !prev)}
                    title="Toggle Navigation Menu"
                >
                    <Menu size={18} />
                </button>

                <div className="admin-breadcrumbs">
                    <span className="crumb-root">KIVI Cloud</span>
                    <span className="crumb-sep">/</span>
                    <span className="crumb-hub">Admin Studio</span>
                    <span className="crumb-sep">/</span>
                    <span className="crumb-current">{tabLabels[activeTab] || 'Dashboard'}</span>
                </div>

                <div className="system-health-pill">
                    <span className="pulse-dot"></span>
                    <span className="health-text">Operational</span>
                </div>
            </div>

            {/* Center Section: Quick Search */}
            <div className="top-nav-center">
                <div className="global-search-bar">
                    <Search size={15} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search users by name, email, or role..."
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
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>

            {/* Right Section: Quick Actions & Session Profile */}
            <div className="top-nav-right">
                <button
                    type="button"
                    className="top-action-btn refresh-btn"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    title="Refresh data from server"
                >
                    <RefreshCw size={14} className={isRefreshing ? 'spinning' : ''} />
                    <span>Sync</span>
                </button>

                <button
                    type="button"
                    className="top-action-btn broadcast-action-btn"
                    onClick={onOpenBroadcastModal}
                    title="Compose platform-wide broadcast or user alert"
                >
                    <Megaphone size={14} />
                    <span className="btn-text-full">Broadcast</span>
                </button>

                <button
                    type="button"
                    className="top-action-btn credit-action-btn"
                    onClick={onOpenCreditsModal}
                    title="Grant instant bonus generation credits"
                >
                    <Sparkles size={14} />
                    <span className="btn-text-full">Credits</span>
                </button>

                <button
                    type="button"
                    className="top-action-btn admin-action-btn"
                    onClick={onOpenAdminModal}
                    title="Register a new administrator"
                >
                    <UserPlus size={14} />
                    <span className="btn-text-full">New Admin</span>
                </button>

                <div className="nav-divider"></div>

                <div className="admin-profile-chip">
                    <div className="profile-avatar">
                        {(adminUser?.username || 'A')[0].toUpperCase()}
                    </div>
                    <div className="profile-details">
                        <span className="profile-name">{adminUser?.username || 'Admin'}</span>
                        <span className="profile-role">Super Admin</span>
                    </div>
                </div>

                <button
                    type="button"
                    className="top-logout-btn"
                    onClick={onLogout}
                    title="Sign Out"
                >
                    <LogOut size={15} />
                </button>
            </div>
        </header>
    );
}
