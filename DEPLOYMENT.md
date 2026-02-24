# Deploy to Railway

## 1. Create project

1. Go to [railway.app](https://railway.app) and sign in
2. **New Project** → **Deploy from GitHub repo**
3. Connect GitHub and select your `TradingSync` repo
4. Railway will detect the Dockerfile and start building

## 2. Add a domain

1. Click your service
2. **Settings** → **Networking** → **Generate Domain**
3. Copy the URL (e.g. `https://tradingsync-production-xxxx.up.railway.app`)

## 3. Set variables

1. Click your service → **Variables** → **+ New Variable**
2. Add each of these:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `PORT` | `3001` | Yes (for domain) |
| `APP_URL` | `https://tradingsync-production.up.railway.app` | Yes (use your domain) |
| `JWT_SECRET` | Any long random string (e.g. `abc123xyz789secret`) | Yes |
| `OPENAI_API_KEY` | Your key from platform.openai.com/api-keys | For screenshot upload |
| `DATABASE_PATH` | `/app/backend/data/trading_sync.db` | Only if using a Volume (step 3b) |

For email: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `EMAIL_FROM`

## 3b. Persistent database (optional)

Without this, data resets on redeploy. For a persistent DB:

1. **Settings** → **Storage** → **Add Volume**
2. Mount path: `/app/backend/data`
3. Add variable: `DATABASE_PATH` = `/app/backend/data/trading_sync.db`
4. Redeploy

## 4. Deploy

Railway deploys automatically when you push to GitHub. Or click **Redeploy** in the dashboard.

## 5. First login

1. Open your domain
2. Click **Register** and create an account
3. If using dev mode (no SMTP), the verification link appears on screen

---

**That's it.** The Dockerfile handles build and start. No extra commands needed.
