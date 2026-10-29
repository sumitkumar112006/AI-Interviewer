/**
 * @file atsScorer.test.js
 * @description Unit tests for the ATS match scoring engine.
 * Covers edge cases: empty resume/JD, perfect match, no matching skills,
 * experience caps, synonym/alias expansion, and configurable weights.
 */

const {
  calculateATSScore,
  scoreKeywords,
  scoreSkills,
  scoreExperience,
  scoreEducation,
  scoreJobTitle,
  scoreFormatting,
  preprocessText,
  cosineSimilarity
} = require('../services/atsScorer.js');

describe('ATS Scoring Engine - Production Test Suite', () => {

  // --------------------------------------------------------------------------
  // TEST 1: Empty or Invalid Inputs (Graceful handling, no crashes)
  // --------------------------------------------------------------------------
  test('Edge Case 1: handles empty, null, and whitespace inputs gracefully without crashing', async () => {
    // 1a. Completely empty resume
    const emptyResult = await calculateATSScore('', 'Software Engineer with JavaScript experience');
    expect(emptyResult.overallScore).toBe(0);
    expect(emptyResult.breakdown.keywordMatch.score).toBe(0);
    expect(emptyResult.breakdown.skillsMatch.score).toBe(0);
    expect(emptyResult.breakdown.formatting.issues).toContain('Resume text is empty.');
    expect(emptyResult.suggestions.length).toBeGreaterThan(0);
    expect(emptyResult.suggestions[0]).toMatch(/provide a non-empty resume/i);

    // 1b. Null / Undefined resume
    const nullResumeResult = await calculateATSScore(null, 'Job description here');
    expect(nullResumeResult.overallScore).toBe(0);

    // 1c. Empty job description
    const emptyJdResult = await calculateATSScore('John Doe\nSoftware Developer with 5 years experience', '   ');
    expect(emptyJdResult.overallScore).toBe(0);
    expect(emptyJdResult.suggestions[0]).toMatch(/provide a target job description/i);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Perfect Match
  // --------------------------------------------------------------------------
  test('Edge Case 2: scores very high (>= 90) on a comprehensive, perfectly aligned resume', async () => {
    const jobDescription = `
      Title: Senior Full Stack Engineer
      We are looking for a Senior Full Stack Engineer with 4+ years of experience.
      Requirements:
      - Strong proficiency in React, Node.js, TypeScript, PostgreSQL, and Docker.
      - Experience with Amazon Web Services (AWS) and CI/CD pipelines.
      - Strong communication, problem solving, and agile collaboration skills.
      - Bachelor's degree in Computer Science or Software Engineering.
    `;

    const resume = `
      John Doe
      Title: Senior Full Stack Engineer
      john.doe@example.com | (555) 234-5678 | github.com/johndoe | linkedin.com/in/johndoe

      Summary
      Experienced Senior Full Stack Engineer with over 6 years of expertise building robust web platforms.
      Strong background in React, Node.js, TypeScript, PostgreSQL, Docker, and AWS.

      Skills
      • Technical Skills: JavaScript, TypeScript, React, Node.js, Express.js, PostgreSQL, Docker, AWS, CI/CD, Git
      • Soft Skills: Problem Solving, Agile, Communication, Teamwork, Mentorship

      Experience
      Lead Software Engineer | Acme Corporation | Jan 2019 - Present
      • Architected microservices with Node.js and TypeScript, increasing throughput by 45%.
      • Designed responsive web interfaces with React and Tailwind CSS.
      • Managed PostgreSQL database migrations and Docker containerized deployments to AWS.
      • Facilitated agile ceremonies and collaborated across cross-functional engineering teams.

      Software Developer | TechCorp Labs | Jun 2017 - Dec 2018
      • Developed RESTful backend services using Express and PostgreSQL.
      • Automated test suites with Jest, increasing test coverage from 60% to 92%.

      Education
      Bachelor of Science in Computer Science | University of Technology | 2013 - 2017

      Projects
      • CloudDeploy CLI: Open-source Docker deployment tool with 1,500 GitHub stars.
      • E-Commerce Microservices: Scalable distributed store backend built with React and Node.js.
    `;

    const result = await calculateATSScore(resume, jobDescription);

    expect(result.overallScore).toBeGreaterThanOrEqual(90);
    expect(result.breakdown.skillsMatch.score).toBeGreaterThanOrEqual(90);
    expect(result.breakdown.experienceMatch.score).toBe(100);
    expect(result.breakdown.educationMatch.score).toBe(100);
    expect(result.breakdown.titleMatch.score).toBeGreaterThanOrEqual(90);
    expect(result.breakdown.formatting.issues.length).toBe(0);

    // Verify key skills were matched
    const matchedSkills = result.breakdown.skillsMatch.matched;
    expect(matchedSkills).toContain('react');
    expect(matchedSkills).toContain('node.js');
    expect(matchedSkills).toContain('typescript');
    expect(matchedSkills).toContain('postgresql');
    expect(matchedSkills).toContain('docker');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Zero / No Matching Skills
  // --------------------------------------------------------------------------
  test('Edge Case 3: scores 0 on skills when resume has zero skill overlap and identifies all missing requirements', async () => {
    const jobDescription = `
      Title: Cloud Infrastructure Engineer
      Requirements:
      - 3+ years experience with Go, Rust, Kubernetes, and Terraform.
      - Experience with Helm, gRPC, and Microservices.
    `;

    const resume = `
      Jane Smith
      Accountant & Payroll Administrator
      jane.smith@example.com | 555-987-6543

      Summary
      Dedicated financial accountant with 5 years experience handling corporate payroll, ledger reconciliation, and tax filings.

      Skills
      • Microsoft Excel, QuickBooks, Financial Auditing, Accounts Payable, Tax Preparation

      Experience
      Senior Accountant | Apex Finance | Jan 2019 - Present
      • Managed $10M corporate operating budget and audited monthly revenue statements.
      • Prepared quarterly GAAP tax filings with 100% compliance.

      Education
      Bachelor of Business Administration in Accounting | State College | 2014 - 2018

      Projects
      • Financial Automation: Automated spreadsheet macros using Excel VBA.
    `;

    const result = await calculateATSScore(resume, jobDescription);

    // Skills match should be 0 because none of Go, Rust, Kubernetes, or Terraform are present
    expect(result.breakdown.skillsMatch.score).toBe(0);
    expect(result.breakdown.skillsMatch.missing.length).toBeGreaterThanOrEqual(3);

    // Suggestions should explicitly urge candidate to add missing technical skills
    const suggestionsText = result.suggestions.join(' ');
    expect(suggestionsText).toMatch(/add missing required skills/i);
    expect(suggestionsText).toMatch(/kubernetes|go|rust|terraform/i);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Experience Parsing, Proportional Scoring & Cap at 100
  // --------------------------------------------------------------------------
  test('Edge Case 4: accurately parses experience requirements, scores proportionally, and caps at 100', async () => {
    const jd = 'Role: Backend Developer. Requires 5+ years of experience with Node.js.';

    // Case 4a: Candidate exceeds requirement (8 years) -> Cap at 100
    const seniorResume = `
      Alex Rivers | Senior Engineer
      alex@example.com | 555-111-2222
      Summary: Senior Backend Engineer with 8+ years of professional experience.
      Experience:
      Software Engineer | Tech Inc | Jan 2016 - Present
      • Engineered scalable APIs.
      Education:
      BS in Computer Science
      Projects:
      • Distributed Cache
    `;
    const seniorResult = await calculateATSScore(seniorResume, jd);
    expect(seniorResult.breakdown.experienceMatch.score).toBe(100);
    expect(seniorResult.breakdown.experienceMatch.details.status).toBe('exceeds');
    expect(seniorResult.breakdown.experienceMatch.details.candidateYears).toBeGreaterThanOrEqual(8);

    // Case 4b: Candidate has less experience (2 years) -> Proportional (~40%)
    const juniorResume = `
      Taylor Swift | Junior Developer
      taylor@example.com | 555-333-4444
      Summary: Junior developer eager to build web systems.
      Experience:
      Junior Engineer | Startup LLC | Jan 2022 - Jan 2024
      • Built REST endpoints with Node.js.
      Education:
      BS in Computer Science
      Projects:
      • Chat Application
    `;
    const juniorResult = await calculateATSScore(juniorResume, jd);
    // ~2.1 years / 5 years = 42%
    expect(juniorResult.breakdown.experienceMatch.score).toBeGreaterThanOrEqual(40);
    expect(juniorResult.breakdown.experienceMatch.score).toBeLessThanOrEqual(45);
    expect(juniorResult.breakdown.experienceMatch.details.status).toBe('below');
    expect(juniorResult.suggestions.some(s => s.includes('5+ years of experience'))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Synonym / Alias Matching & Configurable Weights
  // --------------------------------------------------------------------------
  test('Edge Case 5: recognizes tech aliases (JS=JavaScript, Mongo=MongoDB, K8s=Kubernetes) and respects custom weights', async () => {
    const jd = `
      Title: Software Engineer
      Looking for an engineer proficient in JavaScript, MongoDB, Node.js, and Kubernetes.
    `;

    // Candidate uses only abbreviations / aliases: JS, Mongo, Node, K8s
    const resume = `
      Devin Vance
      devin@example.com | 555-444-5555
      Title: Software Engineer

      Summary
      Software Engineer skilled in modern web development.

      Skills
      • JS, Mongo, Node, K8s

      Experience
      Full Stack Engineer | CloudCorp | Jan 2021 - Present
      • Maintained Node microservices connected to Mongo databases orchestrated via K8s.

      Education
      Bachelor's in Computer Science

      Projects
      • K8s cluster automation tool using JS and Node.
    `;

    // 5a. Test Alias Matching with default options
    const defaultResult = await calculateATSScore(resume, jd);
    const matched = defaultResult.breakdown.skillsMatch.matched;

    // Canonical names in taxonomy should be recognized via aliases
    expect(matched).toContain('javascript');
    expect(matched).toContain('mongodb');
    expect(matched).toContain('node.js');
    expect(matched).toContain('kubernetes');
    expect(defaultResult.breakdown.skillsMatch.score).toBe(100);

    // 5b. Test Configurable Weights override
    // Put 90% weight on skills and 10% on formatting, zeroing out others
    const customWeights = {
      skillsMatch: 0.90,
      formatting: 0.10,
      keywordMatch: 0,
      experienceMatch: 0,
      educationMatch: 0,
      titleMatch: 0
    };

    const weightedResult = await calculateATSScore(resume, jd, { weights: customWeights });
    expect(weightedResult.breakdown.skillsMatch.weight).toBeCloseTo(0.90, 2);
    expect(weightedResult.breakdown.formatting.weight).toBeCloseTo(0.10, 2);
    expect(weightedResult.overallScore).toBeGreaterThanOrEqual(90);
  });

  // --------------------------------------------------------------------------
  // BONUS TEST: Optional Embeddings & LLM Integration
  // --------------------------------------------------------------------------
  test('Bonus: blends semantic similarity when useEmbeddings=true and respects custom LLM suggestions', async () => {
    const jd = 'React Developer with Redux knowledge.';
    const resume = 'Jane | jane@example.com | 555-000-1111\nSummary: React specialist.\nExperience: Jan 2022 - Present\nSkills: React, Redux\nEducation: BS CS\nProjects: Web Store';

    // Mock embedding function returning 2 identical vectors (cosine sim = 1.0)
    const mockEmbeddingFn = jest.fn(async () => [0.5, 0.5, 0.5, 0.5]);
    const mockLLMCaller = jest.fn(async () => [
      'Custom LLM suggestion: Showcase your Redux store architecture in a portfolio video.'
    ]);

    const result = await calculateATSScore(resume, jd, {
      useEmbeddings: true,
      embeddingFunction: mockEmbeddingFn,
      useLLM: true,
      llmCaller: mockLLMCaller
    });

    expect(mockEmbeddingFn).toHaveBeenCalledTimes(2);
    expect(mockLLMCaller).toHaveBeenCalledTimes(1);
    expect(result.suggestions).toContain(
      'Custom LLM suggestion: Showcase your Redux store architecture in a portfolio video.'
    );
  });

});
