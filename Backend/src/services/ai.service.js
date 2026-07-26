const { GoogleGenAI } = require("@google/genai")
const { z } = require('zod')
const { zodToJsonSchema } = require('zod-to-json-schema')
const puppeteer = require('puppeteer');

const request = require('request');
const fs = require('fs')
const axios = require('axios');


// Initialize Google GenAI client
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY })

if (!process.env.GOOGLE_GENAI_API_KEY) {
    console.warn('GOOGLE_GENAI_API_KEY is not set. AI calls will likely fail.')
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
`
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

    return interviewReport


}



async function generatePfdFromHtml(htmlContent) {
    // 1. Regex to automatically insert target="_blank" and rel="noopener noreferrer" into all <a> tags
    const processedHtml = htmlContent.replace(/<a\s+(?![^>]*target=)/gi, '<a target="_blank" rel="noopener noreferrer" ');

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage"
        ]
    });
    const page = await browser.newPage();

    // 2. Pass the processed HTML instead of raw HTML
    await page.setContent(processedHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
            top: '60px',
            right: '20px',
            bottom: '40px',
            left: '20px'
        }
    });
    await browser.close();
    return pdfBuffer;
}





async function generateResumeHtml({ resume, selfDescription, jobDescription }) {
    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume including all the hyperlinks, styles, and formatting necessary for a professional 1-2 page resume. And this resume should have all those updated details which are mentioned in the resume, self description and job description. It should be ATS friendly based on the Job Description and visually appealing for human recruiters.")
    })
    const resumeGenerationModels = [
        "gemini-3-flash-preview",
        "gemini-2.5-flash"
    ]

    const prompt = `
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

// Add the helper function and export it
// Add helper for scraping company culture
async function scrapeCompanyCulture(companyName) {
    if (!companyName || !companyName.trim()) {
        return null;
    }

    console.log(`[Scraper] Starting culture search for company: ${companyName}`);
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage"
            ]
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Search DuckDuckGo HTML version for company culture
        const searchQuery = encodeURIComponent(`${companyName} company culture values mission about`);
        const searchUrl = `https://html.duckduckgo.com/html/?q=${searchQuery}`;
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
        
        // Extract the first 3 links from search results (ignoring ads and duckduckgo search urls)
        const urls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a.result__a'));
            return links
                .map(a => a.href)
                .filter(href => href && !href.includes('duckduckgo.com'))
                .slice(0, 3);
        });
        
        if (!urls || urls.length === 0) {
            console.log(`[Scraper] No search results found for ${companyName}`);
            await browser.close();
            return null;
        }
        
        // Take the first link as the most relevant culture page
        const targetUrl = urls[0];
        console.log(`[Scraper] Navigating to target site for culture data: ${targetUrl}`);
        
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        
        // Extract main text content
        const textContent = await page.evaluate(() => {
            const elementsToRemove = document.querySelectorAll('script, style, nav, footer, header, noscript');
            elementsToRemove.forEach(el => el.remove());
            const bodyText = document.body.innerText || "";
            return bodyText.replace(/\s+/g, ' ').trim();
        });
        
        await browser.close();
        
        // Limit scraped text length to avoid token limit issues
        const trimmedText = textContent.slice(0, 2000);
        console.log(`[Scraper] Successfully scraped ${trimmedText.length} chars from ${targetUrl}`);
        
        return {
            sourceUrl: targetUrl,
            scrapedText: trimmedText
        };
    } catch (err) {
        console.error(`[Scraper] Failed to scrape company culture:`, err.message);
        if (browser) {
            try {
                await browser.close();
            } catch (closeErr) {
                // ignore
            }
        }
        return null;
    }
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

    const prompt = `
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
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: zodToJsonSchema(coverLetterPdfSchema)
        }
    });
    const jsonContent = JSON.parse(response.text);
    return jsonContent.html; // Returns the generated HTML string
}

module.exports = { generateInterviewReport, generateResumePfd, generateCoverLetter, generatePfdFromHtml, generateResumeHtml }
