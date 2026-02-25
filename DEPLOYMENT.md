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

## 3b. Database (required for production)

**Option A: PostgreSQL (recommended)** – persistent, works reliably on Railway:

1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**
2. Railway creates a Postgres service and sets `DATABASE_URL` automatically
3. **Link it to your app**: Click your **TradingSync** service → **Variables** → **+ New Variable** → **Add Reference** → select the Postgres service’s `DATABASE_URL` (or `POSTGRES_URL` / `DATABASE_PRIVATE_URL` – the app checks all of these)
4. Redeploy – the app will use PostgreSQL instead of SQLite
5. On startup you should see `📦 Using PostgreSQL database`. If you see `Using SQLite`, none of the Postgres URL variables reached your app

**Option B: SQLite + Volume** – simpler but less robust:

1. Press **⌘K** (Mac) or **Ctrl+K** (Windows)
2. Search for **"volume"** → Create Volume
3. Attach to your service, mount path: `/app/backend/data`
4. Add variable: `DATABASE_PATH` = `/app/backend/data/trading_sync.db`
5. Redeploy

## 4. Deploy

Railway deploys automatically when you push to GitHub. Or click **Redeploy** in the dashboard.

## 5. First login

1. Open your domain
2. Click **Register** and create an account
3. If using dev mode (no SMTP), the verification link appears on screen

---

**That's it.** The Dockerfile handles build and start. No extra commands needed.

## Troubleshooting

- **`/api/debug`** – Returns database type, env status (no secrets). Share this URL with AI tools for remote troubleshooting: `https://your-app.up.railway.app/api/debug`
