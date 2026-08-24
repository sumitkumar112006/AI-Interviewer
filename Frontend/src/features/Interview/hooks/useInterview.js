import { getAllInterviewReport, getSkillAnalytics, generateInterviewReport, getInterviewReportById, generateResumePdf, deleteReportById, updateResumeHtml } from '../services/interview.api';
import { useContext } from 'react';
import { interviewContext } from '../interview.context';
import { useAuth } from '../../Auth/hooks/useAuth';




export const useInterview = () => {
    const context = useContext(interviewContext)
    const { fetchUsage } = useAuth()

    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const { 
        loading, 
        setLoading, 
        report, 
        setReport, 
        reports, 
        setReports,
        previousResume,
        jobDescription,
        newResume
    } = context

    const generateReport = async ({ jobDescription, selfDescription, resumeFile }) => {
        setLoading(true)
        try {
            const response = await generateInterviewReport({ jobDescription, selfDescription, resumeFile })

            // 1. Set current report
            setReport(response.interviewReport)

            // 2. UPDATE HISTORY LIST IN REAL-TIME (Add this line):
            setReports(prevReports => prevReports ? [response.interviewReport, ...prevReports] : [response.interviewReport])
            
            // 3. Refresh navbar credit limits in real-time
            if (fetchUsage) fetchUsage()
            
            return response.interviewReport
        } catch (err) {
            console.error('Generate report error:', err)
            throw err
        } finally {
            setLoading(false)
        }
    }

    const getReoprtById = async (interbiewId) => {
        setLoading(true)
        try {
            const response = await getInterviewReportById(interbiewId)
            setReport(response.interviewReport)
            return response.interviewReport
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const getReports = async () => {
        setLoading(true)
        try {
            const response = await getAllInterviewReport()
            setReports(response.interviewReports)
            return response
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const getSkillsStats = async () => {
        try {
            const response = await getSkillAnalytics()
            return response.skillAnalytics
        } catch (error) {
            console.log(error)
            return null
        }
    }

    const getResumePdf = async (interviewReportId, options = {}) => {
        setLoading(true)

        try {
            const response = await generateResumePdf(interviewReportId, options)
            if (fetchUsage) fetchUsage()
            return response
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const deleteReport = async (interviewReportId) => {
        setLoading(true)
        try {
            const response = await deleteReportById(interviewReportId)
            setReports((prevReports) =>
                prevReports
                    ? prevReports.filter((r) => {
                        const id = r._id?.$oid || r._id
                        return id !== interviewReportId
                    })
                    : []
            )
            return response
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const updateNewResume = async (htmlContent) => {
        if (!report) return
        setLoading(true)
        try {
            const reportId = report._id?.$oid || report._id
            const res = await updateResumeHtml(reportId, { generatedResumeHtml: htmlContent })
            setReport(res.interviewReport)
            return res.interviewReport
        } catch (error) {
            console.error("Error updating centralized resume:", error)
            throw error
        } finally {
            setLoading(false)
        }
    }

    return { 
        loading, 
        setLoading, 
        report, 
        reports, 
        getReoprtById, 
        getReports,
        getSkillsStats,
        generateReport, 
        getResumePdf, 
        deleteReport,
        previousResume,
        jobDescription,
        newResume,
        updateNewResume
    }
}   
