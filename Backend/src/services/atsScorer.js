/**
 * @file atsScorer.js
 * @description Production-quality ATS (Applicant Tracking System) match score engine.
 * Computes deep lexical, semantic, skills taxonomy, experience, education,
 * title similarity, and document formatting breakdown scores.
 *
 * Compatible with both ES Modules (`import { calculateATSScore } from '...'`)
 * and CommonJS (`const { calculateATSScore } = require('...')`).
 */

// Modular natural subpath imports to prevent loading unused ESM sentiment analyzers in Jest/CJS
let PorterStemmer;
let TfIdf;
let JaroWinklerDistance;
let naturalStopwords = [];

try {
  PorterStemmer = require('natural/lib/natural/stemmers/porter_stemmer');
  TfIdf = require('natural/lib/natural/tfidf').TfIdf;
  JaroWinklerDistance = require('natural/lib/natural/distance/jaro-winkler_distance');
  const sw = require('natural/lib/natural/util/stopwords');
  naturalStopwords = sw.words || sw.stopwords || [];
} catch (err) {
  // Robust native fallback
  PorterStemmer = { stem: (word) => word.toLowerCase().replace(/(ing|ed|ly|es|s)$/, '') };
  JaroWinklerDistance = (s1, s2) => s1 === s2 ? 1 : 0;
  class FallbackTfIdf {
    constructor() { this.docs = []; }
    addDocument(text) { this.docs.push(text); }
    listTerms() { return []; }
  }
  TfIdf = FallbackTfIdf;
}

// ============================================================================
// 1. DEFAULT CONFIGURATION & TAXONOMIES
// ============================================================================

/**
 * Default category weights summing to 1.0 (100%).
 */
const DEFAULT_WEIGHTS = Object.freeze({
  keywordMatch: 0.30,
  skillsMatch: 0.25,
  experienceMatch: 0.20,
  educationMatch: 0.10,
  titleMatch: 0.10,
  formatting: 0.05
});

/**
 * Standard tech & domain synonym / alias dictionary.
 * Maps abbreviated or synonymous terms to their canonical representations.
 */
const DEFAULT_ALIASES = Object.freeze({
  // Languages
  'js': 'javascript',
  'javascript': 'javascript',
  'ecmascript': 'javascript',
  'ts': 'typescript',
  'typescript': 'typescript',
  'py': 'python',
  'python': 'python',
  'python3': 'python',
  'golang': 'go',
  'go': 'go',
  'cpp': 'c++',
  'c++': 'c++',
  'csharp': 'c#',
  'c#': 'c#',
  '.net': 'c#',
  'dotnet': 'c#',

  // Frameworks & Libraries
  'node': 'node.js',
  'nodejs': 'node.js',
  'node.js': 'node.js',
  'react': 'react',
  'reactjs': 'react',
  'react.js': 'react',
  'next': 'next.js',
  'nextjs': 'next.js',
  'next.js': 'next.js',
  'vue': 'vue.js',
  'vuejs': 'vue.js',
  'vue.js': 'vue.js',
  'express': 'express.js',
  'expressjs': 'express.js',
  'express.js': 'express.js',
  'nest': 'nestjs',
  'nestjs': 'nestjs',
  'spring': 'spring boot',
  'springboot': 'spring boot',
  'spring boot': 'spring boot',
  'tailwind': 'tailwind css',
  'tailwindcss': 'tailwind css',

  // Databases
  'mongo': 'mongodb',
  'mongodb': 'mongodb',
  'postgres': 'postgresql',
  'postgresql': 'postgresql',
  'psql': 'postgresql',
  'redis': 'redis',
  'mysql': 'mysql',

  // Cloud & DevOps
  'k8s': 'kubernetes',
  'kubernetes': 'kubernetes',
  'docker': 'docker',
  'aws': 'amazon web services',
  'amazon web services': 'amazon web services',
  'gcp': 'google cloud platform',
  'google cloud': 'google cloud platform',
  'azure': 'microsoft azure',
  'ci/cd': 'ci/cd',
  'cicd': 'ci/cd',
  'continuous integration': 'ci/cd'
});

/**
 * Comprehensive Hard & Soft skills dictionary.
 */
const DEFAULT_SKILLS_TAXONOMY = Object.freeze({
  hardSkills: [
    // Languages
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust',
    'ruby', 'php', 'swift', 'kotlin', 'sql', 'bash', 'scala',
    // Frontend
    'react', 'next.js', 'angular', 'vue.js', 'svelte', 'redux', 'tailwind css',
    'html', 'css', 'sass', 'webpack', 'vite',
    // Backend & APIs
    'node.js', 'express.js', 'nestjs', 'django', 'flask', 'fastapi',
    'spring boot', 'graphql', 'rest api', 'grpc', 'microservices',
    // Databases
    'mongodb', 'postgresql', 'mysql', 'sqlite', 'redis', 'elasticsearch',
    'dynamodb', 'cassandra',
    // Cloud & DevOps
    'amazon web services', 'google cloud platform', 'microsoft azure',
    'docker', 'kubernetes', 'terraform', 'ci/cd', 'github actions', 'jenkins',
    'linux', 'git',
    // Testing & QA
    'jest', 'cypress', 'playwright', 'mocha', 'junit', 'pytest',
    // AI/Data
    'machine learning', 'deep learning', 'nlp', 'pandas', 'numpy', 'pytorch',
    'tensorflow', 'llm', 'langchain'
  ],
  softSkills: [
    'leadership', 'communication', 'problem solving', 'teamwork',
    'critical thinking', 'time management', 'adaptability', 'collaboration',
    'mentoring', 'mentorship', 'agile', 'scrum', 'presentation',
    'conflict resolution', 'negotiation', 'analytical skills'
  ]
});

/**
 * Common noise stop words in job descriptions and resumes.
 */
const CUSTOM_STOPWORDS = new Set([
  ...naturalStopwords,
  'job', 'description', 'role', 'company', 'candidate', 'responsibilities',
  'qualifications', 'requirements', 'requirement', 'required', 'must', 'have',
  'years', 'year', 'experience', 'exp', 'preferred', 'plus', 'opportunity',
  'work', 'working', 'team', 'ideal', 'looking', 'join', 'successful', 'seeking',
  'including', 'ability', 'responsible', 'knowledge', 'understanding',
  'proven', 'track', 'record', 'well', 'etc', 'e.g', 'i.e', 'using',
  'degree', 'degrees', 'bachelor', 'bachelors', 'master', 'masters', 'phd',
  'proficiency', 'proficient', 'familiarity', 'strong', 'skills', 'skill',
  'equal', 'employment', 'gender', 'race', 'religion', 'salary', 'benefits'
]);

// Degree levels ranking hierarchy
const DEGREE_LEVELS = Object.freeze({
  DOCTORATE: { level: 4, label: "Doctorate / Ph.D." },
  MASTERS:   { level: 3, label: "Master's Degree" },
  BACHELORS: { level: 2, label: "Bachelor's Degree" },
  ASSOCIATES:{ level: 1, label: "Associate's Degree" },
  NONE:      { level: 0, label: "Not Specified" }
});

// ============================================================================
// 2. TEXT PREPROCESSING & TOKENIZATION
// ============================================================================

/**
 * Preprocesses raw text by converting to lowercase, normalizing unicode/accents,
 * preserving compound technical acronyms, stripping punctuation, filtering stop words,
 * and generating Porter-stemmed token representations.
 *
 * @param {string} text - Raw input text.
 * @returns {object} Preprocessed text metadata and token sets.
 */
function preprocessText(text = '') {
  if (typeof text !== 'string') {
    return {
      rawText: '',
      cleanText: '',
      tokens: [],
      stemmedTokens: [],
      tokenSet: new Set(),
      stemmedSet: new Set(),
      tokenFrequencies: new Map()
    };
  }

  // 1. Normalize accents and diacritics
  let normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // 2. Protect compound tech terms before punctuation stripping
  const protectedTechMap = [
    { regex: /\bc\+\+/gi, replacement: ' cpp ' },
    { regex: /\bc#/gi, replacement: ' csharp ' },
    { regex: /\b\.net\b/gi, replacement: ' dotnet ' },
    { regex: /\bnode\.js\b/gi, replacement: ' nodejs ' },
    { regex: /\breact\.js\b/gi, replacement: ' reactjs ' },
    { regex: /\bvue\.js\b/gi, replacement: ' vuejs ' },
    { regex: /\bnext\.js\b/gi, replacement: ' nextjs ' },
    { regex: /\bexpress\.js\b/gi, replacement: ' expressjs ' },
    { regex: /\bci\/cd\b/gi, replacement: ' cicd ' },
    { regex: /\brest\s*api[s]?\b/gi, replacement: ' restapi ' }
  ];

  for (const item of protectedTechMap) {
    normalized = normalized.replace(item.regex, item.replacement);
  }

  // 3. Remove non-alphanumeric punctuation except intra-word hyphens
  const cleaned = normalized
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 4. Tokenize and filter stop words
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  const tokens = [];
  const stemmedTokens = [];
  const tokenSet = new Set();
  const stemmedSet = new Set();
  const tokenFrequencies = new Map();

  for (const token of rawTokens) {
    if (token.length <= 1) continue;
    if (CUSTOM_STOPWORDS.has(token)) continue;

    tokens.push(token);
    tokenSet.add(token);

    const stem = PorterStemmer.stem(token);
    stemmedTokens.push(stem);
    stemmedSet.add(stem);

    tokenFrequencies.set(token, (tokenFrequencies.get(token) || 0) + 1);
  }

  return {
    rawText: text,
    cleanText: cleaned,
    tokens,
    stemmedTokens,
    tokenSet,
    stemmedSet,
    tokenFrequencies
  };
}

/**
 * Returns all synonym / alias variants of a given term.
 *
 * @param {string} term
 * @param {object} aliasMap
 * @returns {string[]}
 */
function getSynonymVariants(term, aliasMap = DEFAULT_ALIASES) {
  const variants = new Set([term]);
  const lower = term.toLowerCase();
  const canonical = aliasMap[lower];

  if (canonical) {
    variants.add(canonical);
  }

  for (const [k, v] of Object.entries(aliasMap)) {
    if (v === lower || (canonical && v === canonical)) {
      variants.add(k);
    }
  }

  return [...variants];
}

// ============================================================================
// 3. CATEGORY SCORING HELPERS
// ============================================================================

/**
 * 1. Keyword match (Default 30%):
 * Extracts important keywords/phrases from the JD using TF-IDF and term frequencies.
 * Checks exact, stemmed, and synonym matches in the resume.
 * Keywords appearing multiple times in the JD receive higher weighting.
 * Optional: Blends semantic cosine similarity if `options.useEmbeddings` is enabled.
 *
 * @param {string} resumeText
 * @param {string} jdText
 * @param {object} options
 * @param {number} weight
 * @returns {Promise<{ score: number, weight: number, matched: string[], missing: string[] }>}
 */
async function scoreKeywords(resumeText = '', jdText = '', options = {}, weight = DEFAULT_WEIGHTS.keywordMatch) {
  if (!jdText.trim() || !resumeText.trim()) {
    return { score: 0, weight, matched: [], missing: [] };
  }

  const aliasMap = { ...DEFAULT_ALIASES, ...(options.aliases || options.synonymMap || {}) };
  const jdPre = preprocessText(jdText);
  const resumePre = preprocessText(resumeText);
  const resumeLower = resumeText.toLowerCase();

  // Compute TF-IDF on JD terms
  const tfidf = new TfIdf();
  tfidf.addDocument(jdPre.cleanText);
  const termList = tfidf.listTerms(0) || [];

  // Filter out terms that are too short or noise
  const candidateKeywords = termList
    .filter(t => t.term.length >= 2 && !CUSTOM_STOPWORDS.has(t.term))
    .slice(0, 45); // Focus on top 45 salient JD terms

  if (candidateKeywords.length === 0) {
    return { score: 100, weight, matched: [], missing: [] };
  }

  let totalWeightSum = 0;
  let matchedWeightSum = 0;
  const matched = [];
  const missing = [];

  for (const item of candidateKeywords) {
    const rawTerm = item.term;
    // Logarithmic term frequency scaling: terms appearing repeatedly in JD carry more weight
    const termWeight = 1.0 + Math.log(Math.max(1, item.tf));
    totalWeightSum += termWeight;

    const termStem = PorterStemmer.stem(rawTerm);
    const variants = getSynonymVariants(rawTerm, aliasMap);

    // Check exact, stem, or alias match in resume
    const exactMatch = resumePre.tokenSet.has(rawTerm) || resumePre.cleanText.includes(rawTerm);
    const stemMatch = resumePre.stemmedSet.has(termStem);
    const aliasMatch = variants.some(v => {
      const vStem = PorterStemmer.stem(v);
      return (
        resumePre.tokenSet.has(v) ||
        resumePre.cleanText.includes(v) ||
        resumeLower.includes(v) ||
        resumePre.stemmedSet.has(vStem)
      );
    });

    if (exactMatch || stemMatch || aliasMatch) {
      matchedWeightSum += termWeight;
      matched.push(rawTerm);
    } else {
      missing.push(rawTerm);
    }
  }

  let lexicalScore = totalWeightSum > 0 ? (matchedWeightSum / totalWeightSum) * 100 : 0;
  lexicalScore = Math.min(100, Math.max(0, Math.round(lexicalScore)));

  let finalScore = lexicalScore;

  // Optional: Blended embedding semantic similarity
  if (options.useEmbeddings) {
    let semanticScore = null;

    if (options.embeddings?.resumeEmbedding && options.embeddings?.jdEmbedding) {
      const cos = cosineSimilarity(options.embeddings.resumeEmbedding, options.embeddings.jdEmbedding);
      // Map cosine similarity [0.4, 1.0] to [0, 100]
      semanticScore = Math.min(100, Math.max(0, Math.round(((cos - 0.4) / 0.6) * 100)));
    } else if (typeof options.embeddingFunction === 'function') {
      try {
        const [rEmb, jdEmb] = await Promise.all([
          options.embeddingFunction(resumeText),
          options.embeddingFunction(jdText)
        ]);
        if (Array.isArray(rEmb) && Array.isArray(jdEmb)) {
          const cos = cosineSimilarity(rEmb, jdEmb);
          semanticScore = Math.min(100, Math.max(0, Math.round(((cos - 0.4) / 0.6) * 100)));
        }
      } catch (err) {
        // Fallback gracefully on embedding failure without crashing
      }
    }

    if (typeof semanticScore === 'number') {
      // 70% lexical keyword score + 30% semantic embeddings
      finalScore = Math.min(100, Math.max(0, Math.round(0.70 * lexicalScore + 0.30 * semanticScore)));
    }
  }

  return {
    score: finalScore,
    weight,
    matched,
    missing
  };
}

/**
 * 2. Skills match (Default 25%):
 * Separates hard skills (frameworks, tools, languages) from soft skills.
 * Hard skills are weighted higher (75% hard vs 25% soft).
 * Uses canonical skills taxonomy and configurable alias mapping.
 *
 * @param {string} resumeText
 * @param {string} jdText
 * @param {object} options
 * @param {number} weight
 * @returns {Promise<{ score: number, weight: number, matched: string[], missing: string[] }>}
 */
async function scoreSkills(resumeText = '', jdText = '', options = {}, weight = DEFAULT_WEIGHTS.skillsMatch) {
  if (!jdText.trim() || !resumeText.trim()) {
    return { score: 0, weight, matched: [], missing: [] };
  }

  const taxonomy = options.skillsDictionary || DEFAULT_SKILLS_TAXONOMY;
  const aliasMap = { ...DEFAULT_ALIASES, ...(options.aliases || options.synonymMap || {}) };

  const resumeLower = resumeText.toLowerCase();
  const jdLower = jdText.toLowerCase();

  /**
   * Helper to check if a skill (or its aliases) exists in given text.
   */
  function textHasSkill(skillName, text) {
    const canonical = skillName.toLowerCase();
    const aliases = getSynonymVariants(canonical, aliasMap);

    return aliases.some(alias => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
      return regex.test(text);
    });
  }

  // Detect skills required in JD
  const requiredHard = (taxonomy.hardSkills || []).filter(skill => textHasSkill(skill, jdLower));
  const requiredSoft = (taxonomy.softSkills || []).filter(skill => textHasSkill(skill, jdLower));

  // If JD doesn't mention any specific catalog skills, scan resume against catalog
  if (requiredHard.length === 0 && requiredSoft.length === 0) {
    const resumeSkills = (taxonomy.hardSkills || []).filter(skill => textHasSkill(skill, resumeLower));
    const score = resumeSkills.length >= 4 ? 100 : Math.round((resumeSkills.length / 4) * 100);
    return {
      score,
      weight,
      matched: resumeSkills,
      missing: []
    };
  }

  const matched = [];
  const missing = [];
  let matchedHardCount = 0;
  let matchedSoftCount = 0;

  for (const skill of requiredHard) {
    if (textHasSkill(skill, resumeLower)) {
      matched.push(skill);
      matchedHardCount++;
    } else {
      missing.push(skill);
    }
  }

  for (const skill of requiredSoft) {
    if (textHasSkill(skill, resumeLower)) {
      matched.push(skill);
      matchedSoftCount++;
    } else {
      missing.push(skill);
    }
  }

  const hardScore = requiredHard.length > 0 ? (matchedHardCount / requiredHard.length) * 100 : 100;
  const softScore = requiredSoft.length > 0 ? (matchedSoftCount / requiredSoft.length) * 100 : 100;

  // If both are required, blend 75% hard skills and 25% soft skills.
  // If only hard skills or only soft skills are required, base 100% on that category.
  let finalScore;
  if (requiredHard.length > 0 && requiredSoft.length > 0) {
    finalScore = Math.round(0.75 * hardScore + 0.25 * softScore);
  } else if (requiredHard.length > 0) {
    finalScore = Math.round(hardScore);
  } else if (requiredSoft.length > 0) {
    finalScore = Math.round(softScore);
  } else {
    finalScore = 100;
  }
  finalScore = Math.min(100, Math.max(0, finalScore));

  return {
    score: finalScore,
    weight,
    matched,
    missing
  };
}

/**
 * 3. Experience match (Default 20%):
 * Parses years of experience required in the JD (e.g. "3+ years", "5-7 years").
 * Estimates candidate's total experience from resume date ranges or explicit statements.
 * Merges overlapping date intervals to avoid duplicate credit.
 * Scores proportionally and caps at 100.
 *
 * @param {string} resumeText
 * @param {string} jdText
 * @param {object} options
 * @param {number} weight
 * @returns {Promise<{ score: number, weight: number, details: object }>}
 */
async function scoreExperience(resumeText = '', jdText = '', options = {}, weight = DEFAULT_WEIGHTS.experienceMatch) {
  if (!resumeText.trim()) {
    return {
      score: 0,
      weight,
      details: { requiredYears: 0, candidateYears: 0, status: 'below', extractedRanges: [] }
    };
  }

  // 1. Parse required experience in JD
  let requiredYears = 0;
  const jdExpRegexes = [
    /(?:minimum|at least)\s+(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)/i,
    /(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:experience|exp|relevant|hands-on|industry|professional))/i,
    /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:experience|exp|relevant|hands-on|industry|professional))/i,
    /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp|relevant|hands-on|industry|professional)/i,
    /(\d+(?:\.\d+)?)\s*\+\s*years?/i
  ];

  for (const regex of jdExpRegexes) {
    const match = jdText.match(regex);
    if (match) {
      requiredYears = parseFloat(match[1]);
      break;
    }
  }

  // 2. Parse candidate experience from resume date intervals
  const monthMap = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
    nov: 10, november: 10, dec: 11, december: 11
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const intervals = [];
  const extractedRanges = [];

  // Pattern A: Named Month ranges: "Jan 2019 - Present", "March 2018 to December 2021"
  const namedDateRegex = /(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[a-z.]*\s+)?(\d{4})\s*(?:-|–|—|to)\s*(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[a-z.]*\s+)?(\d{4}|present|current|now|date)/gi;

  let match;
  while ((match = namedDateRegex.exec(resumeText)) !== null) {
    extractedRanges.push(match[0]);
    const startMName = (match[1] || 'jan').toLowerCase();
    const startYear = parseInt(match[2], 10);
    const endMName = match[3] ? match[3].toLowerCase() : null;
    const endStr = match[4].toLowerCase();

    if (startYear < 1980 || startYear > currentYear + 2) continue;

    const startMonth = monthMap[startMName] ?? 0;
    const startTotalMonths = startYear * 12 + startMonth;

    let endTotalMonths;
    if (['present', 'current', 'now', 'date'].includes(endStr)) {
      endTotalMonths = currentYear * 12 + currentMonth;
    } else {
      const endYear = parseInt(endStr, 10);
      if (isNaN(endYear)) continue;
      const endMonth = endMName ? (monthMap[endMName] ?? 11) : 11;
      endTotalMonths = endYear * 12 + endMonth;
    }

    if (endTotalMonths >= startTotalMonths) {
      intervals.push([startTotalMonths, endTotalMonths]);
    }
  }

  // Pattern B: Slash date ranges: "06/2018 - 12/2021" or "01/2020 - Present"
  const slashDateRegex = /(\d{1,2})\/(\d{4})\s*(?:-|–|—|to)\s*(?:(\d{1,2})\/)?(\d{4}|present|current|now|date)/gi;
  while ((match = slashDateRegex.exec(resumeText)) !== null) {
    extractedRanges.push(match[0]);
    const startMonth = Math.max(0, parseInt(match[1], 10) - 1);
    const startYear = parseInt(match[2], 10);
    const endMonthPart = match[3] ? Math.max(0, parseInt(match[3], 10) - 1) : 11;
    const endStr = match[4].toLowerCase();

    if (startYear < 1980 || startYear > currentYear + 2) continue;
    const startTotalMonths = startYear * 12 + startMonth;

    let endTotalMonths;
    if (['present', 'current', 'now', 'date'].includes(endStr)) {
      endTotalMonths = currentYear * 12 + currentMonth;
    } else {
      const endYear = parseInt(endStr, 10);
      if (isNaN(endYear)) continue;
      endTotalMonths = endYear * 12 + endMonthPart;
    }

    if (endTotalMonths >= startTotalMonths) {
      intervals.push([startTotalMonths, endTotalMonths]);
    }
  }

  // Merge overlapping intervals to avoid duplicate experience calculation
  intervals.sort((a, b) => a[0] - b[0]);
  const mergedIntervals = [];
  for (const interval of intervals) {
    if (!mergedIntervals.length) {
      mergedIntervals.push(interval);
    } else {
      const last = mergedIntervals[mergedIntervals.length - 1];
      if (interval[0] <= last[1]) {
        last[1] = Math.max(last[1], interval[1]);
      } else {
        mergedIntervals.push(interval);
      }
    }
  }

  let totalMonths = 0;
  for (const [start, end] of mergedIntervals) {
    totalMonths += (end - start + 1);
  }
  let candidateYearsFromDates = Math.round((totalMonths / 12) * 10) / 10;

  // Check explicit statement in resume: e.g. "5+ years of experience"
  let explicitYears = 0;
  const explicitExpRegex = /(?:over|more than|\+)?\s*(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:experience|exp|relevant|hands-on|industry|professional))/i;
  const expMatch = resumeText.match(explicitExpRegex);
  if (expMatch) {
    explicitYears = parseFloat(expMatch[1]);
  }

  const candidateYears = Math.max(candidateYearsFromDates, explicitYears);

  // Score proportionally; cap at 100
  let score;
  let status = 'meets';

  if (requiredYears <= 0) {
    score = candidateYears >= 1 ? 100 : 80;
    status = 'unspecified';
  } else {
    const ratio = candidateYears / requiredYears;
    score = Math.min(100, Math.max(0, Math.round(ratio * 100)));
    if (candidateYears > requiredYears) status = 'exceeds';
    else if (candidateYears === requiredYears) status = 'meets';
    else status = 'below';
  }

  return {
    score,
    weight,
    details: {
      requiredYears,
      candidateYears,
      status,
      extractedRanges: [...new Set(extractedRanges)].slice(0, 10)
    }
  };
}

/**
 * 4. Education match (Default 10%):
 * Detects required degree level and field in JD and compares with resume.
 *
 * @param {string} resumeText
 * @param {string} jdText
 * @param {object} options
 * @param {number} weight
 * @returns {Promise<{ score: number, weight: number, details: object }>}
 */
async function scoreEducation(resumeText = '', jdText = '', options = {}, weight = DEFAULT_WEIGHTS.educationMatch) {
  if (!resumeText.trim()) {
    return {
      score: 0,
      weight,
      details: { requiredDegree: 'Not specified', candidateDegree: null, meetsDegree: false, meetsField: false }
    };
  }

  const jdLower = jdText.toLowerCase();
  const resumeLower = resumeText.toLowerCase();

  // Degree patterns
  const degreePatterns = [
    { level: 4, name: "Doctorate / Ph.D.", regex: /\b(ph\.?d|doctorate|doctor of philosophy)\b/i },
    { level: 3, name: "Master's Degree", regex: /\b(master'?s?|ms|m\.s\.?|m\.sc|msc|mba|m\.tech|mtech|mca)\b/i },
    { level: 2, name: "Bachelor's Degree", regex: /\b(bachelor'?s?|bs|b\.s\.?|b\.sc|bsc|b\.tech|btech|be|b\.e\.?|ba|b\.a\.?)\b/i },
    { level: 1, name: "Associate's Degree", regex: /\b(associate'?s?|diploma)\b/i }
  ];

  // STEM / Tech degree fields
  const fieldPatterns = [
    { field: 'Computer Science', regex: /\b(computer science|cs)\b/i },
    { field: 'Software Engineering', regex: /\b(software engineering|computer engineering)\b/i },
    { field: 'Information Technology', regex: /\b(information technology|it|information systems)\b/i },
    { field: 'Data Science', regex: /\b(data science|artificial intelligence|machine learning|analytics)\b/i },
    { field: 'Electrical / Electronics', regex: /\b(electrical|electronics)\b/i },
    { field: 'STEM / Mathematics', regex: /\b(mathematics|stats|statistics|stem|physics)\b/i }
  ];

  // Detect JD degree requirements
  let requiredLevel = 0;
  let requiredDegreeName = 'Not specified';
  for (const p of degreePatterns) {
    if (p.regex.test(jdLower)) {
      requiredLevel = p.level;
      requiredDegreeName = p.name;
      break;
    }
  }

  let requiredField = null;
  for (const f of fieldPatterns) {
    if (f.regex.test(jdLower)) {
      requiredField = f.field;
      break;
    }
  }

  // Detect Candidate degree
  let candidateLevel = 0;
  let candidateDegreeName = null;
  for (const p of degreePatterns) {
    if (p.regex.test(resumeLower)) {
      candidateLevel = p.level;
      candidateDegreeName = p.name;
      break;
    }
  }

  let candidateField = null;
  for (const f of fieldPatterns) {
    if (f.regex.test(resumeLower)) {
      candidateField = f.field;
      break;
    }
  }

  const meetsDegree = candidateLevel >= requiredLevel;
  const meetsField = !requiredField || (candidateField !== null);

  let score;
  if (requiredLevel === 0) {
    // JD did not demand a degree
    score = candidateLevel >= 2 ? 100 : candidateLevel >= 1 ? 95 : 90;
  } else if (candidateLevel >= requiredLevel) {
    score = meetsField ? 100 : 90;
  } else if (candidateLevel === requiredLevel - 1) {
    // 1 level below (e.g. Bachelor's when Master's requested)
    score = meetsField ? 75 : 65;
  } else {
    // Missing degree or below associate level
    score = candidateLevel > 0 ? 50 : 35;
  }

  return {
    score,
    weight,
    details: {
      requiredDegree: requiredDegreeName,
      requiredField,
      candidateDegree: candidateDegreeName || 'None detected',
      candidateField: candidateField || 'None detected',
      meetsDegree,
      meetsField
    }
  };
}

/**
 * 5. Job title match (Default 10%):
 * Fuzzy-matches JD title against candidate headline/titles using Jaro-Winkler
 * and token overlap similarity.
 *
 * @param {string} resumeText
 * @param {string} jdText
 * @param {object} options
 * @param {number} weight
 * @returns {Promise<{ score: number, weight: number, details: object }>}
 */
async function scoreJobTitle(resumeText = '', jdText = '', options = {}, weight = DEFAULT_WEIGHTS.titleMatch) {
  if (!resumeText.trim() || !jdText.trim()) {
    return {
      score: 0,
      weight,
      details: { jobTitle: '', candidateTitle: '', similarity: 0, method: 'jaro-winkler + token overlap' }
    };
  }

  // Extract JD title from explicit label or first sentence of JD
  let jobTitle = '';
  const jdTitleMatch = jdText.match(/(?:job\s+title|role|position|title):\s*([^\n\r.]+)/i);
  if (jdTitleMatch) {
    jobTitle = jdTitleMatch[1].trim();
  } else {
    const jdLines = jdText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const firstLine = jdLines[0] || 'Software Engineer';
    // If first line has a sentence period or colon, take preceding segment
    jobTitle = firstLine.split(/[.:|•]/)[0].trim();
  }

  // Extract candidate headline/title from first 3 lines of resume
  let candidateTitle = '';
  const resumeTitleMatch = resumeText.match(/(?:job\s+title|role|position|title|headline):\s*([^\n\r.]+)/i);
  if (resumeTitleMatch) {
    candidateTitle = resumeTitleMatch[1].trim();
  } else {
    const resumeLines = resumeText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    // If first line is a candidate name (short), check line 2
    if (resumeLines.length > 1 && resumeLines[0].split(/\s+/).length <= 4 && !/developer|engineer|manager|architect|designer/i.test(resumeLines[0])) {
      candidateTitle = resumeLines[1].split(/[.:|•]/)[0].trim();
    } else {
      candidateTitle = (resumeLines[0] || '').split(/[.:|•]/)[0].trim();
    }
  }

  const cleanJdTitle = jobTitle.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanCandTitle = candidateTitle.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Jaro-Winkler string similarity
  const jaroSim = JaroWinklerDistance(cleanJdTitle, cleanCandTitle);

  // 2. Token overlap similarity
  const jdTokens = new Set(cleanJdTitle.split(' ').filter(t => t.length > 1 && !CUSTOM_STOPWORDS.has(t)));
  const candTokens = new Set(cleanCandTitle.split(' ').filter(t => t.length > 1 && !CUSTOM_STOPWORDS.has(t)));

  let intersectionCount = 0;
  for (const t of jdTokens) {
    if (candTokens.has(t) || [...candTokens].some(ct => PorterStemmer.stem(ct) === PorterStemmer.stem(t))) {
      intersectionCount++;
    }
  }

  const tokenOverlap = (jdTokens.size + candTokens.size) > 0
    ? (2 * intersectionCount) / (jdTokens.size + candTokens.size)
    : 0;

  // Substring bonus (e.g. "Senior React Developer" vs "React Developer")
  const isSubstring = (cleanCandTitle && cleanJdTitle) &&
    (cleanCandTitle.includes(cleanJdTitle) || cleanJdTitle.includes(cleanCandTitle));
  const substringBonus = isSubstring ? 0.2 : 0;

  // Combined similarity [0.0 - 1.0]
  const combinedSimilarity = Math.min(1.0, (0.5 * jaroSim + 0.5 * tokenOverlap + substringBonus));
  const score = Math.min(100, Math.max(0, Math.round(combinedSimilarity * 100)));

  return {
    score,
    weight,
    details: {
      jobTitle,
      candidateTitle,
      similarity: Math.round(combinedSimilarity * 100) / 100,
      method: 'jaro-winkler + token overlap'
    }
  };
}

/**
 * 6. Formatting & parsability (Default 5%):
 * Validates document structure: standard sections, contact info, bullet points,
 * absence of corrupted/odd characters, and optimal word count.
 *
 * @param {string} resumeText
 * @param {object} options
 * @param {number} weight
 * @returns {Promise<{ score: number, weight: number, issues: string[] }>}
 */
async function scoreFormatting(resumeText = '', options = {}, weight = DEFAULT_WEIGHTS.formatting) {
  if (!resumeText.trim()) {
    return {
      score: 0,
      weight,
      issues: ['Resume text is empty.']
    };
  }

  const issues = [];
  let score = 100;

  // Check 1: Standard Sections (Total 40 points)
  const standardSections = [
    { name: 'Summary', regex: /\b(summary|professional\s+summary|profile|about\s+me|objective)\b/i },
    { name: 'Experience', regex: /\b(professional\s+experience|work\s+history|work\s+experience|experience|employment)\b/i },
    { name: 'Skills', regex: /\b(skills|technical\s+skills|technologies|core\s+competencies)\b/i },
    { name: 'Education', regex: /\b(education|academic|qualifications)\b/i },
    { name: 'Projects', regex: /\b(projects|key\s+projects|portfolio|personal\s+projects)\b/i }
  ];

  for (const sec of standardSections) {
    if (!sec.regex.test(resumeText)) {
      score -= 8;
      issues.push(`Missing standard section: '${sec.name}'. ATS parsers rely on this header.`);
    }
  }

  // Check 2: Contact Information (Total 20 points)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

  if (!emailRegex.test(resumeText)) {
    score -= 10;
    issues.push('No email address detected. Contact information must be clearly visible.');
  }
  if (!phoneRegex.test(resumeText)) {
    score -= 10;
    issues.push('No valid phone number detected.');
  }

  // Check 3: Bullet points usage (15 points)
  const bulletMatches = resumeText.match(/[•*▪►–\-]|\d+\.\s+/g) || [];
  const words = resumeText.trim().split(/\s+/).filter(Boolean);

  if (words.length > 150 && bulletMatches.length < 3) {
    score -= 15;
    issues.push('Lack of bullet points. Dense paragraphs are hard for ATS and recruiters to parse.');
  }

  // Check 4: Odd or corrupted characters / table artifacts (15 points)
  if (/[\uFFFD\x00-\x08\x0B\x0C\x0E-\x1F]/.test(resumeText)) {
    score -= 10;
    issues.push('Contains unprintable or corrupted unicode characters. Ensure text encoding is UTF-8.');
  }
  // Markdown/ASCII table borders (e.g. |---|---| or +---+---+)
  if (/(?:\|[-:]+[-| :]*\|)|(?:\+[-=+]+\+)/.test(resumeText)) {
    score -= 5;
    issues.push('Table structures detected. Complex tables often confuse automated ATS parsers.');
  }

  // Check 5: Document Length (10 points)
  if (words.length < 80) {
    score -= 15;
    issues.push(`Resume is very brief (${words.length} words). Standard resumes typically contain 300-1,200 words.`);
  } else if (words.length > 2500) {
    score -= 10;
    issues.push(`Resume is unusually verbose (${words.length} words). Consider condensing to 1-2 pages.`);
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    weight,
    issues
  };
}

// ============================================================================
// 4. ACTIONABLE SUGGESTIONS GENERATOR
// ============================================================================

/**
 * Generates specific, actionable improvements based on the scoring breakdown.
 * If `options.useLLM` is enabled and an LLM caller function is provided,
 * leverages AI generation; otherwise produces deterministic, high-impact suggestions.
 *
 * @param {object} params
 * @returns {Promise<string[]>}
 */
async function generateSuggestions({ resumeText, jobDescriptionText, breakdown, options }) {
  // Optional: LLM generation
  if (options?.useLLM && typeof options.llmCaller === 'function') {
    try {
      const llmResult = await options.llmCaller({
        resumeText,
        jobDescriptionText,
        breakdown
      });
      if (Array.isArray(llmResult) && llmResult.length > 0) {
        return llmResult;
      }
    } catch (err) {
      // Fallback cleanly to rule-based suggestions
    }
  }

  const suggestions = [];

  // 1. Missing Hard & Soft Skills
  if (breakdown.skillsMatch.missing.length > 0) {
    const topMissingSkills = breakdown.skillsMatch.missing.slice(0, 5);
    suggestions.push(
      `Add missing required skills to your resume: ${topMissingSkills.join(', ')}.`
    );
  }

  // 2. Missing Core Keywords
  if (breakdown.keywordMatch.missing.length > 0) {
    const topMissingKeywords = breakdown.keywordMatch.missing
      .filter(k => !breakdown.skillsMatch.missing.includes(k))
      .slice(0, 5);
    if (topMissingKeywords.length > 0) {
      suggestions.push(
        `Incorporate high-priority keywords from the job description: ${topMissingKeywords.join(', ')}.`
      );
    }
  }

  // 3. Experience Match Suggestions
  const expDetails = breakdown.experienceMatch.details;
  if (expDetails && expDetails.status === 'below' && expDetails.requiredYears > 0) {
    suggestions.push(
      `The job asks for ${expDetails.requiredYears}+ years of experience, but only ~${expDetails.candidateYears} years were detected. Explicitly list all contract, freelance, or relevant roles with clear start/end dates.`
    );
  }

  // 4. Education Match Suggestions
  const eduDetails = breakdown.educationMatch.details;
  if (eduDetails && !eduDetails.meetsDegree && eduDetails.requiredDegree !== 'Not specified') {
    suggestions.push(
      `The job requires a ${eduDetails.requiredDegree}. If you have equivalent experience or specialized certifications, emphasize them prominently in your Summary.`
    );
  }

  // 5. Job Title Alignment
  const titleDetails = breakdown.titleMatch.details;
  if (titleDetails && titleDetails.similarity < 0.65 && titleDetails.jobTitle) {
    suggestions.push(
      `Align your headline or target title closer to '${titleDetails.jobTitle}' to improve ATS title search relevance.`
    );
  }

  // 6. Formatting & Section issues
  if (breakdown.formatting.issues.length > 0) {
    for (const issue of breakdown.formatting.issues.slice(0, 3)) {
      suggestions.push(`Formatting fix: ${issue}`);
    }
  }

  if (suggestions.length === 0) {
    suggestions.push(
      'Strong match! Review your bullet points to ensure key achievements include measurable metrics and business impact.'
    );
  }

  return suggestions;
}

// ============================================================================
// 5. MAIN ATS MATCH FUNCTION
// ============================================================================

/**
 * Calculates a comprehensive ATS match score between a candidate resume and a job description.
 *
 * @param {string} resumeText - Candidate resume in plain text.
 * @param {string} jobDescriptionText - Target job description in plain text.
 * @param {object} [options={}] - Configurable weights, aliases, embeddings, or LLM options.
 * @param {object} [options.weights] - Custom category weights (e.g. { keywordMatch: 0.35, skillsMatch: 0.25 }).
 * @param {object} [options.aliases] - Custom synonym / alias dictionary.
 * @param {object} [options.skillsDictionary] - Custom hard & soft skills taxonomy.
 * @param {boolean} [options.useEmbeddings=false] - Whether to blend cosine similarity into keyword score.
 * @param {object} [options.embeddings] - Pre-computed embeddings `{ resumeEmbedding, jdEmbedding }`.
 * @param {Function} [options.embeddingFunction] - Async function `(text) => Promise<number[]>`.
 * @param {boolean} [options.useLLM=false] - Whether to generate suggestions via LLM.
 * @param {Function} [options.llmCaller] - Async function `({ resumeText, jobDescriptionText, breakdown }) => Promise<string[]>`.
 * @returns {Promise<{
 *   overallScore: number,
 *   breakdown: {
 *     keywordMatch: { score: number, weight: number, matched: string[], missing: string[] },
 *     skillsMatch: { score: number, weight: number, matched: string[], missing: string[] },
 *     experienceMatch: { score: number, weight: number, details: object },
 *     educationMatch: { score: number, weight: number, details: object },
 *     titleMatch: { score: number, weight: number, details: object },
 *     formatting: { score: number, weight: number, issues: string[] }
 *   },
 *   suggestions: string[]
 * }>}
 */
async function calculateATSScore(resumeText, jobDescriptionText, options = {}) {
  // Input validation
  const safeResume = typeof resumeText === 'string' ? resumeText : '';
  const safeJD = typeof jobDescriptionText === 'string' ? jobDescriptionText : '';

  // Edge Case: Empty Resume
  if (!safeResume.trim()) {
    return {
      overallScore: 0,
      breakdown: {
        keywordMatch:    { score: 0, weight: DEFAULT_WEIGHTS.keywordMatch, matched: [], missing: [] },
        skillsMatch:     { score: 0, weight: DEFAULT_WEIGHTS.skillsMatch, matched: [], missing: [] },
        experienceMatch: { score: 0, weight: DEFAULT_WEIGHTS.experienceMatch, details: { requiredYears: 0, candidateYears: 0, status: 'below', extractedRanges: [] } },
        educationMatch:  { score: 0, weight: DEFAULT_WEIGHTS.educationMatch, details: { requiredDegree: 'Not specified', candidateDegree: null, meetsDegree: false, meetsField: false } },
        titleMatch:      { score: 0, weight: DEFAULT_WEIGHTS.titleMatch, details: { jobTitle: '', candidateTitle: '', similarity: 0, method: 'jaro-winkler + token overlap' } },
        formatting:      { score: 0, weight: DEFAULT_WEIGHTS.formatting, issues: ['Resume text is empty.'] }
      },
      suggestions: ['Please provide a non-empty resume text to calculate the ATS match score.']
    };
  }

  // Edge Case: Empty Job Description
  if (!safeJD.trim()) {
    const formatting = await scoreFormatting(safeResume, options, DEFAULT_WEIGHTS.formatting);
    return {
      overallScore: 0,
      breakdown: {
        keywordMatch:    { score: 0, weight: DEFAULT_WEIGHTS.keywordMatch, matched: [], missing: [] },
        skillsMatch:     { score: 0, weight: DEFAULT_WEIGHTS.skillsMatch, matched: [], missing: [] },
        experienceMatch: { score: 0, weight: DEFAULT_WEIGHTS.experienceMatch, details: { requiredYears: 0, candidateYears: 0, status: 'unspecified', extractedRanges: [] } },
        educationMatch:  { score: 0, weight: DEFAULT_WEIGHTS.educationMatch, details: { requiredDegree: 'Not specified', candidateDegree: null, meetsDegree: false, meetsField: false } },
        titleMatch:      { score: 0, weight: DEFAULT_WEIGHTS.titleMatch, details: { jobTitle: '', candidateTitle: '', similarity: 0, method: 'jaro-winkler + token overlap' } },
        formatting
      },
      suggestions: ['Please provide a target job description text to calculate the ATS match score against.']
    };
  }

  // Normalize Category Weights
  const rawWeights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
  const totalWeight = Object.values(rawWeights).reduce((sum, w) => sum + (typeof w === 'number' && w > 0 ? w : 0), 0);

  const weights = {};
  for (const [k, v] of Object.entries(rawWeights)) {
    weights[k] = totalWeight > 0 ? (v / totalWeight) : DEFAULT_WEIGHTS[k];
  }

  // Calculate each modular category score in parallel
  const [
    keywordMatch,
    skillsMatch,
    experienceMatch,
    educationMatch,
    titleMatch,
    formatting
  ] = await Promise.all([
    scoreKeywords(safeResume, safeJD, options, weights.keywordMatch),
    scoreSkills(safeResume, safeJD, options, weights.skillsMatch),
    scoreExperience(safeResume, safeJD, options, weights.experienceMatch),
    scoreEducation(safeResume, safeJD, options, weights.educationMatch),
    scoreJobTitle(safeResume, safeJD, options, weights.titleMatch),
    scoreFormatting(safeResume, options, weights.formatting)
  ]);

  const breakdown = {
    keywordMatch,
    skillsMatch,
    experienceMatch,
    educationMatch,
    titleMatch,
    formatting
  };

  // Weighted overall score
  const overallCalculated =
    (keywordMatch.score * keywordMatch.weight) +
    (skillsMatch.score * skillsMatch.weight) +
    (experienceMatch.score * experienceMatch.weight) +
    (educationMatch.score * educationMatch.weight) +
    (titleMatch.score * titleMatch.weight) +
    (formatting.score * formatting.weight);

  const overallScore = Math.min(100, Math.max(0, Math.round(overallCalculated)));

  // Generate actionable suggestions
  const suggestions = await generateSuggestions({
    resumeText: safeResume,
    jobDescriptionText: safeJD,
    breakdown,
    options
  });

  return {
    overallScore,
    breakdown,
    suggestions
  };
}

// ============================================================================
// 6. UTILITY FUNCTIONS
// ============================================================================

/**
 * Computes standard Cosine Similarity between two numeric vectors.
 */
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// 7. EXPORTS (ESM & CommonJS Dual Compatibility)
// ============================================================================

exports.calculateATSScore = calculateATSScore;
exports.scoreKeywords = scoreKeywords;
exports.scoreSkills = scoreSkills;
exports.scoreExperience = scoreExperience;
exports.scoreEducation = scoreEducation;
exports.scoreJobTitle = scoreJobTitle;
exports.scoreFormatting = scoreFormatting;
exports.generateSuggestions = generateSuggestions;
exports.preprocessText = preprocessText;
exports.cosineSimilarity = cosineSimilarity;
exports.DEFAULT_WEIGHTS = DEFAULT_WEIGHTS;
exports.DEFAULT_ALIASES = DEFAULT_ALIASES;
exports.DEFAULT_SKILLS_TAXONOMY = DEFAULT_SKILLS_TAXONOMY;
exports.default = calculateATSScore;

module.exports = {
  calculateATSScore,
  scoreKeywords,
  scoreSkills,
  scoreExperience,
  scoreEducation,
  scoreJobTitle,
  scoreFormatting,
  generateSuggestions,
  preprocessText,
  cosineSimilarity,
  DEFAULT_WEIGHTS,
  DEFAULT_ALIASES,
  DEFAULT_SKILLS_TAXONOMY,
  default: calculateATSScore
};
