require('dotenv').config();
const Groq = require("groq-sdk")

const { z } = require('zod')
const { zodToJsonSchema } = require('zod-to-json-schema')
// Puppeteer removed — PDF is now generated client-side via window.print()

const request = require('request');
const fs = require('fs')
const axios = require('axios');


// Initialize Groq client
const ai = new Groq({ apiKey: process.env.GROQ_API_KEY })

if (!process.env.GROQ_API_KEY) {
    console.warn('GROQ_API_KEY is not set. AI calls will likely fail.')
}

// OpenRouter fallback config (OpenAI-compatible API)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
const OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free" // Free 120B model on OpenRouter

if (!OPENROUTER_API_KEY) {
    console.warn('OPENROUTER_API_KEY is not set. OpenRouter fallback will not be available.')
}

// Gemini config
const { GoogleGenAI } = require('@google/genai')
const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY
const aiGemini = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null

if (!GEMINI_API_KEY) {
    console.warn('GOOGLE_GENAI_API_KEY is not set. Gemini fallback will not be available.')
}

const GROQ_MODEL = "openai/gpt-oss-120b"




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

const detectedSkillSchema = z.object({
    name: z.string().describe("Standardized major skill or tech stack name e.g. Node.js, React, Python, JavaScript, Java, SQL, MongoDB, Docker, AWS, System Design"),
    category: z.string().default("General"),
    knowledgePercentage: z.coerce.number().min(0).max(100).describe("Evaluated actual knowledge percentage (0-100%) based on listed project depth and experience.")
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

    detectedSkills: z.array(detectedSkillSchema).optional().describe(
        "List of major tech stacks evaluated with percentage knowledge score (0-100%) based on candidate's listed projects, experience, and technical depth."
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
    detectedSkills: z.array(detectedSkillSchema).optional(),
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
            severity: ["low", "medium", "high"].includes(normalizedSeverity) ?
                normalizedSeverity : "medium",
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
        @page {
            size: A4;
            margin: 12mm 16mm;
        }
        body {
            margin: 0 auto;
            width: 210mm;
            min-height: 297mm;
            padding: 12mm 16mm;
            box-sizing: border-box;
            font-family: 'Calibri', 'Arial', sans-serif;
            color: #111827;
            background: #ffffff;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
        }
        li, ul, ol, p, h1, h2, h3, h4, section, .section, .experience-item, .project-item {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        h1, h2, h3, h4 {
            page-break-after: avoid !important;
            break-after: avoid !important;
        }
        ul, ol {
            padding-left: 1.25rem;
            margin-top: 0.25rem;
            margin-bottom: 0.5rem;
        }
        li {
            margin-bottom: 0.35rem;
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

    const normalizedDetectedSkills = Array.isArray(rawReport.detectedSkills)
        ? rawReport.detectedSkills.map(sk => ({
            name: String(sk?.name ?? sk?.skill ?? '').trim(),
            category: String(sk?.category ?? 'General').trim(),
            knowledgePercentage: Math.max(0, Math.min(100, Number(sk?.knowledgePercentage ?? sk?.score ?? 75)))
        })).filter(sk => sk.name)
        : []

    return {
        developerTitle: String(rawReport.developerTitle ?? rawReport.title ?? rawReport.Title ?? "").trim(),
        matchScore: rawReport.matchScore,
        technicalQuestions: normalizeQuestionArray(
            rawReport.technicalQuestions ?? rawReport.technicalQuestion, {
            fallbackIntention: "Evaluates technical depth, implementation ability, and practical problem-solving for the role.",
            fallbackAnswer: "Answer with concrete implementation details, tradeoffs, and an example from your past work.",
        }
        ),
        behavioralQuestion: normalizeQuestionArray(
            rawReport.behavioralQuestion ?? rawReport.behaviouralQuestion, {
            fallbackIntention: "Evaluates communication, ownership, teamwork, and professional judgment in real situations.",
            fallbackAnswer: "Use a concise STAR-style example that shows your actions, reasoning, and outcome.",
        }
        ),
        skillGaps: normalizeSkillGapArray(rawReport.skillGaps),
        detectedSkills: normalizedDetectedSkills,
        preparationPlan: normalizedPreparationPlan,
    }
}

/**
 * Extract JSON from a Groq response text that may contain markdown fences or extra text.
 */
function extractJsonFromText(text) {
    // Strip markdown code fences if present
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
        return fenceMatch[1].trim()
    }
    // Try to find raw JSON object/array in the text
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (jsonMatch) {
        return jsonMatch[1].trim()
    }
    return text.trim()
}

/**
 * Check if the error from Groq is a rate-limit / quota error.
 */
function isGroqRateLimitError(err) {
    // Groq SDK sets status on the error object
    if (err?.status === 429) return true
    if (err?.statusCode === 429) return true
    // Some SDKs wrap it in a message
    const msg = (err?.message ?? "").toLowerCase()
    return msg.includes('rate limit') || msg.includes('rate_limit') || msg.includes('quota') || msg.includes('too many requests')
}

/**
 * Call OpenRouter as a fallback (OpenAI-compatible API).
 * Supports many free and paid models via https://openrouter.ai
 */
async function callOpenRouter(systemPrompt, userPrompt) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not configured. Cannot use OpenRouter as fallback.')
    }
    console.log('[AI] Switched to OpenRouter fallback.')
    const response = await axios.post(
        OPENROUTER_BASE_URL,
        {
            model: OPENROUTER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 8192,
        },
        {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://resumegenerator.app',
                'X-Title': 'Resume Generator'
            }
        }
    )
    return response.data.choices[0].message.content
}

/**
 * Call Gemini (Google GenAI SDK) as the primary provider.
 */
async function callGemini(systemPrompt, userPrompt) {
    if (!aiGemini) {
        throw new Error('Gemini API is not configured.')
    }
    const response = await aiGemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser request:\n${userPrompt}` }] }
        ],
        config: {
            temperature: 0.7,
        }
    })
    return response.text
}

let isGroqHealthy = true;
let groqLastFailureTime = 0;
const GROQ_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown

/**
 * Primary AI call dispatcher: tries Groq first (if healthy), then falls back to Gemini, then OpenRouter.
 */
async function callGroq(systemPrompt, userPrompt) {
    // Check if Groq has recovered from cooldown
    if (!isGroqHealthy && (Date.now() - groqLastFailureTime > GROQ_COOLDOWN_MS)) {
        console.log('[AI] Groq cooldown period passed. Attempting to use Groq again.');
        isGroqHealthy = true;
    }

    // 1. Try Groq if healthy
    if (isGroqHealthy) {
        try {
            const completion = await ai.chat.completions.create({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7,
                max_completion_tokens: 4096,
                top_p: 1,
                stream: false,
                stop: null
            });
            return completion.choices[0].message.content;
        } catch (err) {
            console.warn(`[AI] Groq call failed (${err?.status ?? err?.statusCode ?? err?.message}). Setting Groq to unhealthy status.`);
            isGroqHealthy = false;
            groqLastFailureTime = Date.now();
            // Fall through to other providers
        }
    }

    // 2. Try Gemini fallback if configured
    if (aiGemini) {
        try {
            return await callGemini(systemPrompt, userPrompt);
        } catch (geminiErr) {
            console.error('[AI] Gemini fallback failed:', geminiErr.message);
            // Fall through to OpenRouter
        }
    }

    // 3. Try OpenRouter fallback if configured
    if (OPENROUTER_API_KEY) {
        try {
            return await callOpenRouter(systemPrompt, userPrompt);
        } catch (orErr) {
            console.error('[AI] OpenRouter fallback failed:', orErr.message);
            throw orErr;
        }
    }

    throw new Error('All AI providers (Groq, Gemini, OpenRouter) failed or are not configured.');
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

    const systemPrompt = `You are an expert AI interview coach, You have 10+ years of experience as HR Manager in IT industry.You MUST respond ONLY with valid JSON — no markdown, no explanation, no commentary. Never wrap the JSON in code fences.`

    const userPrompt = `
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
  - detectedSkills
  - preparationPlan
- Provide exactly 5 technicalQuestions.
- Provide exactly 5 behavioralQuestion items.
- technicalQuestions must focus on technical evaluation.
- behavioralQuestion must focus on communication, leadership, teamwork, problem-solving, emotional intelligence, and professional decision-making.
- detectedSkills must evaluate candidate's actual knowledge percentage (0-100%) for each major tech stack based on listed projects, experience, technical answers, and skill gaps.
- technicalQuestions must be an array of objects.
- behavioralQuestion must be an array of objects.
- skillGaps must be an array of objects.
- detectedSkills must be an array of objects.
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
  "detectedSkills": [
    {
      "name": "Node.js",
      "category": "Frameworks",
      "knowledgePercentage": 85
    },
    {
      "name": "React",
      "category": "Frameworks",
      "knowledgePercentage": 90
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
`

    const rawText = await callGroq(systemPrompt, userPrompt)
    const jsonText = extractJsonFromText(rawText)
    const parsedResponse = JSON.parse(jsonText)
    const normalizedResponse = normalizeInterviewReport(parsedResponse)
    const interviewReport = mongooseInterviewReportSchema.parse(normalizedResponse)

    console.log(interviewReport);

    return interviewReport
}



// generatePfdFromHtml removed — PDF is now generated client-side via window.print() + @media print CSS


async function generateResumeHtml({ resume, selfDescription, jobDescription }) {
    const systemPrompt = `You are an expert resume writer. You MUST respond ONLY with valid JSON — no markdown, no explanation. The JSON must have exactly one key: "html", whose value is a complete HTML string for a professional resume. Never wrap the JSON in code fences.`

    const userPrompt = `
Generate a professional one-two page resume in valid JSON only.

Rules:
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
- If any link assosiated with any Word in resume that make use extract link and add them carfully with new resume with same name. (eg:-Portfolio, Linkedin, Github, Preview, etc.) 
Generate a complete, self-contained HTML document for a 1 to 2 page A4 resume, single-column, ATS-friendly, styled clean and professional.

SETUP
- Full doc: <!DOCTYPE html> to </html>. One <style> block in <head>. No external CSS/fonts/images/JS.
- Font: 'Calibri', 'Arial', sans-serif. Body #1a1a1a on white, 11 to 12pt, line-height 1.35.
- @page { size: A4; margin: 12mm 16mm; } body { margin:0; width:210mm; }

HEADER
- Name (h1, 20 to 22pt bold) → title line (11pt, gray) → contact line (location | phone | email, 9pt) → links line (GitHub | LinkedIn | Portfolio as real <a> tags, one accent color e.g. navy #1a3a6b) → thin gray rule.

SECTIONS (in order)
Summary → Technical Skills → Soft Skills → Experience → Projects → Achievements → Education.
- h2 for section titles: uppercase, 11 to 12pt bold, bottom border, accent or near-black.
- Every section and entry block MUST have style="page-break-inside: avoid; break-inside: avoid;".

CONTENT RULES
- Summary: one dense <p>, 3 to 4 lines.
- Skills: "<strong>Category:</strong> items" per line, tight spacing.
- Soft Skills: one comma-separated line.
- Experience/Projects: h3 title + dates/stack right-aligned or inline; 2 to 4 real <ul><li> bullets, action-verb-led; links (Live/GitHub) below in small text.
- BULLET LENGTH & ORPHAN RULE: Each <li> bullet must fit within 1 or 2 complete text lines (approx 12-14 words per line). Never leave a single orphaned word wrapping onto a new line or across pages.
- Achievements: flat bullet list.
- Education: degree + institution one line, graduation date aligned right.
- Never invent facts, metrics, dates, or employers not in source data.

LAYOUT / ATS SAFETY & PAGINATION
- Strict single column, no floats/multi-column/tables-for-layout, no fixed/absolute positioning, no animations/gradients/icon fonts.
- Real semantic h1/h2/h3/ul/li only — never typed "•" in a <p>.
- One accent color max; everything else near-black/gray.
- STRICT PAGE BOUNDARY RULE: All <li>, <p>, <h2>, <h3>, and section block wrappers MUST specify page-break-inside: avoid !important; break-inside: avoid !important;. Never split or cut a bullet point across a page line.
- If content extends onto Page 2, insert an explicit clean section page break (<div style="page-break-before: always; break-before: page; margin-top: 1.5rem;"></div>) before a major section (e.g. before PROJECTS or EDUCATION) so Page 2 starts cleanly at the top with a fresh header instead of splitting a bullet list mid-way.
- If content overflows 2 pages: tighten spacing first, then trim oldest/least relevant bullets — never cut contact info or most recent role.

Candidate details:
Resume: ${resume}
Self Description: ${selfDescription}
Job Description: ${jobDescription}
- Return only valid JSON.
- Do not add fake or unreal information, Knowledge, or data which is not present in the resume, self description or job description.
- If the Resume Data is less or incomplete and the Job description requires more information then the Job description should guide the resume html to be generated, it should align with the job description.
- Do not use fake hyper links for email address, github, linkedin.
- Every link should be varified and real in you are not able to verify then leave it blank.
`

    const rawText = await callGroq(systemPrompt, userPrompt)
    const jsonText = extractJsonFromText(rawText)
    
    let htmlContent = ""
    try {
        const jsonContent = JSON.parse(jsonText)
        htmlContent = extractResumeHtmlContent(jsonContent)
    } catch (parseError) {
        console.warn("[AI] JSON parsing failed in generateResumeHtml. Falling back to direct HTML extraction. Error:", parseError.message)
        const htmlMatch = rawText.match(/<!DOCTYPE html>[\s\S]*<\/html>/i) || 
                          rawText.match(/<html[\s\S]*<\/html>/i) || 
                          rawText.match(/<body[\s\S]*<\/body>/i) || 
                          rawText.match(/<div[\s\S]*<\/div>/i)
        
        if (htmlMatch) {
            htmlContent = htmlMatch[0].trim()
        } else {
            htmlContent = rawText.replace(/```(?:html)?/g, '').trim()
        }
    }

    console.log(htmlContent);
    return normalizeResumeHtmlDocument(htmlContent)
}

async function generateResumePfd({ resume, selfDescription, jobDescription }) {
    const normalizedHtmlDocument = await generateResumeHtml({ resume, selfDescription, jobDescription })
    const pdfBuffer = await generatePfdFromHtml(normalizedHtmlDocument)
    return pdfBuffer
}


const coverLetterPdfSchema = z.object({
    html: z.string().describe("The complete HTML content of the professional cover letter. It should look clean, professional, and well-spaced, optimized for a single A4 page.")
});

// scrapeCompanyCulture removed (was Puppeteer-based). Returns null so generateCoverLetter
// skips the culture injection section gracefully.
async function scrapeCompanyCulture(companyName) {
    // Puppeteer scraping removed. Culture context is skipped.
    return null;
}

// Add the helper function and export it
async function generateCoverLetter({ resume, selfDescription, jobDescription, companyName, roleName }) {
    let scrapedCulture = null;
    if (companyName && companyName.trim()) {
        scrapedCulture = await scrapeCompanyCulture(companyName);
    }

    let culturePromptSection = "";
    if (scrapedCulture) {
        culturePromptSection = `
        We scraped the company's website (${scrapedCulture.sourceUrl}) and found the following details about their culture, values, or mission:
        ---
        ${scrapedCulture.scrapedText}
        ---
        Please use this company culture/values information to adapt the tone, language, and emphasized strengths of the cover letter so it reflects the company's culture and values.
        `;
    }

    const systemPrompt = `You are an expert cover letter writer. You MUST respond ONLY with valid JSON — no markdown, no explanation. The JSON must have exactly one key: "html", whose value is a complete print-ready HTML string for a professional cover letter. Never wrap the JSON in code fences.`

    const userPrompt = `
Generate a professional cover letter in valid JSON format.

Rules:
- Use exactly one top-level key: "html".
- The "html" value must be a string containing print-ready HTML optimized for an A4 page.
- Write in a natural, persuasive human tone. Avoid sounding overly robotic or generic.
- Address it professionally. If companyName (${companyName || 'the company'}) or roleName (${roleName || 'the position'}) is provided, use them correctly.
- Tailor the letter by connecting the candidate's Resume strengths and Self Description with the Job Description requirements.
- Do not fabricate experiences or certifications not mentioned in the resume.
${culturePromptSection}

Candidate details:
Resume: ${resume}
Self Description: ${selfDescription || 'Not provided'}
Job Description: ${jobDescription}
`;

    const rawText = await callGroq(systemPrompt, userPrompt);
    const jsonText = extractJsonFromText(rawText);
    
    let htmlContent = "";
    try {
        const jsonContent = JSON.parse(jsonText);
        htmlContent = jsonContent.html;
    } catch (parseError) {
        console.warn("[AI] JSON parsing failed in generateCoverLetter. Falling back to direct HTML extraction. Error:", parseError.message);
        const htmlMatch = rawText.match(/<!DOCTYPE html>[\s\S]*<\/html>/i) || 
                          rawText.match(/<html[\s\S]*<\/html>/i) || 
                          rawText.match(/<body[\s\S]*<\/body>/i) || 
                          rawText.match(/<div[\s\S]*<\/div>/i);
        
        if (htmlMatch) {
            htmlContent = htmlMatch[0].trim();
        } else {
            htmlContent = rawText.replace(/```(?:html)?/g, '').trim();
        }
    }

    if (htmlContent && typeof htmlContent === 'string') {
        const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        htmlContent = htmlContent
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, '')
            .replace(/"\s*\+\s*new Date\(\)[^"]*"\s*\+\s*"/gi, currentDate)
            .replace(/["']\s*\+\s*new Date\(\)[^"']*["']/gi, currentDate)
            .trim();
    }

    return htmlContent;
}

/**
 * AI Resume Chat Copilot & Section Rewriter
 */
async function rewriteResumeSection({ selectedText = "", instruction = "", action = "enhance", message = "" }) {
    const promptText = message.trim() || instruction.trim();
    const lowerPrompt = promptText.toLowerCase();

    // Detect if user is asking about the project, platform, jobs, or general info
    const isAskingAboutProject = (
        lowerPrompt.includes("about project") ||
        lowerPrompt.includes("about app") ||
        lowerPrompt.includes("about application") ||
        lowerPrompt.includes("what is this") ||
        lowerPrompt.includes("how this project works") ||
        lowerPrompt.includes("how to use") ||
        lowerPrompt.includes("what can you do") ||
        lowerPrompt.includes("features of this app") ||
        lowerPrompt.includes("kivi-ai") ||
        lowerPrompt.includes("who created") ||
        lowerPrompt.includes("what is kivi") ||
        lowerPrompt.includes("tell me about") ||
        lowerPrompt.includes("how does this work")
    );

    const isGeneralInfoOrJobQuery = isAskingAboutProject || (
        !selectedText.trim() && (
            lowerPrompt.includes("job") ||
            lowerPrompt.includes("career") ||
            lowerPrompt.includes("hiring") ||
            lowerPrompt.includes("interview") ||
            lowerPrompt.includes("salary") ||
            lowerPrompt.includes("recommend") ||
            lowerPrompt.includes("help") ||
            lowerPrompt.includes("hi") ||
            lowerPrompt.includes("hello") ||
            lowerPrompt.includes("hey") ||
            lowerPrompt.includes("who are you") ||
            lowerPrompt.includes("what is") ||
            lowerPrompt.includes("how to")
        ) && !lowerPrompt.includes("rewrite") && !lowerPrompt.includes("enhance") && !lowerPrompt.includes("shorten") && !lowerPrompt.includes("summary")
    );

    let systemPrompt = `You are an expert AI Resume Copilot & Career Coach (KIVI AI). You help job seekers refine their resume content and answer career/job questions. 

Respond in valid JSON only with two keys:
1. "replyText": A concise, friendly conversational response answering the user or explaining your improvement (1-3 sentences max).
2. "suggestedSnippet": (Optional string) ONLY set this if the user explicitly asked to rewrite, enhance, shorten, or generate specific resume text snippet or if text was highlighted to be rewritten. If the user is asking general questions, questions about jobs, career advice, or about the platform/application, set "suggestedSnippet" to null!

Rules:
- Return ONLY valid JSON with keys "replyText" and "suggestedSnippet".
- Never wrap JSON in code fences.`;

    if (isAskingAboutProject) {
        systemPrompt = `You are KIVI AI, the intelligent assistant embedded inside KIVI-AI Platform (AI Technical Interviewer & ATS Resume Studio).

About KIVI-AI Platform:
- Purpose: KIVI-AI is an end-to-end AI-powered career platform designed to help software engineers prepare for technical interviews and generate ATS-friendly resumes and also provide detailed reports on their performance, And Based in thier resume provide them real Jobs and Applications.
- Key Features:
  1. AI Technical Mock Interviews: Conducts real-time, interactive technical interview assessments covering frontend, backend, system design, and coding.
  2. Detailed Interview Reports: Provides granular performance analytics, technical scoring, strengths, and targeted improvement plans.
  3. AI ATS Resume Studio: Automatically transforms candidate interview performance and self-descriptions into professional, ATS-optimized A4 resumes matching job requirements.
  4. Live Sheet Editor & PDF Export: Allows candidates to edit resume content directly on the simulated A4 page in the browser and export clean 1:1 PDFs.
  5. KIVI AI Assistant: Floating AI copilot (you!) that assists with live text selection re-writing, bullet point enhancement, grammar fixes, and platform support.

Your Task:
When the user asks about the project, jobs, or application, provide a friendly, helpful, and concise overview explaining what the application does and how its features help candidates succeed.

Respond in valid JSON only with two keys:
1. "replyText": Clear, enthusiastic, and informative answer about KIVI-AI Platform and career tools (2-4 sentences max).
2. "suggestedSnippet": Set to null.

Rules:
- Return ONLY valid JSON with keys "replyText" and "suggestedSnippet".
- Never wrap JSON in code fences.`;
    }

    let actionGuide = "Make the text snippet more impactful, professional, and results-oriented with strong action verbs.";
    if (action === "shorten") {
        actionGuide = "Shorten the text snippet to be concise and punchy while keeping key achievements intact.";
    } else if (action === "fix_grammar") {
        actionGuide = "Correct all spelling, grammar, and phrasing errors while maintaining the original meaning.";
    } else if (action === "align_job") {
        actionGuide = "Optimize the text snippet with industry-relevant technical keywords and professional skills.";
    }

    const userPrompt = `
User Query / Message: ${promptText || actionGuide}
${selectedText ? `Highlighted Resume Text: "${selectedText.trim()}"` : 'No text highlighted currently.'}

Generate response JSON with "replyText" and "suggestedSnippet":
`;

    try {
        const rawText = await callGroq(systemPrompt, userPrompt);
        const jsonText = extractJsonFromText(rawText);
        const parsed = JSON.parse(jsonText);

        const snippetResult = (isGeneralInfoOrJobQuery || !parsed.suggestedSnippet || parsed.suggestedSnippet === "null") 
            ? null 
            : parsed.suggestedSnippet;

        return {
            replyText: parsed.replyText || "Here is information to assist you.",
            suggestedSnippet: snippetResult
        };
    } catch (err) {
        return {
            replyText: isAskingAboutProject 
                ? "KIVI-AI is an end-to-end AI platform featuring AI Mock Interviews, detailed technical reports, and an automated ATS Resume Studio with live 1:1 A4 PDF export!" 
                : "Here is information to assist you.",
            suggestedSnippet: (isGeneralInfoOrJobQuery || !selectedText) ? null : selectedText.trim()
        };
    }
}

function getAIStatus() {
    return {
        provider: isGroqHealthy ? "Groq AI" : (aiGemini ? "Gemini AI" : "OpenRouter"),
        primaryModel: isGroqHealthy ? "GPT-OSS 120B" : (aiGemini ? "Gemini 2.5 Flash" : "Nemotron 3 120B"),
        fallbackModel: isGroqHealthy ? (aiGemini ? "Gemini 2.5 Flash" : "Nemotron 3 120B (OpenRouter)") : (aiGemini ? "Nemotron 3 120B (OpenRouter)" : "None"),
        status: "online",
        label: isGroqHealthy ? "GPT-OSS 120B · Groq AI" : (aiGemini ? "Switched to Gemini" : "Nemotron 3 120B · OpenRouter")
    }
}

module.exports = { generateInterviewReport, generateResumePfd, generateCoverLetter, generateResumeHtml, rewriteResumeSection, getAIStatus }

