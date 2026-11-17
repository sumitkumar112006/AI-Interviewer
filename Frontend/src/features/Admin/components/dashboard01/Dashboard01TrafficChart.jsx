import React, { useState } from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import { Activity, Eye, EyeOff, Layers } from 'lucide-react';

const SERIES_CONFIG = [
    { key: 'resumes', label: 'Resumes & Rewrites', color: '#38bdf8', fill: 'url(#trafficResumeGrad)' },
    { key: 'interviews', label: 'Mock Interview Reports', color: '#6366f1', fill: 'url(#trafficInterviewGrad)' },
    { key: 'coverLetters', label: 'Cover Letters', color: '#a855f7', fill: 'url(#trafficCoverLetterGrad)' },
    { key: 'aiAssistant', label: 'AI Assistant Invocations', color: '#f59e0b', fill: 'url(#trafficAiGrad)' }
];

export default function Dashboard01TrafficChart({ data, loading, isHourly }) {
    const [hiddenSeries, setHiddenSeries] = useState(new Set());

    const toggleSeries = (key) => {
        setHiddenSeries(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const seriesData = data?.series || [];
    const totalEvents = data?.totalEvents || 0;

    const formatXAxis = (tickItem) => {
        if (!tickItem) return '';
        if (isHourly) {
            // tickItem like "2026-11-09 14:00"
            const parts = tickItem.split(' ');
            return parts[1] || tickItem;
        }
        // tickItem like "2026-11-09"
        try {
            const d = new Date(tickItem);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (_) {
            return tickItem;
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;

        let displayLabel = label;
        try {
            if (!isHourly) {
                const d = new Date(label);
                displayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            }
        } catch (_) {}

        const currentTotal = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);

        return (
            <div className="custom-recharts-tooltip">
                <div className="tooltip-header">
                    <span className="tooltip-timestamp">{displayLabel}</span>
                    <span className="tooltip-total-pill">{currentTotal} events</span>
                </div>
                <div className="tooltip-items-list">
                    {payload.map((item, index) => (
                        <div key={index} className="tooltip-item-row">
                            <span className="item-color-dot" style={{ backgroundColor: item.color }}></span>
                            <span className="item-name">{item.name}:</span>
                            <span className="item-val">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-01-chart-card traffic-chart-card">
            <div className="chart-card-header">
                <div className="header-text-group">
                    <div className="title-row">
                        <h3>Application Traffic & Activity</h3>
                        <span className="live-count-badge">
                            <Activity size={12} />
                            {totalEvents.toLocaleString('en-IN')} Total Events
                        </span>
                    </div>
                    <p className="chart-description">
                        Aggregated operational throughput across resumes, ATS scores, mock interviews, and AI assistant invocations.
                    </p>
                </div>

                {/* Series Visibility Toggles */}
                <div className="series-toggles-row">
                    {SERIES_CONFIG.map(sc => {
                        const isHidden = hiddenSeries.has(sc.key);
                        return (
                            <button
                                key={sc.key}
                                type="button"
                                className={`series-toggle-pill ${isHidden ? 'hidden-series' : 'active-series'}`}
                                onClick={() => toggleSeries(sc.key)}
                                title={isHidden ? `Show ${sc.label}` : `Hide ${sc.label}`}
                            >
                                <span className="toggle-dot" style={{ backgroundColor: sc.color }}></span>
                                <span>{sc.label}</span>
                                {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="chart-card-body">
                {loading ? (
                    <div className="chart-loading-state">
                        <div className="loading-spinner-ring"></div>
                        <span>Aggregating application traffic across collections...</span>
                    </div>
                ) : seriesData.length === 0 ? (
                    <div className="chart-empty-state">
                        <Layers size={32} className="empty-icon" />
                        <p>No operational activity recorded in the selected window.</p>
                        <span className="empty-sub">Activity will populate automatically when users generate resumes or reports.</span>
                    </div>
                ) : (
                    <div className="recharts-wrapper-container" style={{ width: '100%', height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={seriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="trafficResumeGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                                    </linearGradient>
                                    <linearGradient id="trafficInterviewGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                                    </linearGradient>
                                    <linearGradient id="trafficCoverLetterGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                                    </linearGradient>
                                    <linearGradient id="trafficAiGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                <XAxis
                                    dataKey="timestamp"
                                    tickFormatter={formatXAxis}
                                    stroke="#64748b"
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                {!hiddenSeries.has('resumes') && (
                                    <Area
                                        type="monotone"
                                        dataKey="resumes"
                                        name="Resumes & Rewrites"
                                        stroke="#38bdf8"
                                        strokeWidth={2}
                                        fill="url(#trafficResumeGrad)"
                                        stackId="1"
                                    />
                                )}
                                {!hiddenSeries.has('interviews') && (
                                    <Area
                                        type="monotone"
                                        dataKey="interviews"
                                        name="Mock Interviews"
                                        stroke="#6366f1"
                                        strokeWidth={2}
                                        fill="url(#trafficInterviewGrad)"
                                        stackId="1"
                                    />
                                )}
                                {!hiddenSeries.has('coverLetters') && (
                                    <Area
                                        type="monotone"
                                        dataKey="coverLetters"
                                        name="Cover Letters"
                                        stroke="#a855f7"
                                        strokeWidth={2}
                                        fill="url(#trafficCoverLetterGrad)"
                                        stackId="1"
                                    />
                                )}
                                {!hiddenSeries.has('aiAssistant') && (
                                    <Area
                                        type="monotone"
                                        dataKey="aiAssistant"
                                        name="AI Assistant"
                                        stroke="#f59e0b"
                                        strokeWidth={2}
                                        fill="url(#trafficAiGrad)"
                                        stackId="1"
                                    />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}

