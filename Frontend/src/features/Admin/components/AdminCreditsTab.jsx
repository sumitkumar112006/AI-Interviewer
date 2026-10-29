import React, { useState } from 'react';
import { grantUserCredits } from '../services/admin.api';
import { Sparkles, Plus, Minus, CheckCircle, AlertCircle, Coins, Zap } from 'lucide-react';

export const AdminCreditsTab = ({ onRefresh }) => {
    const [identifier, setIdentifier] = useState('');
    const [amount, setAmount] = useState(10);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState({ type: '', text: '' });

    const presets = [5, 10, 25, 50, 100, -10];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!identifier.trim()) return;
        setSubmitting(true);
        setResult({ type: '', text: '' });

        try {
            const res = await grantUserCredits(identifier.trim(), Number(amount));
            setResult({ type: 'success', text: res.message || `Successfully allocated ${amount} bonus credits!` });
            setIdentifier('');
            if (onRefresh) onRefresh();
        } catch (err) {
            setResult({ type: 'error', text: err?.response?.data?.message || 'Failed to allocate bonus credits.' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="admin-credits-section">
            <div className="credits-layout-container">
                <div className="credits-card">
                    <div className="section-title-row">
                        <div className="title-with-icon">
                            <Sparkles size={20} className="icon-accent" />
                            <div>
                                <h2>Grant Bonus Credits</h2>
                                <span className="section-sub">Adjust attempt limits for resumes, mock interviews, and cover letters</span>
                            </div>
                        </div>
                    </div>

                    {result.text && (
                        <div className={`broadcast-result-banner ${result.type}`}>
                            {result.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            <span>{result.text}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="credits-form">
                        <div className="form-item">
                            <label className="field-label">User Email or Database User ID</label>
                            <input
                                type="text"
                                className="console-input"
                                placeholder="e.g. sumit@example.com or 64b8f10..."
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-item">
                            <label className="field-label">Credit Amount Offset</label>
                            <div className="stepper-row">
                                <button
                                    type="button"
                                    className="stepper-btn"
                                    onClick={() => setAmount(prev => Math.max(-500, prev - 5))}
                                    title="Decrease credits"
                                >
                                    <Minus size={16} />
                                </button>
                                <input
                                    type="number"
                                    className="stepper-input"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    min="-500"
                                    max="1000"
                                    required
                                />
                                <button
                                    type="button"
                                    className="stepper-btn"
                                    onClick={() => setAmount(prev => Math.min(1000, prev + 5))}
                                    title="Increase credits"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className="preset-chips-row">
                                {presets.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        className={`preset-chip ${amount === p ? 'active' : ''}`}
                                        onClick={() => setAmount(p)}
                                    >
                                        {p > 0 ? `+${p}` : p} Credits
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-actions-row">
                            <button
                                type="submit"
                                className="console-submit-btn"
                                disabled={submitting}
                            >
                                <Coins size={15} />
                                <span>{submitting ? 'Applying Credits...' : 'Apply Bonus Credits'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
