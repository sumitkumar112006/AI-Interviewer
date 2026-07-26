import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    generateCoverLetterFromReport,
    getCoverLetterByReportId,
    generateCoverLetterPdf,
    deleteCoverLetter,
    updateCoverLetter
} from '../services/coverletter.api';
import { getInterviewReportById } from '../services/interview.api';
import LoadingPage from '../Loading';
import '../style/coverletter.scss';

const CoverLetter = () => {
    const { interviewId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [error, setError] = useState('');
    const [report, setReport] = useState(null);
    const [coverLetter, setCoverLetter] = useState(null);

    // Form State
    const [companyName, setCompanyName] = useState('');
    const [roleName, setRoleName] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    // Inline Editing State
    const [iframeContent, setIframeContent] = useState('');
    const [isDirty, setIsDirty] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const editedContentRef = React.useRef('');
    const iframeRef = React.useRef(null);

    // Custom Link Modal State
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkText, setLinkText] = useState('');
    const [linkUrl, setLinkUrl] = useState('');

    useEffect(() => {
        let isMounted = true;

        async function initData() {
            setPageLoading(true);
            setError('');
            try {
                const reportRes = await getInterviewReportById(interviewId);
                if (isMounted) {
                    setReport(reportRes?.interviewReport || null);
                }

                const coverLetterRes = await getCoverLetterByReportId(interviewId);
                if (isMounted && coverLetterRes?.coverLetter) {
                    setCoverLetter(coverLetterRes.coverLetter);
                    setIframeContent(coverLetterRes.coverLetter.generatedContent);
                    editedContentRef.current = coverLetterRes.coverLetter.generatedContent;
                    setCompanyName(coverLetterRes.coverLetter.companyName || '');
                    setRoleName(coverLetterRes.coverLetter.roleName || '');
                }
            } catch (err) {
                console.error("Error loading cover letter data:", err);
                if (isMounted) {
                    setError(err?.response?.data?.message || err?.message || 'Failed to load page data.');
                }
            } finally {
                if (isMounted) {
                    setPageLoading(false);
                }
            }
        }

        initData();

        return () => {
            isMounted = false;
        };
    }, [interviewId]);

    const handleGenerate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await generateCoverLetterFromReport(interviewId, {
                companyName: companyName.trim(),
                roleName: roleName.trim()
            });
            setCoverLetter(res.coverLetter);
            setIframeContent(res.coverLetter.generatedContent);
            editedContentRef.current = res.coverLetter.generatedContent;
            setIsDirty(false);
        } catch (err) {
            console.error("Error generating cover letter:", err);
            setError(err?.response?.data?.message || err?.message || 'Failed to generate cover letter.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!coverLetter?._id) return;
        setLoading(true);
        setError('');
        try {
            // Auto-save changes first if dirty
            if (isDirty) {
                const res = await updateCoverLetter(coverLetter._id, {
                    generatedContent: editedContentRef.current
                });
                setCoverLetter(res.coverLetter);
                setIframeContent(res.coverLetter.generatedContent);
                setIsDirty(false);
            }

            const pdfBlob = await generateCoverLetterPdf(coverLetter._id);
            const objectUrl = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `cover_letter_${companyName ? companyName.replace(/\s+/g, '_') : 'builder'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(objectUrl);
        } catch (err) {
            console.error("Error downloading PDF:", err);
            setError(err?.message || 'Failed to download cover letter PDF.');
        } finally {
            setLoading(false);
        }
    };

    const handleIframeLoad = (e) => {
        const iframe = e.target;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc && iframeDoc.body) {
            iframeDoc.body.contentEditable = "true";
            iframeDoc.body.style.outline = "none";
            iframeDoc.body.style.cursor = "text";

            iframeDoc.body.addEventListener('input', () => {
                const updatedContent = iframeDoc.documentElement.outerHTML;
                editedContentRef.current = updatedContent;
                setIsDirty(true);
            });

            // Keep track of text selection inside the iframe
            iframeDoc.addEventListener('mouseup', saveSelection);
            iframeDoc.addEventListener('keyup', saveSelection);
            iframeDoc.addEventListener('selectionchange', saveSelection);
        }
    };

    const savedRangeRef = React.useRef(null);

    const saveSelection = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const win = iframe.contentWindow;
        if (!win) return;
        const sel = win.getSelection();
        if (sel && sel.rangeCount > 0) {
            savedRangeRef.current = sel.getRangeAt(0);
        }
    };

    const restoreSelection = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const win = iframe.contentWindow;
        if (!win) return;
        const sel = win.getSelection();
        if (savedRangeRef.current && sel) {
            sel.removeAllRanges();
            sel.addRange(savedRangeRef.current);
        }
    };

    const applyFormat = (command, value = null) => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc) {
            restoreSelection();
            if (iframe.contentWindow) {
                iframe.contentWindow.focus();
            }
            doc.execCommand(command, false, value);
            
            // Re-save selection after change
            saveSelection();

            // Trigger input event manually to sync edits
            const event = new Event('input', { bubbles: true });
            doc.body.dispatchEvent(event);
        }
    };

    const handleInsertLinkClick = (e) => {
        e.preventDefault();
        
        // Restore range first
        restoreSelection();
        
        const iframe = iframeRef.current;
        if (!iframe) return;
        const win = iframe.contentWindow;
        if (!win) return;
        
        const sel = win.getSelection();
        let selectedText = "";
        if (sel && sel.rangeCount > 0) {
            selectedText = sel.toString().trim();
        }
        
        setLinkText(selectedText || 'Link');
        setLinkUrl('https://');
        setIsLinkModalOpen(true);
    };

    const handleLinkSubmit = (e) => {
        e.preventDefault();
        if (!linkText.trim() || !linkUrl.trim()) return;

        const formattedUrl = /^https?:\/\//i.test(linkUrl) ? linkUrl : `https://${linkUrl}`;
        const anchorHtml = `<a href="${formattedUrl}" target="_blank" style="color: #6366f1; text-decoration: underline; font-weight: bold;">${linkText}</a>`;
        
        applyFormat('insertHTML', anchorHtml);
        setIsLinkModalOpen(false);
        setLinkText('');
        setLinkUrl('');
    };

    const handleSaveChanges = async () => {
        if (!coverLetter?._id) return;
        setSaveLoading(true);
        setError('');
        try {
            const res = await updateCoverLetter(coverLetter._id, {
                generatedContent: editedContentRef.current
            });
            setCoverLetter(res.coverLetter);
            setIframeContent(res.coverLetter.generatedContent);
            setIsDirty(false);
        } catch (err) {
            console.error("Error saving cover letter changes:", err);
            setError(err?.response?.data?.message || err?.message || 'Failed to save changes.');
        } finally {
            setSaveLoading(false);
        }
    };

    const stripHtml = (html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    };

    const handleCopyText = () => {
        if (!coverLetter?.generatedContent) return;
        const text = stripHtml(coverLetter.generatedContent);
        navigator.clipboard.writeText(text)
            .then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            })
            .catch(err => {
                console.error("Error copying text:", err);
            });
    };

    const handleDelete = async () => {
        if (!coverLetter?._id) return;
        if (!window.confirm("Are you sure you want to delete this cover letter?")) return;

        setLoading(true);
        setError('');
        try {
            await deleteCoverLetter(coverLetter._id);
            setCoverLetter(null);
            setIframeContent('');
            editedContentRef.current = '';
            setIsDirty(false);
            setCompanyName('');
            setRoleName('');
        } catch (err) {
            console.error("Error deleting cover letter:", err);
            setError(err?.message || 'Failed to delete cover letter.');
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <main>
                <LoadingPage />
            </main>
        );
    }

    const reportTitle = report?.developerTitle || 'Developer';

    return (
        <div className="coverletter-page">
            <div className="coverletter-shell">
                {/* Header Section */}
                <div className="coverletter-header">
                    <div className="coverletter-heading">
                        <p className="eyebrow">CV Generator Cover Letter Builder</p>
                        <h1>Cover Letter for {reportTitle}</h1>
                        <p className="intro">
                            Generate a highly tailored, professional cover letter matching your resume strengths to the target job description.
                        </p>
                    </div>
                    <div>
                        <button
                            type="button"
                            className="action-btn btn-secondary"
                            onClick={() => navigate(`/interview/${interviewId}`, { state: { interviewReport: report } })}
                        >
                            Back To Report
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="feedback-message error-message" style={{ minHeight: 'auto', padding: '1.2rem 1.5rem', background: '#180e15', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.75rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', boxShadow: '0 0 25px rgba(239, 68, 68, 0.15)' }}>
                        <p style={{ margin: 0, color: '#f87171', fontSize: '0.9rem', lineHeight: '1.5', fontWeight: '500' }}>❌ {error}</p>
                        <button 
                            type="button" 
                            onClick={() => setError('')} 
                            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', padding: '0.2rem' }}
                            title="Dismiss"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Main Content Area */}
                <div className="coverletter-grid" style={{ marginTop: '1rem' }}>
                    {/* Left Panel: Form controls / Actions */}
                    <div className="form-panel">
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
                            {coverLetter ? 'Cover Letter Details' : 'Generate Cover Letter'}
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)', lineHeight: '1.4' }}>
                            {coverLetter
                                ? 'Review the details or edit inputs below to regenerate your cover letter.'
                                : 'Fill in the optional details below to personalize your cover letter address.'}
                        </p>

                        <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="input-field">
                                <label htmlFor="companyName">Company Name (Optional)</label>
                                <input
                                    type="text"
                                    id="companyName"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="e.g. Google, Stripe"
                                    disabled={loading}
                                />
                            </div>

                            <div className="input-field">
                                <label htmlFor="roleName">Role Name (Optional)</label>
                                <input
                                    type="text"
                                    id="roleName"
                                    value={roleName}
                                    onChange={(e) => setRoleName(e.target.value)}
                                    placeholder="e.g. Senior Software Engineer"
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                className="generate-btn"
                                disabled={loading}
                            >
                                {loading ? 'Generating...' : coverLetter ? 'Regenerate with AI' : 'Generate Cover Letter'}
                            </button>
                        </form>

                        <div className="info-card">
                            💡 <strong>KIVI-AI</strong> automatically blends the <strong>resume</strong> text and <strong>job description</strong> from your interview report to align your cover letter with the job's core requirements.
                        </div>

                        {coverLetter && (
                            <button
                                type="button"
                                className="action-btn btn-secondary"
                                onClick={handleDelete}
                                disabled={loading}
                                style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--danger)', color: 'var(--danger)', marginTop: '0.5rem' }}
                            >
                                Delete Cover Letter
                            </button>
                        )}
                    </div>

                    {/* Right Panel: Interactive Paper Preview */}
                    <div className="preview-panel">
                        {loading && !coverLetter ? (
                            <div className="feedback-message">
                                <span className="pulse-dot"></span>
                                <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>Drafting your professional cover letter using Gemini AI...</p>
                            </div>
                        ) : coverLetter ? (
                            <div className="paper-frame">
                                <div className="paper-actions-bar">
                                    <div className="left-actions" style={{ alignItems: 'center' }}>
                                        <button
                                            type="button"
                                            className="action-btn btn-secondary"
                                            onClick={handleCopyText}
                                        >
                                            {isCopied ? '✓ Copied Text' : '📋 Copy Text'}
                                        </button>

                                        <button
                                            type="button"
                                            className="action-btn btn-primary"
                                            onClick={handleSaveChanges}
                                            disabled={saveLoading || !isDirty}
                                            style={{ background: 'var(--success-color)' }}
                                        >
                                            {saveLoading ? 'Saving...' : '💾 Save Changes'}
                                        </button>

                                        {isDirty && (
                                            <span style={{ fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', marginLeft: '0.5rem', fontWeight: '600' }}>
                                                ⚠️ Unsaved changes
                                            </span>
                                        )}
                                    </div>
                                    <div className="right-actions">
                                        <button
                                            type="button"
                                            className="action-btn btn-primary"
                                            onClick={handleDownloadPdf}
                                            disabled={loading || saveLoading}
                                        >
                                            {loading ? 'Preparing...' : '📥 Download PDF'}
                                        </button>
                                    </div>
                                </div>

                                <div className="formatting-toolbar">
                                    <button 
                                        type="button" 
                                        className="toolbar-btn" 
                                        onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }}
                                        title="Bold"
                                        style={{ fontWeight: 'bold' }}
                                    >
                                        B
                                    </button>
                                    <button 
                                        type="button" 
                                        className="toolbar-btn" 
                                        onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }}
                                        title="Italic"
                                        style={{ fontStyle: 'italic' }}
                                    >
                                        I
                                    </button>
                                    <button 
                                        type="button" 
                                        className="toolbar-btn" 
                                        onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }}
                                        title="Underline"
                                        style={{ textDecoration: 'underline' }}
                                    >
                                        U
                                    </button>
                                    <div className="toolbar-divider" />
                                    <button 
                                        type="button" 
                                        className="toolbar-btn" 
                                        onMouseDown={handleInsertLinkClick}
                                        title="Insert Link"
                                    >
                                        🔗 Link
                                    </button>
                                    <div className="toolbar-divider" />
                                    <div className="toolbar-select-container">
                                        <label htmlFor="fontSizeSelect" style={{ fontSize: '0.75rem', color: 'var(--muted)', marginRight: '0.4rem' }}>Size:</label>
                                        <select 
                                            id="fontSizeSelect"
                                            onChange={(e) => applyFormat('fontSize', e.target.value)}
                                            defaultValue="3"
                                            className="toolbar-select"
                                        >
                                            <option value="2">Small</option>
                                            <option value="3">Normal</option>
                                            <option value="4">Medium</option>
                                            <option value="5">Large</option>
                                            <option value="6">X-Large</option>
                                        </select>
                                    </div>
                                </div>

                                <iframe
                                    ref={iframeRef}
                                    srcDoc={iframeContent}
                                    onLoad={handleIframeLoad}
                                    title="Cover Letter Preview"
                                    className="coverletter-iframe"
                                />
                            </div>
                        ) : (
                            <div className="preview-empty-state">
                                <div className="icon-container">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                    </svg>
                                </div>
                                <h3>No Cover Letter Generated Yet</h3>
                                <p>Provide details in the left panel and click generate to design a tailored cover letter.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Link Modal */}
            {isLinkModalOpen && (
                <div className="link-modal-overlay">
                    <div className="link-modal-card">
                        <button 
                            type="button" 
                            className="modal-close-btn"
                            onClick={() => setIsLinkModalOpen(false)}
                        >
                            ✕
                        </button>
                        
                        <div className="modal-header">
                            <span className="modal-icon">🔗</span>
                            <div>
                                <h3>Insert Hyperlink</h3>
                                <p>Add a clickable link to your cover letter.</p>
                            </div>
                        </div>

                        <form onSubmit={handleLinkSubmit} className="modal-form">
                            <div className="modal-input-field">
                                <label htmlFor="modalLinkText">Display Text</label>
                                <input 
                                    type="text" 
                                    id="modalLinkText" 
                                    value={linkText}
                                    onChange={(e) => setLinkText(e.target.value)}
                                    placeholder="e.g. GitHub, LinkedIn, Portfolio"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="modal-input-field">
                                <label htmlFor="modalLinkUrl">URL Link</label>
                                <input 
                                    type="text" 
                                    id="modalLinkUrl" 
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="e.g. https://github.com/yourusername"
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button 
                                    type="button" 
                                    className="modal-btn modal-btn-secondary"
                                    onClick={() => setIsLinkModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="modal-btn modal-btn-primary"
                                >
                                    Insert Link
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoverLetter;
