'use strict';

const { logger } = require('../telemetry/logger');

/**
 * Production-ready Graceful Shutdown Coordinator for KIVI API and BullMQ worker.
 *
 * Sequence:
 * 1. Stop receiving new HTTP traffic (server.close & server.closeIdleConnections)
 * 2. Stop recurring background timers (order expiry & reconciliation cron)
 * 3. Stop accepting new BullMQ jobs & wait for active jobs to finish
 * 4. Close BullMQ queue connections
 * 5. Close primary Redis connection
 * 6. Close MongoDB connection pool
 * 7. Force exit if timeout is exceeded
 *
 * @param {object} options
 * @param {import('http').Server} [options.server]
 * @param {Function} [options.closeAiWorker]
 * @param {Function} [options.closeAiQueue]
 * @param {object} [options.reconciliationService]
 * @param {Function} [options.closeRedis]
 * @param {Function} [options.closeDB]
 * @param {number} [options.timeoutMs]
 * @param {boolean} [options.registerSignalHandlers]
 * @param {boolean} [options.exitProcess]
 * @param {Function} [options.onShutdownComplete]
 * @returns {object} { shutdown, isShuttingDown: () => boolean }
 */
function setupGracefulShutdown(options = {}) {
    const {
        server = null,
        closeAiWorker = null,
        closeAiQueue = null,
        reconciliationService = null,
        closeRedis = null,
        closeDB = null,
        timeoutMs = parseInt(process.env.SHUTDOWN_TIMEOUT_MS, 10) || 10000,
        registerSignalHandlers = true,
        exitProcess = true,
        onShutdownComplete = null
    } = options;

    let isShuttingDown = false;
    let shutdownPromise = null;
    let sigintCount = 0;

    async function executeShutdown(signal = 'MANUAL') {
        if (isShuttingDown && shutdownPromise) {
            return shutdownPromise;
        }
        isShuttingDown = true;

        logger.info(`[Shutdown] Initiating graceful shutdown (signal: ${signal}, timeout: ${timeoutMs}ms)...`);

        // Watchdog timer: force exit if any component hangs
        let forceExitTimer = null;
        if (timeoutMs > 0) {
            forceExitTimer = setTimeout(() => {
                logger.error(`[Shutdown] Graceful shutdown timed out after ${timeoutMs}ms. Forcing process termination.`);
                if (exitProcess) {
                    process.exit(1);
                }
            }, timeoutMs);

            if (typeof forceExitTimer.unref === 'function') {
                forceExitTimer.unref();
            }
        }

        try {
            // 1. Stop accepting new HTTP requests
            if (server && typeof server.close === 'function') {
                logger.info('[Shutdown] Closing HTTP server and rejecting new incoming connections...');
                await new Promise((resolve) => {
                    // Close idle keep-alive connections (Node 18.2+)
                    if (typeof server.closeIdleConnections === 'function') {
                        try {
                            server.closeIdleConnections();
                        } catch (idleErr) {
                            logger.warn('[Shutdown] Failed closing idle connections', { error: idleErr.message });
                        }
                    }

                    server.close((err) => {
                        if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
                            logger.error('[Shutdown] Error while closing HTTP server', { error: err.message });
                        } else {
                            logger.info('[Shutdown] HTTP server closed cleanly');
                        }
                        resolve();
                    });
                });
            }

            // 2. Stop recurring background cron services
            if (reconciliationService && typeof reconciliationService.stopBackgroundCron === 'function') {
                logger.info('[Shutdown] Stopping background payment reconciliation and order expiry cron...');
                try {
                    reconciliationService.stopBackgroundCron();
                    logger.info('[Shutdown] Background cron services stopped');
                } catch (cronErr) {
                    logger.error('[Shutdown] Error stopping background cron service', { error: cronErr.message });
                }
            }

            // 3. Stop accepting new BullMQ jobs & allow active jobs to finish
            if (typeof closeAiWorker === 'function') {
                logger.info('[Shutdown] Closing BullMQ worker and waiting for in-flight jobs to complete...');
                try {
                    await closeAiWorker(false);
                    logger.info('[Shutdown] BullMQ worker closed cleanly');
                } catch (workerErr) {
                    logger.error('[Shutdown] Error closing BullMQ worker', { error: workerErr.message });
                }
            }

            // 4. Close BullMQ queue connections
            if (typeof closeAiQueue === 'function') {
                logger.info('[Shutdown] Closing BullMQ queue connections...');
                try {
                    await closeAiQueue();
                    logger.info('[Shutdown] BullMQ queue connections closed');
                } catch (queueErr) {
                    logger.error('[Shutdown] Error closing BullMQ queue', { error: queueErr.message });
                }
            }

            // 5. Close application Redis connection
            if (typeof closeRedis === 'function') {
                logger.info('[Shutdown] Closing primary Redis connection...');
                try {
                    await closeRedis();
                    logger.info('[Shutdown] Redis connection closed');
                } catch (redisErr) {
                    logger.error('[Shutdown] Error closing Redis connection', { error: redisErr.message });
                }
            }

            // 6. Close MongoDB connection pool
            if (typeof closeDB === 'function') {
                logger.info('[Shutdown] Closing MongoDB connection pool...');
                try {
                    await closeDB(false);
                    logger.info('[Shutdown] MongoDB connection closed');
                } catch (dbErr) {
                    logger.error('[Shutdown] Error closing MongoDB connection', { error: dbErr.message });
                }
            }

            if (forceExitTimer) {
                clearTimeout(forceExitTimer);
            }

            logger.info('[Shutdown] All services stopped. Graceful shutdown complete.');

            if (typeof onShutdownComplete === 'function') {
                await onShutdownComplete();
            }

            if (exitProcess) {
                process.exit(0);
            }
        } catch (fatalErr) {
            if (forceExitTimer) {
                clearTimeout(forceExitTimer);
            }
            logger.error('[Shutdown] Uncaught exception during graceful shutdown', {
                error: fatalErr.message,
                stack: fatalErr.stack
            });
            if (exitProcess) {
                process.exit(1);
            }
            throw fatalErr;
        }
    }

    function handleSignal(signal) {
        if (signal === 'SIGINT') {
            sigintCount++;
            if (sigintCount > 1) {
                logger.warn('[Shutdown] Received second SIGINT (Ctrl+C). Forcing immediate termination.');
                if (exitProcess) {
                    process.exit(1);
                }
                return;
            }
        }

        if (isShuttingDown) {
            logger.warn(`[Shutdown] Received ${signal} while shutdown is already in progress. Ignoring.`);
            return shutdownPromise;
        }

        shutdownPromise = executeShutdown(signal);
        return shutdownPromise;
    }

    if (registerSignalHandlers) {
        process.once('SIGTERM', () => handleSignal('SIGTERM'));
        process.on('SIGINT', () => handleSignal('SIGINT'));
    }

    return {
        shutdown: (signal) => {
            if (!shutdownPromise) {
                shutdownPromise = executeShutdown(signal || 'MANUAL');
            }
            return shutdownPromise;
        },
        isShuttingDown: () => isShuttingDown
    };
}

module.exports = {
    setupGracefulShutdown
};

