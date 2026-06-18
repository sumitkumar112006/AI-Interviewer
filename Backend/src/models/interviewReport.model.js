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
    },
    intention: {
        type: String,
        required: [true, "Intention is required for technical question"],
    },
    answer: {
        type: String,
        required: [true, "Answer is required for technical question"],
    }
}, {
    _id: false, // this will prevent mongoose from creating an _id for each technical question  
})


const behavioralQuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [true, "Behavioral question is required"],
    },
    intention: {
        type: String,
        required: [true, "Intention is required for Behavioral question"],
    },
    answer: {
        type: String,
        required: [true, "Answer is required for Behavioral question"],
    }
}, {
    _id: false,
})


const skillGapSchema = new mongoose.Schema({
    skill: {
        type: String,
        required: [true, "Skill is required for skill gap"],
    },
    severity: {
        type: String,
        enum: ["low", "medium", "high"],
        required: [true, "Severity is required"]
    }
}, {
    _id: false
})


const interviewPreparationPlanSchema = new mongoose.Schema({
    day: {
        type: String,
        required: [true, "Day is required"]
    },
    focus: {
        type: String,
        required: [true, "Focus is required"]
    },
    tasks: [{
        type: String,
        required: [true, "Task is required"]
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
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    }

}, {
    timestamps: true
})

const interviewReportModel = mongoose.model("InterviewReports", interviewReportSchema);

module.exports = interviewReportModel
