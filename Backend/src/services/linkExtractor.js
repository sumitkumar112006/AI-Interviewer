/**
 * ATS Resume Link Extraction Service
 * Recovers hidden URLs from PDF link annotations and DOCX relationships,
 * extracts visible URLs from plain text, normalizes, dedupes, and classifies links.
 *
 * Supports both ES module imports (`import { parseResumeLinks } ...`)
 * and CommonJS requires (`const { parseResumeLinks } = require(...)`).
 */

const fs = require('fs');
const path = require('path');
let pdfjsLibInstance = null;
async function getPdfJsLib() {
  if (!pdfjsLibInstance) {
    try {
      pdfjsLibInstance = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } catch {
      pdfjsLibInstance = require('pdfjs-dist/legacy/build/pdf.mjs');
    }
  }
  return pdfjsLibInstance;
}

const mammoth = require('mammoth');
const cheerio = require('cheerio');
const {
  normalizeUrl,
  dedupeLinks,
  isJunkLink,
  isShortenedUrl,
  resolveShortUrl
} = require('../utils/urlUtils.js');

// Tolerance in points (~pixels) for matching PDF link annotation rects with text items
const RECT_TOLERANCE_PX = 2.0;

// Common tech keywords ending in .js, degrees, or abbreviations that are NOT web links
const FALSE_POSITIVE_TERMS = new Set([
  'react.js',
  'node.js',
  'next.js',
  'vue.js',
  'express.js',
  'three.js',
  'd3.js',
  'angular.js',
  'chart.js',
  'moment.js',
  'ember.js',
  'backbone.js',
  'electron.js',
  'nest.js',
  'nuxt.js',
  'gatsby.js',
  'b.tech',
  'm.tech',
  'b.e',
  'm.e',
  'b.sc',
  'm.sc',
  'b.com',
  'm.com',
  'b.a',
  'm.a',
  'ph.d',
  'phd',
  'e.g.',
  'i.e.',
  'etc.',
  'vs.'
]);

/**
 * Extracts hyperlinks and plain text from a PDF file using pdfjs-dist legacy build.
 * Inspects Link annotations on every page and recovers anchor text by matching annotation rects
 * against page text items with a ~2px tolerance.
 *
 * @param {string|Buffer|Uint8Array} filePathOrBuffer
 * @returns {Promise<{ links: Array<{ page: number, text: string, url: string, source: string }>, plainText: string, totalAnnotationsCount: number, numPages: number }>}
 */
async function extractPdfLinks(filePathOrBuffer) {
  let data;
  if (typeof filePathOrBuffer === 'string') {
    const fileBuffer = await fs.promises.readFile(filePathOrBuffer);
    data = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
  } else if (Buffer.isBuffer(filePathOrBuffer) || filePathOrBuffer instanceof Uint8Array) {
    data = new Uint8Array(filePathOrBuffer.buffer, filePathOrBuffer.byteOffset, filePathOrBuffer.byteLength);
  } else {
    data = new Uint8Array(filePathOrBuffer);
  }

  // Load document with pdfjs-dist legacy build
  const pdfjsLib = await getPdfJsLib();
  const loadingTask = pdfjsLib.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true
  });
  const doc = await loadingTask.promise;

  const links = [];
  const textChunks = [];
  let totalAnnotationsCount = 0;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const [annotations, textContent] = await Promise.all([
      page.getAnnotations(),
      page.getTextContent()
    ]);

    // Assemble page plain text
    const pageStrings = textContent.items
      .map(item => (item && typeof item.str === 'string' ? item.str : ''))
      .filter(Boolean);
    textChunks.push(pageStrings.join(' '));

    // Filter link annotations
    const linkAnnotations = (annotations || []).filter(
      annot => annot && annot.subtype === 'Link'
    );
    totalAnnotationsCount += linkAnnotations.length;

    for (const annot of linkAnnotations) {
      // Determine URL from annotation object
      let rawUrl = annot.url || annot.unsafeUrl;
      if (!rawUrl && annot.action === 'URI' && annot.uri) {
        rawUrl = annot.uri;
      }
      if (!rawUrl && typeof annot.dest === 'string') {
        rawUrl = annot.dest;
      }

      if (!rawUrl || isJunkLink(rawUrl)) continue;

      // Extract anchor text by matching annotation rect against text items
      let anchorText = '';
      if (Array.isArray(annot.rect) && annot.rect.length === 4) {
        const [rx1, ry1, rx2, ry2] = annot.rect;
        const rectMinX = Math.min(rx1, rx2) - RECT_TOLERANCE_PX;
        const rectMaxX = Math.max(rx1, rx2) + RECT_TOLERANCE_PX;
        const rectMinY = Math.min(ry1, ry2) - RECT_TOLERANCE_PX;
        const rectMaxY = Math.max(ry1, ry2) + RECT_TOLERANCE_PX;

        const matchedItems = [];

        for (const item of textContent.items) {
          if (!item || !item.str || !item.str.trim()) continue;
          const transform = item.transform || [0, 0, 0, 0, 0, 0];
          const tx = transform[4];
          const ty = transform[5];
          const width = item.width || 0;

          // Check if text item baseline falls within the annotation rect (with tolerance)
          // In PDF coordinates, ty is the text baseline.
          const xInRect = tx >= rectMinX && tx <= rectMaxX;
          const yInRect = ty >= rectMinY && ty <= rectMaxY;

          const itemRight = tx + width;
          const overlapX = Math.max(0, Math.min(rectMaxX, itemRight) - Math.max(rectMinX, tx));

          // Only associate items whose vertical baseline is truly on this line
          if (yInRect && (xInRect || overlapX > 0)) {
            matchedItems.push({
              str: item.str,
              x: tx,
              y: ty
            });
          }
        }

        if (matchedItems.length > 0) {
          // Sort items in reading order: top-to-bottom (higher Y in PDF coordinates), then left-to-right
          matchedItems.sort((a, b) => {
            const dy = Math.abs(a.y - b.y);
            if (dy > 3) {
              return b.y - a.y;
            }
            return a.x - b.x;
          });

          anchorText = matchedItems.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
        }
      }

      // Fallback for anchor text if rect matching found no text (e.g. icon/overlay)
      if (!anchorText) {
        anchorText = (annot.overlaidText || annot.contentsObj?.str || '').trim();
      }

      links.push({
        page: pageNum,
        text: anchorText,
        url: rawUrl.trim(),
        source: 'annotation'
      });
    }
  }

  return {
    links,
    plainText: textChunks.join('\n'),
    totalAnnotationsCount,
    numPages: doc.numPages
  };
}

/**
 * Extracts hyperlinks and plain text from a DOCX document using mammoth and cheerio.
 *
 * @param {string|Buffer} filePathOrBuffer
 * @returns {Promise<{ links: Array<{ text: string, url: string, source: string }>, plainText: string }>}
 */
async function extractDocxLinks(filePathOrBuffer) {
  const input = typeof filePathOrBuffer === 'string'
    ? { path: filePathOrBuffer }
    : { buffer: filePathOrBuffer };

  const [htmlResult, textResult] = await Promise.all([
    mammoth.convertToHtml(input),
    mammoth.extractRawText(input)
  ]);

  const $ = cheerio.load(htmlResult.value || '');
  const links = [];

  $('a').each((_, el) => {
    const rawUrl = $(el).attr('href');
    if (!rawUrl || isJunkLink(rawUrl)) return;

    const text = $(el).text().trim();
    links.push({
      text,
      url: rawUrl.trim(),
      source: 'annotation'
    });
  });

  return {
    links,
    plainText: textResult.value || ''
  };
}

/**
 * Runs regular expressions over plain text to find visible URLs, emails, and phone numbers.
 * Filters out programming keywords like 'React.js' and normalizes matches.
 *
 * @param {string} plainText
 * @returns {Array<{ text: string, url: string, source: 'text' }>}
 */
function extractTextUrls(plainText) {
  if (!plainText || typeof plainText !== 'string') return [];

  const foundLinks = [];
  const seenUrls = new Set();

  // 1. Full web URLs (with http:// or https://)
  const fullUrlRegex = /https?:\/\/[^\s<>"'{}|\\^`\[\]]+/gi;
  let match;
  while ((match = fullUrlRegex.exec(plainText)) !== null) {
    const rawMatch = match[0];
    const normalized = normalizeUrl(rawMatch);
    if (normalized && !seenUrls.has(normalized)) {
      seenUrls.add(normalized);
      foundLinks.push({
        text: rawMatch,
        url: normalized,
        source: 'text'
      });
    }
  }

  // 2. Scheme-less URLs (e.g. github.com/user, linkedin.com/in/user, leetcode.com/user, sumit.dev, etc.)
  const domainUrlRegex = /\b(?:(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|edu|gov|io|dev|me|ai|app|co|in|tech|site|online|vercel\.app|netlify\.app|github\.io|pages\.dev))(?:\/[^\s<>"'{}|\\^`\[\]]*)?/gi;
  const commonEmailDomains = new Set(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'protonmail.com']);

  while ((match = domainUrlRegex.exec(plainText)) !== null) {
    const rawMatch = match[0];
    const lowerMatch = rawMatch.toLowerCase();

    // Skip if preceded by @ (it's part of an email address handled below)
    if (match.index > 0 && plainText[match.index - 1] === '@') {
      continue;
    }

    // Skip false positives like React.js, Node.js, B.Tech, etc.
    if (FALSE_POSITIVE_TERMS.has(lowerMatch) || (lowerMatch.endsWith('.js') && !lowerMatch.includes('/'))) {
      continue;
    }

    // Skip bare email provider domains without path or www
    if (commonEmailDomains.has(lowerMatch) && !rawMatch.includes('/')) {
      continue;
    }

    const normalized = normalizeUrl(rawMatch);
    if (normalized && !seenUrls.has(normalized)) {
      seenUrls.add(normalized);
      foundLinks.push({
        text: rawMatch,
        url: normalized,
        source: 'text'
      });
    }
  }

  // 3. Email addresses written in text
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  while ((match = emailRegex.exec(plainText)) !== null) {
    const rawEmail = match[0];
    const mailto = `mailto:${rawEmail.toLowerCase()}`;
    if (!seenUrls.has(mailto)) {
      seenUrls.add(mailto);
      foundLinks.push({
        text: rawEmail,
        url: mailto,
        source: 'text'
      });
    }
  }

  // 4. Phone numbers written in text (e.g. +91 62079 19163, +1-555-234-5678, (555) 234-5678)
  const phoneRegex = /(?:(?:\+|00)\d{1,3}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{4,5}\b/g;
  while ((match = phoneRegex.exec(plainText)) !== null) {
    const rawPhone = match[0].trim();
    const digits = rawPhone.replace(/\D/g, '');
    // Ensure standard phone length (10 to 15 digits) and not a year range like 2020-2024
    if (digits.length >= 10 && digits.length <= 15) {
      const formattedNumber = (rawPhone.startsWith('+') ? '+' : '') + digits;
      const tel = `tel:${formattedNumber}`;
      if (!seenUrls.has(tel)) {
        seenUrls.add(tel);
        foundLinks.push({
          text: rawPhone,
          url: tel,
          source: 'text'
        });
      }
    }
  }

  return foundLinks;
}

/**
 * Classifies a link into one of:
 * 'github', 'linkedin', 'leetcode', 'codeforces', 'codechef', 'hackerrank',
 * 'kaggle', 'twitter', 'medium', 'email', 'phone', 'portfolio', or 'others'.
 * Uses both URL structure and anchor text hints.
 *
 * @param {string} url
 * @param {string} [anchorText=""]
 * @returns {string} Classification tag
 */
function classifyLink(url, anchorText = '') {
  if (!url || typeof url !== 'string') return 'others';

  const cleanAnchor = (anchorText || '').trim().toLowerCase();
  const normalized = normalizeUrl(url) || url.trim();
  const lowerUrl = normalized.toLowerCase();

  // 1. Email check
  if (lowerUrl.startsWith('mailto:') || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(normalized)) {
    return 'email';
  }
  if ((cleanAnchor === 'email' || cleanAnchor === 'mail') && lowerUrl.includes('@')) {
    return 'email';
  }

  // 2. Phone check
  if (lowerUrl.startsWith('tel:') || cleanAnchor === 'phone' || cleanAnchor === 'mobile' || cleanAnchor === 'tel') {
    return 'phone';
  }

  // 3. Extract domain and path
  let host = '';
  let pathname = '';
  try {
    const parsed = new URL(lowerUrl.startsWith('http') ? lowerUrl : `https://${lowerUrl}`);
    host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    pathname = parsed.pathname.toLowerCase();
  } catch {
    host = lowerUrl.split('/')[0].replace(/^www\./, '');
  }

  // 4. Known developer & social platforms
  if (host === 'github.com' || host.endsWith('.github.com') || cleanAnchor === 'github' || cleanAnchor.includes('github')) {
    return 'github';
  }
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com') || cleanAnchor === 'linkedin' || cleanAnchor.includes('linkedin')) {
    return 'linkedin';
  }
  if (host === 'leetcode.com' || host.endsWith('.leetcode.com') || cleanAnchor.includes('leetcode')) {
    return 'leetcode';
  }
  if (host === 'codeforces.com' || host.endsWith('.codeforces.com') || cleanAnchor.includes('codeforces')) {
    return 'codeforces';
  }
  if (host === 'codechef.com' || host.endsWith('.codechef.com') || cleanAnchor.includes('codechef')) {
    return 'codechef';
  }
  if (host === 'hackerrank.com' || host.endsWith('.hackerrank.com') || cleanAnchor.includes('hackerrank')) {
    return 'hackerrank';
  }
  if (host === 'kaggle.com' || host.endsWith('.kaggle.com') || cleanAnchor.includes('kaggle')) {
    return 'kaggle';
  }
  if (host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com') || host.endsWith('.x.com') || cleanAnchor === 'twitter' || cleanAnchor === 'x') {
    return 'twitter';
  }
  if (host === 'medium.com' || host.endsWith('.medium.com') || cleanAnchor.includes('medium')) {
    return 'medium';
  }

  // 5. Portfolio classification (using anchor text and domain hints)
  const portfolioKeywords = [
    'portfolio',
    'personal website',
    'my website',
    'personal site',
    'web portfolio',
    'homepage',
    'my portfolio'
  ];

  const anchorIsPortfolio = portfolioKeywords.some(kw => cleanAnchor.includes(kw));
  const urlIsPortfolio = host.includes('portfolio') || pathname.includes('portfolio');

  if (anchorIsPortfolio || urlIsPortfolio) {
    return 'portfolio';
  }

  // GitHub user pages (e.g. user.github.io) without subpath often represent portfolio
  if (host.endsWith('.github.io') && (pathname === '' || pathname === '/')) {
    return 'portfolio';
  }

  // If anchor explicitly points to personal profile / site on hosting platforms
  if (
    (host.endsWith('.vercel.app') || host.endsWith('.netlify.app') || host.endsWith('.pages.dev')) &&
    (cleanAnchor.includes('site') || cleanAnchor.includes('profile'))
  ) {
    return 'portfolio';
  }

  // If anchor was empty (e.g. icon/image link), anchor hints don't apply; classified by domain above
  return 'others';
}

/**
 * Main entry point: Parses a resume file (PDF or DOCX), recovers hidden and visible links,
 * dedupes, resolves shortened URLs, and produces structured ATS link classification.
 *
 * Never throws on a corrupt file. Returns a clear error object instead.
 *
 * @param {string|Buffer} filePathOrBuffer - Absolute file path or Buffer of resume
 * @param {string} [mimeType] - MIME type (e.g. 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
 * @returns {Promise<{
 *   links: {
 *     github: string|null,
 *     linkedin: string|null,
 *     leetcode: string|null,
 *     codeforces: string|null,
 *     codechef: string|null,
 *     hackerrank: string|null,
 *     kaggle: string|null,
 *     twitter: string|null,
 *     medium: string|null,
 *     portfolio: string|null,
 *     email: string|null,
 *     phone: string|null,
 *     others: string[]
 *   },
 *   rawLinks: Array<{ text: string, url: string, type: string, source: 'annotation'|'text', page?: number }>,
 *   warnings: string[],
 *   linksMayBeMissing?: boolean,
 *   error?: string
 * }>}
 */
async function parseResumeLinks(filePathOrBuffer, mimeType) {
  const warnings = [];
  let linksMayBeMissing = false;

  // Initial structure for categorized links
  const categorizedLinks = {
    github: null,
    linkedin: null,
    leetcode: null,
    codeforces: null,
    codechef: null,
    hackerrank: null,
    kaggle: null,
    twitter: null,
    medium: null,
    portfolio: null,
    email: null,
    phone: null,
    others: []
  };

  try {
    if (!filePathOrBuffer) {
      return {
        error: 'No file path or buffer provided for resume link extraction.',
        links: categorizedLinks,
        rawLinks: [],
        warnings: ['No file provided.']
      };
    }

    // Determine MIME type or infer from extension if path is string
    let effectiveMime = mimeType ? mimeType.toLowerCase() : '';
    if (!effectiveMime && typeof filePathOrBuffer === 'string') {
      const ext = path.extname(filePathOrBuffer).toLowerCase();
      if (ext === '.pdf') {
        effectiveMime = 'application/pdf';
      } else if (ext === '.docx') {
        effectiveMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }
    }

    let annotationLinks = [];
    let plainText = '';

    if (effectiveMime.includes('pdf')) {
      const pdfResult = await extractPdfLinks(filePathOrBuffer);
      annotationLinks = pdfResult.links;
      plainText = pdfResult.plainText;

      // Check if PDF has no annotations (common in Canva, Figma, or flat exported PDFs)
      if (pdfResult.totalAnnotationsCount === 0) {
        linksMayBeMissing = true;
        warnings.push(
          'linksMayBeMissing: true: No PDF link annotations found. Hyperlinks behind anchor text or icons may be missing (common in Canva/Figma exports).'
        );
      }
    } else if (
      effectiveMime.includes('wordprocessingml') ||
      effectiveMime.includes('docx') ||
      (typeof filePathOrBuffer === 'string' && filePathOrBuffer.endsWith('.docx'))
    ) {
      const docxResult = await extractDocxLinks(filePathOrBuffer);
      annotationLinks = docxResult.links;
      plainText = docxResult.plainText;
    } else {
      warnings.push(`Unsupported or unknown MIME type '${mimeType}'. Attempting visible text URL extraction only.`);
      if (typeof filePathOrBuffer === 'string') {
        try {
          plainText = await fs.promises.readFile(filePathOrBuffer, 'utf-8');
        } catch {
          // If binary, skip raw utf-8 read
        }
      }
    }

    // Extract visible URLs from plain text layer
    const textLinks = extractTextUrls(plainText);

    // Merge annotation links and visible URLs
    const combinedRaw = [...annotationLinks, ...textLinks];

    // Deduplicate and normalize
    let mergedLinks = dedupeLinks(combinedRaw);

    // Resolve shortened links (bit.ly, tinyurl, etc.) with timeout protection
    for (let i = 0; i < mergedLinks.length; i++) {
      if (isShortenedUrl(mergedLinks[i].url)) {
        try {
          const resolved = await resolveShortUrl(mergedLinks[i].url, 3000);
          if (resolved && resolved !== mergedLinks[i].url) {
            mergedLinks[i].url = resolved;
          }
        } catch {
          // Never throw on shortener resolution failure
        }
      }
    }

    // Classify each link
    const classifiedRawLinks = mergedLinks.map(item => {
      const type = classifyLink(item.url, item.text);
      return {
        text: item.text,
        url: item.url,
        type,
        source: item.source,
        ...(item.page !== undefined ? { page: item.page } : {})
      };
    });

    // Populate categorized links object
    for (const item of classifiedRawLinks) {
      const { type, url } = item;

      if (type === 'email') {
        const cleanEmail = url.replace(/^mailto:/i, '');
        if (!categorizedLinks.email) {
          categorizedLinks.email = cleanEmail;
        } else if (cleanEmail !== categorizedLinks.email && !categorizedLinks.others.includes(url)) {
          categorizedLinks.others.push(url);
        }
      } else if (type === 'phone') {
        const cleanPhone = url.replace(/^tel:/i, '');
        if (!categorizedLinks.phone) {
          categorizedLinks.phone = cleanPhone;
        } else if (cleanPhone !== categorizedLinks.phone && !categorizedLinks.others.includes(url)) {
          categorizedLinks.others.push(url);
        }
      } else if (type === 'others') {
        if (!categorizedLinks.others.includes(url)) {
          categorizedLinks.others.push(url);
        }
      } else if (categorizedLinks[type] !== undefined) {
        if (!categorizedLinks[type]) {
          categorizedLinks[type] = url;
        } else if (categorizedLinks[type] !== url && !categorizedLinks.others.includes(url)) {
          // If secondary link of same type exists (e.g. second GitHub repository), keep in others
          categorizedLinks.others.push(url);
        }
      } else {
        if (!categorizedLinks.others.includes(url)) {
          categorizedLinks.others.push(url);
        }
      }
    }

    const result = {
      links: categorizedLinks,
      rawLinks: classifiedRawLinks,
      warnings
    };

    if (linksMayBeMissing) {
      result.linksMayBeMissing = true;
    }

    return result;
  } catch (err) {
    // Never throw on a corrupt file. Return a clear error object instead.
    const errorMessage = `Failed to parse resume: ${err?.message || 'Corrupt or unreadable file format.'}`;
    return {
      error: errorMessage,
      links: categorizedLinks,
      rawLinks: [],
      warnings: [...warnings, errorMessage],
      ...(linksMayBeMissing ? { linksMayBeMissing: true } : {})
    };
  }
}

/**
 * Formats extracted links into a clear, structured prompt section with explicit indicators
 * connecting each link to its associated category, anchor text, and context for LLM generation.
 *
 * @param {object} parsedResult - Result from parseResumeLinks
 * @returns {string} Formatted prompt text
 */
function formatExtractedLinksForPrompt(parsedResult) {
  if (!parsedResult || !parsedResult.links) return '';

  const { links, rawLinks = [] } = parsedResult;
  const sections = [];

  sections.push('=== VERIFIED RESUME HYPERLINKS & ASSOCIATED ENTITIES ===');
  sections.push('The following verified hyperlinks were recovered directly from the candidate\'s resume (including links behind anchor text, icons, and document relationships). When generating the resume:');
  sections.push('- Use these EXACT URLs in the candidate\'s header and project sections.');
  sections.push('- Associate each link with its corresponding anchor text / project context indicated below.');
  sections.push('- Do NOT hallucinate fake URLs or replace them with generic text.');

  // 1. Primary Profiles & Contacts
  const contactLines = [];
  if (links.email) {
    const rawMatch = rawLinks.find(l => l.type === 'email');
    const anchor = rawMatch?.text && rawMatch.text !== links.email ? ` (Associated anchor: "${rawMatch.text}")` : '';
    contactLines.push(`• [Email Address]: mailto:${links.email} (${links.email})${anchor}`);
  }
  if (links.phone) {
    const rawMatch = rawLinks.find(l => l.type === 'phone');
    const anchor = rawMatch?.text && rawMatch.text !== links.phone ? ` (Associated anchor: "${rawMatch.text}")` : '';
    contactLines.push(`• [Phone Number]: ${links.phone}${anchor}`);
  }
  if (links.github) {
    const rawMatch = rawLinks.find(l => l.type === 'github');
    const anchor = rawMatch?.text ? ` (Associated anchor text in resume: "${rawMatch.text}")` : '';
    contactLines.push(`• [GitHub Profile]: ${links.github}${anchor}`);
  }
  if (links.linkedin) {
    const rawMatch = rawLinks.find(l => l.type === 'linkedin');
    const anchor = rawMatch?.text ? ` (Associated anchor text in resume: "${rawMatch.text}")` : '';
    contactLines.push(`• [LinkedIn Profile]: ${links.linkedin}${anchor}`);
  }
  if (links.portfolio) {
    const rawMatch = rawLinks.find(l => l.type === 'portfolio');
    const anchor = rawMatch?.text ? ` (Associated anchor text in resume: "${rawMatch.text}")` : '';
    contactLines.push(`• [Portfolio / Personal Website]: ${links.portfolio}${anchor}`);
  }
  if (links.leetcode) {
    contactLines.push(`• [LeetCode Profile]: ${links.leetcode}`);
  }
  if (links.codeforces) {
    contactLines.push(`• [Codeforces Profile]: ${links.codeforces}`);
  }
  if (links.codechef) {
    contactLines.push(`• [CodeChef Profile]: ${links.codechef}`);
  }
  if (links.hackerrank) {
    contactLines.push(`• [HackerRank Profile]: ${links.hackerrank}`);
  }
  if (links.kaggle) {
    contactLines.push(`• [Kaggle Profile]: ${links.kaggle}`);
  }
  if (links.twitter) {
    contactLines.push(`• [Twitter / X Profile]: ${links.twitter}`);
  }
  if (links.medium) {
    contactLines.push(`• [Medium Blog / Profile]: ${links.medium}`);
  }

  if (contactLines.length > 0) {
    sections.push('\n[PRIMARY CONTACT & PROFILE LINKS]');
    sections.push(contactLines.join('\n'));
  }

  // 2. Project Demos, Live Repositories, and Other Links
  const usedUrls = new Set([
    links.github,
    links.linkedin,
    links.portfolio,
    links.leetcode,
    links.codeforces,
    links.codechef,
    links.hackerrank,
    links.kaggle,
    links.twitter,
    links.medium,
    links.email ? `mailto:${links.email}` : null,
    links.phone ? `tel:${links.phone}` : null
  ].filter(Boolean));

  const projectAndOtherLines = [];
  for (const item of rawLinks) {
    if (!item.url || usedUrls.has(item.url)) continue;
    usedUrls.add(item.url);

    const anchorDesc = item.text ? `Associated Anchor/Project Label: "${item.text}"` : 'No explicit anchor text';
    const typeLabel = item.type === 'others' ? 'Project / Live Demo / External Resource' : item.type.toUpperCase();
    projectAndOtherLines.push(`• [${typeLabel}]: ${item.url} (${anchorDesc})`);
  }

  if (projectAndOtherLines.length > 0) {
    sections.push('\n[PROJECT DEMOS, REPOSITORIES & ASSOCIATED APPLICATION LINKS]');
    sections.push(projectAndOtherLines.join('\n'));
  }

  sections.push('=== END OF VERIFIED RESUME HYPERLINKS ===');
  return sections.join('\n');
}

// Named exports for ES Module static analysis
exports.extractPdfLinks = extractPdfLinks;
exports.extractDocxLinks = extractDocxLinks;
exports.extractTextUrls = extractTextUrls;
exports.classifyLink = classifyLink;
exports.parseResumeLinks = parseResumeLinks;
exports.formatExtractedLinksForPrompt = formatExtractedLinksForPrompt;

// Object export for CommonJS destructuring
module.exports = {
  extractPdfLinks,
  extractDocxLinks,
  extractTextUrls,
  classifyLink,
  parseResumeLinks,
  formatExtractedLinksForPrompt
};
