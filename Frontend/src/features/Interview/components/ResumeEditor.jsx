import React, { useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, Quote, Undo, Redo, Highlighter, Type,
    Heading1, Heading2, Heading3, Minus
} from 'lucide-react'
import '../style/editor.scss'

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
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                bulletList: { keepMarks: true, keepAttributes: false },
                orderedList: { keepMarks: true, keepAttributes: false },
            }),
            Underline,
            TextStyle,
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
        },
        onUpdate: ({ editor }) => {
            onChange?.(editor.getHTML())
        },
    })

    // When initialHtml changes externally (e.g. after fetch), update editor content
    useEffect(() => {
        if (editor && initialHtml && editor.isEmpty) {
            editor.commands.setContent(initialHtml, false)
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

    // ── Link dialog handler ──────────────────────────────────────────────
    const handleSetLink = useCallback(() => {
        if (!editor) return
        const previousUrl = editor.getAttributes('link').href
        const url = window.prompt('Enter URL:', previousUrl || 'https://')
        if (url === null) return
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }
        const finalUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`
        editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run()
    }, [editor])

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

                {/* Link */}
                <ToolBtn onClick={handleSetLink} active={editor.isActive('link')} title="Insert / Edit Link">
                    <LinkIcon size={14} />
                </ToolBtn>

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
            </div>

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
