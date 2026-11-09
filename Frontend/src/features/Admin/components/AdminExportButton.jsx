import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown, Loader2 } from 'lucide-react';
import { exportAdminData, triggerBlobDownload } from '../services/admin.api';

export const AdminExportButton = ({ moduleName, filters = {}, label = 'Export' }) => {
    const [open, setOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleExport = async (format) => {
        setOpen(false);
        setExporting(true);
        try {
            const cleanFilters = {};
            Object.entries(filters).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') {
                    cleanFilters[k] = v;
                }
            });

            const res = await exportAdminData(moduleName, {
                ...cleanFilters,
                format
            });

            // Extract filename from Content-Disposition header if present
            let filename = `kivi-${moduleName}-${new Date().toISOString().split('T')[0]}.${format}`;
            const disposition = res.headers?.['content-disposition'];
            if (disposition && disposition.includes('filename=')) {
                const match = disposition.match(/filename="?([^";]+)"?/);
                if (match && match[1]) filename = match[1];
            }

            triggerBlobDownload(res.data, filename);
        } catch (err) {
            console.error(`Failed to export ${moduleName}:`, err);
            alert(`Export failed: ${err?.response?.data?.message || err?.message || 'Server error occurred during export.'}`);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                onClick={() => !exporting && setOpen(prev => !prev)}
                disabled={exporting}
                title={`Export filtered ${moduleName} dataset`}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.42rem 0.75rem',
                    background: 'rgba(99, 102, 241, 0.12)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: exporting ? 'wait' : 'pointer',
                    transition: 'all 0.15s ease'
                }}
            >
                {exporting ? (
                    <Loader2 size={13} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                    <Download size={13} />
                )}
                <span>{exporting ? 'Exporting...' : label}</span>
                <ChevronDown size={12} style={{ opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    backgroundColor: '#0d1322',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
                    zIndex: 100,
                    minWidth: '170px',
                    overflow: 'hidden',
                    padding: '4px'
                }}>
                    <button
                        type="button"
                        onClick={() => handleExport('csv')}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#f8fafc',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            textAlign: 'left'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <FileText size={14} style={{ color: '#38bdf8' }} />
                        <span>Export as CSV</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleExport('xlsx')}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#f8fafc',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            textAlign: 'left'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <FileSpreadsheet size={14} style={{ color: '#34d399' }} />
                        <span>Export as Excel (XLSX)</span>
                    </button>
                </div>
            )}
        </div>
    );
};

