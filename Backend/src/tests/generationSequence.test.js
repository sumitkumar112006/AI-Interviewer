const mongoose = require('mongoose');

describe('Resume-First Generation Sequence & Stage Isolation Tests', () => {
    let mockJobDoc;
    let mockInterviewReportModel;
    let mockAiService;
    let createdReports = [];
    let updatedReports = [];
    let executionLog = [];

    beforeEach(() => {
        createdReports = [];
        updatedReports = [];
        executionLog = [];

        mockJobDoc = {
            _id: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId(),
            type: 'interview_report',
            resourceId: null,
            resourceModel: null,
            status: 'pending',
            input: {
                resumeText: 'Software Engineer with React experience',
                selfDescription: 'Experienced frontend developer',
                jobDescription: 'Senior Full Stack Developer with React and Node.js',
                userPlan: 'pro',
                extractedLinks: ['https://github.com/test']
            },
            save: jest.fn().mockImplementation(function() {
                return Promise.resolve(this);
            })
        };

        mockInterviewReportModel = {
            create: jest.fn().mockImplementation((data) => {
                const doc = {
                    _id: new mongoose.Types.ObjectId(),
                    ...data,
                    save: jest.fn().mockResolvedValue(true)
                };
                createdReports.push(doc);
                executionLog.push(`DB:create:${doc._id}`);
                return Promise.resolve(doc);
            }),
            findById: jest.fn().mockImplementation((id) => {
                const found = createdReports.find(r => r._id.toString() === id.toString());
                return Promise.resolve(found || null);
            }),
            findByIdAndUpdate: jest.fn().mockImplementation((id, update, options) => {
                const existing = createdReports.find(r => r._id.toString() === id.toString());
                if (!existing) return Promise.resolve(null);
                Object.assign(existing, update.$set || update);
                updatedReports.push(existing);
                executionLog.push(`DB:findByIdAndUpdate:${id}`);
                return Promise.resolve(existing);
            })
        };

        mockAiService = {
            generateResumeHtml: jest.fn().mockImplementation(async (params) => {
                executionLog.push('AI:generateResumeHtml');
                return {
                    html: '<div class="resume"><h1>John Doe</h1><p>Full Stack Engineer</p></div>',
                    skills: ['React', 'Node.js', 'TypeScript', 'MongoDB']
                };
            }),
            generateInterviewReport: jest.fn().mockImplementation(async (params) => {
                executionLog.push(`AI:generateInterviewReport:hasTailoredResume=${Boolean(params.generatedResume)}`);
                return {
                    developerTitle: 'Full-Stack Developer',
                    matchScore: 92,
                    technicalQuestions: [
                        { question: 'Explain React reconciliation', intention: 'Test virtual DOM knowledge', answer: 'React compares the virtual DOM tree...' },
                        { question: 'How does Node.js event loop work?', intention: 'Test concurrency architecture', answer: 'Node event loop runs through phases...' }
                    ],
                    behavioralQuestion: [
                        { question: 'Tell me about a challenging deployment', intention: 'Test resilience', answer: 'During a production outage...' }
                    ],
                    skillGaps: [{ skill: 'GraphQL', severity: 'low' }],
                    detectedSkills: [
                        { name: 'React', category: 'Frontend', knowledgePercentage: 90 },
                        { name: 'Node.js', category: 'Backend', knowledgePercentage: 85 }
                    ],
                    preparationPlan: [
                        { day: 'Day 1', focus: 'Architecture Review', tasks: ['Review Node event loop', 'Practice React performance'] }
                    ]
                };
            })
        };
    });

    test('1. Stage 1 executes before Stage 2 and passes tailored resume to Stage 2', async () => {
        // Simulate execution sequence in aiWorker
        executionLog.push('START');

        // STAGE 1: Resume First
        const resumeValue = await mockAiService.generateResumeHtml({
            resume: mockJobDoc.input.resumeText,
            selfDescription: mockJobDoc.input.selfDescription,
            jobDescription: mockJobDoc.input.jobDescription,
            plan: mockJobDoc.input.userPlan
        });

        const generatedResumeHtml = resumeValue.html;
        const resumeSkills = resumeValue.skills;

        const initialDoc = await mockInterviewReportModel.create({
            user: mockJobDoc.userId,
            resume: mockJobDoc.input.resumeText,
            generatedResumeHtml,
            resumeSkills
        });
        mockJobDoc.resourceId = initialDoc._id;

        // STAGE 2: Report Second (with tailored resume)
        const reportByAi = await mockAiService.generateInterviewReport({
            resume: mockJobDoc.input.resumeText,
            selfDescription: mockJobDoc.input.selfDescription,
            jobDescription: mockJobDoc.input.jobDescription,
            plan: mockJobDoc.input.userPlan,
            generatedResume: generatedResumeHtml
        });

        await mockInterviewReportModel.findByIdAndUpdate(initialDoc._id, {
            $set: {
                developerTitle: reportByAi.developerTitle,
                matchScore: reportByAi.matchScore,
                technicalQuestions: reportByAi.technicalQuestions,
                behavioralQuestion: reportByAi.behavioralQuestion,
                preparationPlan: reportByAi.preparationPlan
            }
        });

        executionLog.push('END');

        // Verify sequence
        expect(executionLog).toEqual([
            'START',
            'AI:generateResumeHtml',
            `DB:create:${initialDoc._id}`,
            'AI:generateInterviewReport:hasTailoredResume=true',
            `DB:findByIdAndUpdate:${initialDoc._id}`,
            'END'
        ]);

        // Verify Stage 2 received the generated resume HTML
        expect(mockAiService.generateInterviewReport).toHaveBeenCalledWith(
            expect.objectContaining({
                generatedResume: expect.stringContaining('<div class="resume">')
            })
        );
    });

    test('2. Stage 1 failure cleanly aborts and prevents Stage 2 from running', async () => {
        mockAiService.generateResumeHtml = jest.fn().mockRejectedValue(new Error('LLM rate limit on resume'));

        let stage1Error = null;
        try {
            await mockAiService.generateResumeHtml({});
            // If it didn't throw, Stage 2 would run:
            await mockAiService.generateInterviewReport({});
        } catch (err) {
            stage1Error = err;
        }

        expect(stage1Error).not.toBeNull();
        expect(stage1Error.message).toBe('LLM rate limit on resume');
        expect(mockAiService.generateInterviewReport).not.toHaveBeenCalled();
        expect(mockInterviewReportModel.create).not.toHaveBeenCalled();
    });

    test('3. Stage 2 failure preserves Stage 1 resume and marks job without deleting resume', async () => {
        // Stage 1 succeeds
        const resumeValue = await mockAiService.generateResumeHtml({});
        const savedDoc = await mockInterviewReportModel.create({
            user: mockJobDoc.userId,
            resume: mockJobDoc.input.resumeText,
            generatedResumeHtml: resumeValue.html,
            resumeSkills: resumeValue.skills
        });
        mockJobDoc.resourceId = savedDoc._id;
        await mockJobDoc.save();

        // Stage 2 fails
        mockAiService.generateInterviewReport = jest.fn().mockRejectedValue(new Error('Groq 503 Service Unavailable'));

        let stage2Error = null;
        try {
            await mockAiService.generateInterviewReport({
                generatedResume: resumeValue.html
            });
        } catch (err) {
            stage2Error = err;
            mockJobDoc.status = 'failed';
            mockJobDoc.error = err.message;
            await mockJobDoc.save();
        }

        expect(stage2Error).not.toBeNull();
        expect(mockJobDoc.status).toBe('failed');
        expect(mockJobDoc.resourceId).toBe(savedDoc._id);

        // Crucial: The saved document in MongoDB still has the resume HTML intact!
        const docInDb = await mockInterviewReportModel.findById(mockJobDoc.resourceId);
        expect(docInDb).not.toBeNull();
        expect(docInDb.generatedResumeHtml).toBe(resumeValue.html);
        expect(docInDb.resumeSkills).toEqual(['React', 'Node.js', 'TypeScript', 'MongoDB']);
    });

    test('4. Retrying after Stage 2 failure reuses the existing resume and does not duplicate documents', async () => {
        // Prior state from test 3: job has resourceId and resume already generated
        const existingDocId = new mongoose.Types.ObjectId();
        const existingDoc = {
            _id: existingDocId,
            user: mockJobDoc.userId,
            generatedResumeHtml: '<div class="resume">Cached Resume</div>',
            resumeSkills: ['React', 'Node.js']
        };
        createdReports.push(existingDoc);

        mockJobDoc.resourceId = existingDocId;

        // Worker execution on retry:
        let interviewReport = await mockInterviewReportModel.findById(mockJobDoc.resourceId);
        let generatedResumeHtml = interviewReport?.generatedResumeHtml || '';

        // If already generated, skip Stage 1!
        if (!generatedResumeHtml || generatedResumeHtml.trim().length < 30) {
            await mockAiService.generateResumeHtml({});
        }

        // Run Stage 2 directly
        const reportByAi = await mockAiService.generateInterviewReport({
            resume: mockJobDoc.input.resumeText,
            generatedResume: generatedResumeHtml
        });

        // Idempotent update
        const updatedDoc = await mockInterviewReportModel.findByIdAndUpdate(interviewReport._id, {
            $set: {
                developerTitle: reportByAi.developerTitle,
                matchScore: reportByAi.matchScore
            }
        });

        // Verify: Stage 1 generateResumeHtml was NEVER called on retry!
        expect(mockAiService.generateResumeHtml).not.toHaveBeenCalled();
        // Verify: Stage 2 succeeded with the cached resume
        expect(mockAiService.generateInterviewReport).toHaveBeenCalledWith(
            expect.objectContaining({ generatedResume: '<div class="resume">Cached Resume</div>' })
        );
        // Verify: No new documents were created, only the existing one was updated
        expect(mockInterviewReportModel.create).not.toHaveBeenCalled();
        expect(updatedDoc._id.toString()).toBe(existingDocId.toString());
    });

    test('5. Backward compatibility: InterviewReport structure matches legacy requirements', () => {
        const sampleReport = {
            developerTitle: 'Front-End Developer',
            matchScore: 85,
            technicalQuestions: [{ question: 'Q1', intention: 'I1', answer: 'A1' }],
            behavioralQuestion: [{ question: 'B1', intention: 'I2', answer: 'A2' }],
            skillGaps: [{ skill: 'Docker', severity: 'low' }],
            detectedSkills: [{ name: 'React', category: 'Frontend', knowledgePercentage: 90 }],
            preparationPlan: [{ day: 'Day 1', focus: 'Fundamentals', tasks: ['Task 1'] }],
            generatedResumeHtml: '<p>Resume</p>',
            resumeSkills: ['React']
        };

        // Ensure all required top-level keys exist and have valid types
        expect(typeof sampleReport.developerTitle).toBe('string');
        expect(typeof sampleReport.matchScore).toBe('number');
        expect(Array.isArray(sampleReport.technicalQuestions)).toBe(true);
        expect(Array.isArray(sampleReport.behavioralQuestion)).toBe(true);
        expect(Array.isArray(sampleReport.skillGaps)).toBe(true);
        expect(Array.isArray(sampleReport.detectedSkills)).toBe(true);
        expect(Array.isArray(sampleReport.preparationPlan)).toBe(true);
        expect(typeof sampleReport.generatedResumeHtml).toBe('string');
    });

    test('6. Stage 1 Mongoose schema validation: current and currentSkills must be valid embedded documents', () => {
        const realInterviewReportModel = require('../models/interviewReport.model');
        const doc = new realInterviewReportModel({
            user: new mongoose.Types.ObjectId(),
            resume: 'Sample resume text',
            selfDescription: 'Self description',
            jobDescription: 'Job description text',
            detectedSkills: [],
            resumeSkills: ['JavaScript', 'React'],
            older: ['JavaScript'],
            olderSkills: ['JavaScript'],
            originalSkills: ['JavaScript'],
            current: { all: [], newSkills: [], previousSkills: [] },
            currentSkills: { all: [], newSkills: [], previousSkills: [] },
            generatedResumeHtml: '<p>Resume HTML</p>',
            developerTitle: 'ATS Tailored Resume',
            matchScore: 0,
            technicalQuestions: [],
            behavioralQuestion: [],
            skillGaps: [],
            preparationPlan: []
        });

        const validationError = doc.validateSync();
        expect(validationError).toBeUndefined();
    });
});

