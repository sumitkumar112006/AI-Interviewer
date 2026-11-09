/**
 * userAgent.js — Lightweight, Safe Client Device & Browser Parser
 *
 * Implements:
 * 1. Safe parsing of standard HTTP User-Agent headers.
 * 2. Basic device categorization (desktop, mobile, tablet).
 * 3. Browser and OS classification without invasive hardware fingerprinting.
 */

'use strict';

/**
 * Parse a raw User-Agent header string into a safe, normalized device descriptor
 * @param {string} [uaString=''] - Raw req.headers['user-agent']
 * @returns {{ browser: string, os: string, deviceType: string, sanitizedUa: string }}
 */
function parseUserAgent(uaString = '') {
    if (!uaString || typeof uaString !== 'string') {
        return {
            browser: 'Unknown Browser',
            os: 'Unknown OS',
            deviceType: 'unknown',
            sanitizedUa: 'Unknown'
        };
    }

    const ua = uaString.trim();

    // 1. Detect Device Type
    let deviceType = 'desktop';
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
        deviceType = 'tablet';
    } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
        deviceType = 'mobile';
    }

    // 2. Detect Operating System
    let os = 'Unknown OS';
    if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
    else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1';
    else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/cros/i.test(ua)) os = 'ChromeOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    // 3. Detect Browser Name
    let browser = 'Unknown Browser';
    if (/edg\/|edge\//i.test(ua)) browser = 'Microsoft Edge';
    else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
    else if (/brave/i.test(ua)) browser = 'Brave';
    else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
    else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Apple Safari';
    else if (/postman/i.test(ua)) browser = 'Postman API Client';
    else if (/curl/i.test(ua)) browser = 'cURL';

    return {
        browser,
        os,
        deviceType,
        sanitizedUa: ua.slice(0, 255)
    };
}

/**
 * Mask an IP address for privacy when rendered to non-admin or standard user views.
 * Examples:
 *   192.168.1.100 -> 192.168.***.***
 *   2001:0db8:85a3:0000:0000:8a2e:0370:7334 -> 2001:db8:****:****
 */
function maskIpAddress(ip) {
    if (!ip || typeof ip !== 'string') return '***.***.***.***';
    const cleanIp = ip.trim();

    // IPv4
    if (cleanIp.includes('.')) {
        const parts = cleanIp.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.***.***`;
        }
    }

    // IPv6
    if (cleanIp.includes(':')) {
        const parts = cleanIp.split(':');
        if (parts.length >= 4) {
            return `${parts[0]}:${parts[1]}:****:****`;
        }
    }

    return '***.***.***.***';
}

module.exports = {
    parseUserAgent,
    maskIpAddress
};

