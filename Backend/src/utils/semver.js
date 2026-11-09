/**
 * semver.js — Pure, Resilient Semantic Version Parser & Comparator
 *
 * Implements:
 * 1. Safe parsing of SemVer strings (1.2.3, v1.2.3, 1.2, 1.2.3-beta.1).
 * 2. Deterministic comparison without external dependencies.
 * 3. Safe fallback logic to prevent accidental user lockout on malformed version values.
 */

'use strict';

/**
 * Parse version string into numeric components
 * @param {string} versionStr 
 * @returns {{ major: number, minor: number, patch: number, prerelease: string|null } | null}
 */
function parseSemVer(versionStr) {
    if (!versionStr || typeof versionStr !== 'string') {
        return null;
    }

    const clean = versionStr.trim().replace(/^v/i, '');
    const match = clean.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/);

    if (!match) {
        return null;
    }

    return {
        major: parseInt(match[1], 10),
        minor: match[2] !== undefined ? parseInt(match[2], 10) : 0,
        patch: match[3] !== undefined ? parseInt(match[3], 10) : 0,
        prerelease: match[4] || null
    };
}

/**
 * Validate whether a string is a valid SemVer
 * @param {string} versionStr 
 * @returns {boolean}
 */
function isValidSemVer(versionStr) {
    return parseSemVer(versionStr) !== null;
}

/**
 * Compare two version strings.
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 *
 * Safe Fallback: If either version is malformed, returns 0 to prevent accidental lockout.
 * @param {string} v1 
 * @param {string} v2 
 * @returns {number}
 */
function compareSemVer(v1, v2) {
    const p1 = parseSemVer(v1);
    const p2 = parseSemVer(v2);

    if (!p1 || !p2) {
        return 0;
    }

    if (p1.major !== p2.major) {
        return p1.major > p2.major ? 1 : -1;
    }
    if (p1.minor !== p2.minor) {
        return p1.minor > p2.minor ? 1 : -1;
    }
    if (p1.patch !== p2.patch) {
        return p1.patch > p2.patch ? 1 : -1;
    }

    // A version with prerelease is lower than a release version of the same numbers (e.g. 1.0.0-beta < 1.0.0)
    if (p1.prerelease && !p2.prerelease) {
        return -1;
    }
    if (!p1.prerelease && p2.prerelease) {
        return 1;
    }
    if (p1.prerelease && p2.prerelease) {
        return p1.prerelease.localeCompare(p2.prerelease);
    }

    return 0;
}

module.exports = {
    parseSemVer,
    isValidSemVer,
    compareSemVer
};

