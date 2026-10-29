# 📋 Kivi AI Project & Session History Log

> **Note for AI Assistant**: ALWAYS read this file at the start of any new session or after a context reset to understand the full project background, existing features, and current tasks without asking the user to re-explain.

---

## 🎯 Project Overview & Core Goals
- **Project Name**: Kivi AI (Resume Generator & AI Interview Preparation Platform)
- **Primary Goal**: Full-stack platform that analyzes resumes against target job descriptions, identifies skill gaps, generates tailored resumes/cover letters, and provides AI interview preparation.
- **Tech Stack**:
  - **Frontend**: React (Vite), SCSS, Lucide Icons, TipTap Editor, Axios.
  - **Backend**: Node.js, Express, MongoDB (Mongoose), Redis (ioredis), BullMQ (Async AI Job Queue).
  - **AI Engines**: Multi-provider fallback (Groq / Gemini / OpenRouter / Anthropic).
  - **Auth**: JWT HTTP-only Cookies + Supabase Google OAuth.
  - **Payments**: Razorpay subscriptions, webhook events, invoices.

---

## 🏗️ Architecture & Key Systems

1. **Authentication & User Management**:
   - Email/Password with OTP verification & cooldowns (`Backend/src/controller/auth.controller.js`).
   - Google Sign-In via Supabase Access Tokens (`/api/auth/google-supabase`).
   - Rate limiting via Redis (`ratelimit:auth:*`).

2. **Async AI Generation Queue**:
   - Long-running operations (Interview Report, Resume PDF/HTML generation, Cover Letter) are queued in BullMQ (`Backend/src/jobs/aiQueue.js`, `aiWorker.js`).
   - Client polls `/api/interview/jobs/active` and `/api/interview/jobs/:jobId` until completion.

3. **Career Profile & Self-Description System**:
   - **Schema**: `user.careerProfile` with `selfDescription`, `targetRole`, `experienceLevel`, `targetCompanies`, `savedDescriptions` (presets array), `savedRoadmaps`.
   - **Endpoints**: `PUT /api/auth/career-profile` to update role, default self-description, add new presets, or delete presets.
   - **Auto-Fill & Fallback**: Used across Home interview generation, Cover letter creation, and Resume generator.

4. **KIVI AI Assistant Copilot & Memory Architecture**:
   - Modular orchestrator under `Backend/src/ai-assistant/`.
   - **Redis Working Memory**:
     - `chat:session:${userId}`: Saves **ONLY the current active chat session turns** (not entire history) with a strict **1-Hour TTL (3600 seconds)**.
     - `assistant:key_info:${userId}`: Extracted 5 pillars from report (JD, Candidate, Resume, Company, Profile) for instant access.
     - Rate limiters (`ratelimit:*`) and OTP caches (`auth:otp:*`) continue as normal.
   - **MongoDB Persistent Storage**:
     - Entire multi-session chat history is permanently stored in MongoDB (`chatHistory.model.js`).
     - Interview reports and user career profile are stored long-term in MongoDB.
   - **Tool Calling**: Live real-time web search & curated tutorial/course resource lookup.

---

## 📝 Session Activity Logs

### 🔹 Session: 2026-09-06
- **Topic**: Save Self-Description, Career Profile & Profile Presets Implementation
- **Completed Actions**:
  1. **Home Generator Form ([Home.jsx](file:///Frontend/src/features/Interview/pages/Home.jsx))**:
     - Auto-fills `selfDescription` on load from `user.careerProfile.selfDescription`.
     - Preset chips bar (`preset-chip`) to switch between tailored pitches (Frontend, Backend, etc.).
     - "+ Save Preset" inline creator with title label.
     - Added `[x] Save as default profile self-description` checkbox under textarea.
     - Connected global `setUser` in `useAuth()` to immediately sync updated profile in React state.
  2. **API & Hook Integration**:
     - Forwarded `saveSelfDescription` parameter in `generateInterviewReport` ([interview.api.js](file:///Frontend/src/features/Interview/services/interview.api.js)) and `useInterview.js`.
  3. **Profile Settings Page ([Profile.jsx](file:///Frontend/src/features/Profile/Pages/Profile.jsx) & [profile.scss](file:///Frontend/src/features/Profile/style/profile.scss))**:
     - Added dedicated **"Career Profile & Self-Descriptions"** management section.
     - Editable **Target Role**, **Experience Level** (*Fresher*, *Mid-Level*, *Senior*), and **Default Self-Description**.
     - Full **Saved Presets Manager**: Add new custom presets, set any preset as active default, and delete presets with instant UI & backend sync.
  4. **Cover Letter Fallback ([coverletter.controller.js](file:///Backend/src/controller/coverletter.controller.js))**:
     - Added fallback to `req.user.careerProfile.selfDescription` if input description is left blank.
  5. **Redis Architecture Rule Applied**:
     - Updated [contextAssembler.js](file:///Backend/src/ai-assistant/contextAssembler.js) to store **only current active chat history** with strict **1-Hour TTL (3600s)**.

---

## 🧠 Scalable AI Memory & Analytics Architecture (Zero-Bloat Strategy)

### 🎯 Architecture Decisions:
1. **No Permanent Chat Storage in MongoDB**:
   - We **do not** save chat sessions or long-term chat message logs in MongoDB. This eliminates unnecessary DB storage and keeps the system clean and lightweight.
   - Active conversation turns are stored **ONLY in Redis working memory (`chat:session:${userId}`) with a strict 1-Hour TTL (3600s)**.
2. **Real-Time Analytics Profile as Single Source of Truth**:
   - Instead of storing raw chats, we maintain a **Real-Time Analytics & Candidate Intelligence Profile** (computed live from reports, skill analytics matrix, career profile, and performance metrics).
   - The AI Assistant fetches candidate context directly from this real-time analytics engine (Target Role, Top 3-5 Strengths, Identified Skill Gaps, Match Score, Experience Level).
3. **Super Lightweight Prompting (~250-350 Tokens)**:
   - When communicating with LLMs:
     - `[Compact Candidate Analytics Context (~100 tokens)]`
     - `[Last 4-6 Active Turns from Redis 1-hr buffer (~150 tokens)]`
     - `[User Instruction / Editor Snippet]`
   - Result: Sub-second response latency, minimal token consumption, and zero database bloat.

---

### 🔹 Session: 2026-09-06 (Part 2)
- **Topic**: Real-Time SSE Token Streaming for KIVI AI Assistant Implementation
- **Completed Actions**:
  1. **Multi-Provider LLM Streaming Waterfall ([ai.service.js](file:///Backend/src/services/ai.service.js))**:
     - Implemented `streamLlmWithFallback` with multi-key Groq pool streaming (`stream: true`) for instant sub-200ms TTFT.
     - Automatic failover to Gemini streaming (`generateContentStream`) and OpenRouter.
     - Added unified `callLlmWithFallback` for non-streaming requests.
  2. **KIVI Assistant Orchestrator ([assistant.orchestrator.js](file:///Backend/src/ai-assistant/assistant.orchestrator.js))**:
     - Added `streamAssistantChat` supporting candidate context assembly, live tool invocation (Tavily/YouTube), and regex/markdown snippet extraction (`extractSnippetFromReply`).
     - Non-blocking background turn memory persistence in Redis working memory (`chat:session:${userId}`, 1-hr TTL).
  3. **Backend Controller & SSE Route ([assistant.controller.js](file:///Backend/src/controller/assistant.controller.js) & [assistant.route.js](file:///Backend/src/routes/assistant.route.js))**:
     - Created `POST /api/assistant/chat` with SSE headers (`text/event-stream`, `Cache-Control: no-cache`), tiered rate limiting, and client abort detection (`req.on('close')`).
     - Mounted `/api/assistant` in [app.js](file:///Backend/src/app.js).
  4. **Frontend Real-Time SSE Streamer ([interview.api.js](file:///Frontend/src/features/Interview/services/interview.api.js))**:
     - Implemented `streamAssistantChatApi` using `fetch` and `ReadableStream` reader.
  5. **KIVI Assistant Component ([KiviAiAssistant.jsx](file:///Frontend/src/features/Shared/components/KiviAiAssistant.jsx) & [KiviAiAssistant.scss](file:///Frontend/src/features/Shared/components/KiviAiAssistant.scss))**:
     - Real-time typewriter token streaming into chat bubbles with blinking `.streaming-cursor`.
     - 1-click "Apply to Document" snippet insertion card.
     - Verified study/video resources panel rendering with clickable links.
     - Connected `fetchUsage()` to refresh daily remaining assistant quota upon stream completion.

---

### 🔹 Session: 2026-09-06 (Part 3)
- **Topic**: Single-Report JD Context Injection, Multi-Report Bloat Elimination & Resizable KIVI Window
- **User Query & Feedback**:
  > *"ye important hai hum Usko history me kewal canticate ki infomation de na ki sari info related to theire all reports or dusri chiz hume ye dhyan rkhna hai ki uske pass job description ho current report ka ye sabse important hai jisse usko company ke bare me ab pta chalega abh mujhe btao inme se kya kya hai context ke andar or kya extra hai"*
- **Completed Actions**:
  1. **Removed Multi-Report Aggregation Bloat ([contextAssembler.js](file:///Backend/src/ai-assistant/contextAssembler.js))**:
     - Completely removed the 3-report aggregation loop that merged old scores, strengths, and unrelated historical skill gaps.
     - Replaced with clean candidate profile extraction (`name`, `targetRole`, `experienceLevel`, `selfDescription`).
  2. **Injected Current Report's Job Description & Role Context ([contextAssembler.js](file:///Backend/src/ai-assistant/contextAssembler.js))**:
     - Assistant now targets the **exact currently active report** (`reportId` passed from frontend URL `/resume/:id` or `/interview/:id`).
     - Extracts a compact, high-signal JD summary (~50-80 words) and specific skill gaps for *this* target job (preventing heavy multi-thousand token raw JD bloat).
  3. **Updated Orchestrator & Controller ([assistant.orchestrator.js](file:///Backend/src/ai-assistant/assistant.orchestrator.js) & [assistant.controller.js](file:///Backend/src/controller/assistant.controller.js))**:
     - Threaded `reportId` from frontend through API controller, orchestrator, and context assembler.
  4. **Frontend URL Report Detection ([KiviAiAssistant.jsx](file:///Frontend/src/features/Shared/components/KiviAiAssistant.jsx))**:
     - Automatically parses `currentReportId` from the route (`/resume/:id`, `/interview/:id`, `/cover-letter/:id`) and sends it with every chat stream request.
  5. **Draggable Resizing & 1-Click Maximize ([KiviAiAssistant.jsx](file:///Frontend/src/features/Shared/components/KiviAiAssistant.jsx) & [KiviAiAssistant.scss](file:///Frontend/src/features/Shared/components/KiviAiAssistant.scss))**:
     - Added live drag-to-resize handles on Top border, Left border, and Top-Left corner (`⠿`).
     - Added `🗖` / `🗗` Maximize/Restore toggle button in the header.
     - Persists user custom dimensions in `localStorage.kivi_drawer_size`.
  6. **Sanitized Rich Markdown Rendering**:
     - Integrated `marked` + `DOMPurify` with clean typography, tables, headings, code blocks, and blockquotes.

---

### 🔹 Session: 2026-09-12 (Part 1)
- **Topic**: TipTap Rich Text Google Docs Features (Font Picker & Link Popover) & Speech Voice Services
- **Completed Actions**:
  1. **Google Docs-Style Font Family Picker ([ResumeEditor.jsx](file:///Frontend/src/features/Interview/components/ResumeEditor.jsx) & [editor.scss](file:///Frontend/src/features/Interview/style/editor.scss))**:
     - Custom dropdown selector in TipTap toolbar with 17 curated Google and System fonts (*Merriweather, Georgia, Inter, Roboto, Calibri, Montserrat, Playfair, Lora, Caveat, Roboto Mono, etc.*).
     - Native font previews for each menu item with active selection checkmark.
     - Added Google Fonts preconnect stylesheet in [index.html](file:///Frontend/index.html).
  2. **Google Docs-Style Floating Link Popover ([ResumeEditor.jsx](file:///Frontend/src/features/Interview/components/ResumeEditor.jsx))**:
     - Floating popover modal card triggered by Link toolbar button or `Ctrl+K`.
     - Dual inputs: Text anchor label & Link URL with auto `https://` prefix handling.
     - Real-time preview chip, target `_blank` handling, Apply, Cancel, and Remove Link button.
  3. **Help & Support Page ([HelpSupport.jsx](file:///Frontend/src/features/HelpSupport/pages/HelpSupport.jsx))**:
     - Interactive search, categorized FAQs, support tickets, and contact modal.
  4. **Neural Speech & Voice Services ([speech.service.js](file:///Backend/src/services/speech.service.js), [speech.controller.js](file:///Backend/src/controller/speech.controller.js), [speech.route.js](file:///Backend/src/routes/speech.route.js))**:
     - Neural text-to-speech audio streaming and candidate voice simulation.

---

### 🔹 Session: 2026-09-12 (Part 2)
- **Topic**: Smart Intent Classification & Dynamic Context Engine for AI Assistant
- **Problem Statement**:
  - Previously, every chat query unconditionally queried MongoDB collections (`User` and `InterviewReport`) and injected full candidate profiles into LLM prompts. This resulted in token bloat (~1,800–2,400 tokens per message) and unnecessary database latency.
- **Architectural Implementation**:
  1. **Two-Tier Intent Classifier ([intentClassifier.js](file:///Backend/src/ai-assistant/intentClassifier.js))**:
     - **Tier 1 (Fast Regex & Deterministic Heuristics - 0ms latency)**: Analyzes query keywords, action presets, and `selectedText` to instantly categorize requests.
     - **Tier 2 (Micro-LLM Semantic Fallback - ~80ms)**: Lightweight Groq model fallback for complex Hinglish phrases and ambiguous requests.
     - **High-Precision Intent Taxonomy**:
       - `RESUME`: Resume edits, section refinements, ATS optimization, phone/contact updates.
       - `ROADMAP`: 14-day study plans, learning path generation, roadmap updates.
       - `INTERVIEW_REPORT`: Mock interview score analysis, weak area identification, performance recommendations.
       - `JOB_SEARCH`: Job & internship discovery tailored to skills/profile.
       - `PROJECT`: Portfolio project retrieval & deep explanation.
       - `SKILLS`: Profile skills inspection.
       - `MULTI`: Compound requests (e.g. Resume + Roadmap, Report + Resume).
       - `UNKNOWN`: Vague requests without context (triggers clarification without querying DB).
       - `AMBIGUOUS`: Keyword stuffing/spam (triggers clarification, 0 DB calls).
       - `SECURITY`: Jailbreak / prompt injection / data exfiltration shield (safe rejection, 0 unrestricted DB access).
       - `GENERAL`: General tech concepts, coding, syntax, architecture (0 DB calls).
       - `PLATFORM_HELP`: Features, pricing, PDF download (0 DB calls).
  2. **Dynamic Context Loader ([dynamicContextLoader.js](file:///Backend/src/ai-assistant/dynamicContextLoader.js))**:
     - **Zero DB Calls**: Completely bypasses MongoDB for `TECH_CONCEPT`, `GENERAL`, `PLATFORM_HELP`, `UNKNOWN`, `SECURITY`.
     - **Selective Lean Projections**: Selectively queries only requested fields (`resume.summary`, `resume.skills`, `job.targetRole`, `report.matchScore`, `report.skillGaps`, `report.preparationPlan`).
     - **Dynamic History Bounding**: Fresh queries bypass chat history injection (`history_turns_needed: 0`), cutting token usage by **50% to 85%**.
  3. **Orchestrator Integration ([assistant.orchestrator.js](file:///Backend/src/ai-assistant/assistant.orchestrator.js) & [index.js](file:///Backend/src/ai-assistant/index.js))**:
     - Integrated dynamic classification and context loading into both streaming (`streamAssistantChat`) and non-streaming (`processAssistantChat`).
  4. **Exhaustive 30/30 Benchmark Test Suite**:
     - Ran 30 diverse test cases across English, Hinglish, vague queries, multi-intent queries, and security jailbreaks.
     - **Score: 30/30 Passed (100% Accuracy)** across Intent, Action, and Context Keys.

---

### 🔹 Session: 2026-09-12 (Part 3)
- **Topic**: Report Technical Preparation Plan Roadmap Extraction & Diagnostic
- **User Issue**:
  - User asked *"report ka roadmap do"* in chat, but AI assistant outputted a document-writing outline for a UX research report with personas and SUS scores instead of the actual **14-Day Technical Preparation Roadmap (`preparationPlan`)** stored in the report.
- **Root Cause Diagnostic**:
  1. Frontend `KiviAiAssistant.jsx` was passing default `action: 'enhance'`, causing LLM to assume user wanted to rewrite/draft document text.
  2. LLM misinterpreted "report roadmap" as an outline for writing a research report document.
  3. Database `preparationPlan` was not previously extracted and passed into the LLM system prompt.
- **Resolution Implemented**:
  1. Updated `dynamicContextLoader.js` to explicitly query and format `preparationPlan` array (`Day 1... Day 14` with daily focus & tasks) whenever `roadmap` or `interview_report` context is requested.
  2. Updated `intentClassifier.js` to recognize report-based roadmap queries and bind `Context: ["roadmap", "interview_report"]`.
  4. **Strict Separation of Rewrite vs Conversational Advice**:
     - The AI Assistant will **ONLY** generate replacement code blocks (` ```suggestion...``` `) and "Apply to Document" chips when the user has explicitly highlighted a text snippet or explicitly issued a rewrite/replace command.
     - For all informational queries, advice, roadmaps, reviews, interview prep, or general chat, the AI will provide clean conversational markdown bullets and **NEVER attempt to rewrite or replace the active document**.

### 🔹 Session: 2026-09-27
- **Topic**: Architectural Overhaul: Tiered Semantic Context & Intent Router (Replacing Brittle Regex Rules)
- **Problem & Root Cause**:
  - The AI Assistant previously relied on over 500 lines of hardcoded regular expressions (`hasResumeKeywords`, `hasJdKeywords`, `explicitNoJd`, `allThreeRegex`, etc.) to guess which contextual documents (Resume, Job Description, Preparation Roadmap, User Profile, Web Search) to attach to user queries.
  - This rule-based approach broke on conversational English, Hinglish (*"is role ke liye mera project kaisa hai"*, *"bina JD ke check karo"*), multi-hop questions, and cross-domain reasoning, either dropping critical context or injecting unneeded text blobs and blowing token budgets.
- **Industry-Grade Solution Implemented ([Backend/src/ai-assistant/intentClassifier.js](file:///Backend/src/ai-assistant/intentClassifier.js))**:
  1. **Tier 1: Fast Deterministic Guardrails & Action Presets (0ms)**:
     - Security & prompt injection shield (blocking jailbreaks, DB dumps, and env leaks).
     - Instant passthrough for direct 1-click UI button actions (`enhance`, `shorten`, `fix_grammar`, `make_ats`).
     - Zero-DB routing for standard conversational greetings and platform help questions.
  2. **Tier 2: Micro-LLM Semantic Context & Intent Dispatcher (~150ms)**:
     - Leverages fast micro-LLM reasoning (`llama-3.1-8b-instant` / `gemini-1.5-flash`) with strict JSON schema to evaluate user intent, active tab context, highlighted text, and natural language nuances.
     - Selects granular context flags: `{ resume: boolean, jd: boolean, roadmap: boolean }`, `web_search: boolean`, `is_rewrite: boolean`, and formats `output_format` accordingly.
     - Handles Hinglish, typos, cross-entity comparisons, and explicit negative constraints (*"bina JD ke"* -> `jd: false`).
  3. **Screen-Aware Safe Fallback**:
     - If network timeouts or API limits occur, automatically falls back to safe screen-aware defaults based on the active UI tab (`activeTab: resume` -> loads resume, `activeTab: interview` -> loads resume + JD).
  4. **In-Memory LRU/TTL Cache (15 min)**:
     - Delivers 0ms responses for repeated queries.
  5. **Live Verification**:
     - Tested across Hinglish match queries, negative constraint prompts, roadmap practice discovery, and general software engineering questions with 100% accuracy.

  6. **Smooth 60 FPS Word-by-Word SSE Streaming Pipeline ([KiviAiAssistant.jsx](file:///Frontend/src/features/Shared/components/KiviAiAssistant.jsx))**:
     - Built an adaptive `requestAnimationFrame` token buffer queue that eliminates network chunk stuttering and renders smooth word-to-word text.
     - Memoized message bubbles (`ChatMessageBubble`) so past chat history is not re-parsed on every streaming frame.
     - Added glowing cursor animation and smart scroll tracking.

---

### 🔹 Session: 2026-09-27 (Part 2)
- **Topic**: AI Resume HTML Generation, TipTap Compatibility, and Report Creation Pipeline Overhaul
- **Problem & Root Cause**:
  - When candidates generated an interview report, `generatedResumeHtml` was not created concurrently in the `interview_report` background worker job.
  - As a result, when users navigated to the Resume Studio tab, `Resume.jsx` encountered an empty `generatedResumeHtml` and fell back to wrapping the candidate's raw unformatted uploaded resume text into `<p>` paragraphs.
  - This caused unstyled raw text dumps on the TipTap A4 canvas and in some cases displayed bracketed coaching questions (e.g. `[Question: ...]`) extracted from the candidate's raw notes.
- **Comprehensive Solution Implemented**:
  1. **Parallel Report & Resume Generation ([aiWorker.js](file:///Backend/src/jobs/aiWorker.js))**:
     - Updated the `interview_report` job handler to execute both `generateInterviewReport` and `generateResumeHtml` concurrently in `Promise.allSettled`.
     - Stored the structured `generatedResumeHtml` directly on the `InterviewReport` document upon report creation.
     - Pre-warmed background RAG vector embeddings for Roadmap, Job Description, and Resume simultaneously.
  2. **Strict Prompt Refinement & Semantic HTML ([ai.service.js](file:///Backend/src/services/ai.service.js))**:
     - Refined the `generateResumeHtml` prompt with strict negative constraints: strictly forbidden from generating critique questions, bracketed notes (`[Question: ...]`, `[Insert Metric]`), or pseudo-bullet characters in `<p>`.
     - Enforced semantic HTML tags (`<h1>`, `<h2>`, `<h3>`, `<p>`, `<ul>`, `<li>`, `<strong>`, `<em>`, `<a>`) that map 1:1 into TipTap prose nodes.
  3. **Sanitization & List Normalization ([sanitizeResumeHtml.js](file:///Frontend/src/features/Interview/utils/sanitizeResumeHtml.js))**:
     - Added regex sanitizers to strip any stray bracketed coaching notes (`[Question: ...]`, `[Note: ...]`).
     - Automatically converts any pseudo-bullet paragraphs (`<p>• ...</p>`, `<p>- ...</p>`) into semantic `<ul><li>` list structures for clean rendering in TipTap.
     - Strips unwanted outer wrappers, scripts, styles, and inline layout styles to ensure seamless A4 sheet formatting.
  4. **Eliminated Raw Paragraph Fallback ([Resume.jsx](file:///Frontend/src/features/Interview/pages/Resume.jsx))**:
     - Removed the legacy raw text `<p>` fallback. If `generatedResumeHtml` is missing or corrupted, the client automatically triggers clean AI resume generation (`generateResumePdf(interviewId, { force: true })`).
  5. **Executive Layout & Compact Typography Styling ([editor.scss](file:///Frontend/src/features/Interview/style/editor.scss) & [ai.service.js](file:///Backend/src/services/ai.service.js))**:
     - Reduced line height from `1.55` to `1.35` and tightened paragraph margins (`0.22em`) and bullet margins (`0.12em`) to eliminate wide spacing.
     - Added Deep Navy Blue accent section headings (`<h2>`) with crisp `2px solid #0f3d68` divider bars.
     - Styled centered candidate header blocks (`<h1>`, italic tagline, contact info, and links).
     - Formatted Technical Skills as compact bullet lists and Experience/Projects rows with right-aligned dates.
  6. **AI Assistant Snippet & Replacement Parsing Pipeline ([sanitizeResumeHtml.js](file:///Frontend/src/features/Interview/utils/sanitizeResumeHtml.js), [Resume.jsx](file:///Frontend/src/features/Interview/pages/Resume.jsx), [ResumeEditor.jsx](file:///Frontend/src/features/Interview/components/ResumeEditor.jsx), [KiviAiAssistant.jsx](file:///Frontend/src/features/Shared/components/KiviAiAssistant.jsx))**:
     - Built `parseAndSanitizeSnippet(snippet)` to parse markdown code fences (` ```suggestion...``` `, ` ```html...``` `), convert inline markdown (`**bold**`, `*italic*`, `[link](url)`) to semantic HTML, and sanitize HTML tags before applying updates to TipTap.
     - Ensured replacement text seamlessly blends into the A4 document structure without breaking list items or leaking raw markdown syntax.

---

### 🔹 Session: 2026-09-30
- **Topic**: Live ATS (Applicant Tracking System) Calculator Architecture & Implementation Design for Resume Builder
- **Requirement & Goal**:
  - Implement a real-time, live ATS scoring calculator in the Resume Studio (`Resume.jsx` & `ResumeEditor.jsx`) that delivers 0ms instant feedback as candidates type/edit their resume.
  - Dynamically evaluate match quality against the candidate's target Job Description (`report.jobDescription`) and detected technical skills.
- **Architectural Design & Core Pillars**:
  1. **ATS Scoring Formula (Weighted 0-100 Score)**:
     - **Keywords & Hard Skills (35%)**: Match rate against target JD skills, technical stacks, and role title alignment.
     - **Impact & Action Verbs (25%)**: Ratio of bullet points starting with strong action verbs (`built`, `architected`, `engineered`, `scaled`, `optimized`) and quantifiable metrics (`%`, `$`, multiplier `2x`, volume `100k+`, latency numbers).
     - **Section Completeness (20%)**: Standard ATS section detection (Contact Info with valid email/phone/links, Summary, Work Experience, Technical Skills, Education, Projects).
     - **Formatting & Readability (20%)**: Word count density (optimal 400-800 words), bullet point length, valid contact syntax, absence of ATS parsing blockers.
  2. **Client-Side Live Calculation Engine (`Frontend/src/features/Interview/utils/atsCalculator.js`)**:
     - Fast zero-latency parsing on TipTap editor `onChange` with a 200-300ms debounce.
     - Extracts sections, tokenizes JD keywords (filtering stop words), detects strong action verbs, and identifies quantifiable achievements via regex.
     - Returns `{ overallScore, breakdown: { keywords, impact, sections, formatting } }`.
  3. **Live ATS Score Panel UI (`Frontend/src/features/Interview/components/AtsScorePanel.jsx`)**:
     - SVG Circular/Radial score gauge (color-coded: Green 80+, Amber 60-79, Red <60).
     - Category breakdown progress bars (Keywords, Impact, Structure, Formatting).
     - Interactive **Recommended Missing Keywords** chips (click-to-insert into active editor selection).
     - Live **ATS Audit Checklist** with real-time pass/fail indicators (Email, Phone, Metrics count, Experience headers).
  4. **Integration with TipTap Resume Studio (`Resume.jsx`)**:
     - Embeds `AtsScorePanel` directly into the Resume Studio workspace layout.
     - Feeds `report.jobDescription` and `report.detectedSkills` automatically into the evaluation pipeline.
     - Connects with KIVI AI Copilot / `rewriteResumeSection` for 1-click ATS bullet point improvements.

---

## 🚀 Proposed High-Impact Features & Platform Enhancements

1. **⚡ 1-Click "Personalized 14-Day Skill Action Roadmap" (From Analytics)**:
   - Uses detected skill gaps from the Analytics matrix to generate a tailored 14-day bridge plan with curated YouTube/docs resources.
   - Saves generated roadmaps directly into `user.careerProfile.savedRoadmaps`.

2. **🌊 Real-Time SSE Token Streaming for KIVI AI Assistant** *(COMPLETED)*:
   - Upgraded `/api/assistant/chat` to stream tokens via Server-Sent Events (SSE) for instant sub-200ms initial response times.

3. **🔴 Live ATS Compatibility Meter & AI Diff Highlighter (In Resume Editor)** *(IN PROGRESS)*:
   - Live ATS score gauge (0-100%) dynamically updating during edits in `ResumeEditor.jsx` based on JD keywords, action verbs, metrics, and section structure.
   - Interactive missing keyword chips and live ATS checklist.

4. **🎙️ Interactive Mock Interview Practice Mode (STAR Method Grader)**:
   - Interactive answering box under generated behavioral & technical questions.
   - AI evaluates candidate answers using the STAR methodology (Situation, Task, Action, Result) with actionable scoring and missing keyword detection.

5. **🎯 Target Company Tier Mode (FAANG / Product Startup / Fintech)**:
   - Customizable interview evaluation strictness & focus based on target company tier (e.g. FAANG focuses on scale/DSA, Fintech on concurrency/DB, Startups on rapid shipping).

---

### 🔹 Session: 2026-10-22
- **Topic**: Production ATS Match Engine Implementation & Resume Studio ATS Display
- **Completed Actions**:
  1. **Production-Quality ATS Scoring Engine (`Backend/src/services/atsScorer.js`)**:
     - Engineered modular `calculateATSScore(resumeText, jobDescriptionText, options)` function with ES Modules and CommonJS dual compatibility.
     - **Keyword Match (30%)**: TF-IDF extraction with logarithmic repetition scaling (`1 + ln(tf)`), exact, stemmed (`PorterStemmer`), and synonym/alias matching (`JS` $\rightarrow$ `JavaScript`, `Mongo` $\rightarrow$ `MongoDB`, `Node` $\rightarrow$ `Node.js`, `K8s` $\rightarrow$ `Kubernetes`, `AWS` $\rightarrow$ `Amazon Web Services`).
     - **Skills Match (25%)**: Categorized hard skills (languages, frameworks, databases, cloud, devops) vs. soft skills (communication, agile, leadership). Weighted hard skills at 75% and soft skills at 25%, with extensive canonical alias dictionary.
     - **Experience Match (20%)**: Regex-based required years extraction (`5+ years`, `3-5 years`), candidate date range extraction (`Jan 2019 - Present`, `03/2018 - 11/2021`, etc.), and overlapping interval merging algorithm to prevent double-counting tenure. Proportional scoring capped at 100.
     - **Education Match (10%)**: Hierarchy comparison (Doctorate $\rightarrow$ Master's $\rightarrow$ Bachelor's $\rightarrow$ Associate's) with STEM/Tech field detection.
     - **Job Title Match (10%)**: Fuzzy string similarity combining Jaro-Winkler distance and token set overlap with substring bonuses.
     - **Formatting & Parsability (5%)**: Standard ATS section detection (Summary, Skills, Experience, Education, Projects), contact info (valid email, phone), bullet points presence, table structure detection, and word count validation.
     - **Actionable Suggestions Generator**: Dynamic generation of prioritized fixes for missing skills, core keywords, experience gaps, and formatting flaws.
     - **Optional Signals**: Cosine similarity blending on semantic vector embeddings (`options.useEmbeddings`) and LLM suggestion hook (`options.useLLM`).
     - **Jest Unit Test Suite (`Backend/src/tests/atsScorer.test.js`)**: 6 comprehensive unit tests covering empty inputs, perfect match, zero matching skills, experience cap, tech aliases, and embeddings/LLM calls. All 32 backend tests pass (100%).
  2. **Dual-Engine Link Extraction Module (`Backend/src/services/linkExtractor.js`, `urlUtils.js`)**:
     - Recovers hidden hyperlinks from PDF annotation dictionaries (`/Annots`) with coordinate matching to visible text layer.
     - Extracts relationships from DOCX `word/_rels/document.xml.rels`.
     - Deduplicates, validates, and classifies candidate links (GitHub, LinkedIn, Portfolio, Demos).
     - Connected to interview & cover letter AI prompt injection pipeline.
  3. **Resume Studio Minimalist ATS View (`Frontend/src/features/Interview/pages/Resume.jsx`, `ResumeSkillsWindow.jsx`)**:
     - Streamlined the Resume Studio view to show **ONLY the ATS Score** without visual clutter or extra text.
     - Docked side trigger: `• ATS SCORE: {score}%`.
     - Clean SVG radial gauge displaying the exact match score (0-100%).
     - Top navigation bar integration: `ATS Score: {score}%` badge.

### 🔹 Session: 2026-10-22 (Part 2)
- **Topic**: 1-Click Missing Keyword Inserter, Live ATS Recalculation with Shimmer, Full Skills Window & AI Section Insertion
- **Completed Actions**:
  1. **1-Click Missing Keyword Inserter (`Frontend/src/features/Interview/pages/Resume.jsx`, `ResumeSkillsWindow.jsx`, `resume.scss`, `skillsWindow.scss`)**:
     - Extracted missing technical skills and keywords from ATS breakdown (`breakdown.skillsMatch.missing` & `breakdown.keywordMatch.missing`).
     - Added quick-access horizontal chip strip (`.rp-missing-keywords-bar`) directly above `<ResumeEditor>` displaying interactive pills with `+` action badges.
     - Added dedicated Sub-Window 3 (`missing-window`) inside `ResumeSkillsWindow` with amber indicator dots (`.capsule-missing.is-clickable-inserter`) and filter integration.
     - Implemented smart `handleInsertKeyword`:
       - If TipTap is focused: injects formatted keyword directly at cursor position.
       - If not focused: executes regex section discovery to append the keyword into the Technical Skills block without duplicate headings or syntax breakage.
       - Immediately updates `resumeSkills` state, synchronizes `localStorage`, removes keyword from missing list, and triggers real-time ATS recalculation.
  2. **Debounced Live ATS Score Recalculator & Header Shimmer Sweep (`Resume.jsx`, `resume.scss`)**:
     - Configured responsive 750ms debounced `triggerAtsRecalculation` calling `calculateResumeAtsScore(interviewId, html)`.
     - Added dynamic CSS shimmer sweep (`.rp-ats-badge.is-calculating`) with `@keyframes ats-shimmer-sweep` and `@keyframes ats-badge-shimmer` giving fluid visual feedback during active computation.
     - Automatically recalculates on keystrokes, 1-click keyword insertions, AI snippet applications, diff acceptances, and manual/auto saves.
  3. **Restored Full Two-Window Skills Evolution Panel (`ResumeSkillsWindow.jsx`, `skillsWindow.scss`)**:
     - Restored the dual sub-window skills interface (Current Resume Skills vs. Original Baseline Skills) alongside the new Missing JD Keywords window.
     - Independent collapse chevrons (`>`), metric filter strip (New `+N`, Retained, Not in Resume, Missing JD), live search, and resizable draggable slider edge (`skills-window-slider-edge`).
  4. **Intelligent Section Insertion Engine (`Frontend/src/features/Interview/utils/trackUpdatePart.js`)**:
     - Upgraded `TrackUpdatePart` diff engine to support pure additions (e.g. adding a new project to `PROJECTS` or adding a new role to `EXPERIENCE`).
     - When no target leaf node matches, it dynamically discovers the section boundary, inserts the new item into both `mergedDoc` and `diffDoc` (with `<ins class="kivi-diff-ins">`), preventing changes from being lost when diffs are accepted.
  5. **End-to-End Live Browser Automated Testing (`browser_subagent`)**:
     - Logged in and tested live on `http://localhost:5173/resume/6ada414e5618c3a6fd644ba6` against Microsoft Research India JD.
     - Verified 1-Click Keywords: clicked missing keyword pills which instantly injected into the resume.
     - Added 2 new projects via KIVI AI Assistant: *Distributed Real-Time AI Inference Pipeline* and *Self-Evolving Agentic RL Framework with LLM Reward Modeling*.
     - Added targeted professional experience: *AI Research Engineer – Microsoft Research India (2026 – Present)*.
     - Verified ATS Match Score progression: **25%** $\rightarrow$ **57%** $\rightarrow$ **79%** (Skills Match: **100%**, Keyword Match: **88%**, Experience Match: **80%**).
     - Saved and verified in MongoDB. Recorded WebP session video in artifacts.

---

## 🔮 Capabilities Preserved for Future Frontend Implementation

The following advanced capabilities are fully built and verified in the backend engine, preserved in history for future implementation in the UI:

1. **Interactive ATS Category Breakdown Drawer**:
   - Tabbed or accordion view expanding the overall ATS score into its 6 constituent categories: Keyword Match (30%), Skills Match (25%), Experience (20%), Education (10%), Title Alignment (10%), and Document Formatting (5%).
2. **AI-Powered ATS Actionable Improvement Suggestions Drawer**:
   - Dedicated drawer or modal displaying LLM-generated recommendations to tailor bullet points and close experience/title gaps.
3. **Direct File Upload ATS Scoring API**:
   - `POST /api/ats/score` endpoint to upload and evaluate PDF / DOCX resumes directly with `pdf-parse` and `multer`.

---

## 📌 Active Tasks & Backlog for Next Sessions
- [x] Connect KIVI AI assistant orchestrator to `/api/assistant/chat` endpoint and frontend drawer.
- [x] Add SSE Token Streaming to KIVI AI Assistant.
- [x] Implement TipTap Google Docs-style Font Family Picker & Floating Link Popover.
- [x] Implement Smart Intent Classification & Dynamic Context Engine with Zero-DB Optimization.
- [x] Pass 30/30 Intent Benchmark Test Suite.
- [x] Link MongoDB `preparationPlan` into Assistant Dynamic Context Loader.
- [x] Overhaul Intent Classifier into Tiered Semantic Context & Intent Router (Replacing Brittle Regex Rules).
- [x] Implement 60 FPS Word-to-Word Smooth Streaming Buffer & Layout Auto-Closer.
- [x] Fix AI Resume Structured HTML Generation, TipTap Sanitization, & Auto Report Worker Pipeline.
- [x] Build Production ATS Match Scoring Engine with 6 modular categories (`Backend/src/services/atsScorer.js`).
- [x] Integrate PDF/DOCX hyperlink extraction into AI prompt pipelines (`Backend/src/services/linkExtractor.js`).
- [x] Streamline Resume Studio page to show ONLY the ATS score.
- [x] Enable real-time, responsive ATS score recalculation upon updating resume in editor or saving.
- [x] Implement 1-Click Missing Keyword & Skills Injector above editor and in Skills Window.
- [x] Implement Shimmer Sweep Animation on ATS Badge during recalculation.
- [x] Implement Intelligent Section Insertion in TrackUpdatePart for AI-generated projects & experience.
- [ ] Implement Future Capability 1: Interactive ATS Category Breakdown Drawer.
- [ ] Implement Future Capability 2: Actionable AI ATS Improvement Suggestions Drawer.
- [ ] Test Google Supabase login & OTP flow end-to-end.
- [ ] Finalize deployment pipelines (Vercel Frontend + Railway/Render Backend).



