/**
 * version.config.js — Client Application Version Specification
 */

import { compareSemVer, isValidSemVer } from '../utils/semver';

// The currently running client version
export const CLIENT_APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

/**
 * Check if the running client must be blocked by mandatory force update
 */
export function isMandatoryUpdateRequired(clientVer, minimumVer, mandatoryUpdateEnabled) {
    if (!mandatoryUpdateEnabled) return false;
    if (!clientVer || !minimumVer) return false;
    if (!isValidSemVer(clientVer) || !isValidSemVer(minimumVer)) return false;
    return compareSemVer(clientVer, minimumVer) < 0;
}

/**
 * Check if an optional (non-blocking) update is available
 */
export function isOptionalUpdateAvailable(clientVer, recommendedVer) {
    if (!clientVer || !recommendedVer) return false;
    if (!isValidSemVer(clientVer) || !isValidSemVer(recommendedVer)) return false;
    return compareSemVer(clientVer, recommendedVer) < 0;
}

