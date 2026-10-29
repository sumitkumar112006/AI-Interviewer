import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { generateResumePdf, getInterviewReportById, updateResumeHtml, rewriteResumeSection, getActiveJob, getResumeSkillsComparison, calculateResumeAtsScore } from '../services/interview.api'
import { useInterview } from '../hooks/useInterview'
import { useAuth } from '../../Auth/hooks/useAuth'
import ShimmerLoading from '../../Shared/components/ShimmerLoading'
import Loading from '../Loading'
import ResumeEditor from '../components/ResumeEditor'
import ResumeSkillsWindow from '../components/ResumeSkillsWindow'
import { exportElementToPdf } from '../utils/exportToPdf'
import { sanitizeResumeHtml, parseAndSanitizeSnippet } from '../utils/sanitizeResumeHtml'
import { 
    parseSkillsFromHtml, 
    mergeSkills,
    compareResumeSkills 
} from '../utils/resumeSkillsManager'
import '../style/resume.scss'

// ── helper: normalise MongoDB ObjectId ────────────────────────────────────
function extractObjectId(value) {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object' && '$oid' in value) return String(value.$oid ?? '').trim()
    return String(value).trim()
}

// ── helper: validate that resume HTML is healthy and non-empty ────────────
function isHealthyResumeHtml(html) {
    if (!html || typeof html !== 'string') return false
    const stripped = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    // Reject 24-character hexadecimal IDs (MongoDB ObjectIds like 6a8365bd727464329cdbd674)
    if (/^[a-f0-9]{24}$/i.test(stripped)) return false
    // Reject empty or tiny fragments
    if (stripped.length < 30) return false
    return true
}

// ── Resume page ────────────────────────────────────────────────────────────
const Resume = () => {
    const { interviewId } = useParams()
    const navigate = useNavigate()
    const { report, loading, setLoading, getReoprtById, setReport } = useInterview()
    const { user, fetchUsage } = useAuth()

    const [error, setError]           = useState('')
    const [htmlContent, setHtmlContent] = useState('')
    const [resumeSkills, setResumeSkills] = useState([])
    const [dbLoading, setDbLoading]     = useState(true)
    const [aiGenerating, setAiGenerating] = useState(false)
    const [isDirty, setIsDirty]       = useState(false)
    const [saveLoading, setSaveLoading] = useState(false)
    const [printLoading, setPrintLoading] = useState(false)
    const [saveNotification, setSaveNotification] = useState(null) // { message: string, type: 'manual' | 'auto' }

    // ATS Score & Side Window state
    const [matchScore, setMatchScore] = useState(() => report?.matchScore ?? 85)
    const [atsBreakdown, setAtsBreakdown] = useState(() => report?.atsScoreBreakdown || null)
    const [atsLoading, setAtsLoading] = useState(false)
    const [isSkillsWindowOpen, setIsSkillsWindowOpen] = useState(() => {
        try {
            return localStorage.getItem('resume_skills_window_open') === 'true'
        } catch {
            return false
        }
    })
    const [olderSkills, setOlderSkills] = useState([])
    const [skillsLoading, setSkillsLoading] = useState(false)

    // AI Copilot state
    const [isAiOpen, setIsAiOpen]     = useState(false)
    const [selectedText, setSelectedText] = useState('')
    const [chatMessages, setChatMessages] = useState([
        { id: 1, sender: 'ai', text: '👋 Hi! I\'m your AI Resume Copilot. Select any text in the editor, then send me instructions to refine it.' }
    ])
    const [chatInput, setChatInput]   = useState('')
    const [chatLoading, setChatLoading] = useState(false)

    const editorRef  = useRef(null)
    const chatEndRef = useRef(null)
    const atsDebounceTimerRef = useRef(null)

    // ── Load resume HTML with health validation & DB fallback ─────────────
    useEffect(() => {
        let mounted = true
        async function init() {
            setDbLoading(true)
            setError('')

            // 1. Instant check: Do we have a healthy draft in localStorage from recent edits?
            let cachedDraft = null
            try {
                const stored = localStorage.getItem(`resume_draft_${interviewId}`)
                if (isHealthyResumeHtml(stored)) {
                    cachedDraft = stored
                    setHtmlContent(sanitizeResumeHtml(stored))
                    setDbLoading(false)
                }
            } catch (e) {
                console.warn('[Resume] Local draft read notice:', e)
            }

            // Load stored skills from local cache
            let cachedSkills = []
            try {
                const storedSkills = localStorage.getItem(`resume_skills_${interviewId}`)
                if (storedSkills) {
                    const parsed = JSON.parse(storedSkills)
                    if (Array.isArray(parsed) && parsed.length > 0) cachedSkills = parsed
                }
            } catch {}

            try {
                // 2. Fetch current report from database
                const fetched = await getReoprtById(interviewId)
                if (!mounted) return

                if (typeof fetched?.matchScore === 'number') {
                    setMatchScore(fetched.matchScore)
                }
                if (fetched?.atsScoreBreakdown) {
                    setAtsBreakdown(fetched.atsScoreBreakdown)
                }

                // Determine initial skills array from DB report, local cache, or parsed HTML
                let currentSkills = cachedSkills
                if (Array.isArray(fetched?.resumeSkills) && fetched.resumeSkills.length > 0) {
                    currentSkills = mergeSkills(currentSkills, fetched.resumeSkills)
                } else {
                    const rawDoc = fetched?.generatedResumeHtml || cachedDraft || ''
                    const extracted = parseSkillsFromHtml(rawDoc)
                    if (extracted.length > 0) {
                        currentSkills = mergeSkills(currentSkills, extracted)
                    } else if (Array.isArray(fetched?.detectedSkills) && fetched.detectedSkills.length > 0) {
                        currentSkills = mergeSkills(currentSkills, fetched.detectedSkills.map(s => s.name))
                    }
                }

                if (mounted && currentSkills.length > 0) {
                    setResumeSkills(currentSkills)
                    try {
                        localStorage.setItem(`resume_skills_${interviewId}`, JSON.stringify(currentSkills))
                    } catch {}
                }

                // Extract older / original resume skills from report
                const rawOlder = Array.isArray(fetched?.older) && fetched.older.length > 0
                    ? fetched.older
                    : (Array.isArray(fetched?.olderSkills) && fetched.olderSkills.length > 0
                        ? fetched.olderSkills
                        : (Array.isArray(fetched?.originalSkills) ? fetched.originalSkills : []))
                if (mounted && rawOlder.length > 0) {
                    setOlderSkills(rawOlder)
                }

                // Asynchronously fetch canonical skills comparison from server
                getResumeSkillsComparison(interviewId).then(compRes => {
                    if (mounted && compRes?.skillsComparison) {
                        const sComp = compRes.skillsComparison
                        if (Array.isArray(sComp.originalSkills) && sComp.originalSkills.length > 0) {
                            setOlderSkills(sComp.originalSkills)
                        }
                    }
                }).catch(err => {
                    console.warn('[Resume] Initial skills comparison fetch notice:', err.message)
                })

                // Dynamically calculate and fetch the exact ATS score in background
                setAtsLoading(true)
                calculateResumeAtsScore(interviewId, fetched?.generatedResumeHtml || cachedDraft)
                    .then(atsRes => {
                        if (mounted && typeof atsRes?.matchScore === 'number') {
                            setMatchScore(atsRes.matchScore)
                        }
                        if (mounted && atsRes?.breakdown) {
                            setAtsBreakdown(atsRes.breakdown)
                        }
                    })
                    .catch(atsErr => {
                        console.warn('[Resume] Dynamic ATS score calculation notice:', atsErr.message)
                    })
                    .finally(() => {
                        if (mounted) setAtsLoading(false)
                    })

                // 3. Health check: Does DB already have a healthy generatedResumeHtml?
                if (isHealthyResumeHtml(fetched?.generatedResumeHtml)) {
                    const sanitized = sanitizeResumeHtml(fetched.generatedResumeHtml)
                    setHtmlContent(sanitized)
                    try {
                        localStorage.setItem(`resume_draft_${interviewId}`, sanitized)
                    } catch {}
                    setDbLoading(false)
                    return
                }

                // 4. If DB generatedResumeHtml is missing or corrupted, but we have a healthy local draft:
                if (cachedDraft) {
                    setHtmlContent(sanitizeResumeHtml(cachedDraft))
                    setDbLoading(false)
                    // Sync this draft to the database
                    updateResumeHtml(interviewId, { generatedResumeHtml: cachedDraft, resumeSkills: currentSkills }).catch(err => {
                        console.warn('[Resume] Background draft recovery sync notice:', err.message)
                    })
                    return
                }

                // 5. Check if an active resume generation job is currently running on the server
                try {
                    const jobRes = await getActiveJob({ type: 'resume_html', resourceId: interviewId })
                    if (mounted && jobRes?.activeJob?.jobId) {
                        setDbLoading(false)
                        setAiGenerating(true)
                        const pollResult = await generateResumePdf(interviewId)
                        const reportWithHtml = pollResult?.interviewReport || pollResult
                        if (mounted && isHealthyResumeHtml(reportWithHtml?.generatedResumeHtml)) {
                            const sanitized = sanitizeResumeHtml(reportWithHtml.generatedResumeHtml)
                            setHtmlContent(sanitized)
                            const polledSkills = Array.isArray(reportWithHtml?.resumeSkills) && reportWithHtml.resumeSkills.length > 0
                                ? reportWithHtml.resumeSkills
                                : parseSkillsFromHtml(reportWithHtml.generatedResumeHtml)
                            if (polledSkills.length > 0) {
                                setResumeSkills(polledSkills)
                                try {
                                    localStorage.setItem(`resume_skills_${interviewId}`, JSON.stringify(polledSkills))
                                } catch {}
                            }
                            try {
                                localStorage.setItem(`resume_draft_${interviewId}`, sanitized)
                            } catch {}
                            if (fetchUsage) fetchUsage()
                        }
                        if (mounted) setAiGenerating(false)
                        return
                    }
                } catch (jobErr) {
                    console.warn('[Resume] Active job check notice:', jobErr.message)
                }

                // 6. If generatedResumeHtml is missing or unhealthy, trigger AI generation with force
                setDbLoading(false)
                setAiGenerating(true)
                const genRes = await generateResumePdf(interviewId, { force: true })
                const freshReport = genRes?.interviewReport || genRes
                if (mounted && isHealthyResumeHtml(freshReport?.generatedResumeHtml)) {
                    const sanitized = sanitizeResumeHtml(freshReport.generatedResumeHtml)
                    setHtmlContent(sanitized)
                    const freshSkills = Array.isArray(freshReport?.resumeSkills) && freshReport.resumeSkills.length > 0
                        ? freshReport.resumeSkills
                        : parseSkillsFromHtml(freshReport.generatedResumeHtml)
                    if (freshSkills.length > 0) {
                        setResumeSkills(freshSkills)
                        try {
                            localStorage.setItem(`resume_skills_${interviewId}`, JSON.stringify(freshSkills))
                        } catch {}
                    }
                    try {
                        localStorage.setItem(`resume_draft_${interviewId}`, sanitized)
                    } catch {}
                    if (fetchUsage) fetchUsage()
                }
                if (mounted) setAiGenerating(false)

            } catch (err) {
                if (mounted) setError(err?.response?.data?.message || err?.message || 'Failed to load resume.')
                if (mounted) {
                    setDbLoading(false)
                    setAiGenerating(false)
                }
            }
        }
        init()
        return () => { mounted = false }
    }, [interviewId])

    // Scroll AI chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages, chatLoading])

    // Listen to editor selection changes
    useEffect(() => {
        const onMouseUp = () => {
            const sel = window.getSelection()
            if (sel && sel.toString().trim().length > 3) {
                setSelectedText(sel.toString().trim())
            }
        }
        document.addEventListener('mouseup', onMouseUp)
        return () => document.removeEventListener('mouseup', onMouseUp)
    }, [])

    const displayTitle = useMemo(() => {
        if (!report) return 'Resume'
        return report.developerTitle || report?.Title || report?.title || 'Generated Resume'
    }, [report])

    // ── Toggle Skills Window ───────────────────────────────────────────────
    const toggleSkillsWindow = useCallback(() => {
        setIsSkillsWindowOpen(prev => {
            const next = !prev
            try {
                localStorage.setItem('resume_skills_window_open', String(next))
            } catch {}
            return next
        })
    }, [])

    // ── Live Reactive Skills Comparison Diff ───────────────────────────────
    const skillsDiff = useMemo(() => {
        return compareResumeSkills(olderSkills, resumeSkills)
    }, [olderSkills, resumeSkills])

    // ── Cleanup Debounce Timer on Unmount ─────────────────────────────────
    useEffect(() => {
        return () => {
            if (atsDebounceTimerRef.current) {
                clearTimeout(atsDebounceTimerRef.current)
            }
        }
    }, [])

    // ── Live ATS Score Recalculator (Debounced on keystroke / edit) ────────
    const triggerAtsRecalculation = useCallback((rawHtml) => {
        if (!interviewId) return
        const html = rawHtml || editorRef.current?.getHtml()
        if (!isHealthyResumeHtml(html)) return

        if (atsDebounceTimerRef.current) {
            clearTimeout(atsDebounceTimerRef.current)
        }

        setAtsLoading(true)
        atsDebounceTimerRef.current = setTimeout(async () => {
            try {
                const atsRes = await calculateResumeAtsScore(interviewId, html)
                if (typeof atsRes?.matchScore === 'number') {
                    setMatchScore(atsRes.matchScore)
                }
                if (atsRes?.breakdown) {
                    setAtsBreakdown(atsRes.breakdown)
                }
            } catch (err) {
                console.warn('[Resume] Live ATS recalculation error:', err.message)
            } finally {
                setAtsLoading(false)
            }
        }, 750) // Responsive 750ms debounce
    }, [interviewId])

    // ── Missing ATS Keywords from JD Breakdown ─────────────────────────────
    const missingKeywords = useMemo(() => {
        if (!atsBreakdown) return []
        const skillsMissing = Array.isArray(atsBreakdown?.skillsMatch?.missing) ? atsBreakdown.skillsMatch.missing : []
        const kwMissing = Array.isArray(atsBreakdown?.keywordMatch?.missing) ? atsBreakdown.keywordMatch.missing : []

        const seen = new Set()
        const combined = []

        const addKw = (raw) => {
            if (!raw || typeof raw !== 'string') return
            const clean = raw.trim()
            const lower = clean.toLowerCase()
            if (clean.length < 2 || seen.has(lower)) return
            seen.add(lower)
            combined.push(clean)
        }

        // Add skills first, then general keywords
        skillsMissing.forEach(addKw)
        kwMissing.forEach(addKw)

        const liveHtml = editorRef.current?.getHtml() || htmlContent || ''
        const liveLower = liveHtml.toLowerCase()
        return combined.filter(kw => !liveLower.includes(kw.toLowerCase()))
    }, [atsBreakdown, htmlContent])

    // ── 1-Click Missing Keyword Inserter ───────────────────────────────────
    const handleInsertKeyword = useCallback((kw) => {
        if (!kw || !editorRef.current) return
        const cleanKw = kw.trim()
        if (!cleanKw) return

        let inserted = false

        // 1. If editor is currently focused, insert directly at user cursor/selection
        if (editorRef.current.isFocused && editorRef.current.isFocused()) {
            editorRef.current.insertContent(` <strong>${cleanKw}</strong>, `)
            inserted = true
        } else {
            // 2. Intelligent section injection into Skills section
            const currentHtml = editorRef.current.getHtml() || htmlContent || ''

            const skillsHeadingRegex = /(<(?:h[1-6]|p|strong)[^>]*>(?:technical\s+|core\s+)?skills(?:[^<]*)<\/(?:h[1-6]|p|strong)>\s*<p[^>]*>)([\s\S]*?)(<\/p>)/i
            const match = currentHtml.match(skillsHeadingRegex)
            if (match) {
                const [fullMatch, startTag, innerContent, endTag] = match
                const needsComma = innerContent.trim().length > 0 && !innerContent.trim().endsWith(',') && !innerContent.trim().endsWith(':')
                const updatedSkillsSection = `${startTag}${innerContent.trimEnd()}${needsComma ? ', ' : ' '}<strong>${cleanKw}</strong>${endTag}`
                const newFullHtml = currentHtml.replace(fullMatch, updatedSkillsSection)
                editorRef.current.setContent(newFullHtml)
                inserted = true
            } else {
                const anySkillsRegex = /(<strong>\s*(?:Languages|Frameworks|Tools|Technologies|Skills|Technical Skills)\s*:?\s*<\/strong>\s*)([^<]*)(<\/p>)/i
                const match2 = currentHtml.match(anySkillsRegex)
                if (match2) {
                    const [fullMatch2, prefix, text, end] = match2
                    const needsComma = text.trim().length > 0 && !text.trim().endsWith(',')
                    const updated = `${prefix}${text.trimEnd()}${needsComma ? ', ' : ' '}<strong>${cleanKw}</strong>${end}`
                    const newFullHtml = currentHtml.replace(fullMatch2, updated)
                    editorRef.current.setContent(newFullHtml)
                    inserted = true
                } else {
                    editorRef.current.insertContent(` <strong>${cleanKw}</strong>, `)
                    inserted = true
                }
            }
        }

        if (inserted) {
            setIsDirty(true)
            setResumeSkills(prev => {
                const next = mergeSkills(prev, [cleanKw])
                try {
                    localStorage.setItem(`resume_skills_${interviewId}`, JSON.stringify(next))
                } catch {}
                return next
            })

            const updatedHtml = editorRef.current.getHtml()
            triggerAtsRecalculation(updatedHtml)

            setSaveNotification({
                message: `✨ Injected "${cleanKw}" into resume! ATS score recalculating…`,
                type: 'auto'
            })
            setTimeout(() => setSaveNotification(null), 3500)
        }
    }, [htmlContent, interviewId, triggerAtsRecalculation])

    // ── Unified Save & Auto-Save Function ──────────────────────────────────
    const saveResumeChanges = useCallback(async (isAuto = false) => {
        if (!editorRef.current) return
        const html = editorRef.current.getHtml()
        if (!isHealthyResumeHtml(html)) return

        if (atsDebounceTimerRef.current) {
            clearTimeout(atsDebounceTimerRef.current)
        }

        if (!isAuto) {
            setSaveLoading(true)
        }
        setError('')

        // Immediately persist to localStorage
        try {
            localStorage.setItem(`resume_draft_${interviewId}`, html)
            localStorage.setItem(`resume_skills_${interviewId}`, JSON.stringify(resumeSkills))
        } catch (e) {
            console.warn('[Resume] LocalStorage draft save warning:', e)
        }

        try {
            const res = await updateResumeHtml(interviewId, { 
                generatedResumeHtml: html,
                resumeSkills
            })
            if (res?.interviewReport && setReport) {
                setReport(res.interviewReport)
            }
            if (typeof res?.matchScore === 'number') {
                setMatchScore(res.matchScore)
            } else if (typeof res?.interviewReport?.matchScore === 'number') {
                setMatchScore(res.interviewReport.matchScore)
            }
            if (res?.breakdown) {
                setAtsBreakdown(res.breakdown)
            } else if (res?.interviewReport?.atsScoreBreakdown) {
                setAtsBreakdown(res.interviewReport.atsScoreBreakdown)
            }
            setHtmlContent(sanitizeResumeHtml(html))
            setIsDirty(false)
            if (fetchUsage) fetchUsage()

            setSaveNotification({
                message: isAuto
                    ? 'Auto-saved: Your latest resume changes and skills have been saved to the database.'
                    : 'Saved: Your resume changes and skills have been saved to the database successfully!',
                type: isAuto ? 'auto' : 'manual'
            })

            // Automatically recalculate ATS score for latest saved edits
            handleCalculateAtsScore()

            setTimeout(() => {
                setSaveNotification(null)
            }, 4500)
        } catch (err) {
            if (!isAuto) {
                setError(err?.response?.data?.message || err?.message || 'Failed to save resume.')
            } else {
                console.warn('[Auto-Save] Error saving draft:', err.message)
            }
        } finally {
            if (!isAuto) {
                setSaveLoading(false)
            }
        }
    }, [interviewId, resumeSkills, setReport, fetchUsage])

    // ── Editor OnChange: Persist Draft Instantly & Update Skills & ATS Score at Runtime ──
    const handleEditorChange = useCallback((updatedHtml) => {
        setIsDirty(true)
        const html = updatedHtml || editorRef.current?.getHtml()
        if (isHealthyResumeHtml(html)) {
            try {
                localStorage.setItem(`resume_draft_${interviewId}`, html)
            } catch {}

            // Detect any new skills added/typed in the editor at runtime
            const detected = parseSkillsFromHtml(html)
            if (detected && detected.length > 0) {
                setResumeSkills(prev => {
                    const next = mergeSkills(prev, detected)
                    if (JSON.stringify(next) !== JSON.stringify(prev)) {
                        try {
                            localStorage.setItem(`resume_skills_${interviewId}`, JSON.stringify(next))
                        } catch {}
                        return next
                    }
                    return prev
                })
            }

            // Immediately schedule debounced ATS recalculation as candidate updates resume
            triggerAtsRecalculation(html)
        }
    }, [interviewId, triggerAtsRecalculation])

    // ── 1-Minute Auto-Save Timer ──────────────────────────────────────────
    useEffect(() => {
        const AUTO_SAVE_INTERVAL = 60 * 1000 // 1 minute
        const timer = setInterval(() => {
            if (isDirty) {
                saveResumeChanges(true)
            }
        }, AUTO_SAVE_INTERVAL)

        return () => clearInterval(timer)
    }, [isDirty, saveResumeChanges])

    // ── Manual Save Button Click ──────────────────────────────────────────
    const handleSave = useCallback(() => {
        saveResumeChanges(false)
    }, [saveResumeChanges])

    // ── Direct 1-Click PDF Export ─────────────────────────────────────────
    const handlePrint = useCallback(async () => {
        setPrintLoading(true)
        setError('')
        try {
            // Auto-save edits first if dirty
            if (isDirty && editorRef.current) {
                await saveResumeChanges(false)
            }
            const el = document.querySelector('.tiptap-a4-page')
            const safeTitle = (displayTitle || 'Resume').replace(/[^a-z0-9_-]/gi, '_')
            await exportElementToPdf(el, `${safeTitle}_Resume.pdf`)
            if (fetchUsage) fetchUsage()
        } catch (err) {
            console.error('PDF Download Error:', err)
            setError(err?.message || 'Failed to generate PDF download.')
        } finally {
            setPrintLoading(false)
        }
    }, [isDirty, saveResumeChanges, displayTitle, fetchUsage])

    const isResumeBlocked = Boolean(user?.blockedFeatures?.resumeGeneration)

    // ── Regenerate ─────────────────────────────────────────────────────────
    const handleRegenerate = useCallback(async () => {
        if (isResumeBlocked) return
        if (!window.confirm('Regenerate the resume from scratch with AI? Your manual edits will be discarded.')) return
        setAiGenerating(true)
        setError('')
        try {
            const response = await generateResumePdf(interviewId, { force: true })
            const newReport = response?.interviewReport || response
            if (newReport?.generatedResumeHtml) {
                const sanitized = sanitizeResumeHtml(newReport.generatedResumeHtml)
                setHtmlContent(sanitized)
                if (editorRef.current) {
                    editorRef.current.setContent(sanitized)
                }
                setIsDirty(false)
                if (fetchUsage) fetchUsage()
            } else {
                throw new Error('Failed to generate fresh resume content.')
            }
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to regenerate resume.')
        } finally {
            setAiGenerating(false)
        }
    }, [interviewId, isResumeBlocked, fetchUsage])

    // ── AI Copilot ─────────────────────────────────────────────────────────
    const handleSendAi = useCallback(async (e, preset = null) => {
        if (e) e.preventDefault()
        const msg = preset || chatInput
        if (!msg.trim()) return

        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: msg,
            ctx: selectedText || null
        }
        setChatMessages(prev => [...prev, userMsg])
        if (!preset) setChatInput('')
        setChatLoading(true)

        try {
            const currentResumeHtml = editorRef.current?.getHtml() || ''
            const res = await rewriteResumeSection({
                selectedText,
                instruction: msg,
                action: preset || 'enhance',
                message: msg,
                resourceId: interviewId,
                currentResumeHtml
            })
            if (fetchUsage) fetchUsage()
            const aiMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: res?.replyText || 'Here is the refined suggestion.',
                targetText: res?.targetText || selectedText || null,
                snippet: res?.suggestedSnippet || res?.rewrittenText || null
            }
            setChatMessages(prev => [...prev, aiMsg])
        } catch {
            setChatMessages(prev => [...prev, {
                id: Date.now() + 1,
                sender: 'ai',
                text: '⚠️ Something went wrong. Please try again.'
            }])
        } finally {
            setChatLoading(false)
        }
    }, [chatInput, selectedText, interviewId, fetchUsage])

    // ── Apply Snippet In-Place or to Selection ──────────────────────────────
    const handleApplySnippet = useCallback((snippet, targetText = null) => {
        if (!snippet || !editorRef.current) return
        const cleanSnippet = parseAndSanitizeSnippet(snippet)
        if (!cleanSnippet) return

        let changed = false
        if (editorRef.current.replaceExactText) {
            const replaced = editorRef.current.replaceExactText(targetText, cleanSnippet)
            if (replaced) {
                changed = true
            }
        }
        if (!changed && editorRef.current.isFocused && editorRef.current.isFocused()) {
            editorRef.current.insertContent(cleanSnippet)
            changed = true
        }
        if (changed) {
            setIsDirty(true)
            triggerAtsRecalculation(editorRef.current?.getHtml())
        }
    }, [triggerAtsRecalculation])

    // ── Listen for in-place replacement & diff preview events from KIVI AI Assistant ───────
    useEffect(() => {
        window.__KIVI_GET_CURRENT_RESUME_HTML__ = () => editorRef.current?.getHtml() || htmlContent || ''

        const syncSkillsFromLiveDom = () => {
            setTimeout(() => {
                const liveHtml = editorRef.current?.getHtml()
                if (liveHtml) {
                    const detected = parseSkillsFromHtml(liveHtml)
                    if (detected && detected.length > 0) {
                        setResumeSkills(prev => {
                            const next = mergeSkills(prev, detected)
                            try {
                                localStorage.setItem(`resume_skills_${interviewId}`, JSON.stringify(next))
                            } catch {}
                            return next
                        })
                    }
                    triggerAtsRecalculation(liveHtml)
                }
            }, 120)
        }

        const onKiviReplace = (e) => {
            const { targetText, snippet } = e.detail || {}
            if (snippet && editorRef.current) {
                const cleanSnippet = parseAndSanitizeSnippet(snippet)
                if (!cleanSnippet) return

                if (editorRef.current.replaceExactText) {
                    const replaced = editorRef.current.replaceExactText(targetText, cleanSnippet)
                    if (replaced) {
                        setIsDirty(true)
                        syncSkillsFromLiveDom()
                        if (typeof e.preventDefault === 'function') e.preventDefault()
                        return
                    }
                }
                if (editorRef.current.isFocused && editorRef.current.isFocused()) {
                    editorRef.current.insertContent(cleanSnippet)
                    setIsDirty(true)
                    syncSkillsFromLiveDom()
                    if (typeof e.preventDefault === 'function') e.preventDefault()
                }
            }
        }

        const onKiviApplyResumeUpdate = (e) => {
            const { isFullDocument, targetText, replacementHtml, mergedFullResumeHtml, newFullHtml } = e.detail || {}
            if (!editorRef.current) return

            // Case 1: If it is an explicit full document regeneration
            if (isFullDocument && (mergedFullResumeHtml || newFullHtml)) {
                const fullContent = mergedFullResumeHtml || newFullHtml
                if (fullContent && fullContent.trim().length > 50) {
                    editorRef.current.setContent(fullContent)
                    setIsDirty(true)
                    syncSkillsFromLiveDom()
                    return
                }
            }

            // Case 2: Targeted section / line / snippet replacement
            let applied = false

            if (targetText && replacementHtml && editorRef.current.replaceExactText) {
                const cleanReplacement = parseAndSanitizeSnippet(replacementHtml) || replacementHtml
                applied = editorRef.current.replaceExactText(targetText, cleanReplacement)
            }

            // If exact substring replacement didn't find the range, use mergedFullResumeHtml
            // which has ONLY the targeted section swapped in the tree and preserves all other sections
            if (!applied && mergedFullResumeHtml && mergedFullResumeHtml.trim().length > 50) {
                editorRef.current.setContent(mergedFullResumeHtml)
                applied = true
            } else if (!applied && replacementHtml && editorRef.current.isFocused && editorRef.current.isFocused()) {
                const cleanReplacement = parseAndSanitizeSnippet(replacementHtml) || replacementHtml
                editorRef.current.insertContent(cleanReplacement)
                applied = true
            }

            if (applied) {
                setIsDirty(true)
                syncSkillsFromLiveDom()
            }
        }

        const onKiviShowDiff = (e) => {
            const { diffData, updatedPart, newFullHtml, targetText, msgId } = e.detail || {}
            const payload = diffData || {
                targetText: targetText || updatedPart?.target,
                replacementHtml: updatedPart?.replacement || '',
                newFullResumeHtml: newFullHtml || updatedPart?.newFullHtml || '',
                msgId
            }
            if (editorRef.current?.showDiff) {
                editorRef.current.showDiff(payload)
            }
        }

        const onKiviAcceptDiff = () => {
            if (editorRef.current?.acceptDiff) {
                editorRef.current.acceptDiff()
                setIsDirty(true)
                syncSkillsFromLiveDom()
            }
        }

        const onKiviRejectDiff = () => {
            if (editorRef.current?.rejectDiff) {
                editorRef.current.rejectDiff()
            }
        }

        window.__KIVI_GET_CURRENT_RESUME_SKILLS__ = () => resumeSkills

        window.addEventListener('kivi-replace-text', onKiviReplace)
        window.addEventListener('kivi-apply-resume-update', onKiviApplyResumeUpdate)
        window.addEventListener('kivi-show-diff', onKiviShowDiff)
        window.addEventListener('kivi-accept-diff', onKiviAcceptDiff)
        window.addEventListener('kivi-reject-diff', onKiviRejectDiff)

        return () => {
            window.removeEventListener('kivi-replace-text', onKiviReplace)
            window.removeEventListener('kivi-apply-resume-update', onKiviApplyResumeUpdate)
            window.removeEventListener('kivi-show-diff', onKiviShowDiff)
            window.removeEventListener('kivi-accept-diff', onKiviAcceptDiff)
            window.removeEventListener('kivi-reject-diff', onKiviRejectDiff)
            delete window.__KIVI_GET_CURRENT_RESUME_HTML__
            delete window.__KIVI_GET_CURRENT_RESUME_SKILLS__
        }
    }, [htmlContent, resumeSkills, interviewId])

    const RESUME_STEPS = [
        { id: 1, label: "Analyzing profile & technical skills" },
        { id: 2, label: "Matching target job requirements" },
        { id: 3, label: "Structuring ATS-compliant sections" },
        { id: 4, label: "Polishing typography & design formatting" }
    ];

    if (aiGenerating) return <Loading steps={RESUME_STEPS} title="Resume Studio" subtitle="Drafting your document using AI..." />
    if (dbLoading && !htmlContent) return <ShimmerLoading type="resume" title="Loading Resume Studio..." />

    return (
        <div className="resume-page">
            {Boolean(user?.blockedFeatures?.resumeGeneration) && (
                <div className="blocked-feature-banner" style={{ margin: '1rem 1.5rem 0 1.5rem' }}>
                    <span className="banner-icon">🔒</span>
                    <div className="banner-text">
                        <strong>Resume Generation Restricted</strong>
                        <p>Resume generation has been disabled for your account by an administrator.</p>
                    </div>
                </div>
            )}
            {/* ── Header bar ─────────────────────────────────────────── */}
            <header className="rp-header">
                <div className="rp-header-left">
                    <span className="rp-eyebrow">Resume Studio</span>
                    <h1 className="rp-title">{displayTitle}</h1>
                    <span 
                        className={`rp-ats-badge ${atsLoading ? 'is-calculating' : ''}`} 
                        title={atsLoading ? "Recalculating ATS Score…" : `ATS Match Score: ${matchScore}%`}
                    >
                        <span className="rp-ats-dot" style={{ color: matchScore >= 80 ? '#10b981' : matchScore >= 60 ? '#f59e0b' : '#ef4444' }}>●</span>
                        ATS Score: {matchScore}%
                    </span>
                    {isDirty && <span className="rp-unsaved-badge">● Unsaved</span>}

                    {/* ── Grounded ATS Match Score Badge & Dropdown ── */}
                    <div className="rp-ats-score-container" ref={atsRef}>
                        <button
                            type="button"
                            className={`rp-ats-badge ${
                                (atsData.score ?? report?.matchScore ?? 0) >= 75
                                    ? 'score-high'
                                    : (atsData.score ?? report?.matchScore ?? 0) >= 60
                                    ? 'score-mid'
                                    : 'score-low'
                            }`}
                            onClick={() => setShowAtsBreakdown(prev => !prev)}
                            title="Click to view ATS Score breakdown or recalculate"
                        >
                            <span>🎯 ATS</span>
                            <span className="ats-score-val">
                                {atsData.loading ? '...' : `${atsData.score ?? report?.matchScore ?? '--'}/100`}
                            </span>
                            {atsData.loading && <span className="ats-spinner" />}
                        </button>

                        {showAtsBreakdown && (
                            <div className="rp-ats-popover" role="dialog" aria-label="ATS Score Breakdown">
                                <div className="popover-header">
                                    <h4>ATS Compatibility</h4>
                                    <span className="archetype-tag">
                                        {atsData.breakdown?.archetype?.replace('_', ' ') || 'ENGINEERING'}
                                    </span>
                                </div>

                                <div className="popover-breakdown-list">
                                    <div className="breakdown-row">
                                        <span className="row-label">Technical Skills</span>
                                        <span className="row-score">
                                            {atsData.breakdown?.categories?.technicalSkills ?? '--'}%
                                        </span>
                                    </div>
                                    <div className="breakdown-row">
                                        <span className="row-label">Required Qualifications</span>
                                        <span className="row-score">
                                            {atsData.breakdown?.categories?.requiredQualifications ?? '--'}%
                                        </span>
                                    </div>
                                    <div className="breakdown-row">
                                        <span className="row-label">Responsibilities</span>
                                        <span className="row-score">
                                            {atsData.breakdown?.categories?.responsibilities ?? '--'}%
                                        </span>
                                    </div>
                                    <div className="breakdown-row">
                                        <span className="row-label">Experience Fit</span>
                                        <span className="row-score">
                                            {atsData.breakdown?.categories?.experience ?? '--'}%
                                        </span>
                                    </div>
                                    <div className="breakdown-row">
                                        <span className="row-label">ATS Format Quality</span>
                                        <span className="row-score">
                                            {atsData.breakdown?.categories?.atsCompatibility ?? '--'}%
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="popover-recalc-btn"
                                    onClick={handleCalculateAtsScore}
                                    disabled={atsData.loading}
                                >
                                    {atsData.loading ? 'Calculating…' : '↺ Recalculate for Current Edits'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <nav className="rp-actions" aria-label="Resume actions">
                    <button
                        type="button"
                        className="rp-btn rp-btn-ghost"
                        onClick={() => navigate(`/interview/${interviewId}`, { state: { interviewReport: report } })}
                    >
                        ← Back
                    </button>

                    <button
                        type="button"
                        className="rp-btn rp-btn-save"
                        onClick={handleSave}
                        disabled={saveLoading || !isDirty}
                    >
                        {saveLoading ? 'Saving…' : '💾 Save'}
                    </button>

                    <button
                        type="button"
                        className={`rp-btn ${isResumeBlocked ? 'rp-btn-disabled' : 'rp-btn-ghost'}`}
                        onClick={handleRegenerate}
                        disabled={loading || saveLoading || isResumeBlocked}
                        style={isResumeBlocked ? { background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', cursor: 'not-allowed' } : {}}
                        title={isResumeBlocked ? "Resume generation disabled by administrator" : "Regenerate from scratch"}
                    >
                        {isResumeBlocked ? '🔒 Locked' : '↺ Regenerate'}
                    </button>

                    <button
                        type="button"
                        className="rp-btn rp-btn-primary"
                        onClick={handlePrint}
                        disabled={printLoading || loading || !htmlContent}
                        title="Download PDF directly"
                    >
                        {printLoading ? 'Generating PDF…' : '📥 Download PDF'}
                    </button>
                </nav>
            </header>

            {/* ── Error banner ───────────────────────────────────────── */}
            {error && (
                <div className="rp-error-bar" role="alert">
                    <span>❌ {error}</span>
                    <button type="button" onClick={() => setError('')} aria-label="Dismiss error">✕</button>
                </div>
            )}

            {/* ── Main workspace ─────────────────────────────────────── */}
            <div className="rp-workspace">
                {/* Left Side: Skills Difference & Evolution Window */}
                <ResumeSkillsWindow
                    isOpen={isSkillsWindowOpen}
                    onToggle={toggleSkillsWindow}
                    olderSkills={olderSkills}
                    currentSkills={skillsDiff?.currentSkills}
                    stats={skillsDiff?.stats}
                    loading={skillsLoading}
                    missingKeywords={missingKeywords}
                    onInsertKeyword={handleInsertKeyword}
                />

                {/* Right Side: TipTap editor (Part 2: Resume Preview) */}
                <main className="rp-editor-col">
                    {/* 1-Click Missing Keywords Inserter Bar */}
                    {missingKeywords && missingKeywords.length > 0 && (
                        <div className="rp-missing-keywords-bar" aria-label="1-Click Missing Keywords Inserter">
                            <div className="mkw-bar-header">
                                <span className="mkw-sparkle">✨</span>
                                <span className="mkw-title">1-Click ATS Keywords ({missingKeywords.length} missing):</span>
                            </div>
                            <div className="mkw-chips-scroll">
                                {missingKeywords.slice(0, 15).map((kw, idx) => (
                                    <button
                                        key={`${kw}-${idx}`}
                                        type="button"
                                        className="mkw-chip-btn"
                                        onClick={() => handleInsertKeyword(kw)}
                                        title={`Click to insert "${kw}" into resume and boost ATS score`}
                                    >
                                        <span className="mkw-plus">+</span>
                                        <span className="mkw-name">{kw}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {htmlContent ? (
                        <ResumeEditor
                            ref={editorRef}
                            initialHtml={htmlContent}
                            placeholder="Your resume content will appear here. Start editing!"
                            onChange={handleEditorChange}
                        />
                    ) : (
                        <Loading
                            inline={true}
                            title="Resume Studio"
                            subtitle="Drafting your ATS resume using Gemini AI..."
                            steps={[
                                { id: 1, label: "Analyzing interview report & candidate profile" },
                                { id: 2, label: "Extracting core technical skills & accomplishments" },
                                { id: 3, label: "Structuring ATS-compliant A4 layout & sections" },
                                { id: 4, label: "Polishing typography & design formatting" }
                            ]}
                        />
                    )}
                </main>
            </div>

            {/* ── Floating Save & Auto-Save Notification Toast ───────── */}
            {saveNotification && (
                <div className={`rp-save-toast ${saveNotification.type}`} role="status" aria-live="polite">
                    <span className="toast-icon">{saveNotification.type === 'auto' ? '💾' : '✅'}</span>
                    <span className="toast-text">{saveNotification.message}</span>
                    <button
                        type="button"
                        className="toast-close-btn"
                        onClick={() => setSaveNotification(null)}
                        aria-label="Dismiss notification"
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    )
}

export default Resume
