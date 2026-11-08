import { useState, useEffect, useRef, useCallback } from 'react';
import { getJobStatus } from '../features/Interview/services/interview.api';

/**
 * Reusable Hook to track and poll any background BullMQ generation job
 * @param {string|null} initialJobId - Job ID to poll
 * @param {object} options - { pollingInterval = 2500, onSuccess, onError, autoStart = true }
 */
export function useJobStatus(initialJobId = null, options = {}) {
    const { 
        pollingInterval = 2500, 
        onSuccess, 
        onError, 
        autoStart = true 
    } = options;

    const [status, setStatus] = useState(initialJobId ? 'pending' : 'idle');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [activeJobId, setActiveJobId] = useState(initialJobId);

    const isMountedRef = useRef(true);
    const timerRef = useRef(null);
    const pollCountRef = useRef(0);

    const checkStatus = useCallback(async (idToPoll) => {
        if (!idToPoll) return;

        try {
            const data = await getJobStatus(idToPoll);
            if (!isMountedRef.current) return;

            setStatus(data.status);
            setProgress(data.progress || 0);

            if (data.status === 'done') {
                setResult(data.result);
                setError(null);
                if (onSuccess) onSuccess(data.result, data);
            } else if (data.status === 'failed') {
                const errMsg = data.error || 'Generation job failed.';
                setError(errMsg);
                if (onError) onError(new Error(errMsg), data);
            } else {
                // Adaptive polling: 2000ms while pending/early, then 3500ms while actively generating
                pollCountRef.current += 1;
                const nextInterval = (data.status === 'processing' && pollCountRef.current > 2)
                    ? Math.max(pollingInterval, 3500)
                    : Math.min(pollingInterval, 2000);

                timerRef.current = setTimeout(() => {
                    checkStatus(idToPoll);
                }, nextInterval);
            }
        } catch (err) {
            if (!isMountedRef.current) return;

            if (err?.response?.status === 404) {
                setStatus('failed');
                setError('Job not found.');
                if (onError) onError(err);
            } else {
                // Non-fatal network error, retry with gentle backoff
                timerRef.current = setTimeout(() => {
                    checkStatus(idToPoll);
                }, Math.max(pollingInterval, 3000));
            }
        }
    }, [pollingInterval, onSuccess, onError]);

    useEffect(() => {
        isMountedRef.current = true;
        if (activeJobId && autoStart) {
            checkStatus(activeJobId);
        }
        return () => {
            isMountedRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [activeJobId, autoStart, checkStatus]);

    const trackJob = useCallback((newJobId) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        pollCountRef.current = 0;
        setActiveJobId(newJobId);
        setStatus('pending');
        setResult(null);
        setError(null);
        setProgress(0);
        checkStatus(newJobId);
    }, [checkStatus]);

    const reset = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        pollCountRef.current = 0;
        setActiveJobId(null);
        setStatus('idle');
        setResult(null);
        setError(null);
        setProgress(0);
    }, []);

    return {
        jobId: activeJobId,
        status,
        result,
        error,
        progress,
        isLoading: status === 'pending' || status === 'processing',
        isDone: status === 'done',
        isFailed: status === 'failed',
        trackJob,
        reset
    };
}
