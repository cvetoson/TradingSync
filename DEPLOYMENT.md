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

1. Click your service → **Variables**
2. Add these (click **+ New Variable** for each):

| Variable       | Value                          |
|----------------|--------------------------------|
| `NODE_ENV`     | `production`                   |
| `APP_URL`      | Your domain (from step 2)     |
| `JWT_SECRET`   | Any long random string         |
| `OPENAI_API_KEY` | Your OpenAI API key         |

For email (optional): `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `EMAIL_FROM`

## 4. Deploy

Railway deploys automatically when you push to GitHub. Or click **Redeploy** in the dashboard.

## 5. First login

1. Open your domain
2. Click **Register** and create an account
3. If using dev mode (no SMTP), the verification link appears on screen

---

**That's it.** The Dockerfile handles build and start. No extra commands needed.
