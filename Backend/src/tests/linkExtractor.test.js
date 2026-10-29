const {
  classifyLink,
  extractTextUrls,
  parseResumeLinks
} = require('../services/linkExtractor.js');
const {
  normalizeUrl,
  dedupeLinks,
  getDedupeKey,
  isJunkLink,
  isShortenedUrl,
  resolveShortUrl
} = require('../utils/urlUtils.js');
const path = require('path');
const fs = require('fs');

describe('1. classifyLink Unit Tests', () => {
  test('classifies GitHub profiles and repositories', () => {
    expect(classifyLink('https://github.com/sumitkumar112006')).toBe('github');
    expect(classifyLink('https://www.github.com/facebook/react/')).toBe('github');
    expect(classifyLink('github.com/username')).toBe('github');
    expect(classifyLink('https://custom-domain.org', 'GitHub')).toBe('github');
  });

  test('classifies LinkedIn profiles', () => {
    expect(classifyLink('https://www.linkedin.com/in/sumit-kumar-48998b345')).toBe('linkedin');
    expect(classifyLink('linkedin.com/in/johndoe')).toBe('linkedin');
    expect(classifyLink('https://example.com', 'LinkedIn')).toBe('linkedin');
  });

  test('classifies LeetCode profiles', () => {
    expect(classifyLink('https://leetcode.com/u/candidate')).toBe('leetcode');
    expect(classifyLink('leetcode.com/problemset', 'LeetCode Profile')).toBe('leetcode');
  });

  test('classifies Codeforces, CodeChef, HackerRank, Kaggle profiles', () => {
    expect(classifyLink('https://codeforces.com/profile/tourist')).toBe('codeforces');
    expect(classifyLink('https://www.codechef.com/users/coder123')).toBe('codechef');
    expect(classifyLink('https://hackerrank.com/profile/dev')).toBe('hackerrank');
    expect(classifyLink('https://www.kaggle.com/data-scientist')).toBe('kaggle');
  });

  test('classifies Twitter and X profiles', () => {
    expect(classifyLink('https://twitter.com/candidate')).toBe('twitter');
    expect(classifyLink('https://x.com/developer')).toBe('twitter');
    expect(classifyLink('https://short.io', 'Twitter')).toBe('twitter');
  });

  test('classifies Medium profiles and articles', () => {
    expect(classifyLink('https://medium.com/@writer')).toBe('medium');
    expect(classifyLink('https://blog.candidate.com', 'Medium Blog')).toBe('medium');
  });

  test('classifies email links and bare emails', () => {
    expect(classifyLink('mailto:amitk839170@gmail.com')).toBe('email');
    expect(classifyLink('john.doe@company.org')).toBe('email');
    expect(classifyLink('contact@domain.co', 'Email Me')).toBe('email');
  });

  test('classifies phone links and bare numbers', () => {
    expect(classifyLink('tel:+916207919163')).toBe('phone');
    expect(classifyLink('+91 62079 19163', 'Phone')).toBe('phone');
    expect(classifyLink('tel:1234567890')).toBe('phone');
  });

  test('classifies portfolio links based on anchor text hints and domain keywords', () => {
    expect(classifyLink('https://freelance-portfolio-sepia-one.vercel.app/')).toBe('portfolio');
    expect(classifyLink('https://candidate.dev', 'Portfolio')).toBe('portfolio');
    expect(classifyLink('https://sumit.me', 'Personal Website')).toBe('portfolio');
    expect(classifyLink('https://myproject.com', 'My Portfolio')).toBe('portfolio');
    expect(classifyLink('https://john.github.io/')).toBe('portfolio');
  });

  test('classifies icon or image links with empty anchor text by domain only', () => {
    expect(classifyLink('https://github.com/sumitkumar112006', '')).toBe('github');
    expect(classifyLink('https://linkedin.com/in/sumit', '  ')).toBe('linkedin');
    expect(classifyLink('https://leetcode.com/user', '')).toBe('leetcode');
    expect(classifyLink('https://freelance-portfolio-sepia-one.vercel.app', '')).toBe('portfolio');
    expect(classifyLink('https://ai-interviewer-silk.vercel.app', '')).toBe('others');
  });

  test('classifies non-matching links as others', () => {
    expect(classifyLink('https://ai-interviewer-silk.vercel.app', 'Live Demo')).toBe('others');
    expect(classifyLink('https://docs.docker.com')).toBe('others');
    expect(classifyLink('https://youtube.com/watch?v=123')).toBe('others');
  });
});

describe('2. normalizeUrl & dedupeLinks Unit Tests', () => {
  test('normalizeUrl prepends https:// to scheme-less URLs and cleans trailing slashes', () => {
    expect(normalizeUrl('github.com/user')).toBe('https://github.com/user');
    expect(normalizeUrl('https://github.com/user/')).toBe('https://github.com/user');
    expect(normalizeUrl('http://github.com/user/')).toBe('https://github.com/user');
  });

  test('normalizeUrl lowercases hostnames and strips www.', () => {
    expect(normalizeUrl('https://WWW.LinkedIn.COM/in/user/')).toBe('https://linkedin.com/in/user');
    expect(normalizeUrl('HTTPS://GITHUB.COM/SumitKumar')).toBe('https://github.com/SumitKumar');
  });

  test('normalizeUrl strips trailing punctuation attached from text sentences', () => {
    expect(normalizeUrl('github.com/user.')).toBe('https://github.com/user');
    expect(normalizeUrl('github.com/user,')).toBe('https://github.com/user');
    expect(normalizeUrl('https://github.com/user);')).toBe('https://github.com/user');
    expect(normalizeUrl('(https://github.com/user)')).toBe('https://github.com/user');
    expect(normalizeUrl('<https://github.com/user>')).toBe('https://github.com/user');
  });

  test('normalizeUrl handles mailto: and tel: schemes cleanly', () => {
    expect(normalizeUrl('mailto:AmitK839170@gmail.com')).toBe('mailto:amitk839170@gmail.com');
    expect(normalizeUrl('tel:+91-62079-19163')).toBe('tel:+91-62079-19163');
  });

  test('filters out junk links', () => {
    expect(isJunkLink('javascript:void(0)')).toBe(true);
    expect(isJunkLink('#')).toBe(true);
    expect(isJunkLink('')).toBe(true);
    expect(isJunkLink(null)).toBe(true);
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('#')).toBeNull();
  });

  test('getDedupeKey equates identical URLs with different protocols or trailing slashes', () => {
    const key1 = getDedupeKey('https://www.github.com/user/');
    const key2 = getDedupeKey('http://github.com/user');
    expect(key1).toBe('github.com/user');
    expect(key2).toBe('github.com/user');
    expect(key1).toBe(key2);
  });

  test('dedupeLinks removes duplicates and prioritizes annotation anchor text over text', () => {
    const rawList = [
      { url: 'https://github.com/sumitkumar112006', text: 'GitHub', source: 'annotation', page: 1 },
      { url: 'http://www.github.com/sumitkumar112006/', text: 'https://github.com/sumitkumar112006', source: 'text' },
      { url: 'javascript:void(0)', text: 'junk', source: 'annotation' },
      { url: 'https://linkedin.com/in/sumit', text: '', source: 'annotation' },
      { url: 'https://linkedin.com/in/sumit/', text: 'LinkedIn Profile', source: 'text' }
    ];

    const deduped = dedupeLinks(rawList);
    expect(deduped).toHaveLength(2);

    const gh = deduped.find(l => l.url.includes('github.com'));
    expect(gh).toBeDefined();
    expect(gh.text).toBe('GitHub'); // Retained meaningful anchor text
    expect(gh.source).toBe('annotation'); // Retained annotation priority
    expect(gh.page).toBe(1);

    const li = deduped.find(l => l.url.includes('linkedin.com'));
    expect(li).toBeDefined();
    expect(li.text).toBe('LinkedIn Profile'); // Upgraded from empty to meaningful text
  });
});

describe('3. extractTextUrls Unit Tests', () => {
  test('extracts visible URLs, emails, and phones from plain resume text', () => {
    const text = `
      John Doe
      Software Engineer
      Email: john.doe@example.com | Phone: +1 (555) 234-5678
      GitHub: github.com/johndoe
      LinkedIn: https://www.linkedin.com/in/johndoe
      Portfolio: https://john-portfolio.dev
    `;

    const extracted = extractTextUrls(text);
    const urls = extracted.map(e => e.url);

    expect(urls).toContain('mailto:john.doe@example.com');
    expect(urls).toContain('tel:+15552345678');
    expect(urls).toContain('https://github.com/johndoe');
    expect(urls).toContain('https://linkedin.com/in/johndoe');
    expect(urls).toContain('https://john-portfolio.dev');
  });

  test('does not falsely extract programming languages or degrees as URLs', () => {
    const text = `
      Skills: React.js, Node.js, Next.js, Vue.js, Express.js.
      Education: Bachelor of Technology (B.Tech) in Computer Science.
      Worked on e.g. microservices vs. monoliths.
      Contact: amitk839170@gmail.com
    `;

    const extracted = extractTextUrls(text);
    const urls = extracted.map(e => e.url);

    expect(urls).not.toContain('https://react.js');
    expect(urls).not.toContain('https://node.js');
    expect(urls).not.toContain('https://b.tech');
    expect(urls).not.toContain('https://gmail.com'); // Bare email provider domain filtered out
    expect(urls).toContain('mailto:amitk839170@gmail.com');
  });
});

describe('4. Shortened URL handling', () => {
  test('isShortenedUrl detects bit.ly, tinyurl, and t.co', () => {
    expect(isShortenedUrl('https://bit.ly/3xyz')).toBe(true);
    expect(isShortenedUrl('http://tinyurl.com/abc')).toBe(true);
    expect(isShortenedUrl('https://t.co/xyz123')).toBe(true);
    expect(isShortenedUrl('https://github.com/user')).toBe(false);
  });

  test('resolveShortUrl gracefully falls back on network timeout or failure without throwing', async () => {
    const nonExistent = 'https://bit.ly/non_existent_slug_test_12345';
    const result = await resolveShortUrl(nonExistent, 500);
    expect(typeof result).toBe('string');
  });
});

describe('5. Real Resume Edge Cases & parseResumeLinks', () => {
  const samplePdf = path.resolve('../Edge cases/Sumit_Kumar.pdf');
  const sampleDocx = path.resolve('../Edge cases/Sumit_Kumar.docx');

  test('extracts links from real PDF with hidden hyperlinks behind anchor text', async () => {
    const res = await parseResumeLinks(samplePdf, 'application/pdf');

    expect(res).toBeDefined();
    expect(res.links).toBeDefined();
    expect(res.links.github).toBe('https://github.com/sumitkumar112006');
    expect(res.links.linkedin).toBe('https://linkedin.com/in/sumit-kumar-48998b345');
    expect(res.links.portfolio).toBe('https://freelance-portfolio-sepia-one.vercel.app');
    expect(res.links.email).toBe('amitk839170@gmail.com');
    expect(res.links.phone).toBe('+916207919163');
    expect(res.links.leetcode).toBeNull();
    expect(res.warnings).toEqual([]);

    // Raw links verification
    const ghRaw = res.rawLinks.find(l => l.type === 'github');
    expect(ghRaw.text).toBe('GitHub');
    expect(ghRaw.source).toBe('annotation');
  });

  test('extracts links from real DOCX with relationship hyperlinks', async () => {
    const res = await parseResumeLinks(sampleDocx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    expect(res).toBeDefined();
    expect(res.links.github).toBe('https://github.com/sumitkumar112006');
    expect(res.links.linkedin).toBe('https://linkedin.com/in/sumit-kumar-48998b345');
    expect(res.links.portfolio).toBe('https://freelance-portfolio-sepia-one.vercel.app');
    expect(res.links.email).toBe('amitk839170@gmail.com');
    expect(res.links.phone).toBe('+916207919163');
  });

  test('never throws on a corrupt file and returns a clear error object', async () => {
    const corruptBuffer = Buffer.from('NOT_A_REAL_PDF_HEADER_CORRUPT_BYTES_XYZ');
    const res = await parseResumeLinks(corruptBuffer, 'application/pdf');

    expect(res).toBeDefined();
    expect(res.error).toBeDefined();
    expect(typeof res.error).toBe('string');
    expect(res.links).toBeDefined();
    expect(res.rawLinks).toEqual([]);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  test('detects PDF without annotations and flags linksMayBeMissing: true', async () => {
    const emptyPdfResult = await parseResumeLinks(Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF'), 'application/pdf');

    expect(emptyPdfResult.linksMayBeMissing).toBe(true);
    expect(emptyPdfResult.warnings.some(w => w.includes('linksMayBeMissing'))).toBe(true);
  });
});
