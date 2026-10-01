import React, { useState } from 'react';
import { sendAdminMessage } from '../services/admin.api';
import { Megaphone, Send, Globe, Zap, Crown, User, CheckCircle, AlertCircle } from 'lucide-react';

export const AdminBroadcastTab = () => {
    const [form, setForm] = useState({
        targetType: 'all',
        targetValue: '',
        title: '',
        message: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState({ type: '', text: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.message.trim()) {
            setResult({ type: 'error', text: 'Please fill in both title and message body.' });
            return;
        }

        if (form.targetType === 'user' && !form.targetValue.trim()) {
            setResult({ type: 'error', text: 'Please provide user email or ID for target type "Single User".' });
            return;
        }

        setSubmitting(true);
        setResult({ type: '', text: '' });

        try {
            const res = await sendAdminMessage(form);
            setResult({ type: 'success', text: res.message || 'Notification broadcast successfully sent!' });
            setForm({ targetType: 'all', targetValue: '', title: '', message: '' });
        } catch (err) {
            setResult({ type: 'error', text: err?.response?.data?.message || 'Failed to send broadcast message.' });
        } finally {
            setSubmitting(false);
        }
    };

    const targetOptions = [
        { id: 'all', label: 'All Platform Users', icon: Globe, sub: 'Dispatches to entire registered base' },
        { id: 'free', label: 'Free Tier Users', icon: User, sub: 'Promotions, upgrade nudges' },
        { id: 'pro', label: 'Pro Tier Subscribers', icon: Zap, sub: 'Feature announcements, perks' },
        { id: 'premium', label: 'Premium Tier Subscribers', icon: Crown, sub: 'Priority support & VIP updates' },
        { id: 'user', label: 'Direct Individual User', icon: User, sub: 'Targeted account communication' }
    ];

    return (
        <div className="admin-broadcast-section">
            <div className="broadcast-grid-layout">
                {/* Message Composer Card */}
                <div className="broadcast-composer-card">
                    <div className="section-title-row">
                        <div className="title-with-icon">
                            <Megaphone size={20} className="icon-accent" />
                            <div>
                                <h2>Broadcast & Messaging Studio</h2>
                                <span className="section-sub">Deliver real-time in-app alerts and notifications</span>
                            </div>
                        </div>
                    </div>

                    {result.text && (
                        <div className={`broadcast-result-banner ${result.type}`}>
                            {result.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            <span>{result.text}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="broadcast-form">
                        <div className="form-item">
                            <label className="field-label">Target Audience Scope</label>
                            <div className="target-cards-grid">
                                {targetOptions.map((opt) => {
                                    const Icon = opt.icon;
                                    const isSelected = form.targetType === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            className={`target-pill-card ${isSelected ? 'selected' : ''}`}
                                            onClick={() => setForm({ ...form, targetType: opt.id, targetValue: '' })}
                                        >
                                            <div className="target-pill-header">
                                                <Icon size={16} />
                                                <span className="target-name">{opt.label}</span>
                                            </div>
                                            <span className="target-sub">{opt.sub}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {form.targetType === 'user' && (
                            <div className="form-item">
                                <label className="field-label">Target User Email or User ID</label>
                                <input
                                    type="text"
                                    className="console-input"
                                    placeholder="e.g. candidate@gmail.com or 64b8f0..."
                                    value={form.targetValue}
                                    onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
                                    required
                                />
                            </div>
                        )}

                        <div className="form-item">
                            <label className="field-label">Notification Title</label>
                            <input
                                type="text"
                                className="console-input"
                                placeholder="e.g. Platform Update: New AI Resume Features Available"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-item">
                            <label className="field-label">Message Content</label>
                            <textarea
                                className="console-textarea"
                                rows={5}
                                placeholder="Write clear, concise notification content..."
                                value={form.message}
                                onChange={(e) => setForm({ ...form, message: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-actions-row">
                            <button
                                type="submit"
                                className="console-submit-btn"
                                disabled={submitting}
                            >
                                <Send size={15} />
                                <span>{submitting ? 'Dispatching...' : 'Send Broadcast'}</span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* Live Message Preview Panel */}
                <div className="broadcast-preview-card">
                    <div className="preview-header">
                        <span className="preview-tag">IN-APP NOTIFICATION PREVIEW</span>
                    </div>

                    <div className="mock-notification-banner">
                        <div className="mock-bell-badge">
                            <Megaphone size={16} />
                        </div>
                        <div className="mock-content">
                            <div className="mock-title">
                                {form.title || 'Notification Title Preview'}
                            </div>
                            <div className="mock-body">
                                {form.message || 'The full message content will be displayed here as the user sees it in their notification feed.'}
                            </div>
                            <div className="mock-meta">
                                <span>Target: {targetOptions.find(t => t.id === form.targetType)?.label || 'All Users'}</span>
                                <span>•</span>
                                <span>Just Now</span>
                            </div>
                        </div>
                    </div>

                    <div className="broadcast-tips-card">
                        <h4>Broadcast Guidelines</h4>
                        <ul>
                            <li>Messages are delivered immediately into user session trays.</li>
                            <li>Use clean Markdown-compatible text without heavy HTML.</li>
                            <li>Targeting specific plan tiers helps deliver tailored upgrade offers.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
