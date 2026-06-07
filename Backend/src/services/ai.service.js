const { GoogleGenAI } = require("@google/genai")
const { z } = require('zod')
const { zodToJsonSchema } = require('zod-to-json-schema')
const puppet = require('puppeteer')


const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

async function invokeGeminiAI() {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Hello gemini ! Explain what is interview "
    })

    console.log(response.text);

}


const questionSchema = z.object({
    question: z
        .string()
        .describe(
            "The exact interview question asked to the candidate."
        ),

    intention: z
        .string()
        .describe(
            "The real reason the interviewer is asking this question and what they want to evaluate."
        ),

    answer: z
        .string()
        .describe(
            "A concise, interview-ready answer that is natural to speak and focused on high-value information."
        ),
})

const skillGapSchema = z.object({
    skill: z
        .string()
        .describe(
            "The specific missing or weak skill identified during the interview."
        ),

    severity: z
        .enum(["low", "medium", "high"])
        .describe(
            "How strongly this skill gap affects the candidate's interview performance or job readiness."
        ),
})

const aiInterviewReportSchema = z.object({
    developerTitle: z
        .string()
        .describe(
            "A concise best-fit developer role title inferred from the candidate profile and target job, such as Front-End Developer, React Developer, or Full-Stack Developer."
        ),

    matchScore: z
        .number()
        .min(0)
        .max(100)
        .describe(
            "Overall interview match score from 0 to 100 based on technical skills, behavioral performance, communication, problem-solving ability, confidence, and job readiness."
        ),

    technicalQuestions: z.array(questionSchema)
        .length(5)
        .describe(
        "An array of technical interview question objects. Each object must include question, intention, and answer. Focus on technical depth, practical knowledge, problem-solving, tools, architecture, debugging, performance, and implementation ability."
    ),


    behavioralQuestion: z.array(questionSchema)
        .length(5)
        .describe(
        "An object for each question including question , intention and  of behavioural interview questions with deep intent analysis and concise interview-ready answers focused on communication, leadership, teamwork, problem-solving, emotional intelligence, and professional decision-making."
    ),


    skillGaps: z.array(skillGapSchema).describe(
        "List of the most important skill gaps detected during the interview across technical ability, communication, behavioral traits, confidence, problem-solving, and practical experience."
    ),


    preparationPlan: z.array(
        z.object({
            day: z
                .union([z.number(), z.string()])
                .describe(
                    "The day number or label in the interview preparation roadmap."
                ),

            focus: z
                .string()
                .describe(
                    "The main topic, skill, or interview area to focus on for that day."
                ),

            tasks: z
                .array(z.string())
                .describe(
                    "A list of practical tasks, exercises, mock interview activities, revision goals, or coding practice items the candidate should complete for the day."
                ),
        })
    ).describe(
        "A structured day-wise interview preparation plan with focused topics and actionable tasks designed to improve technical skills, behavioral performance, communication, confidence, and interview readiness."
    ),

});

const mongooseInterviewReportSchema = z.object({
    developerTitle: z.string().min(1),
    matchScore: z.coerce.number().min(0).max(100),
    technicalQuestions: z.array(questionSchema).length(5),
    behavioralQuestion: z.array(questionSchema).length(5),
    skillGaps: z.array(skillGapSchema),
    preparationPlan: z.array(
        z.object({
            day: z.string(),
            focus: z.string(),
            tasks: z.array(z.string()),
        })
    ),
})

function parseJsonLikeValue(value) {
    if (typeof value !== "string") {
        return value
    }

    const trimmedValue = value.trim()

    if (!trimmedValue) {
        return value
    }

    if (
        (trimmedValue.startsWith("{") && trimmedValue.endsWith("}")) ||
        (trimmedValue.startsWith("[") && trimmedValue.endsWith("]"))
    ) {
        try {
            return JSON.parse(trimmedValue)
        } catch (error) {
            return value
        }
    }

    return value
}

function normalizeObjectArray(value) {
    const parsedValue = parseJsonLikeValue(value)

    if (Array.isArray(parsedValue)) {
        return parsedValue.map((item) => parseJsonLikeValue(item))
    }

    if (parsedValue && typeof parsedValue === "object") {
        return [parsedValue]
    }

    return []
}

function normalizeQuestionItem(item, fallbackIntention, fallbackAnswer) {
    const parsedItem = parseJsonLikeValue(item)

    if (parsedItem && typeof parsedItem === "object" && !Array.isArray(parsedItem)) {
        const question = String(parsedItem.question ?? parsedItem.title ?? parsedItem.prompt ?? "").trim()
        const intention = String(
            parsedItem.intention ?? parsedItem.reason ?? parsedItem.purpose ?? fallbackIntention
        ).trim()
        const answer = String(
            parsedItem.answer ?? parsedItem.sampleAnswer ?? parsedItem.guidance ?? fallbackAnswer
        ).trim()

        if (!question) {
            return null
        }

        return { question, intention, answer }
    }

    const question = String(parsedItem ?? "").trim()

    if (!question) {
        return null
    }

    return {
        question,
        intention: fallbackIntention,
        answer: fallbackAnswer,
    }
}

function normalizeQuestionArray(value, options = {}) {
    const {
        limit = 5,
        fallbackIntention = "Assesses the candidate's fit for the target role.",
        fallbackAnswer = "Answer with a concise, role-specific example that shows clear reasoning and results.",
    } = options

    return normalizeObjectArray(value)
        .map((item) => normalizeQuestionItem(item, fallbackIntention, fallbackAnswer))
        .filter(Boolean)
        .slice(0, limit)
}

function normalizeSkillGapItem(item) {
    const parsedItem = parseJsonLikeValue(item)

    if (parsedItem && typeof parsedItem === "object" && !Array.isArray(parsedItem)) {
        const skill = String(parsedItem.skill ?? parsedItem.name ?? parsedItem.gap ?? "").trim()
        const normalizedSeverity = String(parsedItem.severity ?? "medium").toLowerCase().trim()

        if (!skill) {
            return null
        }

        return {
            skill,
            severity: ["low", "medium", "high"].includes(normalizedSeverity)
                ? normalizedSeverity
                : "medium",
        }
    }

    const skill = String(parsedItem ?? "").trim()

    if (!skill) {
        return null
    }

    return {
        skill,
        severity: "medium",
    }
}

function normalizeSkillGapArray(value) {
    return normalizeObjectArray(value)
        .map(normalizeSkillGapItem)
        .filter(Boolean)
}

function normalizeStringArray(value) {
    const parsedValue = parseJsonLikeValue(value)

    if (Array.isArray(parsedValue)) {
        return parsedValue.map((item) => String(parseJsonLikeValue(item)).trim()).filter(Boolean)
    }

    if (parsedValue === undefined || parsedValue === null) {
        return []
    }

    return [String(parsedValue).trim()].filter(Boolean)
}

function extractResumeHtmlContent(value) {
    const parsedValue = parseJsonLikeValue(value)

    if (typeof parsedValue === "string") {
        return parsedValue.trim()
    }

    if (parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)) {
        const htmlCandidate = [
            parsedValue.html,
            parsedValue.HTML,
            parsedValue.resumeHtml,
            parsedValue.content,
            parsedValue.markup,
        ].find((candidate) => typeof candidate === "string" && candidate.trim())

        return htmlCandidate ? htmlCandidate.trim() : ""
    }

    return ""
}

function normalizeResumeHtmlDocument(htmlContent) {
    const normalizedHtml = String(htmlContent ?? "").trim()

    if (!normalizedHtml) {
        throw new Error("Resume PDF generation returned empty HTML content.")
    }

    if (/<html[\s>]/i.test(normalizedHtml)) {
        return normalizedHtml
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
        body {
            margin: 0;
            padding: 32px;
            font-family: Arial, sans-serif;
            color: #111827;
            line-height: 1.5;
        }
    </style>
</head>
<body>
${normalizedHtml}
</body>
</html>`
}

function normalizeInterviewReport(rawReport) {
    const normalizedPreparationPlan = normalizeObjectArray(rawReport.preparationPlan).map((item) => ({
        day: typeof item?.day === "number" ? `Day ${item.day}` : String(item?.day ?? "").trim(),
        focus: String(item?.focus ?? "").trim(),
        tasks: normalizeStringArray(item?.tasks),
    }))

    return {
        developerTitle: String(rawReport.developerTitle ?? rawReport.title ?? rawReport.Title ?? "").trim(),
        matchScore: rawReport.matchScore,
        technicalQuestions: normalizeQuestionArray(
            rawReport.technicalQuestions ?? rawReport.technicalQuestion,
            {
                fallbackIntention: "Evaluates technical depth, implementation ability, and practical problem-solving for the role.",
                fallbackAnswer: "Answer with concrete implementation details, tradeoffs, and an example from your past work.",
            }
        ),
        behavioralQuestion: normalizeQuestionArray(
            rawReport.behavioralQuestion ?? rawReport.behaviouralQuestion,
            {
                fallbackIntention: "Evaluates communication, ownership, teamwork, and professional judgment in real situations.",
                fallbackAnswer: "Use a concise STAR-style example that shows your actions, reasoning, and outcome.",
            }
        ),
        skillGaps: normalizeSkillGapArray(rawReport.skillGaps),
        preparationPlan: normalizedPreparationPlan,
    }
}


async function generateInterviewReport({
    resume,
    selfDescription,
    jobDescription,
    selfDescribe,
    jobDescribe
}) {
    const candidateSummary = selfDescription ?? selfDescribe
    const roleDescription = jobDescription ?? jobDescribe

    const prompt = `
Generate an interview report in valid JSON only.

Rules:
- Return only valid JSON.
- Provide a matchScore from 0 to 100 as a number.
- Use these exact top-level keys:
  - developerTitle
  - matchScore
  - technicalQuestions
  - behavioralQuestion
  - skillGaps
  - preparationPlan
- Provide exactly 5 technicalQuestions.
- Provide exactly 5 behavioralQuestion items.
- technicalQuestions must focus on technical evaluation.
- behavioralQuestion must focus on communication, leadership, teamwork, problem-solving, emotional intelligence, and professional decision-making.
- technicalQuestions must be an array of objects.
- behavioralQuestion must be an array of objects.
- skillGaps must be an array of objects.
- preparationPlan must be an array of objects.
- Do not wrap objects inside strings.
- Keep every field practical and concise.

Expected format:
{
  "developerTitle": "Front-End Developer",
  "matchScore": 85,
  "technicalQuestions": [
    {
      "question": "...",
      "intention": "...",
      "answer": "..."
    }
  ],
  "behavioralQuestion": [
    {
      "question": "...",
      "intention": "...",
      "answer": "..."
    }
  ],
  "skillGaps": [
    {
      "skill": "...",
      "severity": "low"
    }
  ],
  "preparationPlan": [
    {
      "day": "Day 1",
      "focus": "...",
      "tasks": ["...", "..."]
    }
  ]
}

- skillGaps: each item must contain:
  - skill
  - severity: "low" | "medium" | "high"

- preparationPlan: each item must contain:
  - day
  - focus
  - tasks

- developerTitle:
  - must be a short, professional developer role title
  - should reflect both the job description and the candidate background
  - examples: "Front-End Developer", "React Developer", "Full-Stack Developer"

Resume: ${resume}
Self Description: ${candidateSummary}
Job Description: ${roleDescription}
`;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: zodToJsonSchema(aiInterviewReportSchema)
        }
    })

    const parsedResponse = JSON.parse(response.text)
    const normalizedResponse = normalizeInterviewReport(parsedResponse)
    const interviewReport = mongooseInterviewReportSchema.parse(normalizedResponse)

    console.log(interviewReport);

    return interviewReport;


}


async function generatePfdFromHtml(htmlContent) {
    let browser

    try {
        browser = await puppet.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        })
    } catch (error) {
        throw new Error(
            `Unable to launch the PDF browser. ${error?.message || 'Chrome/Chromium may be missing in the deployment environment.'}`
        )
    }

    try {
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
        const pdfBytes = await page.pdf({
            format: 'A4',
            margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right:"15mm"
            }
         })

        return Buffer.from(pdfBytes)
    } finally {
        if (browser) {
            await browser.close()
        }
    }
}



async function generateResumePfd({resume, selfDescription, jobDescription}) {
    const resumePdfSchema = z.object({
        html:z.string().describe("The HTML content of resume which can be converted to PDF using any library like puppeteer")
    })
    const resumeGenerationModels = [
        "gemini-3-flash-preview",
        "gemini-2.5-flash"
    ]

    const prompt = `
Generate a professional one-page resume in valid JSON only.

Rules:
- Return only valid JSON.
- Use exactly one top-level key: "html".
- The "html" value must be a string.
- The string must contain complete printable HTML for an A4 resume.
- Do not return markdown fences.
- Do not return undefined or null.
- Do not feel like AI generated content. Write like a human creating a resume.
- Focus on clarity, professionalism, and relevance to the job description.
- Use the candidate details to create a tailored resume that highlights strengths and fits the target role.
- Resume should be ATS friendly it should rank in ATS systems and also visually appealing for human recruiters.
- Resume should be concise and ideally fit in one-two page when converted to PDF.

Candidate details:
Resume: ${resume}
Self Description: ${selfDescription}
Job Description: ${jobDescription}
`

    let response
    let lastError

    for (const model of resumeGenerationModels) {
        try {
            response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseJsonSchema: zodToJsonSchema(resumePdfSchema)
                }
            })
            break
        } catch (error) {
            lastError = error
        }
    }

    if (!response) {
        throw new Error(
            `Resume HTML generation failed for all configured models. ${lastError?.message || 'Unknown AI generation error.'}`
        )
    }

    const jsonContent = JSON.parse(response.text)
    const htmlContent = extractResumeHtmlContent(jsonContent)
    const normalizedHtmlDocument = normalizeResumeHtmlDocument(htmlContent)

    const pdfBuffer = await generatePfdFromHtml(normalizedHtmlDocument)

    return pdfBuffer
}

module.exports = { generateInterviewReport, generateResumePfd }
