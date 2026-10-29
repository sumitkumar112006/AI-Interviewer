/**
 * URL Utilities for ATS Resume Link Extraction
 * Provides normalization, deduplication, junk-link filtering, and URL un-shortening.
 *
 * Supports both ES module imports (`import { normalizeUrl } ...`)
 * and CommonJS requires (`const { normalizeUrl } = require(...)`).
 */

// List of known URL shortening hostnames
const SHORTENER_HOSTS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'buff.ly',
  'is.gd',
  'cutt.ly',
  'rebrand.ly',
  'shorturl.at',
  'tiny.cc',
  'lnkd.in'
]);

// Trailing punctuation characters commonly attached to URLs in plain text or resumes
const TRAILING_PUNCTUATION_REGEX = /[.,;:!?'")>\]}]+$/;

// Junk protocols and anchor fragments
const JUNK_PROTOCOLS = ['javascript:', 'vbscript:', 'data:', 'file:', 'about:blank'];

/**
 * Checks if a string or URL represents a junk link (e.g. javascript:, empty, or lone anchor).
 * @param {string} url
 * @returns {boolean}
 */
function isJunkLink(url) {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#' || trimmed === '/' || trimmed.toLowerCase().startsWith('javascript:')) {
    return true;
  }
  const lower = trimmed.toLowerCase();
  for (const junk of JUNK_PROTOCOLS) {
    if (lower.startsWith(junk)) return true;
  }
  return false;
}

/**
 * Normalizes a URL:
 * - Trims whitespace and strips surrounding quotes/parentheses.
 * - Strips trailing punctuation (e.g. sentence-ending dots or commas).
 * - Handles mailto: and tel: schemes cleanly.
 * - Adds https:// scheme if missing for web URLs.
 * - Lowercases hostname and removes "www.".
 * - Strips trailing slash from pathname.
 * - Removes default ports (:80, :443).
 *
 * @param {string} rawUrl
 * @returns {string|null} Normalized URL or null if invalid/junk.
 */
function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let url = rawUrl.trim();

  // Strip leading/trailing quotes, angle brackets, or matching parentheses
  url = url.replace(/^["'<(\[]+|[>"')\]]+$/g, '').trim();

  if (isJunkLink(url)) return null;

  // Handle mailto: links
  if (url.toLowerCase().startsWith('mailto:')) {
    const emailPart = url.slice(7).trim().replace(TRAILING_PUNCTUATION_REGEX, '').trim();
    if (!emailPart || !emailPart.includes('@')) return null;
    return `mailto:${emailPart.toLowerCase()}`;
  }

  // Handle tel: links
  if (url.toLowerCase().startsWith('tel:')) {
    const phonePart = url.slice(4).trim().replace(TRAILING_PUNCTUATION_REGEX, '').trim();
    if (!phonePart) return null;
    return `tel:${phonePart}`;
  }

  // Check if it's a bare email address written in text
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(url)) {
    return `mailto:${url.toLowerCase()}`;
  }

  // Check if it's a bare phone number with tel protocol intention
  if (/^\+?[0-9\s().-]{7,25}$/.test(url) && /[0-9]{7,}/.test(url.replace(/\D/g, ''))) {
    const digits = url.replace(/[^\d+]/g, '');
    return `tel:${digits}`;
  }

  // Strip trailing punctuation from standard URLs
  url = url.replace(TRAILING_PUNCTUATION_REGEX, '').trim();
  if (!url) return null;

  // If no scheme is present, default to https://
  let hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(url);
  if (!hasScheme) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);

    // Only allow http and https protocols for web links
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    // Lowercase host and strip leading www.
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    parsed.hostname = host;

    // Normalize protocol to https for standard web URLs
    parsed.protocol = 'https:';

    // Remove default ports
    if (parsed.port === '80' || parsed.port === '443') {
      parsed.port = '';
    }

    // Remove multiple consecutive slashes in pathname and remove trailing slash
    let pathname = parsed.pathname.replace(/\/+/g, '/');
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    // If pathname is just root "/", omit it in canonical representation if no search/hash
    if (pathname === '/') {
      pathname = '';
    }
    parsed.pathname = pathname;

    // Return stringified URL (remove trailing slash if parsed.href ends with / and pathname was empty)
    let finalUrl = parsed.toString();
    if (!parsed.search && !parsed.hash && finalUrl.endsWith('/')) {
      finalUrl = finalUrl.slice(0, -1);
    }

    return finalUrl;
  } catch {
    return null;
  }
}

/**
 * Generates a canonical deduplication key for a normalized URL.
 * Two URLs that point to the same resource should return the identical key.
 * E.g., "https://github.com/user" and "http://www.github.com/user/" -> "github.com/user"
 *
 * @param {string} url
 * @returns {string} Deduplication key
 */
function getDedupeKey(url) {
  if (!url) return '';
  const normalized = normalizeUrl(url);
  if (!normalized) return '';

  if (normalized.startsWith('mailto:')) {
    return normalized.toLowerCase();
  }

  if (normalized.startsWith('tel:')) {
    const digitsOnly = normalized.replace(/[^\d+]/g, '');
    return `tel:${digitsOnly}`;
  }

  try {
    const parsed = new URL(normalized);
    let host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let pathname = parsed.pathname.replace(/\/+/g, '/');
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    if (pathname === '/') pathname = '';

    return `${host}${pathname}${parsed.search ? parsed.search : ''}${parsed.hash ? parsed.hash : ''}`;
  } catch {
    return normalized.toLowerCase();
  }
}

/**
 * Checks if a given URL is hosted on a known URL shortening service.
 * @param {string} url
 * @returns {boolean}
 */
function isShortenedUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(normalizeUrl(url) || url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return SHORTENER_HOSTS.has(host);
  } catch {
    return false;
  }
}

/**
 * Resolves a shortened URL using fetch with HEAD and redirect following.
 * Has a strict timeout and try/catch so it never crashes parsing.
 *
 * @param {string} url
 * @param {number} [timeoutMs=3000]
 * @returns {Promise<string>} Resolved URL or original URL if resolution fails/times out.
 */
async function resolveShortUrl(url, timeoutMs = 3000) {
  if (!url || !isShortenedUrl(url)) return url;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timer);

    if (response && response.url && response.url !== url) {
      return normalizeUrl(response.url) || response.url;
    }
  } catch {
    // Graceful fallback on network timeout, DNS failure, or offline mode
  }

  return url;
}

/**
 * Merges and deduplicates an array of raw link objects.
 * Prioritizes:
 * - Annotation source over text source (annotations have actual user-embedded links)
 * - Non-empty descriptive anchor text over raw URL text
 * - Retains page number if present
 *
 * @param {Array<{ url: string, text?: string, source?: string, page?: number, type?: string }>} links
 * @returns {Array<{ url: string, text: string, source: string, page?: number, type?: string }>}
 */
function dedupeLinks(links) {
  if (!Array.isArray(links)) return [];

  const map = new Map();

  for (const item of links) {
    if (!item || !item.url) continue;

    const normalizedUrl = normalizeUrl(item.url);
    if (!normalizedUrl || isJunkLink(normalizedUrl)) continue;

    const key = getDedupeKey(normalizedUrl);
    if (!key) continue;

    const text = (item.text || '').trim();
    const source = item.source === 'annotation' ? 'annotation' : 'text';
    const page = item.page;

    if (!map.has(key)) {
      map.set(key, {
        url: normalizedUrl,
        text,
        source,
        ...(page !== undefined ? { page } : {}),
        ...(item.type ? { type: item.type } : {})
      });
    } else {
      const existing = map.get(key);

      // Upgrade to annotation source if current is annotation
      if (source === 'annotation' && existing.source !== 'annotation') {
        existing.source = 'annotation';
      }

      // Upgrade anchor text if existing text is empty or is just the URL itself
      const existingIsUrl = existing.text === existing.url || existing.text.startsWith('http');
      const currentIsMeaningful = text && text !== normalizedUrl && !text.startsWith('http');

      if ((!existing.text || existingIsUrl) && currentIsMeaningful) {
        existing.text = text;
      } else if (!existing.text && text) {
        existing.text = text;
      }

      // Preserve page number if existing doesn't have it
      if (existing.page === undefined && page !== undefined) {
        existing.page = page;
      }
    }
  }

  return Array.from(map.values());
}

// Named exports for ES Module static analysis
exports.isJunkLink = isJunkLink;
exports.normalizeUrl = normalizeUrl;
exports.getDedupeKey = getDedupeKey;
exports.isShortenedUrl = isShortenedUrl;
exports.resolveShortUrl = resolveShortUrl;
exports.dedupeLinks = dedupeLinks;

// Object export for CommonJS destructuring
module.exports = {
  isJunkLink,
  normalizeUrl,
  getDedupeKey,
  isShortenedUrl,
  resolveShortUrl,
  dedupeLinks
};
