import { getAllInterviewReport, generateInterviewReport, getInterviewReportById, generateResumePdf } from '../services/interview.api';
import { useContext } from 'react';
import { interviewContext } from '../interview.context';




export const useInterview = () => {
    const context = useContext(interviewContext)

    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const { loading, setLoading, report, setReport, reports, setReports } = context

    const generateReport = async ({ jobDescription, selfDescription, resumeFile }) => {
        setLoading(true)
        try {
            const response = await generateInterviewReport({ jobDescription, selfDescription, resumeFile })
            setReport(response.interviewReport)
            return response.interviewReport
        } catch (err) {
            console.log(err)
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
            return response.interviewReports
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const getResumePdf = async (interviewReportId) => {
        setLoading(true)

        try {
            const response = await generateResumePdf(interviewReportId)
            return response
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    return { loading, report, reports, getReoprtById, getReports, generateReport, getResumePdf }
}   
