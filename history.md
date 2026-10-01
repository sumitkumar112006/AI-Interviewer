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

## 3. AI Assistant System Prompts Directory & Code Locations

| Component | File Path | Line Range | System Prompt Purpose & Logic |
| :--- | :--- | :--- | :--- |
| **Full Resume Generator** | `Backend/src/services/ai.service.js` | Lines 1042–1130 | Generates initial ATS-compliant single-column A4 semantic HTML resume from candidate profile & target JD. Enforces strict CSS styling and clean typography. |
| **Standalone Section Rewriter** | `Backend/src/services/ai.service.js` | Lines 1269–1301 | Standalone `/resume/rewrite-section` endpoint prompt. Rewrites specific sections (Summary, Experience, Skills) with JD skill gap mapping, Google X-Y-Z formula, and TipTap semantic HTML. |
| **Main Assistant Orchestrator** | `Backend/src/ai-assistant/assistant.orchestrator.js` | Lines 364–395 | System prompt for Kivi AI Assistant. Dictates conversational tone, actionable advice, and dual-payload JSON response formatting (`messageForUser` + `ResumeUpdations`). |
| **MicroLLM Context Router & Decider** | `Backend/src/ai-assistant/assistant.orchestrator.js` | Lines 24–120 | Evaluates user query to dynamically load context (Resume, JD, Roadmap) with a 60% leniency threshold and picks up to 3 parallel tools. |
| **Intent Classifier Router** | `Backend/src/ai-assistant/intentClassifier.js` | Lines 172–230 | Standalone classifier routing queries to `RESUME`, `ROADMAP`, `JOB_DESCRIPTION`, `GENERAL`, etc. |

---

## 4. Tool Execution & Multi-Tool Capabilities Analysis

### Architectural Improvements & Implementation Status
1. **Multi-Tool Calling Support:** [COMPLETED] Updated `decideToolCallWithLlm` in `assistant.orchestrator.js` to return `tools: [{ tool, query }]` array and execute up to 3 tools simultaneously via `Promise.allSettled`.
2. **Active Web Tool Execution:** [COMPLETED] Direct `searchWeb(query, 3)` wired for live company & market research.
3. **UI Component System in `src/UI`:** [COMPLETED] Created `ToolSymbol`, `ToolBadge`, `MultiToolStatusStrip`, and `ToolResourceCard` with custom styling and animations.
4. **TipTap Markdown Sanitizer Upgrade:** [COMPLETED] Enhanced `parseAndSanitizeSnippet` to convert Markdown headings (`###`) and bullet points (`•`, `-`) to semantic HTML (`<h2>`, `<ul><li>`) before inserting into TipTap.
5. **Always-Ready Context Engine (Streamlined):** [COMPLETED] Target JD and Candidate Resume are directly injected from MongoDB into the prompt on every turn without Vector RAG chunk embedding overhead.
6. **Smart Company & Entity Extraction:** [COMPLETED] `decideToolCallWithLlm` in `assistant.orchestrator.js` automatically resolves "this company" to the target company name from the Job Description (e.g., "Five9", "Google") when creating search queries.
7. **On-Demand Roadmap Tool:** [COMPLETED] Candidate's 14-day roadmap is fetched on-demand via the `"roadmap"` tool only when the user or LLM explicitly requests roadmap tasks/progress.
8. **Clean LLM Payload Logger:** [COMPLETED] Streamlined terminal logger in `assistant.orchestrator.js` to log only the exact payload/messages sent to the LLM without diagnostic clutter.
9. **Unified Micro-Router (60% Leniency Threshold):** [COMPLETED] Single fast ~100-token Micro-Router call selectively loads Job Description, Resume, or Roadmap into context, saving 75–85% token costs on generic queries.
10. **Markdown Table Restriction & Rich Clickable Links:** [COMPLETED] Strictly banned markdown tables to prevent drawer overflow. Mandated direct, active markdown links (`[Title](URL)`) for all resources, YouTube videos, LeetCode problems, GitHub repos, and docs.
11. **YouTube Video Hallucination Fix & Auto-Sanitizer:** [COMPLETED] Added `CURATED_YOUTUBE_VIDEOS` bank in `searchTool.service.js` and implemented `sanitizeOutputLinks` in `assistant.orchestrator.js` to transform unverified video IDs into guaranteed 100% active YouTube search URLs (`https://www.youtube.com/results?search_query=...`).

---

## 5. End-to-End AI Assistant & TipTap Diff Pipeline Architecture

### The Complete 5-Step Execution Pipeline

```
[ Step 1: User Query ] ──► ("add product management skill" / "what is my match score?")
           │
           ▼
[ Step 2: MicroLLM Router ] 
  Fast decision returning: { tools: [...], needsResume: boolean, needsJD: boolean, is_resume_edit: boolean }
           │
           ▼
[ Step 3: Main LLM Orchestrator ]
  Executes with (System Prompt + Selected Context [Resume, JD, Tools] + Chat History + Query)
           │
           ├──────────────────────────────────────┬──────────────────────────────────────┐
           ▼                                                                             ▼
   ─── Case 1: Resume Edit ───                                                  ─── Case 2: Non-Edit Query ───
   FinalResp = {                                                                FinalResp = {
     messageForUser: "I've added product management...",                          messageForUser: "Your match score is 85%...",
     ResumeUpdations: "<updated HTML content>",                                   ResumeUpdations: false,
     targetText: "<original section/line>",                                       toolCalls: [...]
     toolCalls: [...]                                                           }
   }                                                                            
           │                                                                             │
           ▼                                                                             ▼
[ Step 4: Diff Tracking & TipTap Viewport ]                                    [ Direct Chat Path ]
  if (finalResp.ResumeUpdations) {                                               Editor remains untouched
    updatedPart = TrackUpdatePart(oldResume, finalResp.ResumeUpdations)
    Rendered(updatedPart)  // Highlighted in-place on TipTap canvas
    // Renders [ ✓ Accept | ✕ Reject ] floating pill + chat action buttons
    // If Accepted: Commit updatedPart to document state
    // If Rejected: Revert to oldResume cleanly
  }
           │
           ▼
[ Step 5: Chat Assistant Output ]
  Print `finalResp.messageForUser` in the AI Assistant chatbox
  (Clean, conversational message without dumping full documents or raw code blocks)
```

### Component & File Mapping

| Step | Component | File Path | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| **Step 1** | Chat Input Drawer | `Frontend/src/features/Shared/components/KiviAiAssistant.jsx` | Captures user prompt, grabs live editor HTML via `window.__KIVI_GET_CURRENT_RESUME_HTML__()`, and triggers streaming SSE call. |
| **Step 2** | MicroLLM Context Router | `Backend/src/ai-assistant/assistant.orchestrator.js` & `dynamicContextLoader.js` | Fast classification returning `{ tools, needsResume, needsJD, is_resume_edit }` to selectively assemble minimal context tokens. |
| **Step 3** | Dual-Payload Orchestrator | `Backend/src/ai-assistant/assistant.orchestrator.js` | Generates structured JSON: Case 1 (`messageForUser` + `ResumeUpdations` HTML) vs Case 2 (`messageForUser` + `ResumeUpdations: false`). |
| **Step 4** | Targeted Viewport Replacement | `Frontend/src/features/Interview/utils/trackUpdatePart.js`, `ResumeEditor.jsx`, `editor.scss`, `Resume.jsx` | Accurately distinguishes full documents from targeted snippets. Replaces ONLY the matching targeted section/line (e.g. Summary, Skills, Bullet) in-place without wiping or altering the rest of the resume. Includes heading deduplication to prevent double section titles. |
| **Step 5** | Conversational Output Only | `Frontend/src/features/Shared/components/KiviAiAssistant.jsx` & `KiviAiAssistant.scss` | Streams only `messageForUser` cleanly into the chat drawer without duplicate code blocks, raw HTML cards, or document dumps. Displays verified learning resource cards when relevant. |

### Section Heading Deduplication Fix
- **Root Cause**: When the LLM outputs `ResumeUpdations` containing a section heading (e.g. `Summary\n...` or `<h3>Summary</h3><p>...</p>`), but `targetText` targets only the paragraph text under the existing template heading (`<h2>SUMMARY</h2>`), inserting the snippet resulted in two consecutive headings (`SUMMARY` followed by `Summary`).
- **Resolution**:
  1. **Prompt Enforcement** (`assistant.orchestrator.js`): Instructed LLM to output ONLY the body paragraph/list when rewriting a specific section under an existing heading.
  2. **Parser Handling** (`sanitizeResumeHtml.js`): Correctly identifies standalone section title lines via `STANDALONE_SECTION_REGEX` instead of wrapping them in plain `<p>` tags.
  3. **In-Editor Deduplication** (`ResumeEditor.jsx`): `replaceExactText` checks if the replacement text starts with a section heading while the target text does not, automatically stripping the redundant leading heading before inserting.

---

## 6. Admin Portal Redesign & Infrastructure Enhancements

### 6.1 Admin Login Page (`AdminLogin.jsx` & `adminLogin.scss`)
- **Visual Design:** Cyber dark-mode aesthetics with radial glow backgrounds, glassmorphism cards, and Lucide status icons.
- **Security & Session Feedback:** Live TLS/encryption indicator pill, 60s OTP countdown timer with cooldown protection, and active session switch alerts.
- **Backend Fix:** Updated `verifyOtpController` in `Backend/src/controller/auth.controller.js` to return `role` and `isAdmin` flags in both the signed JWT token and the JSON response body.

### 6.2 Universal Admin Pagination Component (`AdminPagination.jsx`)
- **Features:** Glassmorphic navigation bar with dynamic page numbers, previous/next controls, customizable items-per-page selector (`10`, `25`, `50`, `100`), and quick jump-to-page input.
- **Integrated Across Tabs:**
  1. `AdminFeatureMatrixTab.jsx` (Feature Access Matrix)
  2. `AdminDashboard.jsx` (User Directory)
  3. `AdminSubscriptionsTab.jsx` (Subscriptions)
  4. `AdminPaymentsTab.jsx` (Payments)
  5. `AdminAuditLogsTab.jsx` (Audit Trail)

### 6.3 User Evaluation & Account Controls (`UserEvaluationPage.jsx` & `userEvaluation.scss`)
- **Theme:** Google Cloud / Vertex AI dark telemetry theme with real-time analytics.
- **Feature Permission Logic:** Corrected MongoDB inverted storage logic (`Switch ON = Enabled = sets blockedFeatures[key]: false`).
- **Granular Credit Sliders:** Dual range sliders with manual numeric inputs for `customBonusCredits` (standard generations) and `customAiBonusCredits` (AI Assistant queries).
- **In-Portal Inspection & Messaging:** Document preview modal for resumes and interview reports; quick template chips for direct administrative messaging.

---

## 7. Google Docs / Gemini-Style In-Canvas Diff Preview Mode

### 7.1 Visual Specification & UX Behavior
- **Strikethrough Cut Effect on Older Content (`<del class="kivi-diff-del">`):**
  - Older/original text being replaced is rendered with `text-decoration: line-through !important`, `text-decoration-color: #ef4444 !important`, `opacity: 0.45 !important`, `color: #dc2626 !important`, and subtle red background tint `rgba(239, 68, 68, 0.08)`.
  - On hover, opacity increases to `0.75` for inspection.
- **Highlighted New Content (`<ins class="kivi-diff-ins">`):**
  - New suggested text is placed immediately following the strikethrough text with `color: #047857 !important`, `background: rgba(16, 185, 129, 0.12) !important`, `border-bottom: 2px solid #10b981 !important`, and subtle glowing pulse animation (`diffGlowPulse`).
- **Floating Pill Banner (`.kivi-floating-diff-banner`):**
  - Centered floating action banner above the A4 canvas: `[ 🪄 AI Suggested Resume Update | ✕ Reject | ✓ Accept ]`.
  - **Accept Click (`handleAcceptDiff`):** Strips all `<del class="kivi-diff-del">` nodes, unwraps `<ins class="kivi-diff-ins">` nodes into pristine resume text, commits to localStorage/state, and closes the floating banner.
  - **Reject Click (`handleRejectDiff`):** Reverts document back to `oldFullResumeHtml` (clean original text without any diff tags), and closes the floating banner.

### 7.2 TipTap & Architecture Integration
1. **Custom TipTap Marks (`DiffDel`, `DiffIns`):** Registered in `ResumeEditor.jsx` to ensure ProseMirror preserves `<del class="kivi-diff-del">` and `<ins class="kivi-diff-ins">` tags during live DOM parsing.
2. **Sanitizer Compatibility (`sanitizeResumeHtml.js`):** Whitelisted `kivi-diff-del`, `kivi-diff-ins`, and `kivi-diff-ins-block` classes so the sanitizer does not strip diff preview classes.
3. **Diff Generator (`trackUpdatePart.js`):** Generates both `diffPreviewHtml` (strikethrough preview) and `mergedFullResumeHtml` (clean target for Accept) for full documents, section rewrites, and paragraph/line edits.

### 7.3 Leaf-Node Target Matching Resolution (Preventing Section-Wide Strikethroughs)
- **Problem**: When a user modified or added a single skill item inside a `<ul>` list (e.g. `AI & ML APIs`), the section matcher matched the parent container `<ul>` and struck through every single sibling `<li>` item in that entire section.
- **Fix**:
  1. Updated `TrackUpdatePart.js` to search and score leaf nodes (`<li>`, `<p>`, `<h1>`–`<h6>`) directly using `explicitTargetText` and category prefix matching (`<strong>Category:</strong>`).
  2. Isolated diff `<del>` and `<ins>` tags to only the exact matching `<li>` or `<p>` node.
  3. All sibling list items, paragraphs, and headings remain 100% untouched.
  4. Updated `assistant.orchestrator.js` system prompt to enforce returning only the specific updated line and exact `targetText`.


