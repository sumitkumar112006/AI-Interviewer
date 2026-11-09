/**
 * semver.js — Pure, Resilient Client-Side Semantic Version Parser & Comparator
 *
 * Implements:
 * 1. Safe parsing of SemVer strings (1.2.3, v1.2.3, 1.2, 1.2.3-beta.1).
 * 2. Deterministic comparison without external dependencies.
 * 3. Safe fallback logic to prevent accidental user lockout on malformed version values.
 */

export function parseSemVer(versionStr) {
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

export function isValidSemVer(versionStr) {
    return parseSemVer(versionStr) !== null;
}

export function compareSemVer(v1, v2) {
    const p1 = parseSemVer(v1);
    const p2 = parseSemVer(v2);

    if (!p1 || !p2) {
        return 0; // Safe fallback: treat as equal if unparseable to avoid lockout
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

