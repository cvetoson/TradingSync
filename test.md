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

---

## Run #2 — 2026-04-28T21:10:29Z

### Developer Fix Check

All 15 issues from Run #1 were re-verified against the live source files. **No fixes have been applied.** Every issue remains open.

Verification method: grep + direct file inspection of `backend/server.js`, `backend/routes/auth.js`, `backend/routes/portfolio.js`, `backend/services/aiService.js`, `frontend/src/context/AuthContext.jsx`, and `backend/package.json`.

| ID | Evidence of fix? | Status change |
|---|---|---|
| SEC-001 | `JWT_SECRET \|\| 'dev-secret-change-in-production'` still present in `auth.js:8` | `[OPEN]` |
| SEC-002 | `/api/debug` still unauthenticated in `server.js` | `[OPEN]` |
| SEC-003 | No `express-rate-limit` in `package.json` or `server.js` | `[OPEN]` |
| SEC-004 | `app.use(express.static(join(__dirname, 'uploads')))` still in `server.js:26` | `[OPEN]` |
| SEC-005 | `app.use(cors())` still open in `server.js:24` | `[OPEN]` |
| SEC-006 | `user_id IS NULL` clause still in all three auth middleware functions | `[OPEN]` |
| SEC-007 | Reset token written to DB in plaintext in `auth.js:181` | `[OPEN]` |
| SEC-008 | `devLink` returned in response body with no `NODE_ENV` guard in `auth.js:190-197` | `[OPEN]` |
| SEC-009 | No `helmet` package in `package.json`; no security headers in `server.js` | `[OPEN]` |
| SEC-010 | `changePassword` / `resetPassword` issue no token versioning in DB schema | `[OPEN]` |
| SEC-011 | No `fileFilter` in multer config in `server.js` | `[OPEN]` |
| SEC-012 | `email_verified` set to `1` immediately at registration in `auth.js:44` | `[OPEN]` |
| SEC-013 | `error: error.message` in `aiService.js` fallback propagates to client | `[OPEN]` |
| INF-001 | SQLite-in-production warning only; no hard startup failure | `[OPEN]` |
| INF-002 | JWT stored in `localStorage` confirmed in `AuthContext.jsx:14,31` | `[OPEN]` |

---

### [NEW] SEC-014 — Raw Internal Error Messages Sent to Client (Information Disclosure)
- **Severity**: Medium
- **File**: `backend/routes/portfolio.js` (lines 636, 682, 743, 771, 949, 966, 988, 1026, 1061, 1091, 1128, 1181, 1219, 1248, 1438, 1456, 1464, 1512 and more)
- **Description**: Throughout `portfolio.js`, raw database and runtime error messages are sent directly to the client via `res.status(500).json({ error: err.message })`. These messages can contain:
  - Internal SQL error text (table names, column names, constraint names)
  - PostgreSQL driver error codes and query fragments
  - Node.js stack context from runtime errors
  This aids attackers in mapping the database schema, understanding ORM behaviour, and crafting targeted injection or enumeration attacks.
- **Evidence** (representative):
  ```js
  // portfolio.js:682
  return res.status(500).json({ error: err.message });

  // portfolio.js:636 (upload catch-all)
  res.status(500).json({ error: error.message || 'Internal server error' });

  // portfolio.js:949
  return res.status(500).json({ error: summaryErr.message || 'Failed to load portfolio' });
  ```
  The same pattern repeats at 15+ locations.
- **Recommendation**: Replace all `err.message` in JSON responses with static user-facing strings. Log the real message server-side:
  ```js
  console.error('[route] operation failed:', err.message);
  res.status(500).json({ error: 'An internal error occurred. Please try again.' });
  ```
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T21:10:29Z
- **Developer check**: ☐

---

### Frontend XSS Scan — Clean
- Searched all `frontend/src/**` for `dangerouslySetInnerHTML`, `innerHTML`, `eval()`, `document.write` — **none found**. No client-side XSS sinks detected this run.

---

## Summary — Run #2 (2026-04-28T21:10:29Z)

**0 issues fixed since Run #1. 1 new issue added.**

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
| SEC-014 | Medium | Raw internal error messages sent to client | [OPEN] |
| INF-001 | High (ops) | SQLite in production — data loss risk | [OPEN] |
| INF-002 | Medium | JWT in localStorage — XSS token theft | [OPEN] |

**Total: 16 issues — 1 Critical, 5 High, 6 Medium, 2 Low, 2 Operational**

---

*Next review scheduled: 2026-04-28T22:10:29Z*

---

## Run #3 — 2026-04-28T21:40:34Z

### Developer Fix Check

No commits to `backend/` or `frontend/` since Run #2. All 16 issues remain open.

| ID | Verification | Status |
|---|---|---|
| SEC-001 | `JWT_SECRET \|\| 'dev-secret-change-in-production'` at `auth.js:8` | `[OPEN]` |
| SEC-002 | `/api/debug` unauthenticated, no `requireAuth` | `[OPEN]` |
| SEC-003 | No `express-rate-limit` in `package.json` | `[OPEN]` |
| SEC-004 | `express.static('uploads')` at `server.js:26` | `[OPEN]` |
| SEC-005 | `cors()` no-arg at `server.js:24` | `[OPEN]` |
| SEC-006 | `user_id IS NULL` in all three auth guards `auth.js:355,370,388` | `[OPEN]` |
| SEC-007 | Reset token written plaintext `auth.js:181` | `[OPEN]` |
| SEC-008 | `devLink` in response body, no env guard `auth.js:190-197` | `[OPEN]` |
| SEC-009 | No `helmet` package or headers in `server.js` | `[OPEN]` |
| SEC-010 | No token versioning in schema or auth flows | `[OPEN]` |
| SEC-011 | No `fileFilter` in multer config | `[OPEN]` |
| SEC-012 | `email_verified = 1` set at registration `auth.js:44` | `[OPEN]` |
| SEC-013 | `fallbackData.error = error.message` returned in `aiService.js` | `[OPEN]` |
| SEC-014 | `err.message` sent to client at 15+ locations in `portfolio.js` | `[OPEN]` |
| INF-001 | SQLite-in-production warning only, no hard fail | `[OPEN]` |
| INF-002 | JWT in `localStorage` confirmed `AuthContext.jsx:14,31` | `[OPEN]` |

---

### [NEW] SEC-015 — Unauthenticated Open Email Relay via `/api/test-email`
- **Severity**: Medium
- **File**: `backend/server.js:158-172`
- **Description**: The `/api/test-email` endpoint is publicly accessible with no authentication middleware. When the `EMAIL_TEST_ENABLED=true` environment variable is set, any unauthenticated party can trigger email sends to any address by calling `GET /api/test-email?to=victim@example.com`. There is no rate limiting on this route. If accidentally enabled in production — which is a realistic ops mistake — the application becomes an open email relay, usable for spam, phishing setup, or SMTP quota exhaustion.
- **Evidence**:
  ```js
  // server.js:158 — no requireAuth, no rate limit
  app.get('/api/test-email', async (req, res) => {
    if (process.env.EMAIL_TEST_ENABLED !== 'true') {
      return res.status(404).json({ error: 'Not found' });
    }
    const to = req.query.to; // fully attacker-controlled
    ...
    await sendEmail({ to, subject: 'Trading Sync – test email', ... });
  ```
- **Recommendation**: Delete this endpoint or gate it behind `requireAuth` plus an admin check. If kept, add strict rate limiting (1 request / 10 min per IP) and ensure `EMAIL_TEST_ENABLED` is never set in production via deployment checklist / CI env audit.
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T21:40:34Z
- **Developer check**: ☐

---

### [NEW] SEC-016 — No Bounds Validation on Financial Input Fields
- **Severity**: Low
- **File**: `backend/routes/portfolio.js` (`updateAccountBalance:1119`, `updateAccountInterestRate:1161`, `updateHoldingQuantity`, `updateHoldingPrice`)
- **Description**: Financial update routes parse user input with `parseFloat()` and only reject `NaN`. They do not enforce realistic bounds. An authenticated user can write:
  - `balance = Infinity` — `parseFloat('Infinity')` passes `isNaN()` and is stored in the DB, corrupting portfolio totals and any downstream arithmetic (multiplication with `Infinity` propagates)
  - `balance = -9999999999` — negative balances have no floor check
  - `interestRate = 999999` — no upper cap
  - `quantity = Infinity` or `price = Infinity` — same issue for holdings
  Stored `Infinity` / `NaN` values in PostgreSQL will cause JSON serialization errors (PostgreSQL stores them, but they break JavaScript `JSON.stringify`) and can crash summary calculations.
- **Evidence**:
  ```js
  // portfolio.js:1119
  const balanceValue = parseFloat(balance);
  if (isNaN(balanceValue)) { ... } // Infinity passes this check
  db.run('UPDATE accounts SET balance = ? ...', [balanceValue, ...]);
  ```
- **Recommendation**: Add explicit finite-number and range checks:
  ```js
  if (!Number.isFinite(balanceValue) || balanceValue < 0) {
    return res.status(400).json({ error: 'balance must be a finite non-negative number' });
  }
  ```
  Apply equivalent guards to `interestRate` (0–100), `quantity` (> 0, finite), and `price` (≥ 0, finite).
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T21:40:34Z
- **Developer check**: ☐

---

### Additional Surface Scanned This Run
- **Open redirect**: `APP_URL` is env-controlled (not user-supplied); reset/verify URLs use `encodeURIComponent(token)` — no open redirect risk found.
- **Email header injection**: `to`, `subject`, `from` fields in `emailService.js` are either hardcoded strings or come from validated DB values (not raw user input in the email headers) — no injection risk found.
- **Mass assignment**: Each update route destructures only the specific expected field from `req.body` (e.g. `const { balance } = req.body`) — no mass assignment risk found.

---

## Summary — Run #3 (2026-04-28T21:40:34Z)

**0 issues fixed since Run #2. 2 new issues added.**

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
| SEC-015 | Medium | Unauthenticated open email relay endpoint | [OPEN] |
| SEC-014 | Medium | Raw internal error messages sent to client | [OPEN] |
| SEC-012 | Low | Email verification not enforced | [OPEN] |
| SEC-013 | Low | OpenAI error details leaked to client | [OPEN] |
| SEC-016 | Low | No bounds validation on financial fields | [OPEN] |
| INF-001 | High (ops) | SQLite in production — data loss risk | [OPEN] |
| INF-002 | Medium | JWT in localStorage — XSS token theft | [OPEN] |

**Total: 18 issues — 1 Critical, 5 High, 7 Medium, 3 Low, 2 Operational**

---

*Next review scheduled: 2026-04-28T22:40:34Z*

---

## Run #4 — 2026-04-28T22:10:44Z

### Developer Fix Check

No commits to `backend/` or `frontend/` since Run #3. All 18 issues remain open.

| ID | Quick check result | Status |
|---|---|---|
| SEC-001 | `JWT_SECRET \|\| 'dev-secret...'` count=1 in `auth.js:8` | `[OPEN]` |
| SEC-002 | `/api/debug` still no `requireAuth` | `[OPEN]` |
| SEC-003 | `express-rate-limit` absent from `package.json` | `[OPEN]` |
| SEC-004 | `express.static('uploads')` count=1 in `server.js` | `[OPEN]` |
| SEC-005 | `cors()` no-arg count=1 in `server.js` | `[OPEN]` |
| SEC-006 | `user_id IS NULL` count=3 in `auth.js` | `[OPEN]` |
| SEC-007 | Plaintext token write still in `auth.js:181` | `[OPEN]` |
| SEC-008 | `devLink` count=2 in `auth.js` | `[OPEN]` |
| SEC-009 | `helmet` count=0 in `server.js` | `[OPEN]` |
| SEC-010 | No token versioning in schema or flows | `[OPEN]` |
| SEC-011 | `fileFilter` count=0 in `server.js` | `[OPEN]` |
| SEC-012 | `email_verified = 1` at registration still present | `[OPEN]` |
| SEC-013 | `fallbackData.error = error.message` in `aiService.js` | `[OPEN]` |
| SEC-014 | `err.message` in 15+ `res.status(500)` calls in `portfolio.js` | `[OPEN]` |
| SEC-015 | `EMAIL_TEST_ENABLED` endpoint still unauthenticated | `[OPEN]` |
| SEC-016 | `parseFloat` with no `Number.isFinite` guard on financial fields | `[OPEN]` |
| INF-001 | SQLite-in-production warning only | `[OPEN]` |
| INF-002 | JWT in `localStorage` count=10 in `AuthContext.jsx` | `[OPEN]` |

---

### [NEW] SEC-017 — Docker Container Runs as Root
- **Severity**: High
- **File**: `Dockerfile` (entire production stage)
- **Description**: The production Docker image has no `USER` directive, so Node.js and all application code execute as `root` (UID 0) inside the container. If an attacker achieves Remote Code Execution through any application vulnerability (path traversal, deserialization, SSRF to localhost, etc.), they have root privileges within the container. This significantly lowers the bar for container-escape exploits and gives the attacker unrestricted read access to every file in the image including any secrets baked in at build time.
- **Evidence**:
  ```dockerfile
  # Production stage — no USER directive anywhere
  FROM node:20-alpine
  WORKDIR /app/backend
  RUN npm install --omit=dev
  RUN mkdir -p uploads
  ENV NODE_ENV=production
  EXPOSE 3001
  CMD ["node", "server.js"]   # ← runs as root
  ```
- **Recommendation**: Add a non-root user before `CMD`:
  ```dockerfile
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  RUN chown -R appuser:appgroup /app
  USER appuser
  CMD ["node", "server.js"]
  ```
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T22:10:44Z
- **Developer check**: ☐

---

### [NEW] SEC-018 — Known Vulnerable Dependencies (npm audit: 25 issues, 12 High)
- **Severity**: High
- **Files**: `backend/package.json`, `frontend/package.json`
- **Description**: `npm audit` reveals 25 known CVEs across backend and frontend dependencies. The most impactful for a production trading application:

  **Backend (17 total — 8 High, 6 Moderate, 3 Low):**
  | Severity | Package | Vulnerability |
  |---|---|---|
  | HIGH | `axios` | DoS via `__proto__` key in `mergeConfig` — used for all external API calls (Yahoo Finance, CoinGecko) |
  | HIGH | `minimatch` | ReDoS via repeated wildcards — attacker-controlled input could cause CPU exhaustion |
  | HIGH | `cacache` / `node-gyp` / `make-fetch-happen` | Transitive chain via `tar` — path traversal during package operations |
  | MODERATE | `nodemailer` | **SMTP command injection** via unsanitized `envelope.size` — directly used in production email sending |
  | MODERATE | `follow-redirects` | Leaks custom auth headers to cross-domain redirect targets — axios depends on this |

  **Frontend (8 total — 4 High, 4 Moderate):**
  | Severity | Package | Vulnerability |
  |---|---|---|
  | HIGH | `lodash` | Prototype pollution via `_.unset` / `_.omit` — can corrupt object prototypes app-wide |
  | HIGH | `axios` | Same DoS as backend |
  | HIGH | `rollup` | Arbitrary file write via path traversal (build tool; lower runtime risk) |
  | MODERATE | `postcss` | XSS via unescaped `</style>` in CSS stringify (build tool) |
  | MODERATE | `vite` | Path traversal in optimized deps `.map` handling (dev server) |

  The `nodemailer` SMTP injection is the highest-risk runtime vulnerability given the app sends password reset emails.
- **Recommendation**:
  ```bash
  cd backend && npm audit fix
  cd frontend && npm audit fix
  # For breaking changes: npm audit fix --force (review changelog first)
  ```
  Prioritise: `nodemailer` (SMTP injection), `axios` (DoS), `follow-redirects` (auth leak), `lodash` (prototype pollution).
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T22:10:44Z
- **Developer check**: ☐

---

### [NEW] INF-003 — Default Seed User Created with Hardcoded `changeme123` Password
- **Severity**: Medium (operational)
- **File**: `backend/scripts/seedDefaultUser.js:18`
- **Description**: The seed script falls back to the password `'changeme123'` when `DEFAULT_USER_PASSWORD` is not set. The `.env.example` also shows this same value as the example. If a developer runs this script in production without setting `DEFAULT_USER_PASSWORD`, a real account with a trivially guessable password (`default@tradingsync.local` / `changeme123`) is created in the production database. This account would own all legacy NULL `user_id` accounts (the SEC-006 issue compounds this — any user could also access those rows directly).
- **Evidence**:
  ```js
  const password = process.env.DEFAULT_USER_PASSWORD || 'changeme123';
  // ...
  console.log(`✅ Default user created. Log in with: ${email} / ${password}`);
  ```
- **Recommendation**: Remove the hardcoded fallback — throw an error if `DEFAULT_USER_PASSWORD` is not set when `NODE_ENV=production`. Add a post-seed prompt to change the password immediately. Document this in the deployment checklist.
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T22:10:44Z
- **Developer check**: ☐

---

### Additional Surface Scanned This Run
- **Database adapter (`database.js`)**: All queries use parameterised statements (`?` placeholders → `$1,$2` for PG). No raw string interpolation found — no SQL injection risk in the adapter layer.
- **`backfillHistory.js`**: Operates on all accounts without user filtering (it is an internal startup task, not an API route) — acceptable; it runs server-side only before routes are registered.
- **`scripts/backupUserAccount.js`**: Contains a comment warning that output files include password hashes and should be treated as secret — good practice; no runtime exposure.

---

## Summary — Run #4 (2026-04-28T22:10:44Z)

**0 issues fixed since Run #3. 3 new issues added.**

| ID | Severity | Title | Status |
|---|---|---|---|
| SEC-001 | Critical | Hardcoded fallback JWT secret | [OPEN] |
| SEC-002 | High | Unauthenticated `/api/debug` endpoint | [OPEN] |
| SEC-003 | High | No rate limiting on auth endpoints | [OPEN] |
| SEC-004 | High | Uploads served as public static files | [OPEN] |
| SEC-005 | High | Wide-open CORS policy | [OPEN] |
| SEC-006 | High | Authorization bypass via NULL user_id | [OPEN] |
| SEC-017 | High | Docker container runs as root | [OPEN] |
| SEC-018 | High | 25 known-vulnerable dependencies (12 High CVEs) | [OPEN] |
| SEC-007 | Medium | Password reset token stored in plaintext | [OPEN] |
| SEC-008 | Medium | Reset token leaked in API response | [OPEN] |
| SEC-009 | Medium | No security headers (Helmet missing) | [OPEN] |
| SEC-010 | Medium | JWT not invalidated on password change | [OPEN] |
| SEC-011 | Medium | No MIME type validation on uploads | [OPEN] |
| SEC-014 | Medium | Raw internal error messages sent to client | [OPEN] |
| SEC-015 | Medium | Unauthenticated open email relay endpoint | [OPEN] |
| INF-002 | Medium | JWT in localStorage — XSS token theft | [OPEN] |
| INF-003 | Medium | Default seed user with hardcoded password | [OPEN] |
| SEC-012 | Low | Email verification not enforced | [OPEN] |
| SEC-013 | Low | OpenAI error details leaked to client | [OPEN] |
| SEC-016 | Low | No bounds validation on financial fields | [OPEN] |
| INF-001 | High (ops) | SQLite in production — data loss risk | [OPEN] |

**Total: 21 issues — 1 Critical, 7 High, 7 Medium, 3 Low, 3 Operational**

---

*Next review scheduled: 2026-04-28T23:10:44Z*

---

## Run #5 — 2026-04-28T22:40:56Z

### Developer Fix Check

No commits to `backend/` or `frontend/` since Run #4. All 21 issues remain open.

| ID | Check | Status |
|---|---|---|
| SEC-001 | `'dev-secret-change-in-production'` fallback count=1 | `[OPEN]` |
| SEC-002 | `/api/debug` has no `requireAuth` — count=0 | `[OPEN]` |
| SEC-003 | `rate.limit` / `rateLimit` count=0 in `server.js` | `[OPEN]` |
| SEC-004 | `express.static('uploads')` count=1 | `[OPEN]` |
| SEC-005 | `cors()` no-arg count=1 | `[OPEN]` |
| SEC-006 | `user_id IS NULL` count=3 in auth guards | `[OPEN]` |
| SEC-007 | Plaintext token write in `auth.js:181` | `[OPEN]` |
| SEC-008 | `devLink` count=2 in `auth.js` | `[OPEN]` |
| SEC-009 | `helmet` count=0 in `server.js` | `[OPEN]` |
| SEC-010 | No password_version/token_version in schema | `[OPEN]` |
| SEC-011 | `fileFilter` count=0 in multer config | `[OPEN]` |
| SEC-012 | `email_verified = 1` at registration still present | `[OPEN]` |
| SEC-013 | `fallbackData.error = error.message` in `aiService.js` | `[OPEN]` |
| SEC-014 | `err.message` in 15+ `res.status(500)` in `portfolio.js` | `[OPEN]` |
| SEC-015 | Unauthenticated `/api/test-email` still present | `[OPEN]` |
| SEC-016 | `parseFloat` without `Number.isFinite` guard on financial fields | `[OPEN]` |
| SEC-017 | No `USER` directive in `Dockerfile` count=0 | `[OPEN]` |
| SEC-018 | `npm audit` — 25 CVEs unchanged | `[OPEN]` |
| INF-001 | SQLite-in-production warning only | `[OPEN]` |
| INF-002 | JWT in `localStorage` | `[OPEN]` |
| INF-003 | `changeme123` fallback in `seedDefaultUser.js` | `[OPEN]` |

---

### [NEW] SEC-019 — No Maximum Length Validation on User-Supplied String Fields
- **Severity**: Low
- **Files**: `backend/routes/portfolio.js` (`createAccount:673-675`, `updateAccountName:977`, `updateAccountPlatform:1080`, `updateAccountTag:1047`), `backend/routes/auth.js` (`register`, `updateProfile`)
- **Description**: Text fields accepted from authenticated users have no maximum length enforcement. All inputs are only `.trim()`-ed before being written to the database. An authenticated user can store arbitrarily long strings as account names, platform names, tags, and display names. This enables:
  - **Storage DoS**: An authenticated user fills the DB with large strings across many accounts/holdings, consuming disk space disproportionate to normal use.
  - **UI breakage**: Extremely long account names or symbols are rendered directly in the React dashboard — very long strings can break table layouts and chart labels.
  - **Log bloat**: Long strings stored in `raw_data` / `extracted_data` columns (AI JSON responses) accumulate with no size cap and no cleanup mechanism.
  Note: `createAccount` also accepts any arbitrary `accountType` string (unlike `updateAccountType`, which validates against a 7-item allowlist) — a minor inconsistency that lets arbitrary values persist in the DB.
- **Evidence**:
  ```js
  // portfolio.js:673-675
  const name = (accountName || 'Manual').trim();  // no maxLength
  const plat = (platform || 'Manual').trim();      // no maxLength
  const type = (accountType || 'stocks').trim();   // no allowlist check
  ```
- **Recommendation**: Add explicit length caps at the API layer:
  ```js
  if (name.length > 100) return res.status(400).json({ error: 'Account name max 100 chars' });
  const VALID_TYPES = ['p2p','stocks','crypto','precious','bank','savings','unknown'];
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid account type' });
  ```
  Apply equivalent guards to all free-text fields. Also add a periodic cleanup job or size limit for the `raw_data` / `extracted_data` columns.
- **Status**: `[OPEN]`
- **First reported**: 2026-04-28T22:40:56Z
- **Developer check**: ☐

---

### Areas Cleared This Run
- **SSRF via stock symbols**: All user-supplied symbols are passed through `encodeURIComponent()` before inclusion in Yahoo Finance and CoinGecko URLs (`marketData.js:17,136,315,345`). No SSRF possible via this vector.
- **Sensitive server-side logging**: No `console.log` calls found outputting email addresses, passwords, tokens, or secrets in `auth.js`, `portfolio.js`, or `aiService.js`. Error logging in `errorLog.js` truncates messages at 200 chars and stores no request body content.
- **JSON body DoS**: `express.json()` uses Express's default 100 KB body limit — adequate for this API's payloads.
- **Calculations service**: `calculations.js` guards against non-finite balances via `Number.isFinite(balanceNum)` before compound interest arithmetic — no division-by-zero or `Infinity` propagation in that service.
- **Account creation ownership**: `createAccount` correctly binds `user_id = req.userId` (from JWT) — no ownership bypass possible on account creation.

---

## Summary — Run #5 (2026-04-28T22:40:56Z)

**0 issues fixed since Run #4. 1 new issue added.**

| ID | Severity | Title | Status |
|---|---|---|---|
| SEC-001 | Critical | Hardcoded fallback JWT secret | [OPEN] |
| SEC-002 | High | Unauthenticated `/api/debug` endpoint | [OPEN] |
| SEC-003 | High | No rate limiting on auth endpoints | [OPEN] |
| SEC-004 | High | Uploads served as public static files | [OPEN] |
| SEC-005 | High | Wide-open CORS policy | [OPEN] |
| SEC-006 | High | Authorization bypass via NULL user_id | [OPEN] |
| SEC-017 | High | Docker container runs as root | [OPEN] |
| SEC-018 | High | 25 known-vulnerable dependencies (12 High CVEs) | [OPEN] |
| SEC-007 | Medium | Password reset token stored in plaintext | [OPEN] |
| SEC-008 | Medium | Reset token leaked in API response | [OPEN] |
| SEC-009 | Medium | No security headers (Helmet missing) | [OPEN] |
| SEC-010 | Medium | JWT not invalidated on password change | [OPEN] |
| SEC-011 | Medium | No MIME type validation on uploads | [OPEN] |
| SEC-014 | Medium | Raw internal error messages sent to client | [OPEN] |
| SEC-015 | Medium | Unauthenticated open email relay endpoint | [OPEN] |
| INF-002 | Medium | JWT in localStorage — XSS token theft | [OPEN] |
| INF-003 | Medium | Default seed user with hardcoded password | [OPEN] |
| SEC-012 | Low | Email verification not enforced | [OPEN] |
| SEC-013 | Low | OpenAI error details leaked to client | [OPEN] |
| SEC-016 | Low | No bounds validation on financial fields | [OPEN] |
| SEC-019 | Low | No max length on user-supplied string fields | [OPEN] |
| INF-001 | High (ops) | SQLite in production — data loss risk | [OPEN] |

**Total: 22 issues — 1 Critical, 7 High, 7 Medium, 4 Low, 3 Operational**

---

*Next review scheduled: 2026-04-28T23:40:56Z*
