const mongoose = require('mongoose');
/**
 * -job description schema - string
 * -resume text - string
 * -self description - string
 * 
 * ->Match score : 0-100
 * 
 * 
 * Technical questions : 
 *                      [{
 *                   question : "",
 *                   intention : "", 
 *                   answer : "",
 *                  }]
 *  
 * Behavioral question : 
 *                  [{
 *                   question : "",
 *                   intention : "", 
 *                   answer : "",
 *                  }]
 * 
 * Skill gap :  [{
 *          skill : "",
 *          severity : {
 *             type : string,
 *            enum : ["low", "medium", "high"]},
 * }]
 * preparation plan : use [{
 *          day :number,
 *          topic : "",
 * }]
*/

const technicalQuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [true, "Technical question is required"],
        trim: true
    },
    intention: {
        type: String,
        default: "Evaluates technical depth, architecture tradeoffs, and practical implementation ability.",
        trim: true
    },
    answer: {
        type: String,
        default: "Provide a structured explanation detailing core concepts, implementation steps, tradeoff analysis, and concrete project experience.",
        trim: true
    },
    userResponse: {
        type: String,
        default: ""
    }
}, {
    _id: false, // this will prevent mongoose from creating an _id for each technical question  
})


const behavioralQuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [true, "Behavioral question is required"],
        trim: true
    },
    intention: {
        type: String,
        default: "Evaluates communication, ownership, collaboration, problem-solving, and emotional intelligence.",
        trim: true
    },
    answer: {
        type: String,
        default: "Use the STAR method (Situation, Task, Action, Result) highlighting your personal leadership, decision-making, and measurable impact.",
        trim: true
    },
    userResponse: {
        type: String,
        default: ""
    }
}, {
    _id: false,
})


const skillGapSchema = new mongoose.Schema({
    skill: {
        type: String,
        required: [true, "Skill is required for skill gap"],
        trim: true
    },
    severity: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium"
    }
}, {
    _id: false
})


const interviewPreparationPlanSchema = new mongoose.Schema({
    day: {
        type: String,
        default: "Day 1",
        trim: true
    },
    focus: {
        type: String,
        default: "Core Technical Concepts & Problem Solving",
        trim: true
    },
    tasks: [{
        type: String,
        trim: true
    }]
}, {
    _id: false
})


const interviewReportSchema = new mongoose.Schema({
    jobDescription: {
        type: String,
        required: [true, "Job description is required"],
    },
    resume: {
        type: String,
        required:true
    },
    selfDescription: {
        type: String,
    },
    developerTitle: {
        type: String,
        required: [true, "Developer title is required"],
        trim: true
    },
    matchScore: {
        type: Number,
        min: 0,
        max: 100,
    },
    technicalQuestions: [technicalQuestionSchema],
    behavioralQuestion: [behavioralQuestionSchema],
    skillGaps: [skillGapSchema],
    preparationPlan: [interviewPreparationPlanSchema],
    completedTasks: {
        type: [String],
        default: []
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    generatedResumeHtml: {
        type: String,
        default: ""
    },
    detectedSkills: [{
        name: { type: String, required: true },
        category: { type: String, default: "General" },
        score: { type: Number, default: 75 }
    }]

}, {
    timestamps: true
})

const interviewReportModel = mongoose.model("InterviewReports", interviewReportSchema);

module.exports = interviewReportModel
