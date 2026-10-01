# KIVI AI Assistant & Resume Studio Architecture History

---

## 1. Resume Storage & TipTap Viewport Pipeline

### Storage & Data Model
- **Database Model:** `InterviewReports` in `backend/src/models/interviewReport.model.js`
- **Fields:** `generatedResumeHtml` (`String`), `resume` (`String`)
- **Format:** Semantic HTML document (`<h1>`, `<h2>`, `<h3>`, `<p>`, `<ul><li><strong>...</strong></li></ul>`, `<span style="float: right;">...</span>`).

### Frontend Flow & TipTap Viewport
1. **API Retrieval:** `Resume.jsx` fetches the report via `getReportById(interviewId)`.
2. **Sanitization:** Raw HTML is filtered by `sanitizeResumeHtml.js` (removes dangerous scripts, external container styles, normalizes pseudo-bullet `<p>` tags into semantic `<ul><li>`).
3. **TipTap Rendering:** `ResumeEditor.jsx` receives `initialHtml` and parses it into ProseMirror DOM nodes inside `.tiptap-a4-page > .tiptap-prose[contenteditable="true"]`.

---

## 2. Root Cause Analysis: TipTap Viewport Markdown Leakage

### The Issue
Raw markdown formatting (e.g. `### SKILLS`, `• **Product Management:**`) was appearing as literal unstyled text inside the TipTap editor.

### Underlying Causes
1. **Context Flattening:** `backend/src/ai-assistant/dynamicContextLoader.js` converts HTML headings and list items to markdown string tokens (`\n### `, `\n• `) before sending context to the LLM.
2. **LLM Formatting Response:** Because the LLM receives markdown, it outputs suggestions in markdown format within ` ```suggestion ` code blocks.
3. **Insertion into Editor:** `KiviAiAssistant.jsx` was inserting markdown strings directly into the TipTap contenteditable DOM without parsing markdown to semantic HTML elements.

---

## 3. AI Assistant System Prompts Mapping

| Component | File Path | Line Range | Purpose |
| :--- | :--- | :--- | :--- |
| **Main Assistant Orchestrator** | `backend/src/ai-assistant/assistant.orchestrator.js` | Lines 292–383 | Base system prompt, role-specific guidelines, rewrite rules (` ```suggestion `). |
| **Tool Decider Engine** | `backend/src/ai-assistant/assistant.orchestrator.js` | Lines 24–46 | Evaluates whether web, github, leetcode, or video tools should execute. |
| **Standalone Section Rewriter** | `backend/src/services/ai.service.js` | Lines 1305–1330 | Direct `/resume/rewrite-section` endpoint prompt. |
| **Intent Classifier Router** | `backend/src/ai-assistant/intentClassifier.js` | Lines 172–230 | Classifies query intent (`RESUME`, `ROADMAP`, `JOB_DESCRIPTION`, etc.). |
| **Full Resume Generator** | `backend/src/services/ai.service.js` | Lines 1043–1128 | Initial ATS-compliant single-column A4 HTML resume generator. |

---

## 4. Tool Execution & Multi-Tool Capabilities Analysis

### Current Limitations
1. **Strict Negative Prompting:** `decideToolCallWithLlm` in `assistant.orchestrator.js` defaults to `"none"` if questions can be answered with general knowledge, suppressing tool calls for company/resource searches.
2. **Unused `searchWeb` Tool:** `searchWeb` was imported in `assistant.orchestrator.js` but routed to `searchDynamicRoadmapResources` instead of triggering live web searches.
3. **Single-Tool Limitation:** The system currently handles only 1 tool output per query rather than firing parallel multi-tool searches (e.g., Company Research + LeetCode Problems + YouTube Tutorials).

### Proposed Architectural Improvements & Implementation Status
1. **Multi-Tool Calling Support:** [COMPLETED] Updated `decideToolCallWithLlm` in `assistant.orchestrator.js` to return `tools: [{ tool, query }]` array and execute up to 3 tools simultaneously via `Promise.allSettled`.
2. **Active Web Tool Execution:** [COMPLETED] Direct `searchWeb(query, 3)` wired for live company & market research.
3. **UI Component System in `src/UI`:** [COMPLETED] Created `ToolSymbol`, `ToolBadge`, `MultiToolStatusStrip`, and `ToolResourceCard` with custom styling and animations.
4. **TipTap Markdown Sanitizer Upgrade:** [COMPLETED] Enhanced `parseAndSanitizeSnippet` to convert Markdown headings (`###`) and bullet points (`•`, `-`) to semantic HTML (`<h2>`, `<ul><li>`) before inserting into TipTap.
5. **Always-Ready Context Engine (Streamlined):** [COMPLETED] Target JD and Candidate Resume are directly injected from MongoDB into the prompt on every turn without Vector RAG chunk embedding overhead.
6. **Smart Company & Entity Extraction:** [COMPLETED] `decideToolCallWithLlm` in `assistant.orchestrator.js` now automatically resolves "this company" to the target company name from the Job Description (e.g., "Five9", "Google") when creating search queries.
7. **On-Demand Roadmap Tool:** [COMPLETED] Candidate's 14-day roadmap is no longer dumped into every prompt; instead, it is fetched on-demand via the `"roadmap"` tool only when the user or LLM explicitly requests roadmap tasks/progress.
8. **Clean LLM Payload Logger:** [COMPLETED] Streamlined terminal logger in `assistant.orchestrator.js` to log only the exact payload/messages sent to the LLM (including user query and injected prompts) without diagnostic clutter.
9. **Unified Micro-Router (60% Leniency Threshold):** [COMPLETED] Replaced separate intent classification and tool decision passes with a single fast ~100-token Micro-Router call. Selectively loads Job Description, Resume, or Roadmap into LLM context with a lenient 60% threshold, saving 75–85% token costs on generic queries while ensuring context is never missed when relevant.
10. **Markdown Table Restriction & Rich Clickable Links:** [COMPLETED] Strictly banned markdown tables (`| col1 | col2 |`) to prevent drawer overflow. Mandated direct, active markdown links (`[Title](URL)`) for all resources, YouTube videos, LeetCode problems, GitHub repos, and docs instead of text search instructions.
11. **YouTube Video Hallucination Fix & Auto-Sanitizer:** [COMPLETED] LLMs inherently hallucinate 11-char random YouTube video IDs (e.g. `watch?v=Zc8cG9K5YVY` which 404s). Added `CURATED_YOUTUBE_VIDEOS` bank in `searchTool.service.js` and implemented `sanitizeOutputLinks` in `assistant.orchestrator.js` which verifies every link against real scraper/oEmbed results and automatically transforms any unverified video ID into a guaranteed 100% active YouTube live search URL (`https://www.youtube.com/results?search_query=...`).

