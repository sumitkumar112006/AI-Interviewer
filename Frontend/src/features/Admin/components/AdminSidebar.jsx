import React, { useState, useEffect } from 'react';
import {
    Activity,
    Users,
    SlidersHorizontal,
    CreditCard,
    Layers,
    FileClock,
    Megaphone,
    UserPlus,
    Sparkles,
    PanelLeftClose,
    PanelLeftOpen,
    Shield,
    LogOut,
    ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminSidebar({
    activeTab,
    setActiveTab,
    isCollapsed,
    setIsCollapsed,
    sidebarWidth,
    setSidebarWidth,
    userCount = 0,
    adminCount = 0,
    onLogout
}) {
    const [isResizing, setIsResizing] = useState(false);

    // Mouse drag resize handler for adjustable UI
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            const newWidth = Math.max(180, Math.min(380, e.clientX));
            setSidebarWidth(newWidth);
            localStorage.setItem('kivi_admin_sidebar_width', newWidth.toString());
        };

        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };

        if (isResizing) {
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, setSidebarWidth]);

    const navSections = [
        {
            group: 'Core Console',
            items: [
                { id: 'overview', label: 'Overview & Metrics', icon: Activity },
                { id: 'table', label: 'User Directory', icon: Users, badge: userCount > 0 ? userCount : null },
                { id: 'feature-matrix', label: 'Feature Access Matrix', icon: SlidersHorizontal }
            ]
        },
        {
            group: 'Billing & Revenue',
            items: [
                { id: 'payments', label: 'Payments Ledger', icon: CreditCard },
                { id: 'subscriptions', label: 'Subscriptions', icon: Layers }
            ]
        },
        {
            group: 'Operations & Security',
            items: [
                { id: 'audit-logs', label: 'Audit Trail', icon: FileClock },
                { id: 'broadcast', label: 'Broadcast & Alerts', icon: Megaphone },
                { id: 'admins', label: 'Admin Accounts', icon: UserPlus, badge: adminCount > 0 ? `${adminCount}` : null },
                { id: 'credits', label: 'Grant Bonus Credits', icon: Sparkles }
            ]
        }
    ];

    return (
        <aside
            className={`admin-sidebar ${isCollapsed ? 'collapsed' : ''}`}
            style={{ width: isCollapsed ? 68 : sidebarWidth }}
        >
            {/* Sidebar Brand Header */}
            <div className="sidebar-header">
                <div className="sidebar-brand">
                    <img src="/Logo.png" alt="Logo" className="sidebar-logo" />
                    {!isCollapsed && (
                        <div className="brand-text">
                            <span className="brand-name">KIVI Studio</span>
                            <span className="brand-sub">Admin Console</span>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    className="collapse-toggle-btn"
                    onClick={() => setIsCollapsed(prev => !prev)}
                    title={isCollapsed ? "Expand Sidebar (Ctrl+\\)" : "Collapse Sidebar (Ctrl+\\)"}
                >
                    {isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
                </button>
            </div>

            {/* Sidebar Navigation Items */}
            <nav className="sidebar-nav">
                {navSections.map((sec, idx) => (
                    <div key={idx} className="nav-group">
                        {!isCollapsed && <div className="nav-group-title">{sec.group}</div>}
                        <ul className="nav-list">
                            {sec.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = activeTab === item.id;
                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            className={`nav-item ${isActive ? 'active' : ''}`}
                                            onClick={() => setActiveTab(item.id)}
                                            title={isCollapsed ? item.label : undefined}
                                        >
                                            <Icon size={18} className="nav-icon" />
                                            {!isCollapsed && (
                                                <span className="nav-label">{item.label}</span>
                                            )}
                                            {!isCollapsed && item.badge && (
                                                <span className="nav-badge">{item.badge}</span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* Sidebar Footer Info & Session */}
            <div className="sidebar-footer">
                {!isCollapsed ? (
                    <div className="admin-session-card">
                        <div className="session-info">
                            <div className="session-role">
                                <Shield size={12} className="shield-icon" />
                                <span>SUPER ADMIN</span>
                            </div>
                            <span className="session-status">Production v1.2</span>
                        </div>
                        <div className="session-actions">
                            <Link to="/" className="session-btn" title="Exit to Main App">
                                <ExternalLink size={14} />
                            </Link>
                            <button
                                type="button"
                                className="session-btn logout-btn"
                                onClick={onLogout}
                                title="Sign Out of Admin Console"
                            >
                                <LogOut size={14} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="collapsed-footer-actions">
                        <Link to="/" className="rail-btn" title="Exit to App">
                            <ExternalLink size={16} />
                        </Link>
                        <button
                            type="button"
                            className="rail-btn logout"
                            onClick={onLogout}
                            title="Sign Out"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Resize Drag Handle (Only when not collapsed) */}
            {!isCollapsed && (
                <div
                    className="sidebar-resizer"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                    }}
                    onDoubleClick={() => {
                        setSidebarWidth(240);
                        localStorage.setItem('kivi_admin_sidebar_width', '240');
                    }}
                    title="Drag to resize sidebar, Double click to reset width"
                />
            )}
        </aside>
    );
}
