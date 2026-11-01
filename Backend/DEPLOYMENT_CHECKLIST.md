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

## Production Observability (Grafana Cloud / OpenTelemetry)

To stream production traces (Tempo), metrics (Mimir), and logs (Loki) to Grafana Cloud:

1. **Grafana Cloud Account**: Log into [grafana.com](https://grafana.com) -> Open your hosted Grafana instance.
2. **OTLP Gateway Endpoint**: Navigate to **Connections -> OpenTelemetry -> Configure**.
   - Copy your regional OTLP endpoint (e.g. `https://otlp-gateway-prod-us-east-0.grafana.net/otlp`).
3. **Access Policy Token**: Under **Security -> Access Policies**, create a token with:
   - Scopes: `traces:write`, `metrics:write`, `logs:write`
   - Copy the Instance ID and the generated token.
4. **Basic Auth Header**:
   - Compute `base64(INSTANCE_ID:TOKEN)`:
     `node -e "console.log(Buffer.from('123456:glc_token...').toString('base64'))"`
5. **Add Environment Variables to Render / Docker**:
   ```
   OTEL_SERVICE_NAME=kivi-backend
   DEPLOYMENT_ENVIRONMENT=production
   OTEL_TRACES_EXPORTER=otlp
   OTEL_LOGS_EXPORTER=otlp
   OTEL_METRICS_EXPORTER=otlp
   LOG_LEVEL=info
   OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-east-0.grafana.net/otlp
   OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64_string>
   OTEL_TRACES_SAMPLER=parentbased_always_on (or parentbased_traceidratio)
   OTEL_TRACES_SAMPLER_ARG=1.0 (or 0.1 for 10% sampling)
   ```
6. **Cost Control & Sampling**:
   - For high traffic, set `OTEL_TRACES_SAMPLER=parentbased_traceidratio` and `OTEL_TRACES_SAMPLER_ARG=0.1` (10% sampling) to stay well within Grafana Cloud free tier quotas.
7. **Resilience & Kill-Switch**:
   - If Grafana Cloud or OTLP collector is unreachable, KIVI continues normal operations without blocking.
   - To completely disable telemetry instantly without redeploying code: set `OTEL_SDK_DISABLED=true`.

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
