# Frontend Deployment Checklist ✅

## Pre-Deployment Verification

- [x] **Build System** – Vite configured in `vite.config.js`
- [x] **Build Command** – `npm run build` creates `dist/` folder
- [x] **Dependencies** – React, React Router, Axios, SCSS all in `package.json`
- [x] **Environment Variables** – `VITE_API_BASE_URL` set to Render backend
- [x] **API Integration** – All axios calls use `VITE_API_BASE_URL` env var
- [x] **vercel.json** – Properly configured with Vite settings

## Backend URL

✅ **Backend Live:** https://resume-generator-production-2eae.up.railway.app

This URL is already configured in `vercel.json` and `.env.example`

## Vercel Deployment Steps

### Step 1: Update CORS on Backend (IMPORTANT!)

Go to [Render Dashboard](https://dashboard.render.com) → AI-Interviewer → Environment:

Update `CORS_ORIGIN` to your Vercel frontend URL once deployed. For now, set to:
```
CORS_ORIGIN=*
```
(Or wait until you have the Vercel URL)

### Step 2: Push Code to GitHub

```bash
git add .
git commit -m "Add backend URL to frontend config"
git push origin main
```

### Step 3: Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New...** → **Project**
3. Select your GitHub repository
4. In **Configure Project**:
   - **Framework Preset:** Vite (auto-detected)
   - **Root Directory:** `Frontend`
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)

5. Click **Deploy**

### Step 4: Add Environment Variables (if needed)

If Vercel doesn't auto-detect from `vercel.json`, manually add:
- Key: `VITE_API_BASE_URL`
- Value: `https://ai-interviewer-kzwc.onrender.com`

### Step 5: Redeploy

After adding env vars, trigger a redeploy by:
- Pushing another commit to GitHub, OR
- Clicking **Redeploy** in Vercel dashboard

## Expected Frontend URLs

- **Production:** `https://your-project-name.vercel.app`
- **Custom Domain:** (optional, configure in Vercel)

## Testing After Deployment

Once live, test these flows:

1. **Sign Up** – Create new account
2. **Login** – Authenticate and receive JWT
3. **Upload Resume** – PDF upload works
4. **Generate Questions** – AI generates interview questions
5. **View Resume** – Resume rendering works

## Troubleshooting

| Issue | Solution |
|-------|----------|
| API 403/CORS errors | Backend `CORS_ORIGIN` not set correctly |
| 502 Bad Gateway | Render backend cold-start (wait 30s) |
| Build fails on Vercel | Check `npm run build` works locally |
| Env vars not loading | Verify `VITE_API_BASE_URL` in Vercel dashboard |

---

## Status: READY FOR VERCEL DEPLOYMENT ✅

**Backend URL:** https://ai-interviewer-kzwc.onrender.com ✅
**Next:** Push code & deploy to Vercel