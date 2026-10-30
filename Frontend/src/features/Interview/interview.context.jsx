import { createContext, useState } from "react"






export const interviewContext = createContext()

export const InterviewProvider = ({ children }) => {
    const [loading, setLoading] = useState(false)
    const [report, setReport] = useState(null)
    const [reports, setReports] = useState(null)

    const updateReportInList = (reportId, updates) => {
        if (!reportId || !updates) return;
        setReports(prev => {
            if (!Array.isArray(prev)) return prev;
            return prev.map(r => {
                const id = r?._id?.$oid || r?._id;
                if (String(id) === String(reportId)) {
                    return { ...r, ...updates };
                }
                return r;
            });
        });
    };

    const previousResume = report?.resume || ""
    const jobDescription = report?.jobDescription || ""
    const newResume = report?.generatedResumeHtml || ""

    return (
        <interviewContext.Provider value={{ 
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
        }}>
            {children}
        </interviewContext.Provider>
    )

}
