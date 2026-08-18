import { createContext, useState } from "react"






export const interviewContext = createContext()

export const InterviewProvider = ({ children }) => {
    const [loading, setLoading] = useState(false)
    const [report, setReport] = useState(null)
    const [reports, setReports] = useState(null)

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
            previousResume,
            jobDescription,
            newResume
        }}>
            {children}
        </interviewContext.Provider>
    )

}
