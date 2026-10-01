import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export const AdminPagination = ({
    page = 1,
    pages = 1,
    total = 0,
    limit = 20,
    loading = false,
    onPageChange
}) => {
    if (!pages || pages <= 1 && total <= limit) {
        // Even if only 1 page, if total > 0, show item count indicator
        if (total > 0) {
            return (
                <div className="pagination-bar">
                    <div className="page-info">
                        Showing <strong>1–{total}</strong> of <strong>{total}</strong> records
                    </div>
                </div>
            );
        }
        return null;
    }

    const currentPage = Math.max(1, Math.min(page, pages || 1));
    const totalPages = Math.max(1, pages || 1);
    const startRecord = Math.min((currentPage - 1) * limit + 1, total);
    const endRecord = Math.min(currentPage * limit, total);

    // Calculate smart page number array
    const getPageNumbers = () => {
        const delta = 2; // numbers around current
        const range = [];
        for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
            range.push(i);
        }

        if (currentPage - delta > 2) {
            range.unshift('ellipsis-left');
        }
        range.unshift(1);

        if (currentPage + delta < totalPages - 1) {
            range.push('ellipsis-right');
        }
        if (totalPages > 1) {
            range.push(totalPages);
        }

        return range;
    };

    const pageNumbers = getPageNumbers();

    return (
        <div className="pagination-bar">
            <div className="page-info">
                Showing <strong>{startRecord}–{endRecord}</strong> of <strong>{total}</strong> records
                <span className="page-sub"> · Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
            </div>

            <div className="page-buttons">
                {/* First Page Button */}
                <button
                    type="button"
                    className="page-btn nav-btn"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => onPageChange && onPageChange(1)}
                    title="First page"
                >
                    <ChevronsLeft size={14} />
                </button>

                {/* Previous Page Button */}
                <button
                    type="button"
                    className="page-btn nav-btn"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => onPageChange && onPageChange(currentPage - 1)}
                    title="Previous page"
                >
                    <ChevronLeft size={14} />
                    <span>Prev</span>
                </button>

                {/* Numbered Page Buttons */}
                <div className="page-numbers-group">
                    {pageNumbers.map((p, idx) => {
                        if (typeof p === 'string') {
                            return (
                                <span key={`${p}-${idx}`} className="page-ellipsis">
                                    …
                                </span>
                            );
                        }
                        return (
                            <button
                                key={p}
                                type="button"
                                className={`page-pill ${p === currentPage ? 'active' : ''}`}
                                disabled={loading}
                                onClick={() => onPageChange && onPageChange(p)}
                            >
                                {p}
                            </button>
                        );
                    })}
                </div>

                {/* Next Page Button */}
                <button
                    type="button"
                    className="page-btn nav-btn"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => onPageChange && onPageChange(currentPage + 1)}
                    title="Next page"
                >
                    <span>Next</span>
                    <ChevronRight size={14} />
                </button>

                {/* Last Page Button */}
                <button
                    type="button"
                    className="page-btn nav-btn"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => onPageChange && onPageChange(totalPages)}
                    title="Last page"
                >
                    <ChevronsRight size={14} />
                </button>
            </div>
        </div>
    );
};

export default AdminPagination;
