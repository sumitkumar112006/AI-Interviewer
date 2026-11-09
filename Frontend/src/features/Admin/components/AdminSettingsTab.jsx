import React, { useState, useEffect } from 'react';
import {
    Sliders,
    AlertTriangle,
    Shield,
    Users,
    Sparkles,
    FileText,
    FileCode,
    RefreshCw,
    Save,
    CheckCircle2,
    XCircle,
    Info,
    Cpu,
    Lock,
    Unlock,
    ArrowUpCircle,
    RotateCcw,
    ExternalLink
} from 'lucide-react';
import { getAdminSettings, updateAdminSettings, rollbackAdminVersion } from '../services/admin.api';
import { CLIENT_APP_VERSION } from '../../../config/version.config';

export default function AdminSettingsTab() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

    // Confirmation Modal State for Critical Platform Actions
    const [pendingAction, setPendingAction] = useState(null);

    const fetchSettings = async () => {
        setLoading(true);
        setStatusMsg({ type: '', text: '' });
        try {
            const res = await getAdminSettings();
            if (res.success && res.settings) {
                const s = res.settings;
                if (!s.versionControl) {
                    s.versionControl = {
                        currentVersion: '1.0.0',
                        minimumSupportedVersion: '1.0.0',
                        latestRecommendedVersion: '1.0.0',
                        mandatoryUpdate: false,
                        updateAnnouncement: { title: '', message: '' },
                        updateUrl: ''
                    };
                }
                setSettings(s);
            }
        } catch (err) {
            setStatusMsg({
                type: 'error',
                text: err?.response?.data?.message || 'Failed to load platform settings.'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleFeatureToggle = (featureKey) => {
        setSettings(prev => ({
            ...prev,
            features: {
                ...prev.features,
                [featureKey]: !prev.features[featureKey]
            }
        }));
    };

    const handleSave = async (confirmed = false) => {
        // Critical Action Check 1: Enabling Maintenance Mode
        if (!confirmed && settings.maintenanceMode.enabled) {
            setPendingAction({
                title: 'Enable Maintenance Mode?',
                description: 'Activating maintenance mode will immediately block all candidate traffic with HTTP 503. Only administrators and whitelisted IP addresses will be able to access the platform.',
                actionType: 'maintenance'
            });
            return;
        }

        // Critical Action Check 2: Disabling New Registrations
        if (!confirmed && !settings.newRegistrationEnabled) {
            setPendingAction({
                title: 'Disable New User Registrations?',
                description: 'Disabling new user registrations will block both standard signup and new Google OAuth registrations. Existing users will still be able to log in normally.',
                actionType: 'registration'
            });
            return;
        }

        // Critical Action Check 3: Engaging Mandatory Force Update
        if (!confirmed && settings.versionControl?.mandatoryUpdate) {
            setPendingAction({
                title: 'Enable Mandatory Force Update?',
                description: `Enabling mandatory update will immediately block all candidate traffic running versions below v${settings.versionControl?.minimumSupportedVersion || '1.0.0'} with HTTP 426 until they upgrade.`,
                actionType: 'mandatoryUpdate'
            });
            return;
        }

        setSaving(true);
        setStatusMsg({ type: '', text: '' });

        try {
            const payload = {
                maintenanceMode: settings.maintenanceMode,
                newRegistrationEnabled: settings.newRegistrationEnabled,
                features: settings.features,
                ai: settings.ai,
                generationLimits: settings.generationLimits,
                versionControl: settings.versionControl
            };

            const res = await updateAdminSettings(payload);
            if (res.success && res.settings) {
                setSettings(res.settings);
                setStatusMsg({
                    type: 'success',
                    text: 'Platform configuration successfully saved and synchronized across all instances!'
                });
                setTimeout(() => setStatusMsg({ type: '', text: '' }), 5000);
            }
        } catch (err) {
            setStatusMsg({
                type: 'error',
                text: err?.response?.data?.message || 'Failed to update platform settings.'
            });
        } finally {
            setSaving(false);
            setPendingAction(null);
        }
    };

    const handleRollbackVersion = async () => {
        if (!window.confirm('Are you sure you want to rollback version control settings to the previous valid configuration?')) return;
        setSaving(true);
        setStatusMsg({ type: '', text: '' });
        try {
            const res = await rollbackAdminVersion();
            setStatusMsg({ type: 'success', text: res?.message || 'Version configuration rolled back successfully.' });
            fetchSettings();
        } catch (err) {
            setStatusMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to rollback version configuration.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="admin-loading-state" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                <RefreshCw size={36} className="animate-spin text-indigo-400 mb-3" />
                <p>Loading centralized platform settings...</p>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="admin-error-box" style={{ background: '#1e1b4b', border: '1px solid #4338ca', padding: '24px', borderRadius: '12px', color: '#e0e7ff', textAlign: 'center' }}>
                <AlertTriangle size={32} className="text-amber-400 mx-auto mb-2" />
                <p>Unable to retrieve platform settings.</p>
                <button
                    onClick={fetchSettings}
                    className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
                >
                    Retry Loading
                </button>
            </div>
        );
    }

    return (
        <div className="admin-settings-container" style={{ padding: '4px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header / Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Sliders className="text-indigo-400" size={26} />
                        Global App Configuration
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '4px' }}>
                        Centralized kill-switches, maintenance gates, registration control, and AI cluster preferences.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={fetchSettings}
                        disabled={saving}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 16px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#e2e8f0',
                            fontSize: '0.875rem',
                            cursor: 'pointer'
                        }}
                    >
                        <RefreshCw size={15} />
                        Reload
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSave(false)}
                        disabled={saving}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 20px',
                            background: '#4f46e5',
                            border: '1px solid #6366f1',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)'
                        }}
                    >
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Applying...' : 'Save Configuration'}
                    </button>
                </div>
            </div>

            {/* Notification / Toast Message */}
            {statusMsg.text && (
                <div
                    style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '0.875rem',
                        background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        border: `1px solid ${statusMsg.type === 'error' ? '#ef4444' : '#10b981'}`,
                        color: statusMsg.type === 'error' ? '#fca5a5' : '#6ee7b7'
                    }}
                >
                    {statusMsg.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{statusMsg.text}</span>
                </div>
            )}

            {/* Precedence Banner */}
            <div
                style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#94a3b8',
                    fontSize: '0.85rem'
                }}
            >
                <Info size={20} className="text-indigo-400 flex-shrink-0" />
                <div>
                    <strong style={{ color: '#cbd5e1' }}>Rule Precedence Hierarchy:</strong>{' '}
                    <span style={{ color: '#38bdf8' }}>Global Kill-Switch</span> &gt;&gt;{' '}
                    <span style={{ color: '#fbbf24' }}>Individual User Blocked Features</span> &gt;&gt;{' '}
                    <span style={{ color: '#34d399' }}>Subscription Quotas & Entitlements</span>.
                    Disabling a feature globally overrides all user tier access.
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                {/* 1. Platform Maintenance Gate */}
                <div
                    style={{
                        background: settings.maintenanceMode.enabled ? 'rgba(239, 68, 68, 0.08)' : '#0f172a',
                        border: `1px solid ${settings.maintenanceMode.enabled ? '#ef4444' : '#1e293b'}`,
                        borderRadius: '12px',
                        padding: '20px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ padding: '8px', borderRadius: '8px', background: settings.maintenanceMode.enabled ? 'rgba(239, 68, 68, 0.2)' : 'rgba(51, 65, 85, 0.5)' }}>
                                <AlertTriangle size={20} color={settings.maintenanceMode.enabled ? '#ef4444' : '#94a3b8'} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>Maintenance Mode</h3>
                                <span style={{ fontSize: '0.75rem', color: settings.maintenanceMode.enabled ? '#f87171' : '#64748b' }}>
                                    {settings.maintenanceMode.enabled ? 'Traffic Restricted (HTTP 503)' : 'Public Traffic Normal'}
                                </span>
                            </div>
                        </div>

                        {/* Toggle Button */}
                        <button
                            type="button"
                            onClick={() => {
                                setSettings(prev => ({
                                    ...prev,
                                    maintenanceMode: {
                                        ...prev.maintenanceMode,
                                        enabled: !prev.maintenanceMode.enabled
                                    }
                                }));
                            }}
                            style={{
                                width: '48px',
                                height: '26px',
                                borderRadius: '13px',
                                background: settings.maintenanceMode.enabled ? '#ef4444' : '#334155',
                                position: 'relative',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                        >
                            <span
                                style={{
                                    display: 'block',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: '#ffffff',
                                    position: 'absolute',
                                    top: '3px',
                                    left: settings.maintenanceMode.enabled ? '25px' : '3px',
                                    transition: 'left 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                }}
                            />
                        </button>
                    </div>

                    <div style={{ marginTop: '14px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                            Maintenance Notice Message
                        </label>
                        <textarea
                            value={settings.maintenanceMode.message}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSettings(prev => ({
                                    ...prev,
                                    maintenanceMode: { ...prev.maintenanceMode, message: val }
                                }));
                            }}
                            rows={3}
                            style={{
                                width: '100%',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: '#e2e8f0',
                                padding: '10px',
                                fontSize: '0.85rem',
                                resize: 'vertical'
                            }}
                            placeholder="Enter maintenance banner text for users..."
                        />
                    </div>

                    <div style={{ marginTop: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                            Allowed Developer/QA IPs (Comma-separated bypass)
                        </label>
                        <input
                            type="text"
                            value={settings.maintenanceMode.allowedIps?.join(', ') || ''}
                            onChange={(e) => {
                                const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                setSettings(prev => ({
                                    ...prev,
                                    maintenanceMode: { ...prev.maintenanceMode, allowedIps: list }
                                }));
                            }}
                            style={{
                                width: '100%',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: '#e2e8f0',
                                padding: '8px 10px',
                                fontSize: '0.85rem'
                            }}
                            placeholder="e.g. 127.0.0.1, 192.168.1.10"
                        />
                    </div>
                </div>

                {/* 2. User Registration Control */}
                <div
                    style={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '12px',
                        padding: '20px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ padding: '8px', borderRadius: '8px', background: settings.newRegistrationEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}>
                                <Users size={20} color={settings.newRegistrationEnabled ? '#10b981' : '#ef4444'} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>New User Registration</h3>
                                <span style={{ fontSize: '0.75rem', color: settings.newRegistrationEnabled ? '#34d399' : '#f87171' }}>
                                    {settings.newRegistrationEnabled ? 'Signups Allowed (Open)' : 'Signups Closed (Login Only)'}
                                </span>
                            </div>
                        </div>

                        {/* Toggle Button */}
                        <button
                            type="button"
                            onClick={() => {
                                setSettings(prev => ({
                                    ...prev,
                                    newRegistrationEnabled: !prev.newRegistrationEnabled
                                }));
                            }}
                            style={{
                                width: '48px',
                                height: '26px',
                                borderRadius: '13px',
                                background: settings.newRegistrationEnabled ? '#10b981' : '#334155',
                                position: 'relative',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                        >
                            <span
                                style={{
                                    display: 'block',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: '#ffffff',
                                    position: 'absolute',
                                    top: '3px',
                                    left: settings.newRegistrationEnabled ? '25px' : '3px',
                                    transition: 'left 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                }}
                            />
                        </button>
                    </div>

                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.5' }}>
                        When disabled, both email/password registration and first-time Google OAuth onboarding will be rejected with HTTP 403. Existing verified users can continue logging in.
                    </p>

                    <div style={{ marginTop: '18px', padding: '12px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid #334155' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {settings.newRegistrationEnabled ? <Unlock size={14} className="text-emerald-400" /> : <Lock size={14} className="text-red-400" />}
                            {settings.newRegistrationEnabled ? 'Public onboarding pipeline is healthy and accepting signups.' : 'Public registration gate is active.'}
                        </span>
                    </div>
                </div>

                {/* 3. AI Cluster Configuration */}
                <div
                    style={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '12px',
                        padding: '20px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.2)' }}>
                            <Cpu size={20} color="#818cf8" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>AI Provider Routing</h3>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>LLM Dispatch Priority</span>
                        </div>
                    </div>

                    <div style={{ marginTop: '10px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                            Preferred Default LLM Provider
                        </label>
                        <select
                            value={settings.ai?.defaultProvider || 'auto'}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSettings(prev => ({
                                    ...prev,
                                    ai: { ...prev.ai, defaultProvider: val }
                                }));
                            }}
                            style={{
                                width: '100%',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: '#e2e8f0',
                                padding: '9px 12px',
                                fontSize: '0.85rem'
                            }}
                        >
                            <option value="auto">Auto Waterfall (Groq Multi-Key → Gemini → OpenRouter)</option>
                            <option value="groq">Groq (Ultra-Low Latency LPU Pool)</option>
                            <option value="gemini">Google Gemini (Flash 3.5 / Pro Multi-Key)</option>
                            <option value="openrouter">OpenRouter (Multi-Model Aggregator)</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                Free Monthly Quota
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={settings.generationLimits?.freeTierMonthlyQuota ?? 2}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 0;
                                    setSettings(prev => ({
                                        ...prev,
                                        generationLimits: { ...prev.generationLimits, freeTierMonthlyQuota: val }
                                    }));
                                }}
                                style={{
                                    width: '100%',
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: '#e2e8f0',
                                    padding: '8px 10px',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                Free Daily Chat Limit
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="1000"
                                value={settings.generationLimits?.freeTierDailyAssistantLimit ?? 50}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 0;
                                    setSettings(prev => ({
                                        ...prev,
                                        generationLimits: { ...prev.generationLimits, freeTierDailyAssistantLimit: val }
                                    }));
                                }}
                                style={{
                                    width: '100%',
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: '#e2e8f0',
                                    padding: '8px 10px',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Global Feature Kill-Switches */}
            <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#f8fafc', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={18} className="text-indigo-400" />
                    Global Feature Kill-Switches
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    {/* Resume Generation */}
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileText size={18} className="text-indigo-400" />
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#e2e8f0' }}>Resume Generation</div>
                                <div style={{ fontSize: '0.75rem', color: settings.features?.resumeGeneration ? '#34d399' : '#f87171' }}>
                                    {settings.features?.resumeGeneration ? 'Enabled Globally' : 'Disabled Globally'}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleFeatureToggle('resumeGeneration')}
                            style={{
                                width: '42px',
                                height: '22px',
                                borderRadius: '11px',
                                background: settings.features?.resumeGeneration ? '#4f46e5' : '#334155',
                                position: 'relative',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <span style={{ display: 'block', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: settings.features?.resumeGeneration ? '23px' : '3px', transition: 'left 0.2s' }} />
                        </button>
                    </div>

                    {/* Interview Reports */}
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Sparkles size={18} className="text-amber-400" />
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#e2e8f0' }}>Mock Interview Reports</div>
                                <div style={{ fontSize: '0.75rem', color: settings.features?.interviewReports ? '#34d399' : '#f87171' }}>
                                    {settings.features?.interviewReports ? 'Enabled Globally' : 'Disabled Globally'}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleFeatureToggle('interviewReports')}
                            style={{
                                width: '42px',
                                height: '22px',
                                borderRadius: '11px',
                                background: settings.features?.interviewReports ? '#4f46e5' : '#334155',
                                position: 'relative',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <span style={{ display: 'block', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: settings.features?.interviewReports ? '23px' : '3px', transition: 'left 0.2s' }} />
                        </button>
                    </div>

                    {/* AI Assistant */}
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Cpu size={18} className="text-emerald-400" />
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#e2e8f0' }}>AI Assistant Copilot</div>
                                <div style={{ fontSize: '0.75rem', color: settings.features?.aiAssistant ? '#34d399' : '#f87171' }}>
                                    {settings.features?.aiAssistant ? 'Enabled Globally' : 'Disabled Globally'}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleFeatureToggle('aiAssistant')}
                            style={{
                                width: '42px',
                                height: '22px',
                                borderRadius: '11px',
                                background: settings.features?.aiAssistant ? '#4f46e5' : '#334155',
                                position: 'relative',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <span style={{ display: 'block', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: settings.features?.aiAssistant ? '23px' : '3px', transition: 'left 0.2s' }} />
                        </button>
                    </div>

                    {/* Cover Letter Generation */}
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileCode size={18} className="text-sky-400" />
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#e2e8f0' }}>Cover Letter Generation</div>
                                <div style={{ fontSize: '0.75rem', color: settings.features?.coverLetterGeneration ? '#34d399' : '#f87171' }}>
                                    {settings.features?.coverLetterGeneration ? 'Enabled Globally' : 'Disabled Globally'}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleFeatureToggle('coverLetterGeneration')}
                            style={{
                                width: '42px',
                                height: '22px',
                                borderRadius: '11px',
                                background: settings.features?.coverLetterGeneration ? '#4f46e5' : '#334155',
                                position: 'relative',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <span style={{ display: 'block', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: settings.features?.coverLetterGeneration ? '23px' : '3px', transition: 'left 0.2s' }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* 5. Application Version & Force Update Control */}
            <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowUpCircle size={18} className="text-emerald-400" />
                        Application Version & Force Update Control
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: '#1e293b', padding: '4px 8px', borderRadius: '6px', border: '1px solid #334155' }}>
                            Client Running: <strong style={{ color: '#38bdf8' }}>v{CLIENT_APP_VERSION}</strong>
                        </span>

                        <button
                            type="button"
                            onClick={handleRollbackVersion}
                            disabled={saving}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid #334155',
                                color: '#cbd5e1',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                            }}
                            title="Revert to previous valid version configuration"
                        >
                            <RotateCcw size={12} />
                            <span>Rollback Version Config</span>
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '12px',
                        padding: '20px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                >
                    {/* Mandatory Update Toggle Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '16px', borderBottom: '1px solid #1e293b' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: '600', color: '#f1f5f9', fontSize: '0.95rem' }}>Mandatory Force Update Gate</span>
                                <span style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    background: settings.versionControl?.mandatoryUpdate ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                    color: settings.versionControl?.mandatoryUpdate ? '#f87171' : '#34d399',
                                    border: settings.versionControl?.mandatoryUpdate ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
                                }}>
                                    {settings.versionControl?.mandatoryUpdate ? 'STRICT GATE ENGAGED' : 'OPTIONAL NOTIFICATIONS ONLY'}
                                </span>
                            </div>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                                When engaged, users running clients below the minimum supported version will be blocked with a full-screen upgrade prompt and backend HTTP 426 rejection.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setSettings(prev => ({
                                    ...prev,
                                    versionControl: {
                                        ...prev.versionControl,
                                        mandatoryUpdate: !prev.versionControl?.mandatoryUpdate
                                    }
                                }));
                            }}
                            style={{
                                width: '48px',
                                height: '26px',
                                borderRadius: '13px',
                                background: settings.versionControl?.mandatoryUpdate ? '#ef4444' : '#334155',
                                position: 'relative',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                flexShrink: 0
                            }}
                        >
                            <span
                                style={{
                                    display: 'block',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: '#ffffff',
                                    position: 'absolute',
                                    top: '3px',
                                    left: settings.versionControl?.mandatoryUpdate ? '25px' : '3px',
                                    transition: 'left 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                }}
                            />
                        </button>
                    </div>

                    {/* Version Inputs Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '18px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                                Minimum Supported Version <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="1.0.0"
                                value={settings.versionControl?.minimumSupportedVersion || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSettings(prev => ({
                                        ...prev,
                                        versionControl: { ...prev.versionControl, minimumSupportedVersion: val }
                                    }));
                                }}
                                style={{
                                    width: '100%',
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: '#e2e8f0',
                                    padding: '8px 10px',
                                    fontSize: '0.85rem'
                                }}
                            />
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Versions below this are blocked</span>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                                Latest Recommended Version <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="1.2.0"
                                value={settings.versionControl?.latestRecommendedVersion || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSettings(prev => ({
                                        ...prev,
                                        versionControl: { ...prev.versionControl, latestRecommendedVersion: val }
                                    }));
                                }}
                                style={{
                                    width: '100%',
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: '#e2e8f0',
                                    padding: '8px 10px',
                                    fontSize: '0.85rem'
                                }}
                            />
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Suggested optional update</span>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                                Current Platform Release
                            </label>
                            <input
                                type="text"
                                placeholder="1.2.0"
                                value={settings.versionControl?.currentVersion || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSettings(prev => ({
                                        ...prev,
                                        versionControl: { ...prev.versionControl, currentVersion: val }
                                    }));
                                }}
                                style={{
                                    width: '100%',
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: '#e2e8f0',
                                    padding: '8px 10px',
                                    fontSize: '0.85rem'
                                }}
                            />
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Primary backend release tag</span>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                                Update Destination URL
                            </label>
                            <input
                                type="text"
                                placeholder="https://kiviapp.com/download"
                                value={settings.versionControl?.updateUrl || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSettings(prev => ({
                                        ...prev,
                                        versionControl: { ...prev.versionControl, updateUrl: val }
                                    }));
                                }}
                                style={{
                                    width: '100%',
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: '#e2e8f0',
                                    padding: '8px 10px',
                                    fontSize: '0.85rem'
                                }}
                            />
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>App store, download, or release page</span>
                        </div>
                    </div>

                    {/* Announcement Inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                                Update Announcement Headline (Optional)
                            </label>
                            <input
                                type="text"
                                maxLength={150}
                                placeholder="e.g. Major AI Model & Performance Update Available"
                                value={settings.versionControl?.updateAnnouncement?.title || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSettings(prev => ({
                                        ...prev,
                                        versionControl: {
                                            ...prev.versionControl,
                                            updateAnnouncement: {
                                                ...prev.versionControl?.updateAnnouncement,
                                                title: val
                                            }
                                        }
                                    }));
                                }}
                                style={{
                                    width: '100%',
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: '#e2e8f0',
                                    padding: '8px 10px',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                                Release Notes / Announcement Details (Optional)
                            </label>
                            <textarea
                                rows={2}
                                maxLength={500}
                                placeholder="Brief summary of new features or mandatory security upgrades included in this release..."
                                value={settings.versionControl?.updateAnnouncement?.message || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSettings(prev => ({
                                        ...prev,
                                        versionControl: {
                                            ...prev.versionControl,
                                            updateAnnouncement: {
                                                ...prev.versionControl?.updateAnnouncement,
                                                message: val
                                            }
                                        }
                                    }));
                                }}
                                style={{
                                    width: '100%',
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: '#e2e8f0',
                                    padding: '8px 10px',
                                    fontSize: '0.85rem',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Audit attribution footer */}
            <div style={{ marginTop: '30px', padding: '12px 16px', background: '#0b1120', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.75rem' }}>
                <span>Last Updated By: <strong style={{ color: '#94a3b8' }}>{settings.lastUpdatedByUsername || 'system'}</strong></span>
                <span>Last Modified: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'N/A'}</span>
            </div>

            {/* Critical Action Confirmation Modal */}
            {pendingAction && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: '16px'
                    }}
                >
                    <div
                        style={{
                            background: '#0f172a',
                            border: '1px solid #dc2626',
                            borderRadius: '14px',
                            maxWidth: '480px',
                            width: '100%',
                            padding: '24px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.2)' }}>
                                <AlertTriangle size={24} className="text-red-500" />
                            </div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                                {pendingAction.title}
                            </h3>
                        </div>

                        <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
                            {pendingAction.description}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={() => setPendingAction(null)}
                                style={{
                                    padding: '8px 16px',
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: '#cbd5e1',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSave(true)}
                                style={{
                                    padding: '8px 20px',
                                    background: '#dc2626',
                                    border: '1px solid #ef4444',
                                    borderRadius: '8px',
                                    color: '#ffffff',
                                    fontWeight: '600',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Confirm & Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

