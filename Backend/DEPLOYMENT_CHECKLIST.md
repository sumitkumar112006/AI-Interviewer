# Backend Deployment Checklist ✅

## Pre-Deployment Verification

- [x] **Node.js Entry Point** – `server.js` properly configured
- [x] **PORT Configuration** – Reads from `process.env.PORT` with fallback to 3000
- [x] **Start Script** – `npm start` executes `node server.js`
- [x] **Dependencies** – All packages listed in `package.json`
  - Express, Mongoose, JWT, CORS, Google GenAI, etc.
- [x] **CORS Dynamic** – Updated to use `process.env.CORS_ORIGIN`
- [x] **Database Connection** – Mongoose properly configured in `src/config/database.js`
- [x] **Environment Variables** – All mapped and documented in `render.yaml`

## Environment Variables Needed in Render Dashboard

Copy from your `.env` file and add to Render:

```
MONGO_URI = mongodb+srv://sumit:wvfItypGnnGTYXJQ@interview-ai.xqig4c6.mongodb.net/interview-master
JWT_SECRET = 2225560dbdb22044248cf42ba9e52e90b7f7bcf929e94124ea60823a25d0d03f
GOOGLE_GENAI_API_KEY = AIzaSyBfrA9kfsFgs3RSr0ZfhEptByA_epbCIkQ
CORS_ORIGIN = https://your-frontend-vercel-url.vercel.app (set after frontend deployment)
NODE_ENV = production
```

## Render Dashboard Settings (from screenshot)

✅ **Name:** AI-Interviewer (or any name)
✅ **Language:** Node
✅ **Branch:** main
✅ **Root Directory:** Backend
✅ **Build Command:** `npm install` (or use render.yaml)
✅ **Start Command:** `npm start`
✅ **Region:** Oregon (or preferred region)

## Important Notes

1. **CORS_ORIGIN**: Leave blank for now or set to `*` temporarily. Update after Vercel frontend is deployed.
2. **Cold Start**: Free Render plan will have ~30s cold start. Upgrade to paid if needed.
3. **Logs**: Monitor Render dashboard logs for startup issues.
4. **Database**: Ensure MongoDB Atlas allows Render's IP in whitelist (or set 0.0.0.0/0)

## Quick Deploy Steps

1. Push code to GitHub: `git add . && git commit -m "Fix CORS for production" && git push`
2. Go to [render.com](https://render.com)
3. Click **New +** > **Web Service** > Select your repo
4. Fill form with settings from checklist above
5. Add environment variables from `.env` file
6. Click **Create Web Service**
7. Wait for deployment (~2-3 min)
8. Note the Render URL (e.g., `https://ai-interviewer-backend.onrender.com`)
9. Update `CORS_ORIGIN` in Render dashboard after frontend is live

---

## Status: READY FOR DEPLOYMENT ✅
