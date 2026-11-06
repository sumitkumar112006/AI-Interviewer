import { createContext, useState, useCallback, useMemo } from "react"

export const interviewContext = createContext()

export const InterviewProvider = ({ children }) => {
    const [loading, setLoading] = useState(false)
    const [report, setReport] = useState(null)
    const [reports, setReports] = useState(null)

    const updateReportInList = useCallback((reportId, updates) => {
        if (!reportId || !updates) return;
        setReports(prev => {
            if (!Array.isArray(prev)) return prev;
            let hasChanged = false;
            const next = prev.map(r => {
                const id = r?._id?.$oid || r?._id;
                if (String(id) === String(reportId)) {
                    // Check if any property in updates is actually different
                    const isDifferent = Object.entries(updates).some(
                        ([key, val]) => r[key] !== val
                    );
                    if (isDifferent) {
                        hasChanged = true;
                        return { ...r, ...updates };
                    }
                }
                return r;
            });
            return hasChanged ? next : prev;
        });
    }, []);

    const previousResume = report?.resume || ""
    const jobDescription = report?.jobDescription || ""
    const newResume = report?.generatedResumeHtml || ""

    const contextValue = useMemo(() => ({ 
        loading, 
        setLoading, 
        report, 
        setReport, 
        reports, 
        setReports,
        updateReportInList,
        previousResume,
        jobDescription,
        newResume
    }), [
        loading, 
        report, 
        reports, 
        updateReportInList,
        previousResume,
        jobDescription,
        newResume
    ]);

    return (
        <interviewContext.Provider value={contextValue}>
            {children}
        </interviewContext.Provider>
    )

}
