import React, { useEffect, useImperativeHandle, forwardRef, useCallback, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, Quote, Undo, Redo, Highlighter, Type,
    Heading1, Heading2, Heading3, Minus, ChevronDown, Check,
    ExternalLink, Trash2, X, Search, Volume2, VolumeX, Play, Pause, Square, Sparkles
} from 'lucide-react'
import '../style/editor.scss'

// ── Google Docs Curated Font Families ──────────────────────────────────────
const FONT_OPTIONS = [
    { name: 'Calibri', value: 'Calibri, sans-serif' },
    { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { name: 'Inter', value: 'Inter, sans-serif' },
    { name: 'Roboto', value: 'Roboto, sans-serif' },
    { name: 'Caveat', value: 'Caveat, cursive' },
    { name: 'Comfortaa', value: 'Comfortaa, cursive' },
    { name: 'Courier New', value: '"Courier New", Courier, monospace' },
    { name: 'EB Garamond', value: '"EB Garamond", serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Lora', value: 'Lora, serif' },
    { name: 'Merriweather', value: 'Merriweather, serif' },
    { name: 'Montserrat', value: 'Montserrat, sans-serif' },
    { name: 'Oswald', value: 'Oswald, sans-serif' },
    { name: 'Pacifico', value: 'Pacifico, cursive' },
    { name: 'Playfair Display', value: '"Playfair Display", serif' },
    { name: 'Roboto Mono', value: '"Roboto Mono", monospace' },
    { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
]

// ── Toolbar button helper ──────────────────────────────────────────────────
const ToolBtn = ({ onClick, active, disabled, title, children, className = '' }) => (
    <button
        type="button"
        className={`tiptap-toolbar-btn${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
        onMouseDown={(e) => { e.preventDefault(); onClick?.() }}
        disabled={disabled}
        title={title}
        aria-label={title}
    >
        {children}
    </button>
)

const Divider = () => <span className="tiptap-divider" />

// ── Main ResumeEditor component ────────────────────────────────────────────
const ResumeEditor = forwardRef(function ResumeEditor(
    { initialHtml = '', placeholder = 'Start editing...', onChange },
    ref
) {
    const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false)
    const fontDropdownRef = useRef(null)

    // Floating Link Popover state
    const [linkPopover, setLinkPopover] = useState({
        isOpen: false,
        text: '',
        url: '',
        isExisting: false,
    })
    const linkPopoverRef = useRef(null)
    const linkUrlInputRef = useRef(null)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                bulletList: { keepMarks: true, keepAttributes: false },
                orderedList: { keepMarks: true, keepAttributes: false },
            }),
            Underline,
            TextStyle,
            FontFamily.configure({
                types: ['textStyle'],
            }),
            Color,
            Highlight.configure({ multicolor: true }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
            }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Placeholder.configure({ placeholder }),
        ],
        content: initialHtml || '',
        editorProps: {
            attributes: {
                class: 'tiptap-prose',
                spellcheck: 'true',
            },
            handleKeyDown: (view, event) => {
                // Ctrl+K or Cmd+K to open Link Popover
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                    event.preventDefault()
                    openLinkPopover()
                    return true
                }
                return false
            },
        },
        onUpdate: ({ editor }) => {
            onChange?.(editor.getHTML())
        },
    })

    // When initialHtml changes externally, update editor content
    useEffect(() => {
        if (editor && initialHtml) {
            const currentHtml = editor.getHTML()
            if (editor.isEmpty || (currentHtml !== initialHtml && !editor.isFocused)) {
                editor.commands.setContent(initialHtml, false)
            }
        }
    }, [initialHtml, editor])

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
        getHtml: () => editor?.getHTML() ?? '',
        setContent: (html) => editor?.commands.setContent(html, false),
        insertContent: (html) => editor?.commands.insertContent(html),
        focus: () => editor?.commands.focus(),
        isEmpty: () => editor?.isEmpty ?? true,
    }), [editor])

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target)) {
                setIsFontDropdownOpen(false)
            }
            if (linkPopoverRef.current && !linkPopoverRef.current.contains(e.target) && !e.target.closest('.tiptap-link-trigger')) {
                setLinkPopover(prev => ({ ...prev, isOpen: false }))
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Focus link input when popover opens
    useEffect(() => {
        if (linkPopover.isOpen) {
            setTimeout(() => {
                linkUrlInputRef.current?.focus()
            }, 50)
        }
    }, [linkPopover.isOpen])

    // ── Font selector handler ────────────────────────────────────────────
    const currentFont = editor?.getAttributes('textStyle').fontFamily || 'Calibri'
    const activeFontObj = FONT_OPTIONS.find(f => f.value === currentFont || f.name.toLowerCase() === currentFont.toLowerCase()) || { name: 'Calibri', value: 'Calibri, sans-serif' }

    const handleSelectFont = (font) => {
        if (!editor) return
        editor.chain().focus().setFontFamily(font.value).run()
        setIsFontDropdownOpen(false)
    }

    // ── Link popover open handler ────────────────────────────────────────
    const openLinkPopover = useCallback(() => {
        if (!editor) return
        const { from, to } = editor.state.selection
        const selectedText = editor.state.doc.textBetween(from, to, ' ')
        const existingHref = editor.getAttributes('link').href || ''

        setLinkPopover({
            isOpen: true,
            text: selectedText || '',
            url: existingHref || '',
            isExisting: Boolean(existingHref),
        })
    }, [editor])

    const handleApplyLink = useCallback((e) => {
        e?.preventDefault()
        if (!editor) return
        let targetUrl = linkPopover.url.trim()
        
        if (!targetUrl) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            setLinkPopover(prev => ({ ...prev, isOpen: false }))
            return
        }

        if (!/^https?:\/\//i.test(targetUrl) && !/^mailto:/i.test(targetUrl)) {
            targetUrl = `https://${targetUrl}`
        }

        const { from, to } = editor.state.selection
        const currentText = editor.state.doc.textBetween(from, to, ' ')

        // If user changed the label text or there was no selection
        if (linkPopover.text && linkPopover.text !== currentText) {
            editor
                .chain()
                .focus()
                .insertContent({
                    type: 'text',
                    text: linkPopover.text,
                    marks: [{ type: 'link', attrs: { href: targetUrl } }],
                })
                .run()
        } else {
            editor
                .chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: targetUrl })
                .run()
        }

        setLinkPopover(prev => ({ ...prev, isOpen: false }))
    }, [editor, linkPopover])

    const handleRemoveLink = useCallback(() => {
        if (!editor) return
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
        setLinkPopover(prev => ({ ...prev, isOpen: false }))
    }, [editor])

    // ── Speech Synthesis & "Listen to this tab" state ─────────────────────────
    const [audioState, setAudioState] = useState({
        isPlaying: false,
        isPaused: false,
        rate: 1.0,
        showControls: false,
    })
    const synthUtteranceRef = useRef(null)

    // Cancel ongoing speech when component unmounts
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel()
            }
        }
    }, [])

    // Helper to get natural reading text with proper pauses
    const getReadingText = useCallback(() => {
        if (!editor) return ''
        const { from, to } = editor.state.selection
        const selected = editor.state.doc.textBetween(from, to, ' ').trim()
        if (selected && selected.length > 3) {
            return selected
        }

        const html = editor.getHTML()
        if (!html) return ''

        const temp = document.createElement('div')
        temp.innerHTML = html

        // Ensure natural pauses between blocks and headings
        const blocks = temp.querySelectorAll('h1, h2, h3, h4, p, li, blockquote, tr')
        blocks.forEach(el => {
            const text = el.innerText.trim()
            if (text && !/[.!?:]$/.test(text)) {
                el.innerText = text + '. '
            }
        })

        return (temp.innerText || temp.textContent || '').replace(/\s+/g, ' ').trim()
    }, [editor])

    const handleStartSpeech = useCallback((rateOverride = null) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
            alert('Speech synthesis is not supported in this browser.')
            return
        }

        const textToRead = getReadingText()
        if (!textToRead) {
            return
        }

        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(textToRead)
        const currentRate = rateOverride !== null ? rateOverride : audioState.rate
        utterance.rate = currentRate
        utterance.pitch = 1.0

        const voices = window.speechSynthesis.getVoices() || []
        const preferredVoice = voices.find(v => (v.lang.includes('en') || v.lang.includes('EN')) && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Jenny') || v.name.includes('Samantha') || v.name.includes('English')))
        if (preferredVoice) {
            utterance.voice = preferredVoice
        }

        utterance.onstart = () => {
            setAudioState(prev => ({ ...prev, isPlaying: true, isPaused: false, showControls: true }))
        }

        utterance.onend = () => {
            setAudioState(prev => ({ ...prev, isPlaying: false, isPaused: false, showControls: false }))
        }

        utterance.onerror = (e) => {
            console.warn('Speech synthesis ended/interrupted:', e)
            setAudioState(prev => ({ ...prev, isPlaying: false, isPaused: false }))
        }

        utterance.onpause = () => {
            setAudioState(prev => ({ ...prev, isPaused: true }))
        }

        utterance.onresume = () => {
            setAudioState(prev => ({ ...prev, isPaused: false }))
        }

        synthUtteranceRef.current = utterance
        window.speechSynthesis.speak(utterance)
    }, [getReadingText, audioState.rate])

    const handleToggleListen = useCallback(() => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return

        if (audioState.isPlaying) {
            if (audioState.isPaused) {
                window.speechSynthesis.resume()
                setAudioState(prev => ({ ...prev, isPaused: false, showControls: true }))
            } else {
                window.speechSynthesis.pause()
                setAudioState(prev => ({ ...prev, isPaused: true, showControls: true }))
            }
        } else {
            handleStartSpeech()
        }
    }, [audioState.isPlaying, audioState.isPaused, handleStartSpeech])

    const handleResumeSpeech = useCallback(() => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return
        window.speechSynthesis.resume()
        setAudioState(prev => ({ ...prev, isPaused: false }))
    }, [])

    const handlePauseSpeech = useCallback(() => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return
        window.speechSynthesis.pause()
        setAudioState(prev => ({ ...prev, isPaused: true }))
    }, [])

    const handleStopSpeech = useCallback(() => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return
        window.speechSynthesis.cancel()
        setAudioState(prev => ({ ...prev, isPlaying: false, isPaused: false, showControls: false }))
    }, [])

    const handleChangeSpeed = useCallback((newRate) => {
        setAudioState(prev => ({ ...prev, rate: newRate }))
        if (audioState.isPlaying) {
            handleStartSpeech(newRate)
        }
    }, [audioState.isPlaying, handleStartSpeech])

    if (!editor) return null

    return (
        <div className="tiptap-editor-root">
            {/* ── Formatting Toolbar ── */}
            <div className="tiptap-toolbar" role="toolbar" aria-label="Text formatting">
                {/* History */}
                <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
                    <Undo size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
                    <Redo size={14} />
                </ToolBtn>

                <Divider />

                {/* ── Google Docs Font Family Dropdown ── */}
                <div className="tiptap-font-dropdown-wrap" ref={fontDropdownRef}>
                    <button
                        type="button"
                        className={`tiptap-font-picker-btn ${isFontDropdownOpen ? 'open' : ''}`}
                        onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                        title="Font Family"
                    >
                        <span className="font-current-name" style={{ fontFamily: activeFontObj.value }}>
                            {activeFontObj.name}
                        </span>
                        <ChevronDown size={13} className="font-chevron" />
                    </button>

                    {isFontDropdownOpen && (
                        <div className="tiptap-font-menu" role="menu">
                            <div className="font-menu-header">Fonts</div>
                            <div className="font-menu-list">
                                {FONT_OPTIONS.map((font) => {
                                    const isSelected = activeFontObj.name === font.name
                                    return (
                                        <button
                                            key={font.name}
                                            type="button"
                                            className={`font-menu-item ${isSelected ? 'selected' : ''}`}
                                            onClick={() => handleSelectFont(font)}
                                        >
                                            <span className="font-preview-name" style={{ fontFamily: font.value }}>
                                                {font.name}
                                            </span>
                                            {isSelected && <Check size={14} className="font-check-icon" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <Divider />

                {/* Inline Formatting */}
                <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
                    <Bold size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
                    <Italic size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
                    <UnderlineIcon size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
                    <Strikethrough size={14} />
                </ToolBtn>

                <Divider />

                {/* Headings */}
                <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
                    <Heading1 size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
                    <Heading2 size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
                    <Heading3 size={14} />
                </ToolBtn>

                <Divider />

                {/* Lists */}
                <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
                    <List size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered List">
                    <ListOrdered size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
                    <Quote size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
                    <Minus size={14} />
                </ToolBtn>

                <Divider />

                {/* Alignment */}
                <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
                    <AlignLeft size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
                    <AlignCenter size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
                    <AlignRight size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
                    <AlignJustify size={14} />
                </ToolBtn>

                <Divider />

                {/* ── Interactive Google Docs Link Button ── */}
                <div style={{ position: 'relative' }}>
                    <ToolBtn
                        onClick={openLinkPopover}
                        active={editor.isActive('link') || linkPopover.isOpen}
                        title="Insert or Edit Link (Ctrl+K)"
                        className="tiptap-link-trigger"
                    >
                        <LinkIcon size={14} />
                    </ToolBtn>

                    {/* ── Google Docs Floating Link Popover ── */}
                    {linkPopover.isOpen && (
                        <div className="tiptap-link-popover" ref={linkPopoverRef}>
                            <div className="link-popover-header">
                                <span className="popover-title">
                                    {linkPopover.isExisting ? 'Edit link' : 'Insert link'}
                                </span>
                                <button
                                    type="button"
                                    className="popover-close-btn"
                                    onClick={() => setLinkPopover(prev => ({ ...prev, isOpen: false }))}
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            <form onSubmit={handleApplyLink} className="link-popover-body">
                                <div className="link-field-group">
                                    <div className="link-input-wrap">
                                        <Type size={13} className="field-icon" />
                                        <input
                                            type="text"
                                            className="link-field-input"
                                            placeholder="Text label..."
                                            value={linkPopover.text}
                                            onChange={(e) => setLinkPopover(prev => ({ ...prev, text: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="link-field-group">
                                    <div className="link-input-wrap">
                                        <Search size={13} className="field-icon" />
                                        <input
                                            ref={linkUrlInputRef}
                                            type="text"
                                            className="link-field-input"
                                            placeholder="Paste link or search (e.g. github.com)..."
                                            value={linkPopover.url}
                                            onChange={(e) => setLinkPopover(prev => ({ ...prev, url: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {linkPopover.url && (
                                    <div className="link-preview-row">
                                        <a
                                            href={/^https?:\/\//i.test(linkPopover.url) ? linkPopover.url : `https://${linkPopover.url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="preview-anchor"
                                        >
                                            <ExternalLink size={12} />
                                            <span>{linkPopover.url}</span>
                                        </a>
                                    </div>
                                )}

                                <div className="link-popover-actions">
                                    {linkPopover.isExisting && (
                                        <button
                                            type="button"
                                            className="btn-link-remove"
                                            onClick={handleRemoveLink}
                                            title="Remove Link"
                                        >
                                            <Trash2 size={13} />
                                            <span>Remove</span>
                                        </button>
                                    )}
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                        <button
                                            type="button"
                                            className="btn-link-cancel"
                                            onClick={() => setLinkPopover(prev => ({ ...prev, isOpen: false }))}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn-link-apply"
                                            disabled={!linkPopover.url.trim()}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                <Divider />

                {/* Color picker */}
                <div className="tiptap-color-wrap" title="Text Color">
                    <Type size={14} />
                    <input
                        type="color"
                        className="tiptap-color-input"
                        value={editor.getAttributes('textStyle').color || '#000000'}
                        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                        title="Text Color"
                    />
                </div>

                {/* Highlight */}
                <div className="tiptap-color-wrap" title="Highlight">
                    <Highlighter size={14} />
                    <input
                        type="color"
                        className="tiptap-color-input"
                        defaultValue="#fef08a"
                        onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                        title="Highlight Color"
                    />
                </div>

                <Divider />

                {/* Clear formatting */}
                <ToolBtn
                    onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                    title="Clear Formatting"
                    className="tiptap-clear-btn"
                >
                    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '-0.5px' }}>Tx</span>
                </ToolBtn>

                <Divider />

                {/* ── Listen to this tab (Text-to-Speech) ── */}
                <div className="tiptap-listen-wrap">
                    <button
                        type="button"
                        className={`tiptap-listen-btn ${audioState.isPlaying ? 'is-playing' : ''} ${audioState.isPaused ? 'is-paused' : ''}`}
                        onClick={handleToggleListen}
                        title={audioState.isPlaying ? (audioState.isPaused ? "Resume listening" : "Pause listening") : "Listen to this tab"}
                        aria-label="Listen to this tab"
                    >
                        {/* Google Docs style icon: circle with play triangle and sparkle ray */}
                        <span className="listen-icon-circle">
                            <svg className="listen-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="9" />
                                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
                                <path d="M19 5l1.5-1.5M19 9l2-0.5M15 5l0.5-2" strokeWidth="1.5" />
                            </svg>
                        </span>
                        <span className="listen-btn-label">Listen</span>
                        {audioState.isPlaying && !audioState.isPaused && (
                            <span className="listen-equalizer-bars">
                                <span className="eq-bar eq-1"></span>
                                <span className="eq-bar eq-2"></span>
                                <span className="eq-bar eq-3"></span>
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Floating Speech Audio Player ── */}
            {audioState.showControls && (
                <div className="tiptap-audio-player-bar">
                    <div className="audio-player-info">
                        <div className="audio-badge">
                            <Volume2 size={14} className={`audio-pulse-icon ${!audioState.isPaused ? 'animating' : ''}`} />
                            <span className="audio-title">Listening to Document</span>
                        </div>
                        {audioState.isPaused && <span className="audio-status-tag">Paused</span>}
                    </div>

                    <div className="audio-player-actions">
                        {/* Play / Pause */}
                        <button
                            type="button"
                            className="audio-control-btn play-pause-btn"
                            onClick={audioState.isPaused ? handleResumeSpeech : handlePauseSpeech}
                            title={audioState.isPaused ? "Resume" : "Pause"}
                        >
                            {audioState.isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}
                            <span>{audioState.isPaused ? 'Resume' : 'Pause'}</span>
                        </button>

                        {/* Stop */}
                        <button
                            type="button"
                            className="audio-control-btn stop-btn"
                            onClick={handleStopSpeech}
                            title="Stop listening"
                        >
                            <Square size={12} fill="currentColor" />
                            <span>Stop</span>
                        </button>

                        {/* Speed Selector */}
                        <div className="audio-speed-selector" title="Reading speed">
                            {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                                <button
                                    key={speed}
                                    type="button"
                                    className={`speed-pill ${audioState.rate === speed ? 'active' : ''}`}
                                    onClick={() => handleChangeSpeed(speed)}
                                >
                                    {speed}x
                                </button>
                            ))}
                        </div>

                        {/* Dismiss Bar */}
                        <button
                            type="button"
                            className="audio-control-btn close-btn"
                            onClick={() => setAudioState(prev => ({ ...prev, showControls: false }))}
                            title="Close player panel (audio continues in background)"
                        >
                            <X size={13} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── A4 Editor Canvas ── */}
            <div className="tiptap-canvas-wrap" id="print-root">
                <div className="tiptap-a4-page">
                    <EditorContent editor={editor} />
                </div>
            </div>
        </div>
    )
})

export default ResumeEditor

