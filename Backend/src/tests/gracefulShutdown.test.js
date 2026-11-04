'use strict';

const { setupGracefulShutdown } = require('../utils/gracefulShutdown');
const reconciliationService = require('../services/reconciliation.service');
const { closeAiWorker, getAiWorker } = require('../jobs/aiWorker');
const { closeRedis } = require('../config/redis');
const { closeDB } = require('../config/database');

describe('Graceful Shutdown Tests', () => {
    let originalExit;

    beforeEach(() => {
        originalExit = process.exit;
        process.exit = jest.fn();
    });

    afterEach(() => {
        process.exit = originalExit;
        reconciliationService.stopBackgroundCron();
        jest.clearAllMocks();
    });

    test('executes clean shutdown in correct order across all components', async () => {
        const callOrder = [];

        const mockServer = {
            closeIdleConnections: jest.fn(() => {
                callOrder.push('server.closeIdleConnections');
            }),
            close: jest.fn((cb) => {
                callOrder.push('server.close');
                cb();
            })
        };

        const mockReconciliationService = {
            stopBackgroundCron: jest.fn(() => {
                callOrder.push('reconciliation.stopBackgroundCron');
            })
        };

        const mockCloseAiWorker = jest.fn(async (force) => {
            callOrder.push(`worker.close(${force})`);
        });

        const mockCloseAiQueue = jest.fn(async () => {
            callOrder.push('queue.close');
        });

        const mockCloseRedis = jest.fn(async () => {
            callOrder.push('redis.close');
        });

        const mockCloseDB = jest.fn(async (force) => {
            callOrder.push(`db.close(${force})`);
        });

        const shutdownHandler = setupGracefulShutdown({
            server: mockServer,
            reconciliationService: mockReconciliationService,
            closeAiWorker: mockCloseAiWorker,
            closeAiQueue: mockCloseAiQueue,
            closeRedis: mockCloseRedis,
            closeDB: mockCloseDB,
            timeoutMs: 5000,
            registerSignalHandlers: false,
            exitProcess: false
        });

        expect(shutdownHandler.isShuttingDown()).toBe(false);

        await shutdownHandler.shutdown('SIGTERM');

        expect(shutdownHandler.isShuttingDown()).toBe(true);
        expect(mockServer.closeIdleConnections).toHaveBeenCalled();
        expect(mockServer.close).toHaveBeenCalled();
        expect(mockReconciliationService.stopBackgroundCron).toHaveBeenCalled();
        expect(mockCloseAiWorker).toHaveBeenCalledWith(false);
        expect(mockCloseAiQueue).toHaveBeenCalled();
        expect(mockCloseRedis).toHaveBeenCalled();
        expect(mockCloseDB).toHaveBeenCalledWith(false);

        // Verify logical order: HTTP closed first, then cron, then worker, then queue, then redis, then db
        expect(callOrder).toEqual([
            'server.closeIdleConnections',
            'server.close',
            'reconciliation.stopBackgroundCron',
            'worker.close(false)',
            'queue.close',
            'redis.close',
            'db.close(false)'
        ]);
    });

    test('prevents duplicate shutdown runs and returns same promise', async () => {
        let closeCount = 0;
        const mockCloseAiWorker = jest.fn(async () => {
            closeCount++;
            await new Promise((r) => setTimeout(r, 20));
        });

        const shutdownHandler = setupGracefulShutdown({
            closeAiWorker: mockCloseAiWorker,
            timeoutMs: 5000,
            registerSignalHandlers: false,
            exitProcess: false
        });

        const promise1 = shutdownHandler.shutdown('SIGTERM');
        const promise2 = shutdownHandler.shutdown('SIGINT');

        expect(promise1).toBe(promise2);
        await Promise.all([promise1, promise2]);

        expect(closeCount).toBe(1);
    });

    test('resilient execution: continues subsequent steps if one step errors', async () => {
        const mockCloseAiWorker = jest.fn(async () => {
            throw new Error('BullMQ worker failed to close cleanly');
        });
        const mockCloseRedis = jest.fn(async () => {
            throw new Error('Redis connection already dropped');
        });
        const mockCloseDB = jest.fn(async () => {});

        const shutdownHandler = setupGracefulShutdown({
            closeAiWorker: mockCloseAiWorker,
            closeRedis: mockCloseRedis,
            closeDB: mockCloseDB,
            timeoutMs: 5000,
            registerSignalHandlers: false,
            exitProcess: false
        });

        await expect(shutdownHandler.shutdown('SIGTERM')).resolves.not.toThrow();

        expect(mockCloseAiWorker).toHaveBeenCalled();
        expect(mockCloseRedis).toHaveBeenCalled();
        expect(mockCloseDB).toHaveBeenCalled();
    });

    test('forces process exit when shutdown timeout is exceeded', async () => {
        jest.useFakeTimers();

        let exitCalled = false;
        process.exit = jest.fn(() => {
            exitCalled = true;
        });

        let resolveWorker;
        const hangingWorker = jest.fn(() => new Promise((resolve) => {
            resolveWorker = resolve;
        }));

        const shutdownPromise = setupGracefulShutdown({
            closeAiWorker: hangingWorker,
            timeoutMs: 500,
            registerSignalHandlers: false,
            exitProcess: true
        }).shutdown('SIGTERM');

        expect(process.exit).not.toHaveBeenCalled();

        // Advance timer past the 500ms timeout
        jest.advanceTimersByTime(501);

        expect(process.exit).toHaveBeenCalledWith(1);

        // Cleanup pending hanging promise
        resolveWorker();
        jest.useRealTimers();
        await shutdownPromise.catch(() => {});
    });

    test('reconciliationService start/stop idempotency', () => {
        reconciliationService.startBackgroundCron();
        expect(reconciliationService.orderExpiryInterval).toBeDefined();
        expect(reconciliationService.reconciliationInterval).toBeDefined();

        const firstExpiryInterval = reconciliationService.orderExpiryInterval;
        reconciliationService.startBackgroundCron(); // Should not create duplicate intervals
        expect(reconciliationService.orderExpiryInterval).toBe(firstExpiryInterval);

        reconciliationService.stopBackgroundCron();
        expect(reconciliationService.orderExpiryInterval).toBeNull();
        expect(reconciliationService.reconciliationInterval).toBeNull();

        // Second stop should be safe
        expect(() => reconciliationService.stopBackgroundCron()).not.toThrow();
    });

    test('module close helpers operate safely when uninitialized', async () => {
        await expect(closeAiWorker()).resolves.not.toThrow();
        expect(getAiWorker()).toBeNull();
        await expect(closeRedis()).resolves.not.toThrow();
        await expect(closeDB()).resolves.not.toThrow();
    });
});
