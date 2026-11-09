/**
 * systemHealthAndEvents.test.js — System Events & Application Health Dashboard Test Suite
 *
 * Tests:
 * 1. Subsystem health probes: MongoDB, Redis, BullMQ, AI Providers, Process.
 * 2. Fault-isolation (failures in one probe never crash the health service).
 * 3. 15-second in-memory caching and force-live refresh.
 * 4. Zero exposure of credentials, secrets, or internal connection strings.
 * 5. Deterministic status classification: 'healthy', 'degraded', 'unavailable'.
 * 6. getAdminSystemEventsController filtering (category, severity, date range, search).
 * 7. getAdminSystemHealthController response structure.
 */

jest.mock('../jobs/aiQueue', () => ({
    aiQueue: {
        getJob: jest.fn().mockResolvedValue(null),
        getJobCounts: jest.fn().mockResolvedValue({
            waiting: 0,
            active: 0,
            completed: 10,
            failed: 0,
            delayed: 0
        }),
        getWorkers: jest.fn().mockResolvedValue([{ id: 'worker-1' }])
    },
    enqueueAiJob: jest.fn().mockResolvedValue({ id: 'bull-job-123' })
}));

const mongoose = require('mongoose');
const {
    getSystemHealth,
    checkMongoHealth,
    checkRedisHealth,
    checkBullMQHealth,
    checkAIHealth,
    checkProcessHealth,
    getRecentServerErrors,
    _clearHealthCacheForTesting
} = require('../services/systemHealth.service');
const { SystemEvent } = require('../models/systemEvent.model');
const redisConfig = require('../config/redis');
const aiQueueModule = require('../jobs/aiQueue');
const aiWorkerModule = require('../jobs/aiWorker');
const aiService = require('../services/ai.service');
const adminController = require('../controller/admin.controller');

describe('System Events & Application Health Dashboard Test Suite', () => {
    let mockQueueCountsSpy;
    let mockRedisClientSpy;
    let mockAiWorkerSpy;

    beforeEach(() => {
        _clearHealthCacheForTesting();
        jest.clearAllMocks();

        // Safe global mocks to prevent real network connections in unit tests
        mockQueueCountsSpy = jest.spyOn(aiQueueModule.aiQueue, 'getJobCounts').mockResolvedValue({
            waiting: 0,
            active: 0,
            completed: 10,
            failed: 0,
            delayed: 0
        });

        mockRedisClientSpy = jest.spyOn(redisConfig, 'getRedisClient').mockReturnValue({
            status: 'ready',
            ping: jest.fn().mockResolvedValue('PONG')
        });

        mockAiWorkerSpy = jest.spyOn(aiWorkerModule, 'getAiWorker').mockReturnValue({
            isRunning: () => true,
            isClosed: () => false
        });
    });

    afterEach(() => {
        mockQueueCountsSpy.mockRestore();
        mockRedisClientSpy.mockRestore();
        mockAiWorkerSpy.mockRestore();
    });

    describe('1. MongoDB Health Probe', () => {
        test('returns healthy when connected with low latency', async () => {
            const originalReadyState = mongoose.connection.readyState;
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

            const mockPing = jest.fn().mockResolvedValue({ ok: 1 });
            const originalDb = mongoose.connection.db;
            mongoose.connection.db = { admin: () => ({ ping: mockPing }) };

            const res = await checkMongoHealth();
            expect(res.status).toBe('healthy');
            expect(res.connectionState).toBe('connected');
            expect(typeof res.latencyMs).toBe('number');

            Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
            mongoose.connection.db = originalDb;
        });

        test('returns unavailable when MongoDB is disconnected', async () => {
            const originalReadyState = mongoose.connection.readyState;
            Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

            const res = await checkMongoHealth();
            expect(res.status).toBe('unavailable');
            expect(res.connectionState).toBe('disconnected');

            Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
        });
    });

    describe('2. Redis Health Probe', () => {
        test('returns healthy when Redis client responds to ping', async () => {
            const res = await checkRedisHealth();
            expect(res.status).toBe('healthy');
            expect(res.connectionState).toBe('connected');
            expect(typeof res.latencyMs).toBe('number');
        });

        test('returns degraded with fallback notice when Redis is offline or throws', async () => {
            mockRedisClientSpy.mockReturnValue({
                status: 'close',
                ping: jest.fn().mockRejectedValue(new Error('Connection lost'))
            });

            const res = await checkRedisHealth();
            expect(res.status).toBe('degraded');
            expect(res.message).toMatch(/fallback|offline/i);
        });
    });

    describe('3. BullMQ Queue & Worker Probe', () => {
        test('returns healthy when worker is active and queue depth is normal', async () => {
            mockQueueCountsSpy.mockResolvedValue({
                waiting: 2,
                active: 1,
                completed: 50,
                failed: 0,
                delayed: 0
            });

            const res = await checkBullMQHealth();
            expect(res.status).toBe('healthy');
            expect(res.isWorkerRunning).toBe(true);
            expect(res.totalBacklog).toBe(3);
        });

        test('returns degraded when jobs are waiting but worker is not running', async () => {
            mockQueueCountsSpy.mockResolvedValue({
                waiting: 15,
                active: 0,
                completed: 20,
                failed: 2,
                delayed: 0
            });

            mockAiWorkerSpy.mockReturnValue({
                isRunning: () => false,
                isClosed: () => true
            });

            const res = await checkBullMQHealth();
            expect(res.status).toBe('degraded');
            expect(res.isWorkerRunning).toBe(false);
        });
    });

    describe('4. AI Cluster Health Probe', () => {
        test('returns healthy when primary AI provider is online', async () => {
            jest.spyOn(aiService, 'getAIStatus').mockReturnValue({
                status: 'online',
                provider: 'Groq AI',
                primaryModel: 'Tier-Based Model',
                fallbackModel: 'Gemini 2.5 Flash',
                label: 'AI Cluster Online'
            });

            const res = await checkAIHealth();
            expect(res.status).toBe('healthy');
            expect(res.currentProvider).toBe('Groq AI');

            aiService.getAIStatus.mockRestore();
        });
    });

    describe('5. Backend Process Health Probe', () => {
        test('returns runtime metrics without exposing internal secrets', () => {
            const res = checkProcessHealth();
            expect(res.status).toBe('healthy');
            expect(typeof res.uptimeSeconds).toBe('number');
            expect(res.nodeVersion).toBe(process.version);
            expect(res.memory).toHaveProperty('heapUsedMB');
            expect(res.memory).toHaveProperty('heapTotalMB');
            expect(res.memory).toHaveProperty('rssMB');

            // Strictly zero secrets or connection strings
            const strOutput = JSON.stringify(res);
            expect(strOutput).not.toMatch(/mongodb\+srv|password|jwt_secret|groq_key/i);
        });
    });

    describe('6. 15-Second In-Memory Caching & Overall Health', () => {
        test('serves cached health report within 15 seconds, and bypasses with forceLive', async () => {
            const originalReadyState = mongoose.connection.readyState;
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
            const originalDb = mongoose.connection.db;
            mongoose.connection.db = { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) };

            const mockSystemEventSpy = jest.spyOn(SystemEvent, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            });

            const report1 = await getSystemHealth();
            expect(report1.cached).toBe(false);

            // Second call within TTL should be served from memory cache
            const report2 = await getSystemHealth();
            expect(report2.cached).toBe(true);

            // Force live should bypass cache
            const report3 = await getSystemHealth({ forceLive: true });
            expect(report3.cached).toBe(false);

            mockSystemEventSpy.mockRestore();
            Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
            mongoose.connection.db = originalDb;
        });
    });

    describe('7. Admin System Events Controller', () => {
        test('getAdminSystemEventsController supports category, severity, date filters, and metrics', async () => {
            const req = {
                query: {
                    category: 'SECURITY',
                    severity: 'ERROR',
                    search: 'password',
                    startDate: '2026-11-01',
                    endDate: '2026-11-08',
                    page: 1,
                    limit: 10
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const mockEvents = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    eventType: 'SECURITY_ACCOUNT_LOCKED',
                    category: 'SECURITY',
                    severity: 'ERROR',
                    traceId: 'trace-12345',
                    details: { message: 'Too many failed password attempts' },
                    createdAt: new Date()
                }
            ];

            const findSpy = jest.spyOn(SystemEvent, 'find').mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockEvents)
            });

            const countSpy = jest.spyOn(SystemEvent, 'countDocuments').mockResolvedValue(1);
            const aggSpy = jest.spyOn(SystemEvent, 'aggregate')
                .mockResolvedValueOnce([{ _id: 'SECURITY', count: 1 }]) // categories
                .mockResolvedValueOnce([{ _id: 'ERROR', count: 1 }]); // severities

            await adminController.getAdminSystemEventsController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: mockEvents,
                metrics: expect.objectContaining({
                    categories: { SECURITY: 1 },
                    severities: { ERROR: 1 }
                }),
                pagination: expect.objectContaining({
                    total: 1,
                    page: 1
                })
            }));

            // Verify filter query received category, severity, and date range
            expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
                category: 'SECURITY',
                severity: 'ERROR',
                createdAt: expect.objectContaining({
                    $gte: expect.any(Date),
                    $lte: expect.any(Date)
                }),
                $or: expect.any(Array)
            }));

            findSpy.mockRestore();
            countSpy.mockRestore();
            aggSpy.mockRestore();
        });
    });

    describe('8. Admin System Health Controller', () => {
        test('getAdminSystemHealthController returns 200 with structured health report', async () => {
            const req = { query: { refresh: 'true' } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const originalReadyState = mongoose.connection.readyState;
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
            const originalDb = mongoose.connection.db;
            mongoose.connection.db = { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) };

            const mockSystemEventSpy = jest.spyOn(SystemEvent, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            });

            await adminController.getAdminSystemHealthController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    overallStatus: expect.stringMatching(/healthy|degraded|unavailable/),
                    services: expect.objectContaining({
                        backend: expect.any(Object),
                        mongodb: expect.any(Object),
                        redis: expect.any(Object),
                        bullmq: expect.any(Object),
                        ai: expect.any(Object)
                    })
                })
            }));

            mockSystemEventSpy.mockRestore();
            Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
            mongoose.connection.db = originalDb;
        });
    });
});
