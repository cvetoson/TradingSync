# TradingSync Security Review Log

> Automated security review by a specialized trading-app & cybersecurity reviewer.
> Each run checks whether previously reported issues have been fixed and adds new findings.
> Format: `[OPEN]` = unresolved · `[FIXED]` = verified resolved · `[NEW]` = found this run

---

## Run #1 — 2026-04-28T00:00:00Z

### Application Overview
TradingSync is a portfolio aggregation platform with:
- **Backend**: Node.js / Express, JWT auth, bcrypt passwords, SQLite (dev) / PostgreSQL (prod)
- **Frontend**: React 18 + Vite + Tailwind CSS
- **AI layer**: OpenAI GPT-4o Vision for screenshot-based financial data extraction
- **Integrations**: Yahoo Finance, CoinGecko, OpenFIGI (Bloomberg), Nodemailer/Resend email
- **Deployment**: Docker on Railway.app

---

## Vulnerabilities & Issues

---

### [NEW] SEC-001 — Hardcoded Fallback JWT Secret
- **Severity**: Critical
- **File**: `backend/routes/auth.js:8`
- **Description**: The JWT secret falls back to the hardcoded string `'dev-secret-change-in-production'` when `JWT_SECRET` is not set in the environment. If the environment variable is missing in production (e.g. a misconfigured deploy), all JWT tokens become forgeable by anyone who knows this default value, which is publicly visible in the source code.
- **Evidence**:
  ```js
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  ```
- **Recommendation**: Remove the fallback. Throw a startup error instead:
  ```js
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
  ```
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-002 — Unauthenticated Public `/api/debug` Endpoint
- **Severity**: High
- **File**: `backend/server.js` (the `/api/debug` route, ~line 145)
- **Description**: The `/api/debug` endpoint is publicly accessible with no authentication. It exposes:
  - Whether OpenAI and SMTP are configured (`hasOpenAI`, `hasSmtp`)
  - The `APP_URL` (useful for constructing phishing/reset links)
  - Up to 15 recent internal server errors with message details
  - The last email send error
  This information aids reconnaissance and reveals the application's internal error state.
- **Evidence**:
  ```js
  app.get('/api/debug', (req, res) => {
    res.json({
      status: 'ok',
      database: isPostgreSQL() ? 'PostgreSQL' : 'SQLite',
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      ...
      recentErrors: getRecentErrors(),
      lastEmailError: getLastEmailError() || null,
    });
  });
  ```
- **Recommendation**: Protect with `requireAuth` middleware, or gate behind an admin role, or disable in production. At minimum, strip `recentErrors` and `lastEmailError` from the public response.
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-003 — No Rate Limiting on Authentication Endpoints
- **Severity**: High
- **File**: `backend/server.js` (auth route registrations)
- **Description**: The endpoints `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, and `/api/auth/reset-password` have no rate limiting. An attacker can:
  - Brute-force passwords on login (8-char minimum password = limited search space)
  - Flood the forgot-password endpoint to spam victim emails
  - Enumerate valid emails at high speed despite the generic response message
- **Recommendation**: Add `express-rate-limit` (or equivalent) to auth endpoints. Suggested limits:
  - Login: 10 attempts / 15 min per IP
  - Forgot password: 5 requests / 1 hour per IP
  - Register: 5 requests / 1 hour per IP
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-004 — Uploaded Files Served as Public Static Assets
- **Severity**: High
- **File**: `backend/server.js:28`
- **Description**: The `uploads/` directory is mounted as a static file server, meaning any uploaded screenshot is accessible without authentication to anyone who knows (or guesses) the filename. Filenames are timestamped but predictable (`file.fieldname + '-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + ext`). Screenshots contain sensitive financial data (account balances, holdings, platform details).
- **Evidence**:
  ```js
  app.use(express.static(join(__dirname, 'uploads')));
  ```
- **Recommendation**: Remove the static serve of `uploads/`. Instead, create an authenticated route (e.g. `GET /api/files/:filename`) that verifies the requesting user owns the associated account before streaming the file.
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-005 — Wide-Open CORS Policy (Any Origin Allowed)
- **Severity**: High
- **File**: `backend/server.js:26`
- **Description**: CORS is configured with no origin restrictions using `app.use(cors())`. This allows any website on the internet to make credentialed cross-origin requests to the API. While JWT tokens mitigate some risk, this policy is unnecessarily permissive for a financial application and can facilitate CSRF-style attacks from malicious pages if a user is authenticated.
- **Evidence**:
  ```js
  app.use(cors());
  ```
- **Recommendation**: Restrict CORS to known origins:
  ```js
  app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:5173',
    credentials: true
  }));
  ```
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-006 — Authorization Bypass via NULL `user_id` Accounts
- **Severity**: High
- **File**: `backend/routes/auth.js` (`requireAccountAuth`, `requireHistoryAuth`, `requireHoldingAuth`)
- **Description**: All three authorization middleware functions permit access when `user_id IS NULL`:
  ```js
  db.get('SELECT id FROM accounts WHERE id = ? AND (user_id = ? OR user_id IS NULL)', ...)
  ```
  Any authenticated user can access, modify, or delete accounts/holdings/history that have a NULL `user_id`. These are likely legacy rows from before the multi-user migration but may still contain real financial data. Any user can also take ownership actions on these shared rows.
- **Recommendation**: Remove the `OR user_id IS NULL` clause from all three middleware queries. Migrate any legacy NULL rows to the correct user, or delete them.
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-007 — Password Reset Token Stored in Plaintext
- **Severity**: Medium
- **File**: `backend/routes/auth.js` (`forgotPassword`, `resetPassword`)
- **Description**: The password reset token (32 random bytes, hex-encoded) is stored directly in the database. If the database is compromised, all active reset tokens are immediately usable to take over accounts. This is the same vulnerability as storing passwords in plaintext for short-lived credentials.
- **Recommendation**: Store a SHA-256 hash of the reset token in the database. On reset, hash the incoming token and compare. This way, a DB leak does not expose valid reset tokens.
  ```js
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  // store tokenHash, send resetToken in email
  ```
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-008 — Password Reset Token Leaked in API Response (Dev Mode)
- **Severity**: Medium
- **File**: `backend/routes/auth.js` (`forgotPassword`, ~line 185)
- **Description**: When the email service fails, the server returns the password reset link (containing the token) in the JSON API response as `devLink`. This is intended for development but there is no environment check — it will also appear in production if the email service is misconfigured. Any logging infrastructure, browser history, or monitoring tool that captures API responses would expose live reset tokens.
- **Evidence**:
  ```js
  if (emailResult.devLink) {
    return res.json({
      success: true,
      message: '...',
      devLink: emailResult.devLink,  // reset token exposed!
    });
  }
  ```
- **Recommendation**: Gate `devLink` behind `NODE_ENV !== 'production'`. In production, log the error server-side only and return a generic message to the user.
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-009 — No Security Headers (Missing Helmet.js)
- **Severity**: Medium
- **File**: `backend/server.js`
- **Description**: The server does not set security-related HTTP response headers. Missing headers include:
  - `X-Content-Type-Options: nosniff` (MIME sniffing attacks)
  - `X-Frame-Options: DENY` (clickjacking)
  - `Strict-Transport-Security` (HTTPS enforcement)
  - `Content-Security-Policy` (XSS mitigation)
  - `X-XSS-Protection`
  - `Referrer-Policy`
  For a financial application, these headers are baseline security requirements.
- **Recommendation**: Install and configure `helmet`:
  ```js
  import helmet from 'helmet';
  app.use(helmet());
  ```
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-010 — JWT Tokens Not Invalidated on Password Change
- **Severity**: Medium
- **File**: `backend/routes/auth.js` (`changePassword`, `resetPassword`)
- **Description**: When a user changes or resets their password, existing JWT tokens remain valid until their natural expiry (7 days by default). If an attacker has obtained a token (stolen session, XSS, etc.) and the user changes their password to lock them out, the attacker can continue using the old token for up to 7 days.
- **Recommendation**: Implement token invalidation on password change. Options:
  1. Store a `password_version` (integer) in the DB, embed it in JWT claims, reject tokens where the claim doesn't match.
  2. Maintain a server-side token denylist (Redis or DB table).
  3. Reduce token TTL (e.g., 1 day) and enforce refresh token rotation.
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-011 — File Upload: No MIME Type Validation
- **Severity**: Medium
- **File**: `backend/server.js` (multer config, ~line 34)
- **Description**: File uploads are accepted without validating the MIME type. The file extension is taken from `file.originalname.split('.').pop()`, which is fully attacker-controlled. A malicious user could upload:
  - HTML/SVG files that execute scripts when served via the static uploads route (SEC-004 compounds this)
  - Executable files disguised with image extensions
  - Files with path traversal in the name (`../../evil.js`) — though multer's `diskStorage` uses the cb filename, not the original, so path traversal in the extension alone is unlikely but worth confirming
- **Recommendation**: Add a `fileFilter` to multer that checks both the MIME type and the extension:
  ```js
  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      cb(null, allowed.includes(file.mimetype));
    }
  });
  ```
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-012 — Email Verification Not Enforced on Registration
- **Severity**: Low
- **File**: `backend/routes/auth.js` (`register`, ~line 37)
- **Description**: The `email_verified` flag is set to `1` immediately on registration (bypassing the email verification flow), and a JWT token is issued instantly. Users never need to verify their email. A `// TODO` comment acknowledges this. This allows account creation with arbitrary/victim email addresses, weakens account recovery, and reduces confidence in email-based user identity.
- **Evidence**:
  ```js
  // TODO: Add email verification – require verify before login, send verification email on register
  db.run(`INSERT INTO users (..., email_verified, ...) VALUES (?, ?, ?, 1, NULL, NULL)`, ...)
  ```
- **Recommendation**: Send a verification email on registration, set `email_verified = 0`, and require verification before issuing a JWT. Provide a resend-verification endpoint.
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] SEC-013 — OpenAI API Key Exposed to Client Error Messages
- **Severity**: Low
- **File**: `backend/services/aiService.js` (inferred from explorer notes referencing detailed key error messages)
- **Description**: The backend reportedly returns detailed OpenAI API key error messages to the client. If the message includes the partial key, quota details, or account identifiers, this constitutes sensitive information leakage via error responses.
- **Recommendation**: Catch OpenAI API errors server-side and return generic user-facing messages. Log the full error only server-side.
- **Status**: `[OPEN]` *(requires code-level verification of `aiService.js` message content)*
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] INF-001 — SQLite in Production: Data Loss on Redeploy
- **Severity**: High (operational risk)
- **File**: `backend/server.js:47`, `backend/database.js`
- **Description**: The app warns about SQLite in production but does not prevent it. On Railway (and similar ephemeral deployment platforms), SQLite data is lost on every redeploy since the container filesystem is not persistent. A user could lose all their portfolio data.
- **Recommendation**: Add a hard startup failure when `NODE_ENV=production` and no PostgreSQL URL is configured. Document this prominently in the deployment guide (already partially done in DEPLOYMENT.md).
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

### [NEW] INF-002 — Tokens Stored in `localStorage` (XSS Risk)
- **Severity**: Medium
- **File**: `frontend/src/context/AuthContext.jsx` (inferred from architecture notes)
- **Description**: JWT tokens are stored in browser `localStorage`. Any XSS vulnerability in the frontend React app (including from third-party dependencies like Three.js, Recharts, etc.) can read and exfiltrate the token. `localStorage` tokens survive tab/browser restarts, increasing the window of exposure.
- **Recommendation**: Use `httpOnly` cookies for token storage (requires same-origin or proper CORS + credentials). If `localStorage` must be used, implement short-lived access tokens (15 min) with refresh token rotation stored in `httpOnly` cookies.
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T00:00:00Z
- **Developer check**: ☐

---

## Summary — Run #1 (2026-04-28T00:00:00Z)

| ID | Severity | Title | Status |
|---|---|---|---|
| SEC-001 | Critical | Hardcoded fallback JWT secret | [OPEN] |
| SEC-002 | High | Unauthenticated `/api/debug` endpoint | [OPEN] |
| SEC-003 | High | No rate limiting on auth endpoints | [OPEN] |
| SEC-004 | High | Uploads served as public static files | [OPEN] |
| SEC-005 | High | Wide-open CORS policy | [OPEN] |
| SEC-006 | High | Authorization bypass via NULL user_id | [OPEN] |
| SEC-007 | Medium | Password reset token stored in plaintext | [OPEN] |
| SEC-008 | Medium | Reset token leaked in API response | [OPEN] |
| SEC-009 | Medium | No security headers (Helmet missing) | [OPEN] |
| SEC-010 | Medium | JWT not invalidated on password change | [OPEN] |
| SEC-011 | Medium | No MIME type validation on uploads | [OPEN] |
| SEC-012 | Low | Email verification not enforced | [OPEN] |
| SEC-013 | Low | OpenAI error details leaked to client | [OPEN] |
| INF-001 | High (ops) | SQLite in production — data loss risk | [OPEN] |
| INF-002 | Medium | JWT in localStorage — XSS token theft | [OPEN] |

**Total: 15 issues — 1 Critical, 5 High, 5 Medium, 2 Low, 2 Operational**

---

*Next review scheduled: 2026-04-28T01:00:00Z*
