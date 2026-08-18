import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInterview } from '../hooks/useInterview'
import LoadingPage from '../Loading'
import '../style/allreports.scss'

/* ─── helpers ─────────────────────────────────────────────── */
function extractObjectId(v) {
    if (!v) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'object' && '$oid' in v) return String(v.$oid ?? '').trim()
    return String(v).trim()
}

function extractDateValue(v) {
    if (!v) return ''
    if (typeof v === 'string' || v instanceof Date) return v
    if (typeof v === 'object' && '$date' in v) return v.$date
    return v
}

function formatDateTime(v) {
    if (!v) return '—'
    const d = new Date(extractDateValue(v))
    if (isNaN(d.getTime())) return '—'
    return {
        date: new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d),
        time: new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(d),
        raw: d,
    }
}

function getTitle(r) {
    return (r?.developerTitle || r?.Title || r?.title || 'Untitled Report').trim()
}

function getScore(r) {
    const s = r?.matchScore ?? r?.score
    if (s === undefined || s === null) return null
    return typeof s === 'number' ? s : parseInt(String(s).replace('%', ''))
}

function getStatus(score) {
    if (score === null) return { label: '—', cls: 'status-na' }
    if (score >= 85) return { label: 'Excellent', cls: 'status-excellent' }
    if (score >= 75) return { label: 'Good', cls: 'status-good' }
    if (score >= 50) return { label: 'Average', cls: 'status-average' }
    return { label: 'Poor', cls: 'status-poor' }
}

function getScoreColor(score) {
    if (score === null) return '#6b7fa8'
    if (score >= 85) return '#22c55e'
    if (score >= 75) return '#f59e0b'
    if (score >= 50) return '#6366f1'
    return '#ef4444'
}

/* SVG sparkline from an array of values */
function Sparkline({ values = [], color = '#6366f1', width = 80, height = 28 }) {
    if (values.length < 2) return <svg width={width} height={height} />
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const pts = values.map((v, i) => {
        const x = (i / (values.length - 1)) * width
        const y = height - ((v - min) / range) * (height - 4) - 2
        return `${x},${y}`
    }).join(' ')
    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

/* SVG donut chart */
function DonutChart({ segments, size = 130, stroke = 22 }) {
    const r = (size - stroke) / 2
    const circ = 2 * Math.PI * r
    const cx = size / 2, cy = size / 2
    let offset = 0
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            {segments.map((s, i) => {
                const dash = (s.pct / 100) * circ
                const el = (
                    <circle
                        key={i}
                        cx={cx} cy={cy} r={r}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={stroke}
                        strokeDasharray={`${dash} ${circ - dash}`}
                        strokeDashoffset={-offset}
                        strokeLinecap="butt"
                    />
                )
                offset += dash
                return el
            })}
        </svg>
    )
}

const ROLES = ['All Roles', 'Front-End Developer', 'Back-End Developer', 'Full-Stack Developer', 'React Developer', 'Software Engineer']
const STATUSES = ['All Status', 'Excellent', 'Good', 'Average', 'Poor']
const TIME_FILTERS = ['All Time', 'Last 7 Days', 'Last 30 Days', 'Last 3 Months']
const SORT_OPTIONS = ['Newest First', 'Oldest First', 'Highest Score', 'Lowest Score']
const PAGE_SIZE = 8

const MAJOR_SKILLS_LIST = [
    { name: 'JavaScript', category: 'Languages', match: ['javascript', 'js'] },
    { name: 'TypeScript', category: 'Languages', match: ['typescript', 'ts'] },
    { name: 'Python', category: 'Languages', match: ['python', 'python3'] },
    { name: 'Java', category: 'Languages', match: ['java', 'jdk'] },
    { name: 'C++', category: 'Languages', match: ['c++', 'cpp'] },
    { name: 'SQL', category: 'Languages', match: ['sql', 'mysql', 'postgres', 'postgresql'] },
    { name: 'Node.js', category: 'Frameworks', match: ['node.js', 'nodejs', 'node'] },
    { name: 'React', category: 'Frameworks', match: ['react', 'react.js', 'reactjs'] },
    { name: 'Express.js', category: 'Frameworks', match: ['express.js', 'expressjs', 'express'] },
    { name: 'Next.js', category: 'Frameworks', match: ['next.js', 'nextjs'] },
    { name: 'HTML/CSS', category: 'Frameworks', match: ['html', 'css', 'scss', 'sass', 'tailwind'] },
    { name: 'MongoDB', category: 'Databases', match: ['mongodb', 'mongo', 'mongoose'] },
    { name: 'Redis', category: 'Databases', match: ['redis'] },
    { name: 'Docker', category: 'DevOps', match: ['docker', 'container'] },
    { name: 'AWS', category: 'DevOps', match: ['aws', 's3', 'ec2', 'lambda'] },
    { name: 'Git', category: 'DevOps', match: ['git', 'github'] },
    { name: 'System Design', category: 'Core', match: ['system design', 'architecture'] },
    { name: 'Data Structures', category: 'Core', match: ['data structures', 'dsa', 'algorithms'] },
    { name: 'REST APIs', category: 'Core', match: ['rest', 'rest api', 'restful'] }
]

function extractMajorSkillsFromReport(r) {
    if (Array.isArray(r?.detectedSkills) && r.detectedSkills.length > 0) {
        return r.detectedSkills
    }
    const text = [
        r?.developerTitle || '',
        r?.title || '',
        ...(r?.technicalQuestions || []).map(q => q.question || ''),
        ...(r?.skillGaps || []).map(s => s.skill || '')
    ].join(' ').toLowerCase()

    const score = getScore(r) ?? 75

    const matches = []
    MAJOR_SKILLS_LIST.forEach(item => {
        const isMatched = item.match.some(m => {
            const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-zA-Z0-9_#+])`, 'i')
            return regex.test(text)
        })
        if (isMatched) {
            matches.push({ name: item.name, category: item.category, score })
        }
    })
    return matches
}

const AllReports = () => {
    const { loading, reports, getReports, deleteReport } = useInterview()
    const navigate = useNavigate()
    const hasLoaded = React.useRef(false)

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('All Status')
    const [roleFilter, setRoleFilter] = useState('All Roles')
    const [timeFilter, setTimeFilter] = useState('All Time')
    const [sort, setSort] = useState('Newest First')
    const [page, setPage] = useState(1)
    const [deletingId, setDeletingId] = useState(null)
    const [skillViewMode, setSkillViewMode] = useState('list') // 'list' | 'graph'

    useEffect(() => {
        if (reports !== null || hasLoaded.current) return
        hasLoaded.current = true
        void getReports()
    }, [getReports, reports])

    const allReports = useMemo(() => Array.isArray(reports) ? reports : [], [reports])

    /* ── computed stats ── */
    const stats = useMemo(() => {
        const scores = allReports.map(getScore).filter(s => s !== null)
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
        const passed = allReports.filter(r => (getScore(r) ?? 0) >= 75).length
        const failed = allReports.filter(r => { const s = getScore(r); return s !== null && s < 75 }).length
        const highest = scores.length ? Math.max(...scores) : 0
        const highestReport = allReports.find(r => getScore(r) === highest)
        return { total: allReports.length, avg, passed, failed, highest, highestTitle: getTitle(highestReport || {}) }
    }, [allReports])

    /* score distribution */
    const distribution = useMemo(() => {
        const excellent = allReports.filter(r => (getScore(r) ?? -1) >= 85).length
        const good = allReports.filter(r => { const s = getScore(r); return s !== null && s >= 75 && s < 85 }).length
        const average = allReports.filter(r => { const s = getScore(r); return s !== null && s >= 50 && s < 75 }).length
        const poor = allReports.filter(r => { const s = getScore(r); return s !== null && s < 50 }).length
        const total = excellent + good + average + poor || 1
        return [
            { label: 'Excellent (90-100%)', color: '#22c55e', count: excellent, pct: Math.round(excellent / total * 100) },
            { label: 'Good (75-89%)', color: '#6366f1', count: good, pct: Math.round(good / total * 100) },
            { label: 'Average (50-74%)', color: '#f59e0b', count: average, pct: Math.round(average / total * 100) },
            { label: 'Poor (0-49%)', color: '#ef4444', count: poor, pct: Math.round(poor / total * 100) },
        ]
    }, [allReports])

    /* skill performance & major tech stack aggregation */
    const skillPerf = useMemo(() => {
        const map = {}
        allReports.forEach(r => {
            const detected = extractMajorSkillsFromReport(r)
            detected.forEach(sk => {
                if (!map[sk.name]) {
                    map[sk.name] = { name: sk.name, category: sk.category, count: 0, scores: [] }
                }
                map[sk.name].count += 1
                map[sk.name].scores.push(sk.score || 75)
            })
        })
        return Object.values(map)
            .map(item => ({
                name: item.name,
                category: item.category,
                count: item.count,
                avg: Math.round(item.scores.reduce((a, b) => a + b, 0) / item.scores.length)
            }))
            .filter(sk => sk.avg >= 50)
            .sort((a, b) => b.count - a.count || b.avg - a.avg)
            .slice(0, 7)
    }, [allReports])

    /* sparkline history */
    const sparkValues = useMemo(() => {
        return [...allReports]
            .sort((a, b) => new Date(extractDateValue(a.createdAt)) - new Date(extractDateValue(b.createdAt)))
            .map(r => getScore(r) ?? 0)
            .slice(-10)
    }, [allReports])

    /* timeline (last 8) */
    const timeline = useMemo(() => {
        return [...allReports]
            .sort((a, b) => new Date(extractDateValue(b.createdAt)) - new Date(extractDateValue(a.createdAt)))
            .slice(0, 8)
    }, [allReports])

    /* ── filtered + sorted list ── */
    const filtered = useMemo(() => {
        const now = new Date()
        return [...allReports]
            .filter(r => {
                if (search && !getTitle(r).toLowerCase().includes(search.toLowerCase())) return false
                if (statusFilter !== 'All Status') {
                    const st = getStatus(getScore(r))
                    if (st.label !== statusFilter) return false
                }
                if (roleFilter !== 'All Roles') {
                    if (!getTitle(r).toLowerCase().includes(roleFilter.toLowerCase())) return false
                }
                if (timeFilter !== 'All Time') {
                    const d = new Date(extractDateValue(r.createdAt))
                    const days = timeFilter === 'Last 7 Days' ? 7 : timeFilter === 'Last 30 Days' ? 30 : 90
                    if ((now - d) / 86400000 > days) return false
                }
                return true
            })
            .sort((a, b) => {
                if (sort === 'Newest First') return new Date(extractDateValue(b.createdAt)) - new Date(extractDateValue(a.createdAt))
                if (sort === 'Oldest First') return new Date(extractDateValue(a.createdAt)) - new Date(extractDateValue(b.createdAt))
                if (sort === 'Highest Score') return (getScore(b) ?? 0) - (getScore(a) ?? 0)
                return (getScore(a) ?? 0) - (getScore(b) ?? 0)
            })
    }, [allReports, search, statusFilter, roleFilter, timeFilter, sort])

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    useEffect(() => { setPage(1) }, [search, statusFilter, roleFilter, timeFilter, sort])

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this report?')) return
        setDeletingId(id)
        try { await deleteReport(id) } finally { setDeletingId(null) }
    }

    if (loading && !allReports.length) return <main><LoadingPage /></main>

    /* ── group timeline by month ── */
    function groupByMonth(items) {
        const groups = {}
        items.forEach(r => {
            const dt = formatDateTime(r.createdAt)
            const key = dt.raw ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(dt.raw) : 'Unknown'
            if (!groups[key]) groups[key] = []
            groups[key].push(r)
        })
        return groups
    }
    const timelineGroups = groupByMonth(timeline)

    return (
        <div className="ar-page">
            {/* ── PAGE HEADER ── */}
            <div className="ar-topbar">
                <div>
                    <h1>Reports</h1>
                    <p>Track and analyze all your interview performance in one place.</p>
                </div>
                <div className="ar-topbar-right">
                    <div className="ar-search">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports by title, role..." />
                    </div>
                    <button className="ar-export-btn" onClick={() => navigate('/')}>
                        ← Back to Home
                    </button>
                </div>
            </div>

            {/* ── STAT CARDS ── */}
            <div className="ar-stats-row">
                {[
                    { label: 'Total Reports', value: stats.total, sub: 'All time interviews', color: '#6366f1', vals: sparkValues },
                    { label: 'Average Score', value: `${stats.avg}%`, sub: 'Across all interviews', color: '#22c55e', vals: sparkValues },
                    { label: 'Passed', value: stats.passed, sub: `${stats.total ? Math.round(stats.passed / stats.total * 100) : 0}% of total`, color: '#22c55e', vals: sparkValues.map(v => v >= 75 ? 1 : 0) },
                    { label: 'Failed', value: stats.failed, sub: `${stats.total ? Math.round(stats.failed / stats.total * 100) : 0}% of total`, color: '#ef4444', vals: sparkValues.map(v => v < 75 ? 1 : 0) },
                    { label: 'Highest Score', value: `${stats.highest}%`, sub: stats.highestTitle, color: '#f59e0b', vals: sparkValues },
                ].map((s, i) => (
                    <div className="ar-stat-card" key={i}>
                        <div className="ar-stat-header">
                            <span className="ar-stat-label">{s.label}</span>
                        </div>
                        <div className="ar-stat-value" style={{ color: s.color }}>{s.value}</div>
                        <div className="ar-stat-sub">{s.sub}</div>
                        <div className="ar-stat-spark">
                            <Sparkline values={s.vals} color={s.color} />
                        </div>
                    </div>
                ))}
            </div>

            {/* ── MIDDLE ROW ── */}
            <div className="ar-mid-row">
                {/* Score Overview */}
                <div className="ar-panel ar-score-overview">
                    <h3>Score Overview</h3>
                    <div className="ar-donut-wrap">
                        <div className="ar-donut-chart">
                            <DonutChart segments={distribution} />
                            <div className="ar-donut-center">
                                <span className="ar-donut-pct">{stats.avg}%</span>
                                <span className="ar-donut-lbl">Average Score</span>
                            </div>
                        </div>
                        <div className="ar-donut-legend">
                            {distribution.map((d, i) => (
                                <div className="ar-legend-row" key={i}>
                                    <span className="ar-legend-dot" style={{ background: d.color }} />
                                    <span className="ar-legend-label">{d.label}</span>
                                    <span className="ar-legend-count">{d.count}</span>
                                    <span className="ar-legend-pct">{d.pct}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Skill Performance & Tech Stack Preferences */}
                <div className="ar-panel ar-skill-panel">
                    <div className="ar-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>Skill Preferences &amp; Stack</h3>
                        <div className="ar-skill-toggle">
                            <button
                                className={`ar-toggle-btn ${skillViewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setSkillViewMode('list')}
                                title="List View"
                            >
                                ≡ List
                            </button>
                            <button
                                className={`ar-toggle-btn ${skillViewMode === 'graph' ? 'active' : ''}`}
                                onClick={() => setSkillViewMode('graph')}
                                title="Chart Graph View"
                            >
                                📊 Graph
                            </button>
                        </div>
                    </div>

                    {skillPerf.length === 0 ? (
                        <div className="ar-skill-empty">
                            <div className="ar-empty-icon">⚡</div>
                            <p className="ar-empty-sub">No major tech stacks detected yet.</p>
                            <span className="ar-empty-hint">Upload a resume or create an interview report to analyze your top skills.</span>
                        </div>
                    ) : skillViewMode === 'list' ? (
                        <div className="ar-skill-list">
                            {skillPerf.map((sk, i) => (
                                <div className="ar-skill-row" key={i}>
                                    <div className="ar-skill-info">
                                        <span className="ar-skill-name">{sk.name}</span>
                                        <span className="ar-skill-cat">{sk.category}</span>
                                    </div>
                                    <div className="ar-skill-bar-wrap">
                                        <div className="ar-skill-bar" style={{ width: `${sk.avg}%`, background: getScoreColor(sk.avg) }} />
                                    </div>
                                    <span className="ar-skill-pct" style={{ color: getScoreColor(sk.avg) }}>{sk.avg}%</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Graph Chart View */
                        <div className="ar-skill-graph-wrap">
                            <div className="ar-graph-bars">
                                {skillPerf.map((sk, i) => {
                                    const maxCount = Math.max(...skillPerf.map(s => s.count)) || 1
                                    const heightPct = Math.max(25, Math.round((sk.count / maxCount) * 100))
                                    const colors = ['#6366f1', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7', '#3b82f6', '#ec4899']
                                    const color = colors[i % colors.length]
                                    return (
                                        <div className="ar-graph-col" key={i}>
                                            <div className="ar-graph-val">{sk.avg}%</div>
                                            <div className="ar-graph-bar-outer">
                                                <div
                                                    className="ar-graph-bar-inner"
                                                    style={{ height: `${heightPct}%`, background: `linear-gradient(180deg, ${color}, ${color}88)` }}
                                                />
                                            </div>
                                            <span className="ar-graph-label">{sk.name}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Timeline */}
                <div className="ar-panel ar-timeline-panel">
                    <div className="ar-panel-header">
                        <h3>Reports Timeline</h3>
                    </div>
                    <div className="ar-timeline">
                        {Object.entries(timelineGroups).map(([month, items]) => (
                            <div key={month}>
                                <div className="ar-timeline-month">{month}</div>
                                {items.map(r => {
                                    const dt = formatDateTime(r.createdAt)
                                    const score = getScore(r)
                                    const st = getStatus(score)
                                    const id = extractObjectId(r._id)
                                    return (
                                        <div className="ar-timeline-row" key={id} onClick={() => navigate(`/interview/${id}`)}>
                                            <div className="ar-tl-dot" style={{ background: getScoreColor(score) }} />
                                            <div className="ar-tl-info">
                                                <span className="ar-tl-title">{getTitle(r)}</span>
                                                <span className="ar-tl-meta">{score !== null ? `${score}% • ${st.label}` : '—'}</span>
                                            </div>
                                            <div className="ar-tl-time">{dt.date ? `${dt.date.split(' ')[0]} ${dt.date.split(' ')[1]}` : ''}<br />{dt.time}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── ALL REPORTS TABLE ── */}
            <div className="ar-panel ar-table-panel">
                <div className="ar-table-header">
                    <div className="ar-table-title">
                        <h3>All Reports</h3>
                        <span className="ar-count-badge">{filtered.length}</span>
                    </div>
                    <div className="ar-filters">
                        {[
                            { val: statusFilter, set: setStatusFilter, opts: STATUSES },
                            { val: roleFilter, set: setRoleFilter, opts: ROLES },
                            { val: timeFilter, set: setTimeFilter, opts: TIME_FILTERS },
                            { val: sort, set: setSort, opts: SORT_OPTIONS },
                        ].map((f, i) => (
                            <select key={i} value={f.val} onChange={e => f.set(e.target.value)} className="ar-filter-select">
                                {f.opts.map(o => <option key={o}>{o}</option>)}
                            </select>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="ar-table-wrap">
                    <table className="ar-table">
                        <thead>
                            <tr>
                                <th>Interview</th>
                                <th>Role</th>
                                <th>Date &amp; Time</th>
                                <th>Score</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.length === 0 && (
                                <tr><td colSpan={6} className="ar-table-empty">No reports match your filters.</td></tr>
                            )}
                            {paginated.map((r, i) => {
                                const id = extractObjectId(r._id)
                                const title = getTitle(r)
                                const score = getScore(r)
                                const st = getStatus(score)
                                const dt = formatDateTime(r.createdAt)
                                const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#f97316']
                                const iconColor = colors[i % colors.length]
                                return (
                                    <tr key={id} className="ar-table-row" onClick={() => navigate(`/interview/${id}`)}>
                                        <td>
                                            <div className="ar-row-title">
                                                <div className="ar-row-icon" style={{ background: `${iconColor}22`, borderColor: `${iconColor}44` }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                </div>
                                                <div>
                                                    <div className="ar-row-name">{title}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="ar-row-role">{title}</td>
                                        <td className="ar-row-date">{dt.date}<br /><span>{dt.time}</span></td>
                                        <td><span className="ar-row-score" style={{ color: getScoreColor(score) }}>{score !== null ? `${score}%` : '—'}</span></td>
                                        <td><span className={`ar-status-badge ${st.cls}`}>{st.label}</span></td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div className="ar-row-actions">
                                                <button title="View Report" onClick={() => navigate(`/interview/${id}`)}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                </button>
                                                <button title="View Resume" onClick={() => navigate(`/resume/${id}`)}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                </button>
                                                <button title="Delete" className="ar-btn-delete" disabled={deletingId === id} onClick={() => handleDelete(id)}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="ar-pagination">
                        <button className="ar-pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                            <button key={n} className={`ar-pg-btn ${page === n ? 'ar-pg-active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                        ))}
                        <button className="ar-pg-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default AllReports
