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

---

## 🚀 Proposed High-Impact Features & Platform Enhancements

1. **⚡ 1-Click "Personalized 14-Day Skill Action Roadmap" (From Analytics)**:
   - Uses detected skill gaps from the Analytics matrix to generate a tailored 14-day bridge plan with curated YouTube/docs resources.
   - Saves generated roadmaps directly into `user.careerProfile.savedRoadmaps`.

2. **🌊 Real-Time SSE Token Streaming for KIVI AI Assistant** *(COMPLETED)*:
   - Upgraded `/api/assistant/chat` to stream tokens via Server-Sent Events (SSE) for instant sub-200ms initial response times.

3. **🔴 Live ATS Compatibility Meter & AI Diff Highlighter (In Resume Editor)**:
   - Live ATS score gauge (0-100%) dynamically updating during edits in `ResumeEditor.jsx`.
   - Before-vs-After green/red diff highlights when AI rewrites/enhances bullet points with action verbs and metrics.

4. **🎙️ Interactive Mock Interview Practice Mode (STAR Method Grader)**:
   - Interactive answering box under generated behavioral & technical questions.
   - AI evaluates candidate answers using the STAR methodology (Situation, Task, Action, Result) with actionable scoring and missing keyword detection.

5. **🎯 Target Company Tier Mode (FAANG / Product Startup / Fintech)**:
   - Customizable interview evaluation strictness & focus based on target company tier (e.g. FAANG focuses on scale/DSA, Fintech on concurrency/DB, Startups on rapid shipping).

---

## 📌 Active Tasks & Backlog for Next Sessions
- [x] Connect KIVI AI assistant orchestrator to `/api/assistant/chat` endpoint and frontend drawer.
- [x] Add SSE Token Streaming to KIVI AI Assistant.
- [x] Implement TipTap Google Docs-style Font Family Picker & Floating Link Popover.
- [x] Implement Smart Intent Classification & Dynamic Context Engine with Zero-DB Optimization.
- [x] Pass 30/30 Intent Benchmark Test Suite.
- [x] Link MongoDB `preparationPlan` into Assistant Dynamic Context Loader.
- [ ] Add Live ATS Score Gauge & Diff Highlighter in Resume Editor.
- [ ] Test Google Supabase login & OTP flow end-to-end.
- [ ] Finalize deployment pipelines (Vercel Frontend + Railway/Render Backend).
