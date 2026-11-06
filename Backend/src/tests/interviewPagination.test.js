const mongoose = require('mongoose');
const { getAllInterviewReportController } = require('../controller/interview.controller');
const interviewReportModel = require('../models/interviewReport.model');

// Mock Redis service to avoid connection dependency in unit test
jest.mock('../services/redis.service', () => ({
    getCache: jest.fn().mockResolvedValue(null),
    setCache: jest.fn().mockResolvedValue(true),
    deleteCache: jest.fn().mockResolvedValue(true)
}));

function createMockReqRes({ query = {}, user = { id: new mongoose.Types.ObjectId().toString() } } = {}) {
    const req = {
        query,
        user
    };

    const res = {
        statusCode: 200,
        jsonData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.jsonData = data;
            return this;
        }
    };

    const next = jest.fn();

    return { req, res, next };
}

describe('Interview Reports Server-Side Pagination & Search Tests', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('1. Paginated query returns batch of 10 reports and hasMore=true when more reports exist', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const mockReports = Array.from({ length: 11 }, (_, i) => ({
            _id: new mongoose.Types.ObjectId(),
            developerTitle: `Developer Role ${i + 1}`,
            matchScore: 80 + i,
            skillGaps: [{ skill: 'Docker', severity: 'medium' }],
            createdAt: new Date(Date.now() - i * 10000),
            updatedAt: new Date(Date.now() - i * 10000),
            toObject() {
                return {
                    _id: this._id,
                    developerTitle: this.developerTitle,
                    matchScore: this.matchScore,
                    skillGaps: this.skillGaps,
                    createdAt: this.createdAt,
                    updatedAt: this.updatedAt
                };
            }
        }));

        jest.spyOn(interviewReportModel, 'countDocuments').mockResolvedValue(35);

        const mockQuery = {
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(mockReports)
        };
        jest.spyOn(interviewReportModel, 'find').mockReturnValue(mockQuery);

        const { req, res, next } = createMockReqRes({
            query: { limit: '10' },
            user: { id: userId }
        });

        await getAllInterviewReportController(req, res, next);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.totalInterviews).toBe(35);
        expect(res.jsonData.interviewReports.length).toBe(10);
        expect(res.jsonData.hasMore).toBe(true);
        expect(res.jsonData.nextCursor).toBeDefined();
        // Heavy fields excluded
        expect(res.jsonData.interviewReports[0].resume).toBeUndefined();
        expect(res.jsonData.interviewReports[0].generatedResumeHtml).toBeUndefined();
    });

    test('2. Final batch returns hasMore=false and nextCursor=null when reports end', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const mockReports = Array.from({ length: 5 }, (_, i) => ({
            _id: new mongoose.Types.ObjectId(),
            developerTitle: `Final Batch Role ${i + 1}`,
            matchScore: 75,
            skillGaps: [],
            createdAt: new Date(Date.now() - i * 10000),
            updatedAt: new Date(Date.now() - i * 10000),
            toObject() {
                return {
                    _id: this._id,
                    developerTitle: this.developerTitle,
                    matchScore: this.matchScore,
                    skillGaps: this.skillGaps,
                    createdAt: this.createdAt,
                    updatedAt: this.updatedAt
                };
            }
        }));

        jest.spyOn(interviewReportModel, 'countDocuments').mockResolvedValue(35);

        const mockQuery = {
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(mockReports)
        };
        jest.spyOn(interviewReportModel, 'find').mockReturnValue(mockQuery);

        const { req, res, next } = createMockReqRes({
            query: { limit: '10', cursor: Buffer.from(JSON.stringify({ createdAt: new Date().toISOString(), id: new mongoose.Types.ObjectId().toString() })).toString('base64') },
            user: { id: userId }
        });

        await getAllInterviewReportController(req, res, next);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.interviewReports.length).toBe(5);
        expect(res.jsonData.hasMore).toBe(false);
        expect(res.jsonData.nextCursor).toBeNull();
    });

    test('3. Server-side search queries developerTitle and returns matching count', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const mockReports = [
            {
                _id: new mongoose.Types.ObjectId(),
                developerTitle: 'React Frontend Engineer',
                matchScore: 92,
                skillGaps: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                toObject() {
                    return {
                        _id: this._id,
                        developerTitle: this.developerTitle,
                        matchScore: this.matchScore,
                        skillGaps: this.skillGaps,
                        createdAt: this.createdAt,
                        updatedAt: this.updatedAt
                    };
                }
            }
        ];

        jest.spyOn(interviewReportModel, 'countDocuments')
            .mockImplementation((filter) => {
                if (filter.$and) return Promise.resolve(1); // matching search
                return Promise.resolve(35); // total user reports
            });

        const mockQuery = {
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(mockReports)
        };
        jest.spyOn(interviewReportModel, 'find').mockReturnValue(mockQuery);

        const { req, res, next } = createMockReqRes({
            query: { limit: '10', search: 'React' },
            user: { id: userId }
        });

        await getAllInterviewReportController(req, res, next);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.totalInterviews).toBe(35); // preserves overall user total
        expect(res.jsonData.totalMatching).toBe(1);
        expect(res.jsonData.interviewReports.length).toBe(1);
        expect(res.jsonData.interviewReports[0].developerTitle).toBe('React Frontend Engineer');
    });

    test('4. Non-paginated requests preserve backward compatibility and include skill analytics', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const mockReports = [
            {
                _id: new mongoose.Types.ObjectId(),
                developerTitle: 'Full-Stack Developer',
                matchScore: 85,
                resume: 'Sample resume',
                technicalQuestions: [{ question: 'Q1' }],
                behavioralQuestion: [],
                preparationPlan: [],
                completedTasks: [],
                skillGaps: [],
                toObject() {
                    return { ...this };
                }
            }
        ];

        const mockQuery = {
            sort: jest.fn().mockResolvedValue(mockReports)
        };
        jest.spyOn(interviewReportModel, 'find').mockReturnValue(mockQuery);

        const { req, res, next } = createMockReqRes({
            query: {}, // no limit, page, or search
            user: { id: userId }
        });

        await getAllInterviewReportController(req, res, next);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.totalInterviews).toBe(1);
        expect(res.jsonData.totalResumes).toBe(1);
        expect(res.jsonData.skillAnalytics).toBeDefined();
        expect(Array.isArray(res.jsonData.interviewReports)).toBe(true);
    });
});

