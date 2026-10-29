import React, { useState } from 'react';
import { updateUserFeatureAccess } from '../services/admin.api';
import { Check, X, ShieldAlert, Sparkles, FileText, FileCode, Search, RotateCcw } from 'lucide-react';
import AdminPagination from './AdminPagination';

export const AdminFeatureMatrixTab = ({
    users = [],
    setUsers,
    pagination = { page: 1, pages: 1, total: 0, limit: 20 },
    onPageChange,
    loading = false,
    onRefresh
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

    const filteredUsers = users.filter(u => {
        if (!searchTerm.trim()) return true;
        const query = searchTerm.toLowerCase().trim();
        return (
            (u.username && u.username.toLowerCase().includes(query)) ||
            (u.email && u.email.toLowerCase().includes(query)) ||
            (u.plan && u.plan.toLowerCase().includes(query)) ||
            (u.role && u.role.toLowerCase().includes(query))
        );
    });

    const handleToggleFeature = async (user, featureKey) => {
        setUpdatingId(`${user._id}-${featureKey}`);
        setStatusMsg({ type: '', text: '' });

        const currentBlocked = user.blockedFeatures || {};
        const isCurrentlyBlocked = !!currentBlocked[featureKey];
        const nextBlockedState = !isCurrentlyBlocked;

        const updatedFeatures = {
            ...currentBlocked,
            [featureKey]: nextBlockedState
        };

        try {
            const res = await updateUserFeatureAccess(user._id, updatedFeatures);
            setUsers(prev => prev.map(u => u._id === user._id ? { ...u, blockedFeatures: updatedFeatures } : u));
            setStatusMsg({
                type: 'success',
                text: `Updated "${featureKey}" access for ${user.username}`
            });
            setTimeout(() => setStatusMsg({ type: '', text: '' }), 3500);
        } catch (err) {
            setStatusMsg({
                type: 'error',
                text: err?.response?.data?.message || 'Failed to update feature access'
            });
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div className="admin-feature-matrix-section">
            <div className="matrix-header-bar">
                <div className="matrix-title-block">
                    <h2>Feature Access Control Matrix</h2>
                    <span className="matrix-badge">GRANULAR FEATURE RESTRICTIONS</span>
                </div>

                <div className="matrix-search-box">
                    <Search size={14} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search users in matrix..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            className="clear-search-btn"
                            onClick={() => setSearchTerm('')}
                            title="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {statusMsg.text && (
                <div className={`matrix-status-banner ${statusMsg.type}`}>
                    {statusMsg.text}
                </div>
            )}

            <div className="users-table-container">
                <table>
                    <thead>
                        <tr>
                            <th>User Account</th>
                            <th>Tier Plan</th>
                            <th>AI Assistant & Writer</th>
                            <th>Mock Interviews</th>
                            <th>Cover Letter & CV</th>
                            <th>Resume Builder</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="empty-table-cell">
                                    {searchTerm ? 'No accounts match your search filter.' : 'No users available.'}
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map((user) => {
                                const bf = user.blockedFeatures || {};
                                return (
                                    <tr key={user._id}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="avatar-circle">
                                                    {(user.username || 'U')[0].toUpperCase()}
                                                </div>
                                                <div className="user-details">
                                                    <span className="user-name">{user.username}</span>
                                                    <span className="user-email">{user.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge-pill ${user.plan || 'free'}`}>
                                                {(user.plan || 'FREE').toUpperCase()}
                                            </span>
                                        </td>

                                        {/* AI Assistant Toggle */}
                                        <td>
                                            <button
                                                type="button"
                                                className={`matrix-toggle-btn ${bf.aiAssistant ? 'blocked' : 'allowed'}`}
                                                disabled={updatingId === `${user._id}-aiAssistant`}
                                                onClick={() => handleToggleFeature(user, 'aiAssistant')}
                                                title={bf.aiAssistant ? "Feature currently Blocked. Click to Enable." : "Feature currently Allowed. Click to Block."}
                                            >
                                                {bf.aiAssistant ? <X size={13} /> : <Check size={13} />}
                                                <span>{bf.aiAssistant ? 'BLOCKED' : 'ENABLED'}</span>
                                            </button>
                                        </td>

                                        {/* Mock Interviews Toggle */}
                                        <td>
                                            <button
                                                type="button"
                                                className={`matrix-toggle-btn ${bf.interviewReports ? 'blocked' : 'allowed'}`}
                                                disabled={updatingId === `${user._id}-interviewReports`}
                                                onClick={() => handleToggleFeature(user, 'interviewReports')}
                                                title={bf.interviewReports ? "Feature currently Blocked. Click to Enable." : "Feature currently Allowed. Click to Block."}
                                            >
                                                {bf.interviewReports ? <X size={13} /> : <Check size={13} />}
                                                <span>{bf.interviewReports ? 'BLOCKED' : 'ENABLED'}</span>
                                            </button>
                                        </td>

                                        {/* Cover Letter Toggle */}
                                        <td>
                                            <button
                                                type="button"
                                                className={`matrix-toggle-btn ${bf.coverLetterGeneration ? 'blocked' : 'allowed'}`}
                                                disabled={updatingId === `${user._id}-coverLetterGeneration`}
                                                onClick={() => handleToggleFeature(user, 'coverLetterGeneration')}
                                                title={bf.coverLetterGeneration ? "Feature currently Blocked. Click to Enable." : "Feature currently Allowed. Click to Block."}
                                            >
                                                {bf.coverLetterGeneration ? <X size={13} /> : <Check size={13} />}
                                                <span>{bf.coverLetterGeneration ? 'BLOCKED' : 'ENABLED'}</span>
                                            </button>
                                        </td>

                                        {/* Resume Generation Toggle */}
                                        <td>
                                            <button
                                                type="button"
                                                className={`matrix-toggle-btn ${bf.resumeGeneration ? 'blocked' : 'allowed'}`}
                                                disabled={updatingId === `${user._id}-resumeGeneration`}
                                                onClick={() => handleToggleFeature(user, 'resumeGeneration')}
                                                title={bf.resumeGeneration ? "Feature currently Blocked. Click to Enable." : "Feature currently Allowed. Click to Block."}
                                            >
                                                {bf.resumeGeneration ? <X size={13} /> : <Check size={13} />}
                                                <span>{bf.resumeGeneration ? 'BLOCKED' : 'ENABLED'}</span>
                                            </button>
                                        </td>

                                        <td>
                                            <span className={`badge-pill ${user.isBlocked ? 'blocked' : 'active'}`}>
                                                {user.isBlocked ? 'SUSPENDED' : 'ACTIVE'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <AdminPagination
                page={pagination.page}
                pages={pagination.pages}
                total={pagination.total}
                limit={pagination.limit || 20}
                loading={loading}
                onPageChange={onPageChange}
            />
        </div>
    );
};

export default AdminFeatureMatrixTab;
