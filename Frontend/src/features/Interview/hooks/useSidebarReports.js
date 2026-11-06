import { useState, useEffect, useRef, useCallback } from 'react';
import { getPaginatedInterviewReports } from '../services/interview.api';

/**
 * Custom hook for infinite scrolling & server-side pagination in the Recent Reports sidebar.
 * Loads 10 reports initially and fetches next 10 reports progressively as the user scrolls.
 */
export function useSidebarReports() {
  const [reports, setReports] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalMatching, setTotalMatching] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);
  const nextCursorRef = useRef(null);
  const hasMoreRef = useRef(true);
  const pageRef = useRef(1);
  nextCursorRef.current = nextCursor;
  hasMoreRef.current = hasMore;

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Initial fetch / search query fetch
  const fetchInitialReports = useCallback(async (search = '') => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingInitial(true);
    setIsLoadingMore(false);
    setError(null);

    try {
      const res = await getPaginatedInterviewReports({
        limit: 10,
        search,
        signal: controller.signal
      });

      const fetchedReports = Array.isArray(res?.interviewReports) ? res.interviewReports : [];
      pageRef.current = 1;
      setReports(fetchedReports);
      setTotalCount(typeof res?.totalInterviews === 'number' ? res.totalInterviews : fetchedReports.length);
      setTotalMatching(typeof res?.totalMatching === 'number' ? res.totalMatching : fetchedReports.length);
      setHasMore(Boolean(res?.hasMore));
      setNextCursor(res?.nextCursor || null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.warn('[useSidebarReports] Failed to fetch initial reports:', err.message || err);
      setError(err?.response?.data?.message || err.message || 'Failed to load reports');
    } finally {
      setIsLoadingInitial(false);
    }
  }, []);

  // Fetch when mounted or when debounced search query changes
  useEffect(() => {
    fetchInitialReports(debouncedSearch);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedSearch, fetchInitialReports]);

  // Load next batch of 10 reports
  const loadMore = useCallback(async () => {
    if (
      isLoadingInitial ||
      isLoadingMore ||
      !hasMoreRef.current ||
      isFetchingRef.current
    ) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoadingMore(true);
    setError(null);

    const nextPage = pageRef.current + 1;

    try {
      const res = await getPaginatedInterviewReports({
        limit: 10,
        cursor: nextCursorRef.current || undefined,
        page: nextPage,
        search: debouncedSearch
      });

      const freshReports = Array.isArray(res?.interviewReports) ? res.interviewReports : [];

      setReports(prev => {
        const existingIds = new Set(prev.map(r => String(r._id?.$oid || r._id || r.id)));
        const dedupedFresh = freshReports.filter(r => !existingIds.has(String(r._id?.$oid || r._id || r.id)));
        return [...prev, ...dedupedFresh];
      });

      pageRef.current = nextPage;

      if (typeof res?.totalInterviews === 'number') {
        setTotalCount(res.totalInterviews);
      }
      if (typeof res?.totalMatching === 'number') {
        setTotalMatching(res.totalMatching);
      }
      setHasMore(Boolean(res?.hasMore));
      setNextCursor(res?.nextCursor || null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.warn('[useSidebarReports] Failed to fetch more reports:', err.message || err);
      setError(err?.response?.data?.message || err.message || 'Failed to load more reports');
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [isLoadingInitial, isLoadingMore, debouncedSearch]);

  // Prepend newly generated report to the top
  const prependReport = useCallback((newReport) => {
    if (!newReport) return;
    const newId = String(newReport._id?.$oid || newReport._id || newReport.id);
    if (!newId) return;

    setReports(prev => {
      const exists = prev.some(r => String(r._id?.$oid || r._id || r.id) === newId);
      if (exists) {
        return prev.map(r => (String(r._id?.$oid || r._id || r.id) === newId ? { ...r, ...newReport } : r));
      }
      return [newReport, ...prev];
    });
    setTotalCount(prev => prev + 1);
    setTotalMatching(prev => prev + 1);
  }, []);

  // Remove report when deleted
  const removeReport = useCallback((reportId) => {
    if (!reportId) return;
    const targetId = String(reportId);
    setReports(prev => prev.filter(r => String(r._id?.$oid || r._id || r.id) !== targetId));
    setTotalCount(prev => Math.max(0, prev - 1));
    setTotalMatching(prev => Math.max(0, prev - 1));
  }, []);

  // Update existing report in place (e.g., live ATS score changes)
  const updateReport = useCallback((reportId, updates) => {
    if (!reportId || !updates) return;
    const targetId = String(reportId);
    setReports(prev =>
      prev.map(r => (String(r._id?.$oid || r._id || r.id) === targetId ? { ...r, ...updates } : r))
    );
  }, []);

  // Real-time synchronization events across components
  useEffect(() => {
    const handleUpdate = (e) => {
      const { reportId, updates } = e.detail || {};
      if (reportId && updates) {
        updateReport(reportId, updates);
      }
    };
    const handleCreate = (e) => {
      const { report } = e.detail || {};
      if (report) {
        prependReport(report);
      }
    };
    const handleDelete = (e) => {
      const { reportId } = e.detail || {};
      if (reportId) {
        removeReport(reportId);
      }
    };

    window.addEventListener('kivi:report-updated', handleUpdate);
    window.addEventListener('kivi:report-created', handleCreate);
    window.addEventListener('kivi:report-deleted', handleDelete);

    return () => {
      window.removeEventListener('kivi:report-updated', handleUpdate);
      window.removeEventListener('kivi:report-created', handleCreate);
      window.removeEventListener('kivi:report-deleted', handleDelete);
    };
  }, [updateReport, prependReport, removeReport]);

  const retry = useCallback(() => {
    if (reports.length === 0) {
      fetchInitialReports(debouncedSearch);
    } else {
      loadMore();
    }
  }, [reports.length, fetchInitialReports, debouncedSearch, loadMore]);

  return {
    reports,
    totalCount,
    totalMatching,
    hasMore,
    isLoadingInitial,
    isLoadingMore,
    error,
    searchQuery,
    setSearchQuery,
    loadMore,
    retry,
    prependReport,
    removeReport,
    updateReport
  };
}
