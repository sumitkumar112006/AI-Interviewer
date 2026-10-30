/**
 * @file parsingAndEditorPlacement.test.js
 * Comprehensive Unit and Integration Test Suite for:
 * 1. AI Assistant Dual-Payload Parser (assistant.orchestrator.js)
 * 2. Editor Placement & Diff Tracker (trackUpdatePart.js)
 * 3. Sanitizer & Ghost Bullet Pruning (sanitizeResumeHtml.js)
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { parseDualPayloadAssistantReply } = require('../ai-assistant/assistant.orchestrator.js');

describe('Parsing Engine & Editor Placement Test Suite', () => {

    let TrackUpdatePart;
    let sanitizeResumeHtml;
    let parseAndSanitizeSnippet;

    beforeAll(async () => {
        // Setup browser DOM environment for frontend utility testing using ESM linkedom
        const { parseHTML } = await import('linkedom');

        class CustomDOMParser {
            parseFromString(str, type) {
                let content = str || '';
                if (!/<html|<body/i.test(content)) {
                    content = '<!DOCTYPE html><html><body>' + content + '</body></html>';
                }
                const dom = parseHTML(content);
                return dom.document;
            }
        }

        const dom = parseHTML('<!DOCTYPE html><html><body></body></html>');
        global.window = dom.window;
        global.document = dom.document;
        global.DOMParser = CustomDOMParser;
        globalThis.DOMParser = CustomDOMParser;
        globalThis.window = dom.window;
        globalThis.document = dom.document;
        dom.window.DOMParser = CustomDOMParser;
        global.NodeFilter = { SHOW_ALL: -1, SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 };

        // Dynamically import ES modules from Frontend
        const trackPath = pathToFileURL(path.resolve(__dirname, '../../../Frontend/src/features/Interview/utils/trackUpdatePart.js')).href;
        const sanitizePath = pathToFileURL(path.resolve(__dirname, '../../../Frontend/src/features/Interview/utils/sanitizeResumeHtml.js')).href;
        const trackModule = await import(trackPath);
        const sanitizeModule = await import(sanitizePath);
        TrackUpdatePart = trackModule.TrackUpdatePart;
        sanitizeResumeHtml = sanitizeModule.sanitizeResumeHtml;
        parseAndSanitizeSnippet = sanitizeModule.parseAndSanitizeSnippet;
    });

    const SAMPLE_RESUME_HTML = `
        <h1>John Doe</h1>
        <p>john.doe@example.com | <a href="https://linkedin.com/in/johndoe">LinkedIn</a> | <a href="https://github.com/johndoe">GitHub</a></p>
        
        <h2>SKILLS</h2>
        <ul>
            <li><strong>Languages & Frameworks:</strong> C++, Python, JavaScript, TypeScript, React.js, Node.js</li>
            <li><strong>Databases & Caching:</strong> MongoDB, PostgreSQL, Redis</li>
            <li><strong>Cloud & DevOps:</strong> Docker, Git, GitHub Actions, AWS (S3, EC2)</li>
        </ul>

        <h2>PROJECTS</h2>
        <h3><strong>Distributed Task Queue</strong> <span style="float: right;">2025 | <a href="https://github.com/johndoe/task-queue">GitHub</a></span></h3>
        <ul>
            <li>Engineered asynchronous job processing engine with Redis and Node.js.</li>
            <li>Reduced peak message delay by 40% with worker clustering.</li>
        </ul>

        <h2>EXPERIENCE</h2>
        <p><strong>Software Engineer Intern</strong> — <em>Tech Corp</em> <span style="float: right;">2024 - 2025</span></p>
        <ul>
            <li>Maintained internal dashboard APIs with Express and MongoDB.</li>
            <li>Collaborated with senior engineers on unit testing and bug triaging.</li>
        </ul>

        <h2>EDUCATION</h2>
        <p><strong>B.S. in Computer Science</strong> — <em>State University</em> <span style="float: right;">2021 - 2025</span></p>
    `.trim();

    // ──────────────────────────────────────────────────────────────────────────
    // 1. UNIT TESTS: AI Assistant Dual-Payload Extraction
    // ──────────────────────────────────────────────────────────────────────────
    describe('1. AI Assistant Dual-Payload Response Parser', () => {

        test('correctly parses single JSON edit payload with targetText and targetSection', () => {
            const rawLlmOutput = JSON.stringify({
                messageForUser: "Added Java to your Languages bullet to match the backend requirements.",
                ResumeUpdations: "<li><strong>Languages & Frameworks:</strong> C++, Python, JavaScript, TypeScript, React.js, Node.js, Java</li>",
                targetText: "Languages & Frameworks: C++, Python, JavaScript, TypeScript, React.js, Node.js",
                targetSection: "SKILLS"
            });

            const parsed = parseDualPayloadAssistantReply(rawLlmOutput, true);

            expect(parsed.messageForUser).toContain("Added Java");
            expect(parsed.ResumeUpdations).toContain("Java");
            expect(parsed.targetText).toBe("Languages & Frameworks: C++, Python, JavaScript, TypeScript, React.js, Node.js");
            expect(parsed.targetSection).toBe("SKILLS");
        });

        test('correctly parses and merges multiple consecutive JSON blocks', () => {
            const rawLlmOutput = `
                {
                    "messageForUser": "Updated Languages bullet to include Java.",
                    "ResumeUpdations": "<li><strong>Languages & Frameworks:</strong> C++, Python, JavaScript, TypeScript, React.js, Node.js, Java</li>",
                    "targetText": "Languages & Frameworks: C++, Python, JavaScript, TypeScript, React.js, Node.js",
                    "targetSection": "SKILLS"
                }
                {
                    "messageForUser": "Added Tableau for data visualization.",
                    "ResumeUpdations": "<li><strong>Data & Analytics:</strong> Tableau</li>",
                    "targetText": null,
                    "targetSection": "SKILLS"
                }
            `;

            const parsed = parseDualPayloadAssistantReply(rawLlmOutput, true);

            expect(parsed.messageForUser).toContain("Updated Languages bullet");
            expect(parsed.messageForUser).toContain("Added Tableau");
            expect(parsed.ResumeUpdations).toContain("Java");
            expect(parsed.ResumeUpdations).toContain("Data & Analytics:</strong> Tableau");
            expect(parsed.targetText).toBe("Languages & Frameworks: C++, Python, JavaScript, TypeScript, React.js, Node.js");
        });

        test('strips "(NEW)" or "[NEW]" tags from LLM responses automatically', () => {
            const rawLlmOutput = JSON.stringify({
                messageForUser: "Added modern cloud tools.",
                ResumeUpdations: "<li><strong>Cloud & DevOps:</strong> Docker, Git, AWS (S3, EC2), Kubernetes (NEW), Terraform [NEW]</li>",
                targetText: "Cloud & DevOps: Docker, Git, GitHub Actions, AWS (S3, EC2)"
            });

            const parsed = parseDualPayloadAssistantReply(rawLlmOutput, true);

            expect(parsed.ResumeUpdations).not.toContain("(NEW)");
            expect(parsed.ResumeUpdations).not.toContain("[NEW]");
            expect(parsed.ResumeUpdations).toContain("Kubernetes");
            expect(parsed.ResumeUpdations).toContain("Terraform");
        });

        test('returns ResumeUpdations: false for purely informational non-edit queries', () => {
            const rawLlmOutput = JSON.stringify({
                messageForUser: "Your match score is 78%. You can improve it by adding experience with AWS Lambda.",
                ResumeUpdations: false
            });

            const parsed = parseDualPayloadAssistantReply(rawLlmOutput, false);

            expect(parsed.ResumeUpdations).toBe(false);
            expect(parsed.suggestedSnippet).toBeNull();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 2. UNIT TESTS: Sanitization & Ghost Bullet Pruning
    // ──────────────────────────────────────────────────────────────────────────
    describe('2. Sanitization Engine & Ghost Bullet Pruning', () => {

        test('removes empty <li> elements and empty <ul> containers', () => {
            const dirtyHtml = `
                <ul>
                    <li><strong>Languages:</strong> Python, JavaScript</li>
                    <li></li>
                    <li>   </li>
                    <li>&nbsp;</li>
                </ul>
                <ul>
                    <li> </li>
                </ul>
            `;

            const cleaned = sanitizeResumeHtml(dirtyHtml);

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cleaned;
            const lis = tempDiv.querySelectorAll('li');
            expect(lis.length).toBe(1);
            expect(lis[0].textContent).toContain('Python');
        });

        test('unwraps nested <ul> inside <li> cleanly in parseAndSanitizeSnippet', () => {
            const nestedListSnippet = `
                <ul>
                    <li><strong>Cloud:</strong> AWS, Docker, Kubernetes</li>
                </ul>
            `;

            const cleanSnippet = parseAndSanitizeSnippet(nestedListSnippet);
            expect(cleanSnippet).toContain('AWS, Docker, Kubernetes');
            expect(cleanSnippet).not.toContain('<ul');
        });

        test('preserves anchor tags with target="_blank" and valid hrefs in live demo links', () => {
            const linkHtml = `<p>Check out the <a href="https://demo-ecommerce.vercel.app">Live Demo</a> and <a href="https://github.com/myrepo">Source Code</a></p>`;
            const sanitized = sanitizeResumeHtml(linkHtml);

            expect(sanitized).toContain('href="https://demo-ecommerce.vercel.app"');
            expect(sanitized).toContain('href="https://github.com/myrepo"');
            expect(sanitized).toContain('target="_blank"');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 3. INTEGRATION TESTS: Editor Placement & Diff Tracking (TrackUpdatePart)
    // ──────────────────────────────────────────────────────────────────────────
    describe('3. Editor Placement & Diff Tracking (TrackUpdatePart)', () => {

        test('Skill Replacement: Updates existing category bullet in-place without adding extra lines', () => {
            const updatedSnippet = `<li><strong>Languages & Frameworks:</strong> C++, Python, JavaScript, TypeScript, React.js, Node.js, Java, Go</li>`;
            const targetText = "Languages & Frameworks: C++, Python, JavaScript, TypeScript, React.js, Node.js";

            const diffResult = TrackUpdatePart(SAMPLE_RESUME_HTML, updatedSnippet, targetText, 'SKILLS');

            expect(diffResult.hasChanges).toBe(true);
            expect(diffResult.changeType).toBe('line_replace');

            // In merged output, the old line is updated with Java and Go
            expect(diffResult.mergedFullResumeHtml).toContain('Java, Go');
            // The databases bullet must still exist untouched right after it
            expect(diffResult.mergedFullResumeHtml).toContain('MongoDB, PostgreSQL, Redis');

            // In diff preview, both old (del) and new (ins) are inside the exact same <li>
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = diffResult.diffPreviewHtml;
            const diffItem = tempDiv.querySelector('li');

            expect(diffItem).not.toBeNull();
            expect(diffItem.querySelector('.kivi-diff-del')).not.toBeNull();
            expect(diffItem.querySelector('.kivi-diff-ins')).not.toBeNull();
            expect(diffItem.textContent).toContain('Java, Go');
        });

        test('Project Insertion: Places new project with live demo links cleanly into PROJECTS section', () => {
            const newProjectHtml = `
                <h3><strong>Serverless E-Commerce API</strong> <span style="float: right;">2026 | <a href="https://api-demo.aws.com">Live Demo</a></span></h3>
                <ul>
                    <li>Architected scalable microservices using AWS Lambda and DynamoDB.</li>
                    <li>Integrated Stripe checkout webhooks with sub-200ms processing latency.</li>
                </ul>
            `;

            const diffResult = TrackUpdatePart(SAMPLE_RESUME_HTML, newProjectHtml, null, 'PROJECTS');

            expect(diffResult.hasChanges).toBe(true);
            expect(diffResult.changeType).toBe('section_insert');
            expect(diffResult.sectionName).toBe('PROJECTS');

            // Merged doc must place the new project BEFORE the EXPERIENCE section
            const mergedHtml = diffResult.mergedFullResumeHtml;
            const projectHeadingIdx = mergedHtml.indexOf('Serverless E-Commerce API');
            const expHeadingIdx = mergedHtml.indexOf('EXPERIENCE');

            expect(projectHeadingIdx).toBeGreaterThan(-1);
            expect(projectHeadingIdx).toBeLessThan(expHeadingIdx); // Located inside PROJECTS, before EXPERIENCE!
            expect(mergedHtml).toContain('href="https://api-demo.aws.com"');
            expect(mergedHtml).toContain('Live Demo');
        });

        test('Experience Insertion: Places new job role into EXPERIENCE section without affecting projects or education', () => {
            const newExperienceHtml = `
                <p><strong>Cloud Engineer Intern</strong> — <em>Global Systems</em> <span style="float: right;">2025 - Present</span></p>
                <ul>
                    <li>Automated Kubernetes deployments using Helm charts and ArgoCD.</li>
                    <li>Managed AWS IAM access policies across 10+ development environments.</li>
                </ul>
            `;

            const diffResult = TrackUpdatePart(SAMPLE_RESUME_HTML, newExperienceHtml, null, 'EXPERIENCE');

            expect(diffResult.hasChanges).toBe(true);
            expect(diffResult.changeType).toBe('section_insert');
            expect(diffResult.sectionName).toBe('EXPERIENCE');

            const mergedHtml = diffResult.mergedFullResumeHtml;
            const expIdx = mergedHtml.indexOf('Cloud Engineer Intern');
            const eduIdx = mergedHtml.indexOf('EDUCATION');

            expect(expIdx).toBeGreaterThan(-1);
            expect(expIdx).toBeLessThan(eduIdx); // Placed before EDUCATION!
        });

        test('Fuzzy Leaf-Node Match: Finds target bullet even if targetText has minor whitespace or punctuation differences', () => {
            const updatedSnippet = `<li><strong>Databases & Caching:</strong> MongoDB, PostgreSQL, Redis, Apache Cassandra</li>`;
            const fuzzyTarget = "Databases & Caching: MongoDB, PostgreSQL, Redis";

            const diffResult = TrackUpdatePart(SAMPLE_RESUME_HTML, updatedSnippet, fuzzyTarget, 'SKILLS');

            expect(diffResult.hasChanges).toBe(true);
            expect(diffResult.changeType).toBe('line_replace');
            expect(diffResult.mergedFullResumeHtml).toContain('Apache Cassandra');
        });

        test('Normalizes legacy "<p><strong>Role/Entry:</strong> ...</p>" into clean <h3>', () => {
            const legacySnippet = `
                <p><strong>Role/Entry:</strong> Real-Time Chat Engine (WebSockets) 2026 | <a href="https://chat.dev">Live Demo</a></p>
                <ul>
                    <li>Implemented high-concurrency room dispatching.</li>
                </ul>
            `;

            const diffResult = TrackUpdatePart(SAMPLE_RESUME_HTML, legacySnippet, null, 'PROJECTS');

            expect(diffResult.hasChanges).toBe(true);
            expect(diffResult.mergedFullResumeHtml).not.toContain('Role/Entry:');
            expect(diffResult.mergedFullResumeHtml).toContain('Real-Time Chat Engine (WebSockets)');
            expect(diffResult.mergedFullResumeHtml).toContain('<h3>');
        });
    });
});
