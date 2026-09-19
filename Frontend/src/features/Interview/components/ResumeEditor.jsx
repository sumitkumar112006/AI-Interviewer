import React, { useEffect, useImperativeHandle, forwardRef, useCallback, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
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
    ExternalLink, Trash2, X, Search, Volume2, VolumeX, Play, Pause, Square, Sparkles,
    PaintRoller
} from 'lucide-react'
import '../style/editor.scss'

// ── Custom FontSize Extension for Tiptap ───────────────────────────────────
export const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return {
            types: ['textStyle'],
        }
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, '') || null,
                        renderHTML: (attributes) => {
                            if (!attributes.fontSize) {
                                return {}
                            }
                            return {
                                style: `font-size: ${attributes.fontSize}`,
                            }
                        },
                    },
                },
            },
        ]
    },
    addCommands() {
        return {
            setFontSize: (fontSize) => ({ chain }) => {
                return chain()
                    .setMark('textStyle', { fontSize })
                    .run()
            },
            unsetFontSize: () => ({ chain }) => {
                return chain()
                    .setMark('textStyle', { fontSize: null })
                    .removeEmptyTextStyle()
                    .run()
            },
        }
    },
})

// ── Curated Font Sizes ─────────────────────────────────────────────────────
const FONT_SIZE_OPTIONS = [
    { label: '8 pt', value: '8pt' },
    { label: '9 pt', value: '9pt' },
    { label: '10 pt', value: '10pt' },
    { label: '10.5 pt', value: '10.5pt' },
    { label: '11 pt', value: '11pt' },
    { label: '12 pt', value: '12pt' },
    { label: '14 pt', value: '14pt' },
    { label: '16 pt', value: '16pt' },
    { label: '18 pt', value: '18pt' },
    { label: '20 pt', value: '20pt' },
    { label: '24 pt', value: '24pt' },
    { label: '30 pt', value: '30pt' },
    { label: '36 pt', value: '36pt' },
]

// ── Curated Headings / Text Styles ─────────────────────────────────────────
const HEADING_OPTIONS = [
    { label: 'Normal text', level: 0 },
    { label: 'Heading 1', level: 1 },
    { label: 'Heading 2', level: 2 },
    { label: 'Heading 3', level: 3 },
]

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
const ToolBtn = ({ onClick, onDoubleClick, active, disabled, title, children, className = '' }) => (
    <button
        type="button"
        className={`tiptap-toolbar-btn${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
        onMouseDown={(e) => { e.preventDefault(); onClick?.(e) }}
        onDoubleClick={(e) => { e.preventDefault(); onDoubleClick?.(e) }}
        disabled={disabled}
        title={title}
        aria-label={title}
    >
        {children}
    </button>
)

const Divider = () => <span className="tiptap-divider" />

// ── Helper to convert hex / rgb color strings to safe hex for <input type="color"> ──
function toHexColor(color) {
    if (!color) return '#1e293b'
    if (color.startsWith('#')) {
        if (color.length === 7) return color
        if (color.length === 4) {
            return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        }
    }
    if (color.startsWith('rgb')) {
        const parts = color.match(/\d+/g)
        if (parts && parts.length >= 3) {
            const r = Math.min(255, parseInt(parts[0], 10)).toString(16).padStart(2, '0')
            const g = Math.min(255, parseInt(parts[1], 10)).toString(16).padStart(2, '0')
            const b = Math.min(255, parseInt(parts[2], 10)).toString(16).padStart(2, '0')
            return `#${r}${g}${b}`
        }
    }
    return '#1e293b'
}

// ── Helpers to index all text characters in ProseMirror document to absolute positions ──
function buildDocTextIndex(doc) {
    const charToPos = []
    let plainText = ''

    doc.descendants((node, pos) => {
        if (node.isText && node.text) {
            for (let i = 0; i < node.text.length; i++) {
                charToPos.push(pos + i)
                plainText += node.text[i]
            }
        } else if (node.isBlock && plainText.length > 0 && !plainText.endsWith('\n')) {
            charToPos.push(pos)
            plainText += '\n'
        }
    })

    return { charToPos, plainText }
}

function findTextRange(charToPos, plainText, target) {
    if (!target || !plainText || plainText.length === 0) return null

    let idx = plainText.indexOf(target)
    let matchLen = target.length

    if (idx === -1) {
        idx = plainText.toLowerCase().indexOf(target.toLowerCase())
    }

    if (idx === -1) {
        try {
            const escaped = target
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\s+/g, '[\\s\\u00a0]+')
            const rx = new RegExp(escaped, 'i')
            const match = rx.exec(plainText)
            if (match) {
                idx = match.index
                matchLen = match[0].length
            }
        } catch (e) {}
    }

    if (idx === -1 && target.length > 30) {
        const prefix = target.slice(0, 30).trim()
        const escapedPrefix = prefix
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\s+/g, '[\\s\\u00a0]+')
        try {
            const rx = new RegExp(escapedPrefix, 'i')
            const match = rx.exec(plainText)
            if (match) {
                idx = match.index
                matchLen = Math.min(target.length, plainText.length - idx)
            }
        } catch (e) {}
    }

    if (idx !== -1 && charToPos[idx] !== undefined) {
        const from = charToPos[idx]
        const endIdx = Math.min(idx + matchLen - 1, charToPos.length - 1)
        const to = (charToPos[endIdx] ?? from) + 1
        return { from, to }
    }

    return null
}

// ── Main ResumeEditor component ────────────────────────────────────────────
const ResumeEditor = forwardRef(function ResumeEditor(
    { initialHtml = '', placeholder = 'Start editing...', onChange },
    ref
) {
    const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false)
    const [isFontSizeDropdownOpen, setIsFontSizeDropdownOpen] = useState(false)
    const [isHeadingDropdownOpen, setIsHeadingDropdownOpen] = useState(false)
    const [isListDropdownOpen, setIsListDropdownOpen] = useState(false)

    const fontDropdownRef = useRef(null)
    const fontSizeDropdownRef = useRef(null)
    const headingDropdownRef = useRef(null)
    const listDropdownRef = useRef(null)
    const lastSelectionRef = useRef(null)

    // Floating Link Popover state
    const [linkPopover, setLinkPopover] = useState({
        isOpen: false,
        text: '',
        url: '',
        isExisting: false,
    })
    const linkPopoverRef = useRef(null)
    const linkUrlInputRef = useRef(null)

    // ── Paint format (Copy formatting) state ──────────────────────────────
    const [paintFormat, setPaintFormat] = useState(null)
    const [isPaintFormatLocked, setIsPaintFormatLocked] = useState(false)
    const paintFormatRef = useRef(null)
    const paintFormatLockedRef = useRef(false)
    const applyFormatRef = useRef(null)

    paintFormatRef.current = paintFormat
    paintFormatLockedRef.current = isPaintFormatLocked

    // ── Text & Highlight Color Pickers state & refs ────────────────────────
    const colorInputRef = useRef(null)
    const highlightInputRef = useRef(null)
    const [lastTextColor, setLastTextColor] = useState('#1e293b')
    const [lastHighlightColor, setLastHighlightColor] = useState('#fef08a')

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
            FontSize.configure({
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
                // Escape key cancels paint format mode
                if (event.key === 'Escape' && paintFormatRef.current) {
                    setPaintFormat(null)
                    setIsPaintFormatLocked(false)
                    return true
                }
                // Ctrl+K or Cmd+K to open Link Popover
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                    event.preventDefault()
                    openLinkPopover()
                    return true
                }
                return false
            },
            handleDOMEvents: {
                mouseup: (view, event) => {
                    if (!paintFormatRef.current) return false
                    const { from, to } = view.state.selection
                    if (from < to) {
                        applyFormatRef.current?.(paintFormatRef.current)
                        if (!paintFormatLockedRef.current) {
                            setPaintFormat(null)
                            setIsPaintFormatLocked(false)
                        }
                    }
                    return false
                }
            }
        },
        onSelectionUpdate: ({ editor: ed }) => {
            const { from, to } = ed.state.selection
            if (from < to) {
                const text = ed.state.doc.textBetween(from, to, ' ').trim()
                if (text) {
                    lastSelectionRef.current = { from, to, text }
                }
            }
            const currentTextColor = ed.getAttributes('textStyle').color
            if (currentTextColor) {
                setLastTextColor(currentTextColor)
            }
            const currentHighlightColor = ed.getAttributes('highlight').color
            if (currentHighlightColor) {
                setLastHighlightColor(currentHighlightColor)
            }
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
        isFocused: () => editor?.isFocused ?? false,
        getLastSelection: () => lastSelectionRef.current,
        replaceExactText: (targetText, replacementText) => {
            if (!editor || !replacementText) return false

            const cleanTarget = (targetText || '').trim()
            const cleanReplacement = replacementText.trim()

            // Prepare stripped versions (strip leading bullet markers or numbers)
            const strippedTarget = cleanTarget.replace(/^[•\-\*\d\.]+\s*/, '').trim()
            const strippedReplacement = cleanReplacement.replace(/^[•\-\*\d\.]+\s*/, '').trim()

            // Candidate targets to search for, ordered from exact to stripped
            const targetsToTry = [cleanTarget, strippedTarget].filter(Boolean)

            // 1. Check if user has an active/saved selection that matches targetText or non-empty
            if (lastSelectionRef.current && lastSelectionRef.current.from < lastSelectionRef.current.to) {
                const { from, to } = lastSelectionRef.current
                const docSize = editor.state.doc.content.size
                if (from <= docSize && to <= docSize) {
                    const textAtSel = editor.state.doc.textBetween(from, to, ' ').trim()
                    const textAtSelNorm = textAtSel.replace(/[\u00a0\s]+/g, ' ')
                    const cleanTargetNorm = cleanTarget.replace(/[\u00a0\s]+/g, ' ')
                    const strippedTargetNorm = strippedTarget.replace(/[\u00a0\s]+/g, ' ')

                    const isMatch = !cleanTarget ||
                        textAtSelNorm === cleanTargetNorm ||
                        textAtSelNorm === strippedTargetNorm ||
                        textAtSelNorm.includes(cleanTargetNorm) ||
                        cleanTargetNorm.includes(textAtSelNorm) ||
                        textAtSelNorm.includes(strippedTargetNorm)

                    if (isMatch) {
                        const $pos = editor.state.doc.resolve(from)
                        const isInsideList = $pos.parent.type.name === 'listItem' ||
                            $pos.node(-1)?.type.name === 'listItem' ||
                            $pos.node(-2)?.type.name === 'listItem'
                        const rep = (isInsideList || (strippedTarget && cleanReplacement.startsWith('•')))
                            ? strippedReplacement
                            : cleanReplacement

                        editor.chain().focus().setTextSelection({ from, to }).insertContent(rep).run()
                        lastSelectionRef.current = null
                        onChange?.(editor.getHTML())
                        return true
                    }
                }
            }

            // 2. Search across the ProseMirror doc by mapping character indices (immune to inline marks)
            const doc = editor.state.doc
            const { charToPos, plainText } = buildDocTextIndex(doc)

            if (targetsToTry.length > 0 && plainText.length > 0) {
                for (const t of targetsToTry) {
                    const range = findTextRange(charToPos, plainText, t)
                    if (range) {
                        const { from, to } = range
                        const $pos = editor.state.doc.resolve(from)
                        const isInsideList = $pos.parent.type.name === 'listItem' ||
                            $pos.node(-1)?.type.name === 'listItem' ||
                            $pos.node(-2)?.type.name === 'listItem'
                        const rep = (isInsideList || (t === strippedTarget && cleanReplacement.startsWith('•')))
                            ? strippedReplacement
                            : cleanReplacement

                        editor.chain().focus().setTextSelection({ from, to }).insertContent(rep).run()
                        lastSelectionRef.current = null
                        onChange?.(editor.getHTML())
                        return true
                    }
                }
            }

            // 3. Textblock fallback (matches whole paragraph / heading / list item content)
            if (targetsToTry.length > 0) {
                let textblockMatch = null
                doc.descendants((node, pos) => {
                    if (textblockMatch) return false
                    if (node.isTextblock && node.textContent.trim()) {
                        const blockText = node.textContent.trim().replace(/[\u00a0\s]+/g, ' ')
                        for (const t of targetsToTry) {
                            const normT = t.replace(/[\u00a0\s]+/g, ' ')
                            if (blockText === normT || blockText.includes(normT) || normT.includes(blockText)) {
                                textblockMatch = {
                                    from: pos + 1,
                                    to: pos + node.nodeSize - 1,
                                    isInsideList: node.type.name === 'listItem'
                                }
                                return false
                            }
                        }
                    }
                })

                if (textblockMatch) {
                    const { from, to } = textblockMatch
                    const $pos = editor.state.doc.resolve(from)
                    const isInsideList = textblockMatch.isInsideList ||
                        $pos.parent.type.name === 'listItem' ||
                        $pos.node(-1)?.type.name === 'listItem'
                    const rep = (isInsideList || cleanReplacement.startsWith('•'))
                        ? strippedReplacement
                        : cleanReplacement

                    editor.chain().focus().setTextSelection({ from, to }).insertContent(rep).run()
                    lastSelectionRef.current = null
                    onChange?.(editor.getHTML())
                    return true
                }
            }

            // 4. Safe HTML replacement fallback (for complex spans or entities)
            if (targetsToTry.length > 0) {
                const currentHtml = editor.getHTML()
                for (const t of targetsToTry) {
                    const rep = (t === strippedTarget && cleanReplacement.startsWith('•'))
                        ? strippedReplacement
                        : cleanReplacement

                    if (currentHtml.includes(t)) {
                        editor.commands.setContent(currentHtml.replace(t, rep), true)
                        lastSelectionRef.current = null
                        onChange?.(editor.getHTML())
                        return true
                    }
                    const escapedAmpTarget = t.replace(/&/g, '&amp;')
                    if (currentHtml.includes(escapedAmpTarget)) {
                        editor.commands.setContent(currentHtml.replace(escapedAmpTarget, rep), true)
                        lastSelectionRef.current = null
                        onChange?.(editor.getHTML())
                        return true
                    }
                    try {
                        const escapedRegex = t
                            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                            .replace(/\s+/g, '[\\s\\u00a0]+')
                        const rx = new RegExp(escapedRegex, 'i')
                        if (rx.test(currentHtml)) {
                            editor.commands.setContent(currentHtml.replace(rx, rep), true)
                            lastSelectionRef.current = null
                            onChange?.(editor.getHTML())
                            return true
                        }
                    } catch {}
                }
            }

            return false
        },
    }), [editor])

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target)) {
                setIsFontDropdownOpen(false)
            }
            if (fontSizeDropdownRef.current && !fontSizeDropdownRef.current.contains(e.target)) {
                setIsFontSizeDropdownOpen(false)
            }
            if (headingDropdownRef.current && !headingDropdownRef.current.contains(e.target)) {
                setIsHeadingDropdownOpen(false)
            }
            if (listDropdownRef.current && !listDropdownRef.current.contains(e.target)) {
                setIsListDropdownOpen(false)
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

    // ── Font Size selector handler ───────────────────────────────────────
    const currentFontSize = editor?.getAttributes('textStyle').fontSize || ''
    const activeFontSizeObj = FONT_SIZE_OPTIONS.find(s => s.value === currentFontSize || s.label === currentFontSize || s.value === `${currentFontSize}pt`) || (currentFontSize ? { label: currentFontSize, value: currentFontSize } : { label: '11 pt', value: '11pt' })

    const handleSelectFontSize = (size) => {
        if (!editor) return
        editor.chain().focus().setFontSize(size.value).run()
        setIsFontSizeDropdownOpen(false)
    }

    // ── Headings selector handler ────────────────────────────────────────
    const getActiveHeading = () => {
        if (!editor) return HEADING_OPTIONS[0]
        if (editor.isActive('heading', { level: 1 })) return HEADING_OPTIONS[1]
        if (editor.isActive('heading', { level: 2 })) return HEADING_OPTIONS[2]
        if (editor.isActive('heading', { level: 3 })) return HEADING_OPTIONS[3]
        return HEADING_OPTIONS[0]
    }
    const activeHeading = getActiveHeading()

    const handleSelectHeading = (heading) => {
        if (!editor) return
        if (heading.level === 0) {
            editor.chain().focus().setParagraph().run()
        } else {
            editor.chain().focus().toggleHeading({ level: heading.level }).run()
        }
        setIsHeadingDropdownOpen(false)
    }

    // ── Lists selector helpers ───────────────────────────────────────────
    const getActiveListIcon = () => {
        if (!editor) return <List size={14} />
        if (editor.isActive('orderedList')) return <ListOrdered size={14} />
        if (editor.isActive('blockquote')) return <Quote size={14} />
        return <List size={14} />
    }
    const isAnyListActive = Boolean(editor?.isActive('bulletList') || editor?.isActive('orderedList') || editor?.isActive('blockquote'))

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

    // ── Paint Format (Copy formatting) handlers ───────────────────────────
    const copyCurrentFormat = useCallback(() => {
        if (!editor) return null
        const textStyle = editor.getAttributes('textStyle') || {}
        const highlightAttr = editor.getAttributes('highlight') || {}
        const headingLevel = [1, 2, 3].find(level => editor.isActive('heading', { level })) || 0

        return {
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            underline: editor.isActive('underline'),
            strike: editor.isActive('strike'),
            fontFamily: textStyle.fontFamily || null,
            fontSize: textStyle.fontSize || null,
            color: textStyle.color || null,
            highlight: highlightAttr.color || (editor.isActive('highlight') ? '#fef08a' : null),
            textAlign: ['left', 'center', 'right', 'justify'].find(align => editor.isActive({ textAlign: align })) || 'left',
            headingLevel: headingLevel,
            isParagraph: editor.isActive('paragraph'),
        }
    }, [editor])

    const applyFormatToSelection = useCallback((format) => {
        if (!editor || !format) return
        let chain = editor.chain().focus()

        // 1. Font Family
        if (format.fontFamily) {
            chain = chain.setFontFamily(format.fontFamily)
        }

        // 2. Font Size
        if (format.fontSize) {
            chain = chain.setFontSize(format.fontSize)
        }

        // 3. Text Color
        if (format.color) {
            chain = chain.setColor(format.color)
        } else {
            chain = chain.unsetColor()
        }

        // 4. Highlight
        if (format.highlight) {
            chain = chain.setHighlight({ color: format.highlight })
        } else {
            chain = chain.unsetHighlight()
        }

        // 5. Basic Marks: Bold, Italic, Underline, Strike
        if (format.bold) {
            if (!editor.isActive('bold')) chain = chain.setBold()
        } else {
            if (editor.isActive('bold')) chain = chain.unsetBold()
        }

        if (format.italic) {
            if (!editor.isActive('italic')) chain = chain.setItalic()
        } else {
            if (editor.isActive('italic')) chain = chain.unsetItalic()
        }

        if (format.underline) {
            if (!editor.isActive('underline')) chain = chain.setUnderline()
        } else {
            if (editor.isActive('underline')) chain = chain.unsetUnderline()
        }

        if (format.strike) {
            if (!editor.isActive('strike')) chain = chain.setStrike()
        } else {
            if (editor.isActive('strike')) chain = chain.unsetStrike()
        }

        // 6. Text Alignment
        if (format.textAlign) {
            chain = chain.setTextAlign(format.textAlign)
        }

        // 7. Heading or Paragraph level
        if (format.headingLevel && format.headingLevel > 0) {
            chain = chain.setHeading({ level: format.headingLevel })
        } else if (format.isParagraph) {
            chain = chain.setParagraph()
        }

        chain.run()
        onChange?.(editor.getHTML())
    }, [editor, onChange])

    applyFormatRef.current = applyFormatToSelection

    const handlePaintFormatClick = useCallback(() => {
        if (paintFormat) {
            setPaintFormat(null)
            setIsPaintFormatLocked(false)
        } else {
            const format = copyCurrentFormat()
            if (format) {
                setPaintFormat(format)
                setIsPaintFormatLocked(false)
            }
        }
    }, [paintFormat, copyCurrentFormat])

    const handlePaintFormatDoubleClick = useCallback(() => {
        const format = copyCurrentFormat()
        if (format) {
            setPaintFormat(format)
            setIsPaintFormatLocked(true)
        }
    }, [copyCurrentFormat])

    // ── Text & Highlight Color Handlers & Active State ────────────────────
    const activeTextColor = editor?.getAttributes('textStyle').color || lastTextColor || '#1e293b'
    const activeHighlightColor = editor?.getAttributes('highlight').color || lastHighlightColor || '#fef08a'

    const handleTextColorChange = useCallback((e) => {
        const newColor = e.target.value
        if (!editor || !newColor) return
        editor.chain().focus().setColor(newColor).run()
        setLastTextColor(newColor)
        onChange?.(editor.getHTML())
    }, [editor, onChange])

    const handleHighlightColorChange = useCallback((e) => {
        const newColor = e.target.value
        if (!editor || !newColor) return
        editor.chain().focus().setHighlight({ color: newColor }).run()
        setLastHighlightColor(newColor)
        onChange?.(editor.getHTML())
    }, [editor, onChange])

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

    // Helper to get natural, professional reading text with cleaned symbols & pauses
    const getReadingText = useCallback(() => {
        if (!editor) return ''
        const { from, to } = editor.state.selection
        let rawText = ''
        const selected = editor.state.doc.textBetween(from, to, ' ').trim()
        if (selected && selected.length > 3) {
            rawText = selected
        } else {
            const html = editor.getHTML()
            if (!html) return ''

            const temp = document.createElement('div')
            temp.innerHTML = html

            // Ensure natural pauses between blocks and headings
            const blocks = temp.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, tr')
            blocks.forEach(el => {
                const text = el.innerText.trim()
                if (text && !/[.!?:]$/.test(text)) {
                    el.innerText = text + '. '
                }
            })

            rawText = temp.innerText || temp.textContent || ''
        }

        // Clean & polish symbols for natural professional human speech
        return rawText
            .replace(/\bC\+\+/gi, 'C plus plus')
            .replace(/\bC#/gi, 'C sharp')
            .replace(/\bTCP\/IP\b/gi, 'TCP, IP')
            .replace(/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)/g, '$1 and $2') // Linux/Unix -> Linux and Unix
            .replace(/^[•\-\*\·▪▫–—\d\.]+\s*/gm, '') // Remove bullet glyphs
            .replace(/[•\·▪▫–—]/g, ', ')
            .replace(/\s+/g, ' ')
            .trim()
    }, [editor])

    const getBestVoice = useCallback(() => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return null
        const voices = window.speechSynthesis.getVoices() || []
        const naturalVoices = voices.filter(v => (v.lang.startsWith('en') || v.lang.includes('EN')))
        return naturalVoices.find(v => v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online (Natural)'))
            || naturalVoices.find(v => v.name.includes('Google') || v.name.includes('Jenny') || v.name.includes('Guy') || v.name.includes('Andrew') || v.name.includes('Aria') || v.name.includes('Christopher'))
            || naturalVoices.find(v => v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('David'))
            || naturalVoices[0]
            || null
    }, [])

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

        const preferredVoice = getBestVoice()
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
    }, [getReadingText, getBestVoice, audioState.rate])

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
        <div className={`tiptap-editor-root ${paintFormat ? 'paint-format-mode' : ''}`}>
            {/* ── Formatting Toolbar ── */}
            <div className="tiptap-toolbar" role="toolbar" aria-label="Text formatting">
                {/* History */}
                <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
                    <Undo size={14} />
                </ToolBtn>
                <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
                    <Redo size={14} />
                </ToolBtn>
                <ToolBtn
                    onClick={handlePaintFormatClick}
                    onDoubleClick={handlePaintFormatDoubleClick}
                    active={Boolean(paintFormat)}
                    className={paintFormat ? 'paint-format-active' : ''}
                    title={
                        isPaintFormatLocked
                            ? "Paint format locked (Click or Esc to exit)"
                            : paintFormat
                            ? "Paint format active (Click text/selection to apply, double-click for persistent mode)"
                            : "Paint format (Copy formatting: click to copy, double-click for persistent)"
                    }
                >
                    <PaintRoller size={14} />
                </ToolBtn>

                <Divider />

                {/* ── Google Docs Font Family Dropdown ── */}
                <div className="tiptap-font-dropdown-wrap" ref={fontDropdownRef}>
                    <button
                        type="button"
                        className={`tiptap-font-picker-btn ${isFontDropdownOpen ? 'open' : ''}`}
                        onClick={() => {
                            setIsFontDropdownOpen(!isFontDropdownOpen)
                            setIsFontSizeDropdownOpen(false)
                            setIsHeadingDropdownOpen(false)
                            setIsListDropdownOpen(false)
                        }}
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

                {/* ── 3rd Dropdown: Font Size Dropdown ── */}
                <div className="tiptap-font-dropdown-wrap tiptap-fontsize-dropdown-wrap" ref={fontSizeDropdownRef}>
                    <button
                        type="button"
                        className={`tiptap-font-picker-btn tiptap-size-picker-btn ${isFontSizeDropdownOpen ? 'open' : ''}`}
                        onClick={() => {
                            setIsFontSizeDropdownOpen(!isFontSizeDropdownOpen)
                            setIsFontDropdownOpen(false)
                            setIsHeadingDropdownOpen(false)
                            setIsListDropdownOpen(false)
                        }}
                        title="Font Size"
                    >
                        <span className="font-size-current-val">
                            {activeFontSizeObj.label}
                        </span>
                        <ChevronDown size={12} className="font-chevron" />
                    </button>

                    {isFontSizeDropdownOpen && (
                        <div className="tiptap-font-menu tiptap-size-menu" role="menu">
                            <div className="font-menu-header">Font Size</div>
                            <div className="font-menu-list">
                                {FONT_SIZE_OPTIONS.map((size) => {
                                    const isSelected = activeFontSizeObj.value === size.value || activeFontSizeObj.label === size.label
                                    return (
                                        <button
                                            key={size.value}
                                            type="button"
                                            className={`font-menu-item size-menu-item ${isSelected ? 'selected' : ''}`}
                                            onClick={() => handleSelectFontSize(size)}
                                        >
                                            <span className="font-size-label">{size.label}</span>
                                            {isSelected && <Check size={14} className="font-check-icon" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <Divider />

                {/* ── 1st Dropdown: Headings / Text Styles Dropdown ── */}
                <div className="tiptap-font-dropdown-wrap tiptap-heading-dropdown-wrap" ref={headingDropdownRef}>
                    <button
                        type="button"
                        className={`tiptap-font-picker-btn tiptap-heading-picker-btn ${isHeadingDropdownOpen ? 'open' : ''} ${activeHeading.level > 0 ? 'is-active' : ''}`}
                        onClick={() => {
                            setIsHeadingDropdownOpen(!isHeadingDropdownOpen)
                            setIsFontDropdownOpen(false)
                            setIsFontSizeDropdownOpen(false)
                            setIsListDropdownOpen(false)
                        }}
                        title="Text Style / Heading"
                    >
                        <span className="heading-current-label">
                            {activeHeading.label}
                        </span>
                        <ChevronDown size={12} className="font-chevron" />
                    </button>

                    {isHeadingDropdownOpen && (
                        <div className="tiptap-font-menu tiptap-heading-menu" role="menu">
                            <div className="font-menu-header">Styles</div>
                            <div className="font-menu-list">
                                {HEADING_OPTIONS.map((heading) => {
                                    const isSelected = activeHeading.level === heading.level
                                    return (
                                        <button
                                            key={heading.label}
                                            type="button"
                                            className={`font-menu-item heading-menu-item heading-level-${heading.level} ${isSelected ? 'selected' : ''}`}
                                            onClick={() => handleSelectHeading(heading)}
                                        >
                                            <span className="heading-preview-text">
                                                {heading.label}
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

                {/* ── 2nd Dropdown: Lists & Blocks Dropdown ── */}
                <div className="tiptap-font-dropdown-wrap tiptap-list-dropdown-wrap" ref={listDropdownRef}>
                    <button
                        type="button"
                        className={`tiptap-font-picker-btn tiptap-list-picker-btn ${isListDropdownOpen ? 'open' : ''} ${isAnyListActive ? 'is-active' : ''}`}
                        onClick={() => {
                            setIsListDropdownOpen(!isListDropdownOpen)
                            setIsFontDropdownOpen(false)
                            setIsFontSizeDropdownOpen(false)
                            setIsHeadingDropdownOpen(false)
                        }}
                        title="Lists & Blocks"
                    >
                        <span className="list-current-icon">
                            {getActiveListIcon()}
                        </span>
                        <ChevronDown size={11} className="font-chevron" />
                    </button>

                    {isListDropdownOpen && (
                        <div className="tiptap-font-menu tiptap-list-menu" role="menu">
                            <div className="font-menu-header">Lists & Blocks</div>
                            <div className="font-menu-list">
                                <button
                                    type="button"
                                    className={`font-menu-item list-menu-item ${editor.isActive('bulletList') ? 'selected' : ''}`}
                                    onClick={() => {
                                        editor.chain().focus().toggleBulletList().run()
                                        setIsListDropdownOpen(false)
                                    }}
                                >
                                    <div className="item-label-with-icon">
                                        <List size={14} className="item-menu-icon" />
                                        <span>Bullet list</span>
                                    </div>
                                    {editor.isActive('bulletList') && <Check size={14} className="font-check-icon" />}
                                </button>

                                <button
                                    type="button"
                                    className={`font-menu-item list-menu-item ${editor.isActive('orderedList') ? 'selected' : ''}`}
                                    onClick={() => {
                                        editor.chain().focus().toggleOrderedList().run()
                                        setIsListDropdownOpen(false)
                                    }}
                                >
                                    <div className="item-label-with-icon">
                                        <ListOrdered size={14} className="item-menu-icon" />
                                        <span>Numbered list</span>
                                    </div>
                                    {editor.isActive('orderedList') && <Check size={14} className="font-check-icon" />}
                                </button>

                                <button
                                    type="button"
                                    className={`font-menu-item list-menu-item ${editor.isActive('blockquote') ? 'selected' : ''}`}
                                    onClick={() => {
                                        editor.chain().focus().toggleBlockquote().run()
                                        setIsListDropdownOpen(false)
                                    }}
                                >
                                    <div className="item-label-with-icon">
                                        <Quote size={14} className="item-menu-icon" />
                                        <span>Blockquote</span>
                                    </div>
                                    {editor.isActive('blockquote') && <Check size={14} className="font-check-icon" />}
                                </button>

                                <button
                                    type="button"
                                    className="font-menu-item list-menu-item"
                                    onClick={() => {
                                        editor.chain().focus().setHorizontalRule().run()
                                        setIsListDropdownOpen(false)
                                    }}
                                >
                                    <div className="item-label-with-icon">
                                        <Minus size={14} className="item-menu-icon" />
                                        <span>Horizontal line</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

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

                {/* ── Dynamic Text Color Picker (with current/last color indicator bar) ── */}
                <div className="tiptap-color-btn-wrap" title={`Text color (${activeTextColor})`}>
                    <button
                        type="button"
                        className="tiptap-color-trigger-btn"
                        onClick={() => colorInputRef.current?.click()}
                        title={`Text color (${activeTextColor})`}
                        aria-label="Text color"
                    >
                        <span className="tiptap-color-icon-inner">
                            <span className="color-icon-letter">A</span>
                            <span
                                className="color-bar-indicator"
                                style={{ backgroundColor: activeTextColor }}
                            />
                        </span>
                    </button>
                    <input
                        ref={colorInputRef}
                        type="color"
                        className="tiptap-hidden-color-input"
                        value={toHexColor(activeTextColor)}
                        onChange={handleTextColorChange}
                        title="Choose text color"
                        aria-label="Choose text color"
                    />
                </div>

                {/* ── Dynamic Highlight Color Picker (with current/last color indicator bar) ── */}
                <div className="tiptap-color-btn-wrap" title={`Highlight color (${activeHighlightColor})`}>
                    <button
                        type="button"
                        className="tiptap-color-trigger-btn"
                        onClick={() => highlightInputRef.current?.click()}
                        title={`Highlight color (${activeHighlightColor})`}
                        aria-label="Highlight color"
                    >
                        <span className="tiptap-color-icon-inner">
                            <Highlighter size={14} />
                            <span
                                className="color-bar-indicator"
                                style={{ backgroundColor: activeHighlightColor }}
                            />
                        </span>
                    </button>
                    <input
                        ref={highlightInputRef}
                        type="color"
                        className="tiptap-hidden-color-input"
                        value={toHexColor(activeHighlightColor)}
                        onChange={handleHighlightColorChange}
                        title="Choose highlight color"
                        aria-label="Choose highlight color"
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

