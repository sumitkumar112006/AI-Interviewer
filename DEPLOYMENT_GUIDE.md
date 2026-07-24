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

```bash
# Locally test backend with env vars
PORT=3000 npm run dev

# Locally test frontend
cd Frontend && npm run dev

# Build for production
cd Frontend && npm run build

# Push to GitHub to trigger deployments
git push origin main
```

I am changing this line only