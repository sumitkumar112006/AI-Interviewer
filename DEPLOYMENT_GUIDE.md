```bash
# Locally test backend with env vars
PORT=3000 npm run dev

# Locally test frontend
cd Frontend && npm run dev

# Build for production
cd Frontend && npm run build

# Push to GitHub to trigger deployments
git push origin main

#Backend Deployment 
railway up (From Backend Folder)

#Frontend Deployment 
vercel --prod (From resume generator folder)

```




# Deployment Guide: Vercel + Render + Cloudflare

This guide covers deploying your Resume Generator with:
- **Frontend**: Vercel
- **Backend**: Render
- **DNS/CDN**: Cloudflare

---

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
4. **GitHub Repository**: Push your code to GitHub (both Frontend and Backend folders)
5. **Environment Variables Ready**:
   - MongoDB URI
   - JWT Secret
   - Google AI API Key
   - Render backend URL (obtained after deployment)

---

## Step 1: Deploy Backend to Render

### 1.1 Prepare Your Backend

Ensure `Backend/package.json` has a `start` script:

```json
{
  "scripts": {
    "dev": "npx nodemon server.js",
    "start": "node server.js"
  }
}
```

Update `Backend/server.js` to use `process.env.PORT`:

```javascript
require('dotenv').config();
const app = require('./src/app');
const connectToDB = require('./src/config/database');

const PORT = process.env.PORT || 3000;

connectToDB();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
```

### 1.2 Push to GitHub

```bash
git add .
git commit -m "Add deployment configs"
git push origin main
```

### 1.3 Create Render Deployment

1. Go to [render.com](https://render.com) and sign in
2. Click **New +** → **Web Service**
3. Select your GitHub repository
4. Fill in the form:
   - **Name**: `resume-generator-backend`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js` (or use render.yaml auto-detection)
   - **Plan**: Free or Paid (based on your needs)

5. **Add Environment Variables** in Render Dashboard:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A strong random string (e.g., `openssl rand -hex 32`)
   - `GOOGLE_AI_API_KEY`: Your Google AI API key
   - `CORS_ORIGIN`: Leave as placeholder for now; update after frontend deployment
   - `NODE_ENV`: `production`

6. Click **Create Web Service**
7. Wait for deployment to complete and note the URL (e.g., `https://resume-generator-backend.onrender.com`)

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Update Environment Variables

Create `Frontend/.env.production`:

```
VITE_API_BASE_URL=https://resume-generator-backend.onrender.com
```

Or set it in Vercel dashboard (see 2.3).

### 2.2 Update CORS in Backend

Go back to Render Dashboard → resume-generator-backend → Environment:
- Update `CORS_ORIGIN` to your Vercel frontend URL (e.g., `https://resume-generator.vercel.app`)

### 2.3 Create Vercel Deployment

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New...** → **Project**
3. Select your GitHub repository
4. In **Project Settings**:
   - **Framework Preset**: Vite
   - **Root Directory**: `Frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. **Add Environment Variables**:
   - `VITE_API_BASE_URL`: `https://resume-generator-backend.onrender.com`

6. Click **Deploy**
7. Wait for deployment and note your Vercel URL (e.g., `https://resume-generator.vercel.app`)

---

## Step 3: Setup Cloudflare DNS

### 3.1 Add Your Domain to Cloudflare

1. Go to [cloudflare.com](https://cloudflare.com) and sign in
2. Click **Add a site**
3. Enter your domain name and click **Add site**
4. Cloudflare will scan your DNS records
5. Choose a plan (Free is fine for this project)
6. Update your domain registrar's nameservers to point to Cloudflare

### 3.2 Create DNS Records

In Cloudflare Dashboard:

**For Frontend (www/root domain):**
- Type: `CNAME`
- Name: `www`
- Content: `cname.vercel.com`
- Proxy status: Proxied (orange cloud)

**For Root Domain (@):**
- Type: `CNAME`
- Name: `@` (root)
- Content: `cname.vercel.com`
- Proxy status: Proxied

Or use Vercel's auto-setup if offered.

### 3.3 Enable Security & Performance

In Cloudflare Dashboard:
- **SSL/TLS**: Set to "Full" or "Full (strict)"
- **Speed**: Enable Rocket Loader, Minify
- **Caching**: Set cache level to "Standard"

---

## Step 4: Verify Deployment

### Test Backend
```bash
curl https://resume-generator-backend.onrender.com/api/health
```

### Test Frontend
Visit `https://resume-generator.vercel.app` (or your custom domain)

### Test API Integration
- Try login/register
- Upload resume
- Generate interview questions

---

## Step 5: Update CORS After All Deployments

Once both are live, update Render backend environment:
- `CORS_ORIGIN`: Your Vercel frontend URL or custom domain

---

## Troubleshooting

### Backend won't start on Render
- Check logs in Render Dashboard
- Ensure `start` script exists in `package.json`
- Verify all environment variables are set

### Frontend can't reach backend
- Verify `VITE_API_BASE_URL` is correct
- Check Render backend is running
- Confirm CORS is properly configured

### Domain not working
- Wait 24-48 hours for DNS propagation
- Check Cloudflare nameservers are active
- Verify SSL/TLS settings

### Free Render plan limitations
- App spins down after 15 min of inactivity (cold start)
- Upgrade to Paid if you need always-on

---

## Optional: CI/CD Pipeline

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy Backend to Render
        run: |
          curl https://api.render.com/deploy/srv-${{ secrets.RENDER_SERVICE_ID }}?key=${{ secrets.RENDER_API_KEY }}
      
      - name: Deploy Frontend to Vercel
        run: |
          npx vercel --prod --token ${{ secrets.VERCEL_TOKEN }} --scope resume-generator
```

---

## Important Notes

- **Free Tier Limitations**:
  - Render free plan: Cold starts, app spins down after 15 min inactivity
  - Vercel: Fast deployments, generous free tier
  - Cloudflare: Unlimited DNS, generous free tier

- **Security**:
  - Never commit `.env` files to GitHub
  - Use platform-specific environment variables
  - Rotate secrets periodically

- **Monitoring**:
  - Enable error tracking on both platforms
  - Monitor cold start times on Render
  - Setup email alerts for deployment failures

---

## Quick Command Reference






Every AI request (Resume, Interview Report, Cover Letter)
           │
           ▼
┌─────────────────────────────┐
│  1️⃣  TRY GROQ (Primary)     │
│  Model: llama-3.3-70b       │
│  Fast · High quality        │
└────────────┬────────────────┘
             │
     Success? ──── YES ──→ ✅ Return response to user
             │
            NO (Rate limit 429 / quota / too many requests)
             │
             ▼
┌─────────────────────────────────────────┐
│  2️⃣  FALLBACK → OpenRouter              │
│  Model: nvidia/nemotron-3-super-120b    │
│  Free · 120B params · 262k context     │
└────────────┬────────────────────────────┘
             │
     Success? ──── YES ──→ ✅ Return response to user
             │
            NO (any other error)
             │
             ▼
           ❌ Throw error to user




---

## Step 6: Job Services Feature — Deployment Guide

This section covers everything needed to deploy the **Job Services** feature
(Job Search, Job Recommendations, Resume ↔ Job Match Score).

---

### 6.1 Get Your Free Job API Key (JSearch — Recommended)

1. Go to [https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
2. Sign up / log in with a free account
3. Click **Subscribe to Test** → choose the **Basic (Free)** plan
4. Copy your **X-RapidAPI-Key** from the dashboard

> ⚠️ Free Tier Limit: **200 requests/month** — always cache results to preserve quota.

Alternatively (no key needed, for fallback):
- **Arbeitnow API** — `https://www.arbeitnow.com/api/job-board-api` (European / Remote jobs, no auth)
- **Remotive API** — `https://remotive.com/api/remote-jobs` (Remote tech jobs, no auth)

---

### 6.2 Add Environment Variables

#### Backend (Render Dashboard → Environment)

Add the following variables to your Render backend service:

| Variable | Value |
|---|---|
| `JSEARCH_API_KEY` | Your RapidAPI key for JSearch |
| `JSEARCH_API_HOST` | `jsearch.p.rapidapi.com` |
| `JOB_CACHE_TTL_HOURS` | `6` (cache results for 6 hours to save quota) |

#### Frontend (Vercel Dashboard → Environment Variables)

No extra frontend keys needed — all job API calls must go through your backend proxy (never expose API keys in the frontend).

---

### 6.3 Backend Proxy Route — Important

All job API calls **must be proxied through your Node.js backend**, never called directly from the frontend.

**Route structure to implement when building:**

```
GET  /api/jobs/search?query=&location=&remote=
GET  /api/jobs/:jobId
GET  /api/jobs/recommend       ← Based on user's resume
POST /api/jobs/match-score     ← Resume ↔ Job description AI match
```

**Why proxy?**
- Protects your API key from being exposed in browser network tabs
- Allows server-side caching (MongoDB) to reduce API call count
- Lets you add authentication middleware so only logged-in users can search

---

### 6.4 Caching Strategy (Critical for Free Tier)

Because JSearch only allows **200 free requests/month**, you must cache results
in MongoDB to avoid hitting the limit.

**Recommended caching flow:**

```
User searches for jobs
         │
         ▼
Check MongoDB cache (TTL: 6 hours)
         │
    Cache HIT? ──── YES ──→ ✅ Return cached results (0 API calls used)
         │
        NO
         │
         ▼
Call JSearch API → Save result to MongoDB with timestamp
         │
         ▼
✅ Return fresh results to user
```

**MongoDB cache document structure:**

```json
{
  "cacheKey": "developer_bangalore_remote",
  "results": [...],
  "fetchedAt": "2025-01-01T00:00:00Z",
  "expiresAt": "2025-01-01T06:00:00Z"
}
```

---

### 6.5 Update CORS for Job Routes

After adding job routes to your backend, ensure CORS in Render environment
allows requests from both your Vercel frontend and custom domain:

```
CORS_ORIGIN=https://your-app.vercel.app,https://yourdomain.com
```

---

### 6.6 Rate Limit Handling — Fallback Flow

When JSearch quota is exhausted (HTTP 429), fall back to free APIs:

```
JSearch API call
         │
  Success? ──── YES ──→ ✅ Return jobs to user
         │
        NO (429 quota exceeded)
         │
         ▼
Arbeitnow / Remotive API (free, no key)
         │
  Success? ──── YES ──→ ✅ Return jobs (with note: "remote jobs only")
         │
        NO
         │
         ▼
      ❌ Throw error to user
```

---

### 6.7 Deployment Checklist — Job Services

Before going live with the Jobs feature, verify:

- [ ] `JSEARCH_API_KEY` is set in Render environment variables
- [ ] `JSEARCH_API_HOST` is set correctly (`jsearch.p.rapidapi.com`)
- [ ] Backend proxy routes `/api/jobs/*` are deployed and reachable
- [ ] MongoDB caching is working (check logs for cache HIT/MISS)
- [ ] CORS is updated to include your frontend domain
- [ ] API key is **not** present anywhere in the frontend code
- [ ] Rate limit fallback (Arbeitnow/Remotive) is implemented
- [ ] Authentication middleware is applied to job routes (logged-in users only)

---

### 6.8 Job Services Troubleshooting

#### Jobs not loading on frontend
- Check browser network tab → ensure calls go to `/api/jobs/search` (your backend), not directly to RapidAPI
- Verify `JSEARCH_API_KEY` is set in Render environment (not just local `.env`)

#### 429 Too Many Requests from JSearch
- You've hit the 200/month free limit
- Enable MongoDB caching with a longer TTL (12–24 hours)
- Switch fallback to Arbeitnow (free, unlimited)
- Upgrade JSearch plan if needed

#### CORS error on job routes
- Update `CORS_ORIGIN` in Render to include your Vercel URL
- Redeploy backend after changing environment variables

#### Job Match Score (AI) is slow
- This uses your Groq/OpenRouter AI — check the AI fallback flow above
- Cache match scores per (resume + job) pair in MongoDB to avoid repeated AI calls

---

### 6.9 API Quota Monitoring

To avoid surprise outages, monitor your API usage:

| API | Dashboard URL | Free Limit |
| JSearch (RapidAPI) | https://rapidapi.com/developer/dashboard | 200 req/month |
| Arbeitnow | No limit / public | Unlimited |
| Remotive | No limit / public | Unlimited |

> 💡 **Tip**: Add a simple counter in your backend (MongoDB) to track how many
> JSearch API calls you've made this month. Log a warning when > 150 calls used.

---

---

## Step 7: Redis Integration — Full Plan & Task Breakdown

> This section is based on the HLD (High-Level Design) diagram of the platform.
> Redis is used in **3 critical places**: Rate Limiting, Token Blacklist, and Report Caching.
> No code is written yet — this is the complete implementation plan.

---

### 7.0 Why Redis Now? (Context)

Looking at the HLD, Redis sits as an **in-memory layer** between the browser and
MongoDB. Every request flows through middleware that touches Redis before hitting
the database. The three Redis stores are:

```
┌────────────────────────────────────────────────────────────────┐
│                     REDIS (IN-MEMORY STORE)                    │
│                                                                │
│  📦 Store 1: Rate Limit Store                                  │
│     → Tracks requests per IP/user                             │
│     → TTL-based counters (auto-expire after time window)      │
│     → Prevents brute force & abuse                            │
│                                                                │
│  🔐 Store 2: Token Blacklist Store                             │
│     → Stores invalidated JWT tokens after logout              │
│     → Auth Middleware checks here on every request            │
│     → Instant logout = token added here + TTL = token expiry  │
│                                                                │
│  ⚡ Store 3: Report / Data Cache Store                         │
│     → Generated reports cached by reportId / userId           │
│     → Cache HIT → return in ~5ms (no DB call)                 │
│     → Cache MISS → read MongoDB → save to Redis → return      │
└────────────────────────────────────────────────────────────────┘
```

---

### 7.1 Choosing a Redis Provider (Free Tier)

**Recommended: Upstash Redis** ✅

| Provider | Free Tier | Why |
|---|---|---|
| **Upstash Redis** ⭐ | 10,000 commands/day, 256MB | Serverless, REST API, works perfectly with Render + Vercel, no credit card |
| Redis Cloud | 30MB free | Good but limited storage |
| Railway Redis | $5 credit/month | You already use Railway — easy to add |

> **Decision**: Use **Upstash Redis** (serverless, REST API-based, zero cold starts,
> integrates with both Render and Vercel via env variables — best fit for this stack).

Sign up at: https://upstash.com → Create Redis Database → Copy `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

---

### 7.2 New Environment Variables to Add

#### Backend (Render Dashboard → Environment)

| Variable | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | From Upstash dashboard (e.g., `https://xxx.upstash.io`) |
| `UPSTASH_REDIS_REST_TOKEN` | From Upstash dashboard (long token string) |
| `REDIS_RATE_LIMIT_WINDOW_SEC` | `60` (1-minute window for rate limiting) |
| `REDIS_RATE_LIMIT_MAX_REQUESTS` | `30` (max 30 requests per minute per IP) |
| `REDIS_REPORT_CACHE_TTL_SEC` | `3600` (cache reports for 1 hour = 3600 seconds) |
| `REDIS_TOKEN_BLACKLIST_TTL_SEC` | Match with JWT expiry (e.g., `86400` for 24h) |

---

### 7.3 Redis Use Case 1 — Rate Limiting Middleware

**What it does:**
- Every incoming request → middleware checks Redis for that IP's request count
- If count > `REDIS_RATE_LIMIT_MAX_REQUESTS` within the window → reject with 429
- Counter auto-expires after `REDIS_RATE_LIMIT_WINDOW_SEC` seconds (TTL)

**Redis key pattern:**
```
rate_limit:{ip_address}  →  value: request_count  →  TTL: 60 seconds
```

**Flow:**
```
Incoming Request (any route)
         │
         ▼
Rate Limit Middleware
         │
   Check Redis: rate_limit:{ip}
         │
  count < 30? ──── YES ──→ Increment count → Allow request through
         │
        NO (count >= 30)
         │
         ▼
  ❌ 429 Too Many Requests → Block
```

**Affected Routes:** ALL routes — applied globally at server entry level.

---

### 7.4 Redis Use Case 2 — Token Blacklist (Instant Logout)

**What it does:**
- When user logs out → their JWT token is added to Redis blacklist with a TTL
  equal to the token's remaining expiry time
- On every authenticated request → Auth Middleware checks Redis blacklist first
- If token is in blacklist → reject immediately (even if token is technically still valid)

**Redis key pattern:**
```
blacklist:{jwt_token}  →  value: "1"  →  TTL: remaining token expiry seconds
```

**Flow (on every authenticated request):**
```
Request with JWT token
         │
         ▼
Auth Middleware
         │
   Check Redis: blacklist:{token}
         │
  Found in blacklist? ── YES ──→ ❌ 401 Unauthorized (logged out token)
         │
        NO
         │
         ▼
   Verify JWT signature → proceed normally
```

**Flow (on logout):**
```
POST /api/auth/logout
         │
         ▼
Extract JWT from request
         │
         ▼
Calculate remaining TTL (token expiry - current time)
         │
         ▼
SET Redis: blacklist:{token} = "1"  WITH TTL = remaining seconds
         │
         ▼
✅ 200 OK — Logout successful
```

**Why this matters:** Without Redis blacklist, a stolen token could be used
until it naturally expires (hours). With Redis, logout is instant and secure.

---

### 7.5 Redis Use Case 3 — Report Caching (Primary Feature)

**What it does:**
- When a user **generates or views** a report (Interview Report, Resume, Cover Letter)
  → the full report JSON is saved to Redis with the key `report:{userId}:{reportId}`
- Next time the user **clicks the same report** → Redis returns it in ~5ms
- No MongoDB query needed → database load reduced significantly

**Redis key pattern:**
```
report:{userId}:{reportId}  →  value: JSON stringified report  →  TTL: 3600s (1 hour)
```

**Report caching flow (matches HLD "Backend Logics" box):**
```
User clicks a report (GET /api/report/:reportId)
         │
         ▼
Backend Service: Check Redis Cache
    Key: report:{userId}:{reportId}
         │
  Cache HIT? ──── YES ──→ ⚡ Return in ~5ms (no DB call)
         │
        NO (Cache MISS)
         │
         ▼
Query MongoDB → fetch full report document
         │
         ▼
Save to Redis: SET report:{userId}:{reportId} = JSON  TTL: 3600s
         │
         ▼
✅ Return report to user
```

**When is cache WRITTEN (populated)?**
1. When report is first **generated** → immediately cache it
2. When report is fetched from MongoDB (cache miss) → cache it for next time

**When is cache INVALIDATED (deleted)?**
1. When user **deletes** the report → delete Redis key too
2. TTL auto-expires after 1 hour → stale data never persists

---

### 7.6 Redis Use Case 4 — Job Search Cache (Replaces MongoDB Caching)

> ⚠️ Update from Section 6.4: Instead of caching job results in MongoDB,
> we will now use Redis — much faster and purpose-built for caching.

**Redis key pattern:**
```
jobs:{query}:{location}:{remote}  →  value: JSON job results  →  TTL: 21600s (6 hours)
```

**Benefit:** Job search results served from Redis in ~5ms instead of MongoDB (~50ms)
and definitely instead of external API (~500-2000ms). Saves your 200 req/month quota.

---

### 7.7 Complete Implementation Task Plan

#### Phase 1 — Setup & Connection (Do First)
- [ ] Create Upstash account at https://upstash.com
- [ ] Create a new Redis database (choose region closest to Render server)
- [ ] Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- [ ] Add both variables to Render backend environment
- [ ] Add both variables to local `Backend/.env` for development
- [ ] Install `@upstash/redis` package in backend (`npm install @upstash/redis`)
- [ ] Create `Backend/src/config/redis.js` — Redis client singleton

#### Phase 2 — Rate Limiting Middleware
- [ ] Create `Backend/src/middleware/rateLimiter.js`
- [ ] Apply globally in `Backend/src/app.js` before all routes
- [ ] Test: send 31 rapid requests → should get 429 on 31st
- [ ] Add `REDIS_RATE_LIMIT_WINDOW_SEC` and `REDIS_RATE_LIMIT_MAX_REQUESTS` to env

#### Phase 3 — Token Blacklist (Logout Enhancement)
- [ ] Update `Backend/src/middleware/authMiddleware.js` — add Redis blacklist check
- [ ] Update `POST /api/auth/logout` route — add token to Redis blacklist on logout
- [ ] Test: login → get token → logout → try using same token → should get 401
- [ ] Add `REDIS_TOKEN_BLACKLIST_TTL_SEC` to env

#### Phase 4 — Report Caching (Core Feature)
- [ ] Create `Backend/src/utils/reportCache.js` — helper functions (get/set/delete cache)
- [ ] Update `POST /api/report` (report generation route):
  - After generating report and saving to MongoDB
  - Also save report JSON to Redis with key `report:{userId}:{reportId}`
- [ ] Update `GET /api/report/:reportId` (report fetch route):
  - Check Redis first → if HIT return immediately
  - If MISS → fetch from MongoDB → save to Redis → return
- [ ] Update `DELETE /api/report/:reportId` — also delete Redis cache key
- [ ] Update `GET /api/history` — individual report clicks should use cached data
- [ ] Add `REDIS_REPORT_CACHE_TTL_SEC` to env
- [ ] Test: generate report → view it → check Upstash dashboard → key should exist

#### Phase 5 — Job Search Cache (Upgrade from Phase in Section 6)
- [ ] Update `GET /api/jobs/search` — check Redis before calling JSearch API
- [ ] On cache miss → call JSearch → save result to Redis → return
- [ ] Set TTL to 6 hours for job results
- [ ] Test: search same query twice → second call should be instant

#### Phase 6 — Monitoring & Deployment
- [ ] Deploy updated backend to Render
- [ ] Verify env variables are set on Render dashboard
- [ ] Open Upstash dashboard → monitor: commands/day, memory used, key count
- [ ] Test all 4 Redis use cases on production URL
- [ ] Update Render `CORS_ORIGIN` if needed

---

### 7.8 Redis Key Naming Convention (Reference)

| Store | Key Pattern | TTL | Purpose |
|---|---|---|---|
| Rate Limit | `rate_limit:{ip}` | 60s | Request counter per IP |
| Token Blacklist | `blacklist:{token}` | Token remaining TTL | Logged-out JWT tokens |
| Report Cache | `report:{userId}:{reportId}` | 3600s (1 hour) | Full report JSON |
| Job Cache | `jobs:{query}:{location}:{remote}` | 21600s (6 hours) | Job search results |

---

### 7.9 Upstash Free Tier Limits & Monitoring

| Metric | Free Limit | Expected Usage |
|---|---|---|
| Commands/day | 10,000 | ~500–2,000 (well within limit) |
| Storage | 256MB | Reports are small JSON (~5–20KB each) |
| Bandwidth | 200MB/day | More than enough |
| Concurrent connections | Unlimited (REST) | ✅ No issue |

> 💡 **Monitor at**: https://console.upstash.com → Your database → Analytics tab
> Check: daily command count, memory used, top keys

---

### 7.10 Deployment Checklist — Redis

Before going live with Redis integration, verify:

- [ ] Upstash Redis database created and region selected
- [ ] `UPSTASH_REDIS_REST_URL` added to Render environment
- [ ] `UPSTASH_REDIS_REST_TOKEN` added to Render environment
- [ ] Rate limiting working → 429 returned after limit exceeded
- [ ] Token blacklist working → logout invalidates token immediately
- [ ] Report caching working → second view of same report is instant
- [ ] Job caching working → same job search returns from Redis
- [ ] Redis keys visible in Upstash console after testing
- [ ] No Redis keys with sensitive unencrypted user data
- [ ] Cache invalidation working → deleted reports remove Redis key too
