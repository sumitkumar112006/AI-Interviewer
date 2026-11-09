/**
 * config.route.js — Public Application Configuration Route
 *
 * Implements:
 * - GET /api/config/version: Public, non-sensitive configuration endpoint.
 *   Returns current version, minimum supported version, latest recommended version,
 *   force update flag, update announcement, update URL, and public maintenance status.
 *   Strictly filters out internal infrastructure details, admin IPs, and secrets.
 */

'use strict';

const express = require('express');
const router = express.Router();
const appSettingsService = require('../services/appSettings.service');

/**
 * @route GET /api/config/version
 * @description Retrieve public version control and maintenance configuration
 * @access Public
 */
router.get('/version', async (req, res) => {
    try {
        const publicConfig = await appSettingsService.getPublicAppConfig();
        return res.status(200).json(publicConfig);
    } catch (err) {
        console.error('[CONFIG_ROUTE] Error fetching public app configuration:', err.message);
        // Safe, non-blocking fallback in case database is down
        return res.status(200).json({
            success: true,
            versionControl: {
                currentVersion: '1.0.0',
                minimumSupportedVersion: '1.0.0',
                latestRecommendedVersion: '1.0.0',
                mandatoryUpdate: false,
                updateAnnouncement: {
                    title: '',
                    message: ''
                },
                updateUrl: ''
            },
            maintenanceMode: {
                enabled: false,
                message: ''
            }
        });
    }
});

module.exports = router;

