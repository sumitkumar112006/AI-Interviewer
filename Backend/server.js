require('dotenv').config();
// Initialize OpenTelemetry SDK before Express, Mongoose, ioredis, or any other application modules are imported
require('./src/instrumentation');
const app = require('./src/app');
const connectToDB = require('./src/config/database');
const { connectToRedis } = require('./src/config/redis');
const { initAiWorker } = require('./src/jobs/aiWorker');
const reconciliationService = require('./src/services/reconciliation.service');
const { logger } = require('./src/telemetry/logger');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await connectToDB();
        connectToRedis();   // Connect Redis (Railway / local)

        // Initialize BullMQ background worker for decoupled AI jobs
        initAiWorker();

        // Start payment background jobs (Order expiry & Missed webhook reconciliation)
        reconciliationService.startBackgroundCron();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            logger.info('telemetry.log_test', { source: 'startup', service: 'kivi-backend' });
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
}

startServer();
