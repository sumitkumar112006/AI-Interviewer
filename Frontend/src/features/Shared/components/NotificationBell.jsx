import React, { useEffect, useState, useRef } from 'react';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '../services/notification.api';
import './NotificationBell.scss';

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const NotificationBell = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    const fetchNotificationsList = async () => {
        try {
            const data = await getNotifications();
            if (data) {
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (err) {
            // Silently handle if user is unauthenticated
        }
    };

    useEffect(() => {
        fetchNotificationsList();
        // Poll for updates every 15 seconds
        const interval = setInterval(fetchNotificationsList, 15000);
        return () => clearInterval(interval);
    }, []);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        setIsOpen(prev => !prev);
        if (!isOpen) {
            fetchNotificationsList();
        }
    };

    const handleMarkAsRead = async (id, isRead) => {
        if (isRead) return;
        try {
            const res = await markNotificationAsRead(id);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
            setUnreadCount(res.unreadCount ?? Math.max(0, unreadCount - 1));
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        try {
            const res = await deleteNotification(id);
            setNotifications(prev => prev.filter(n => n._id !== id));
            setUnreadCount(res.unreadCount ?? Math.max(0, unreadCount - 1));
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    const getIconForType = (type) => {
        switch (type) {
            case 'FEATURE_UPDATE': return '🔐';
            case 'CREDIT_UPDATE': return '⚡';
            case 'ACCOUNT_STATUS': return '🛡️';
            default: return '🔔';
        }
    };

    return (
        <div className="notification-bell-wrapper" ref={dropdownRef}>
            <button
                className={`header-icon-btn notifications-btn ${isOpen ? 'active' : ''}`}
                onClick={handleToggle}
                title="Account Notifications"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="notifications-badge">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="notifications-popover">
                    <div className="popover-header">
                        <div className="header-title-group">
                            <h4>Notifications</h4>
                            {unreadCount > 0 && (
                                <span className="unread-count-pill">{unreadCount} new</span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button className="mark-all-btn" onClick={handleMarkAllRead}>
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="notifications-list">
                        {notifications.length === 0 ? (
                            <div className="empty-notifications">
                                <span className="empty-icon">🔕</span>
                                <p className="empty-text">No notifications yet</p>
                                <span className="empty-sub">Updates from admin will appear here</span>
                            </div>
                        ) : (
                            notifications.map(item => (
                                <div
                                    key={item._id}
                                    className={`notification-item ${!item.read ? 'unread' : ''}`}
                                    onClick={() => handleMarkAsRead(item._id, item.read)}
                                >
                                    <div className="item-icon-box">
                                        {getIconForType(item.type)}
                                    </div>

                                    <div className="item-content">
                                        <div className="item-header-row">
                                            <h5 className="item-title">{item.title}</h5>
                                            <span className="item-time">{formatRelativeTime(item.createdAt)}</span>
                                        </div>
                                        <p className="item-msg">{item.message}</p>
                                    </div>

                                    <button
                                        className="item-delete-btn"
                                        title="Delete notification"
                                        onClick={(e) => handleDelete(e, item._id)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
