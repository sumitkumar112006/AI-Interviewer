const { GoogleGenAI } = require("@google/genai")
const { z } = require('zod')
const { zodToJsonSchema } = require('zod-to-json-schema')
const { resume, selfDescribe, jobDescribe } = require('./temp')


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


const interviewReportSchema = z.object({

    matchScore: z
        .number()
        .min(0)
        .max(100)
        .describe(
            "Overall interview match score from 0 to 100 based on technical skills, behavioral performance, communication, problem-solving ability, confidence, and job readiness."
        ),

    technicalQuestion: z.array(
        z.object({
            question: z
                .string()
                .describe(
                    "The exact interview question asked to the candidate."
                ),

            intention: z
                .string()
                .describe(
                    "Analyze the real intent behind the question and identify what skill, knowledge, or thinking ability the interviewer wants to evaluate."
                ),

            answer: z
                .string()
                .describe(
                    "Generate the best concise interview-ready answer. Keep it confident, technically accurate, natural to speak, and focused only on high-value information with minimal words."
                ),
        })
    ).describe(
        "An array of technical interview question objects. Each object must include question, intention, and answer. Focus on technical depth, practical knowledge, problem-solving, tools, architecture, debugging, performance, and implementation ability."
    ),


    behaviouralQuestion: z.array(
        z.object({
            question: z
                .string()
                .describe(
                    "The exact behavioural interview question asked to the candidate."
                ),

            intention: z
                .string()
                .describe(
                    "Analyze the psychological and professional intent behind the question. Identify what the interviewer wants to evaluate such as leadership, ownership, teamwork, conflict handling, adaptability, communication, emotional intelligence, decision-making, accountability, growth mindset, or performance under pressure."
                ),

            answer: z
                .string()
                .describe(
                    "Generate a strong interview-ready behavioural answer that sounds authentic, confident, emotionally intelligent, and professionally mature. Keep it concise, natural to speak, results-oriented, and focused on actions, decisions, and impact using minimal words."
                ),
        })
    ).describe(
        "An object for each question including question , intention and  of behavioural interview questions with deep intent analysis and concise interview-ready answers focused on communication, leadership, teamwork, problem-solving, emotional intelligence, and professional decision-making."
    ),


    skillGaps: z.array(
        z.object({
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
    ).describe(
        "List of the most important skill gaps detected during the interview across technical ability, communication, behavioral traits, confidence, problem-solving, and practical experience."
    ),


    preparationPlan: z.array(
        z.object({
            day: z
                .number()
                .describe(
                    "The day number in the interview preparation roadmap."
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


async function generateInterviewReport({ resume, selfDescribe, jobDescribe }) {

    const prompt = `
Generate an interview report in valid JSON only.

Rules:
- Provide a matchScore from 0 to 100 as a number.
- Return only JSON.
- Follow these exact top-level keys to match the database schema:
- matchScore
- technicalQuestion
- behavioralQuestion
- skillGaps
- preparationPlan
- Provide exactly 5 technicalQuestions.
- Provide exactly 5 behavioralQuestion items.
- technicalQuestions should focus on technical evaluation.
- behavioralQuestion should focus on communication, leadership, teamwork, problem-solving, emotional intelligence, and professional decision-making.
- technicalQuestions must be an array of objects, not strings.
- behavioralQuestion must be an array of objects, not strings.
- skillGaps must be an array of objects, not strings.
- preparationPlan must be an array of objects, not strings.

Expected format:
{
  "matchScore": 85,
  "technicalQuestion": [
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
      "day": 1,
      "focus": "...",
      "tasks": ["...", "..."]
    }
  ]
}

- skillGaps: each item must contain skill, severity.
- Use this format for each skill gap item:
{
    "skill": "...",
    "severity": "low" | "medium" | "high"
}

- preparationPlan: each item must contain day, focus, and tasks.
- Use this format for each preparationPlan item:
{
  "day": 1,
  "focus": "...",
  "tasks": ["...", "..."]
}
- Do not wrap objects inside strings.
- Do not return partial JSON fragments like "question": "..." or "skill": "...".
- Keep every field practical, concise.  
  
Resume: ${resume}
Self Description: ${selfDescribe}    
Job Description: ${jobDescribe} 
`;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: zodToJsonSchema(interviewReportSchema)
        }
    })

    console.log(JSON.parse(response.text));

    return JSON.parse(response.text);


}

module.exports = { generateInterviewReport }

