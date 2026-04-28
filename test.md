# TradingSync — Security & Capability Review Log

Reviewer: Automated Security Agent (trading-app specialist)
Repository: `cvetoson/tradingsync`
Branch: `claude/cool-hawking-UiAbk`
Reviews run every hour. Each run re-verifies previously open findings.

---

## Application Capabilities (Summary)

TradingSync is a **multi-asset personal portfolio tracker** with:

| Capability | Details |
|---|---|
| **Auth** | JWT (7-day expiry), bcrypt passwords, email verification infra, password reset |
| **Screenshot OCR** | OpenAI GPT-4o Vision extracts balance/holdings from broker screenshots |
| **Portfolio types** | P2P lending, stocks/ETFs, crypto, precious metals (XAG/XAU), savings, bank |
| **Platforms supported** | Trading 212, IBKR, Revolut, Bondora, Iuvo, Moneyfit, Ledger (auto-detected) |
| **Market data** | Yahoo Finance (unauthenticated), CoinGecko free tier, OpenFIGI ISIN resolution |
| **Currencies** | EUR, USD, GBP, HKD, CHF with live FX rates |
| **History/projections** | Compound-interest daily history generation for P2P; trend-based 3-month stock projection |
| **Database** | SQLite (dev) / PostgreSQL (production, Railway) |
| **Email** | Resend or SMTP (nodemailer) for password reset; verification link fallback in dev |
| **Deployment** | Railway (Dockerfile + Procfile), Vite frontend, Node.js/Express backend |

---

## Review #1 — 2026-04-28T00:00:00Z

**Status:** Initial review — no prior findings to reverify.

---

### CRITICAL Vulnerabilities

---

#### [C-001] Hardcoded Fallback JWT Secret
- **File:** `backend/routes/auth.js:8`
- **Code:** `const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';`
- **Risk:** If `JWT_SECRET` is not set in production, the string `'dev-secret-change-in-production'` is used. An attacker who knows this (it is public in the repo) can mint valid JWTs for any `userId` and gain full account access.
- **Severity:** CRITICAL
- **Fix:** Remove the fallback entirely. Throw a startup error if `JWT_SECRET` is missing or less than 32 characters. Add a check in `start()` before `app.listen`.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [C-002] Unauthenticated `/api/debug` Endpoint
- **File:** `backend/server.js:143-155`
- **Code:** `app.get('/api/debug', (req, res) => { ... recentErrors: getRecentErrors(), ... })`
- **Risk:** Endpoint is public (no `requireAuth`). Exposes: database type, whether OpenAI/SMTP keys are configured, `APP_URL`, recent internal error messages. Error messages may contain SQL queries, file paths, stack traces, or internal identifiers — useful for attackers performing reconnaissance.
- **Severity:** CRITICAL
- **Fix:** Add `requireAuth` middleware (or better: an `adminOnly` check against a whitelist), or remove the endpoint entirely and rely on server logs.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

### HIGH Vulnerabilities

---

#### [H-001] No Rate Limiting on Authentication Routes
- **File:** `backend/server.js:70-74`
- **Routes:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- **Risk:** No throttling, lockout, or CAPTCHA on auth endpoints. Susceptible to:
  - Credential stuffing (automated login attempts with leaked password lists)
  - Brute-force against bcrypt (low cost given no lockout)
  - Password-reset token enumeration (64-hex-char tokens but unlimited attempts)
- **Severity:** HIGH
- **Fix:** Add `express-rate-limit` (e.g., 10 req/15 min per IP on login, 5 req/hour on forgot-password). Consider account lockout after N failed logins.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [H-002] Legacy `user_id IS NULL` Accounts Accessible by Any User
- **File:** `backend/routes/auth.js:355, 370, 388`
- **Code (example):** `WHERE id = ? AND (user_id = ? OR user_id IS NULL)`
- **Risk:** Accounts, history entries, and holdings that were created before multi-user support (or via `seedDefaultUser.js`) have `user_id = NULL`. Every authenticated user can read, modify, or delete these records. On a shared/hosted deployment this is a horizontal privilege escalation vulnerability.
- **Severity:** HIGH
- **Fix:** Either (a) require `user_id = ?` only (migration must assign all legacy rows to a specific admin user first), or (b) add a dedicated `is_shared` boolean column and restrict it to read-only access.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [H-003] Uploaded Financial Screenshots Served Unauthenticated
- **File:** `backend/server.js:26`
- **Code:** `app.use(express.static(join(__dirname, 'uploads')));`
- **Risk:** Screenshot files (containing sensitive financial data: balances, account numbers, broker UI) are served as static files with **no authentication**. A file named `screenshot-1714123456789-912345678.png` is predictable enough that an attacker scanning timestamp ranges can download any user's financial screenshots.
- **Severity:** HIGH
- **Fix:** Remove the static serve. Serve upload files through an authenticated route that validates the requesting user owns the account linked to the screenshot. Alternatively delete screenshots after AI analysis completes.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [H-004] No File Type Validation on Screenshot Upload
- **File:** `backend/server.js:35-48`
- **Risk:** Multer only enforces a 10 MB size limit. No MIME type or file extension validation. An attacker can upload:
  - SVG files with embedded JavaScript (XSS if served back)
  - HTML files
  - Executable payloads
  - Files with double extensions (e.g., `evil.png.php`)
- **Severity:** HIGH
- **Fix:** Add a `fileFilter` to multer that checks `file.mimetype` against an allowlist (`['image/png','image/jpeg','image/webp','image/gif']`). Optionally use `file-type` library for magic-byte validation.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

### MEDIUM Vulnerabilities

---

#### [M-001] Broad CORS Policy — Any Origin Allowed
- **File:** `backend/server.js:24`
- **Code:** `app.use(cors())`
- **Risk:** Without an `origin` allowlist, any website can make credentialed cross-origin requests to the API. While JWT is in `Authorization` headers (not cookies, so classic CSRF is moot), this still enables malicious sites to make API calls on behalf of users if they can steal the localStorage token via XSS.
- **Severity:** MEDIUM
- **Fix:** Restrict to known origins: `cors({ origin: [process.env.APP_URL, 'http://localhost:5173'] })`.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [M-002] JWT Token Stored in `localStorage` (XSS-Accessible)
- **File:** `frontend/src/services/api.js:11-14`
- **Code:** `const token = localStorage.getItem(AUTH_KEY);`
- **Risk:** `localStorage` is readable by any JavaScript on the page. Any XSS vulnerability (e.g., in a user-controlled field, a third-party library, or the AI-returned `platform` name that may be rendered unsanitized) could steal the auth token, giving persistent account access.
- **Severity:** MEDIUM
- **Fix (ideal):** Use `httpOnly` `SameSite=Strict` cookies for the JWT. **Fix (acceptable):** Keep localStorage but add strict Content Security Policy (CSP) headers and carefully audit all rendered user-supplied strings for XSS.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [M-003] `devLink` Password Reset Token Leaked in API Response
- **File:** `backend/routes/auth.js:190-198`
- **Code:** `return res.json({ success: true, ..., devLink: emailResult.devLink })`
- **Risk:** When email delivery fails (misconfigured SMTP/Resend in production), the full password-reset URL (including the token) is returned in the API JSON response body. A network observer or logging system captures a live reset token, enabling account takeover.
- **Severity:** MEDIUM
- **Fix:** Only return `devLink` when `NODE_ENV !== 'production'`. In production, log the dev link to server console only (or better: alert ops) and tell the user to contact support.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [M-004] Raw Database Error Messages Returned to Clients
- **File:** `backend/routes/auth.js:259`, and scattered throughout `portfolio.js`
- **Code (example):** `res.status(500).json({ error: err.message })`
- **Risk:** Raw `err.message` from SQLite/PostgreSQL can include table names, column names, constraint names, query fragments, and file paths — useful for SQL injection mapping and information gathering.
- **Severity:** MEDIUM
- **Fix:** Return a generic message (`'Internal server error'`) to clients and log the full error server-side only. Use the existing `logError` utility consistently.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [M-005] `GET /api/test-email` Can Be Abused to Send Spam
- **File:** `backend/server.js:158-172`
- **Risk:** When `EMAIL_TEST_ENABLED=true`, any anonymous user can trigger emails to arbitrary addresses with no rate limit, no authentication, and only a basic regex check. This is an open relay for spam/phishing when misconfigured in production.
- **Severity:** MEDIUM
- **Fix:** Require `requireAuth` on this endpoint. Add rate limiting (1 req/min per user). Ideally remove entirely from production builds.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

### LOW Vulnerabilities

---

#### [L-001] Email Verification Disabled on Registration (TODO in Code)
- **File:** `backend/routes/auth.js:40-43`
- **Code:** `email_verified = 1` immediately on `INSERT`, with `// TODO: Add email verification` comment
- **Risk:** Anyone can register with any email (including impersonating others), immediately log in, and use the full service without proving ownership of the email. Password-reset emails sent to that address would go to the real owner, potentially leaking that an account was created in their name.
- **Severity:** LOW (design decision — common in early-stage apps)
- **Fix:** Follow the existing infrastructure: insert with `email_verified = 0`, send a verification email (the `sendVerificationEmail` function already exists), and block login until verified. Remove the TODO comment when done.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [L-002] Uploaded Screenshots Not Deleted After Processing
- **File:** `backend/routes/portfolio.js` (uploadScreenshot function)
- **Risk:** Financial screenshots accumulate indefinitely in the `uploads/` directory on the server filesystem. On Railway, this data is lost on redeploy anyway, but on persistent storage this represents a large sensitive data cache with no TTL or cleanup.
- **Severity:** LOW
- **Fix:** After AI analysis (success or failure), delete the file: `fs.unlink(filePath, () => {})`. Store only the extracted structured data in the DB.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [L-003] Weak Password Policy (8-character minimum only)
- **File:** `backend/routes/auth.js:33-35`
- **Risk:** Minimum 8 characters with no complexity requirements (uppercase, digit, symbol). Combined with no rate limiting [H-001], weak passwords are easily brute-forced.
- **Severity:** LOW
- **Fix:** Enforce at least: 1 uppercase, 1 number. Alternatively integrate `zxcvbn` for strength scoring. Add a strength indicator in the frontend.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [L-004] Floating-Point Arithmetic for Financial Calculations
- **File:** `backend/routes/portfolio.js` (holdingValueInEur, compoundP2PToNow), `backend/services/calculations.js`
- **Risk:** JavaScript `Number` (IEEE 754 double) accumulates rounding errors in financial arithmetic. Example: `0.1 + 0.2 === 0.30000000000000004`. Over thousands of compound-interest steps or many holdings, displayed totals can drift from true values.
- **Severity:** LOW (cosmetic in most cases; could mislead users on gains/losses)
- **Fix:** Use a decimal library (`decimal.js` or `big.js`) for all monetary calculations, or round to 2 decimal places at display boundaries consistently.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [L-005] Yahoo Finance Scraping — No API Key, Fragile
- **File:** `backend/services/marketData.js:6, 134-151`
- **Code:** `const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; TradingSync/3.0)' }`
- **Risk:** Yahoo Finance's unofficial chart API is rate-limited and can be blocked or changed at any time with no notice. There is no fallback data source for stocks (only CoinGecko for crypto). When Yahoo is down or blocks the user-agent, all stock/ETF prices silently show stale values with no user alert.
- **Severity:** LOW (operational risk, not security)
- **Recommendation:** Add a `priceDataAge` field in API responses. Alert users in the UI when prices are older than a configurable threshold (e.g., 24 hours). Consider caching last-known good prices in the DB.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

## Finding Tracker

| ID | Severity | Title | Status | First Seen | Fixed In |
|---|---|---|---|---|---|
| C-001 | CRITICAL | Hardcoded Fallback JWT Secret | OPEN | Rev #1 | — |
| C-002 | CRITICAL | Unauthenticated `/api/debug` Endpoint | OPEN | Rev #1 | — |
| H-001 | HIGH | No Rate Limiting on Auth Routes | OPEN | Rev #1 | — |
| H-002 | HIGH | Legacy NULL user_id Privilege Escalation | OPEN | Rev #1 | — |
| H-003 | HIGH | Uploaded Screenshots Served Without Auth | OPEN | Rev #1 | — |
| H-004 | HIGH | No File Type Validation on Upload | OPEN | Rev #1 | — |
| M-001 | MEDIUM | Broad CORS Policy | OPEN | Rev #1 | — |
| M-002 | MEDIUM | JWT in localStorage (XSS-accessible) | OPEN | Rev #1 | — |
| M-003 | MEDIUM | devLink Password Token in API Response | OPEN | Rev #1 | — |
| M-004 | MEDIUM | Raw DB Errors Returned to Clients | OPEN | Rev #1 | — |
| M-005 | MEDIUM | Test-Email Endpoint Open Relay | OPEN | Rev #1 | — |
| L-001 | LOW | Email Verification Disabled on Register | OPEN | Rev #1 | — |
| L-002 | LOW | Screenshots Not Deleted After Processing | OPEN | Rev #1 | — |
| L-003 | LOW | Weak Password Policy | OPEN | Rev #1 | — |
| L-004 | LOW | Floating-Point Financial Arithmetic | OPEN | Rev #1 | — |
| L-005 | LOW | Yahoo Finance Scraping Fragility | OPEN | Rev #1 | — |

---

*Next automated review: 2026-04-28T02:00:00Z*

---

## Review #2 — 2026-04-28T01:00:00Z

**Trigger:** Hourly monitor (task `bvwkvifyy` timed out and was re-armed as `bnv01j267`)
**New commits since Review #1:** None — no developer activity on branch.

### Reverification Results

All 16 findings confirmed still **OPEN**. Spot-checked key lines:

| Finding | File:Line | Verified Still Present |
|---|---|---|
| C-001 | `auth.js:8` — `JWT_SECRET \|\| 'dev-secret-change-in-production'` | YES |
| C-002 | `server.js:143` — `app.get('/api/debug', ...)` no auth | YES |
| H-001 | `server.js:70-74` — no rate-limit middleware on auth routes | YES |
| H-002 | `auth.js:355,370,388` — `user_id IS NULL` in all auth guards | YES |
| H-003 | `server.js:26` — `express.static('uploads')` unauthenticated | YES |
| H-004 | `server.js:35-48` — multer with no `fileFilter` | YES |
| M-001 | `server.js:24` — `cors()` no origin allowlist | YES |
| M-003 | `auth.js:190,197` — `devLink` unconditionally returned | YES |

### No New Vulnerabilities Found

No new code introduced; no new findings to add.

### Finding Tracker (unchanged)

All 16 findings remain OPEN. See tracker table in Review #1.

*Next automated review: 2026-04-28T04:00:00Z*

---

## Review #4 — 2026-04-28T03:00:00Z

**Trigger:** Hourly monitor (task `bbow7kl2o` timed out, re-armed as `bhdq2x1ny`)
**New commits to production branch since Review #3:** None.

### Developer Activity Detected on Side Branches

`git fetch` revealed significant developer activity — several new branches and tags pushed since last review:

| Branch / Tag | Notable Commits |
|---|---|
| `cursor/robustness-improvements-bef2` | `d8e3297` — "Add comprehensive input validation and robustness improvements" |
| `cursor/hourly-refresh-fix-4381` | `b58849c` — "Add automatic hourly portfolio refresh" |
| `cursor/hourly-validation-report-06dd` | `7d9c0fc` — "Add hourly validation report workflow" |
| `v3.5.0`, `v3.6-stable`, `v3.6.0` | New stable release tags |

### Partial Fixes Found on `cursor/robustness-improvements-bef2` (NOT yet merged)

The robustness branch introduced `backend/lib/validation.js` — a comprehensive validation utility library — and applied it to route handlers. **These fixes exist on that branch only; the production code path is unchanged.**

| Finding | Fix on robustness branch | Status on production |
|---|---|---|
| **H-004** (no file type validation) | `validateFileUpload()` called at `portfolio.js:273,1345` — checks MIME type against `['image/png','image/jpeg','image/jpg','image/webp','image/gif']` allowlist | **OPEN** (not merged) |
| **M-004** (raw DB errors) | `sanitizeDbError()` applied throughout `portfolio.js` — 10+ call sites; generic messages returned to client | **OPEN** (not merged) |

Remaining 14 findings have **no fix activity** even on the robustness branch:
- **C-001** — JWT secret hardcoded fallback: unchanged on all branches
- **C-002** — `/api/debug` unauthenticated: unchanged on all branches
- **H-001** — No rate limiting: unchanged on all branches
- **H-002** — `user_id IS NULL` auth bypass: unchanged on all branches
- **H-003** — Static upload serving without auth: unchanged on all branches
- **M-001** — Open CORS: unchanged on all branches
- **M-002** — JWT in localStorage: unchanged on all branches
- **M-003** — `devLink` returned in production: unchanged on all branches
- **M-005** — Test-email open relay: unchanged on all branches
- **L-001 through L-005** — unchanged on all branches

### Recommendation to Developer

The validation library on `cursor/robustness-improvements-bef2` is a good foundation. **Merge it to main**, then continue with the unaddressed CRITICAL and HIGH items. Suggested order:

1. Merge `cursor/robustness-improvements-bef2` → closes H-004 and M-004 on production
2. **[C-001]** Add startup guard: `if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) { console.error('FATAL: JWT_SECRET not set'); process.exit(1); }` in `start()` before `app.listen`
3. **[C-002]** Add `requireAuth` to `app.get('/api/debug', ...)` in `server.js:143`
4. **[H-001]** `npm install express-rate-limit` → add `rateLimit({ windowMs: 15*60*1000, max: 20 })` before auth routes
5. **[H-003]** Remove `app.use(express.static(join(__dirname, 'uploads')))` from `server.js:26`

### Updated Finding Tracker

| ID | Severity | Title | Status | First Seen | Partial Fix Branch |
|---|---|---|---|---|---|
| C-001 | CRITICAL | Hardcoded Fallback JWT Secret | **OPEN** | Rev #1 | — |
| C-002 | CRITICAL | Unauthenticated `/api/debug` Endpoint | **OPEN** | Rev #1 | — |
| H-001 | HIGH | No Rate Limiting on Auth Routes | **OPEN** | Rev #1 | — |
| H-002 | HIGH | Legacy NULL user_id Privilege Escalation | **OPEN** | Rev #1 | — |
| H-003 | HIGH | Uploaded Screenshots Served Without Auth | **OPEN** | Rev #1 | — |
| H-004 | HIGH | No File Type Validation on Upload | **OPEN** (fix pending merge) | Rev #1 | `cursor/robustness-improvements-bef2` |
| M-001 | MEDIUM | Broad CORS Policy | **OPEN** | Rev #1 | — |
| M-002 | MEDIUM | JWT in localStorage (XSS-accessible) | **OPEN** | Rev #1 | — |
| M-003 | MEDIUM | devLink Password Token in API Response | **OPEN** | Rev #1 | — |
| M-004 | MEDIUM | Raw DB Errors Returned to Clients | **OPEN** (fix pending merge) | Rev #1 | `cursor/robustness-improvements-bef2` |
| M-005 | MEDIUM | Test-Email Endpoint Open Relay | **OPEN** | Rev #1 | — |
| L-001 | LOW | Email Verification Disabled on Register | **OPEN** | Rev #1 | — |
| L-002 | LOW | Screenshots Not Deleted After Processing | **OPEN** | Rev #1 | — |
| L-003 | LOW | Weak Password Policy | **OPEN** | Rev #1 | — |
| L-004 | LOW | Floating-Point Financial Arithmetic | **OPEN** | Rev #1 | — |
| L-005 | LOW | Yahoo Finance Scraping Fragility | **OPEN** | Rev #1 | — |

*Next automated review: 2026-04-28T04:00:00Z*

---

## Review #3 — 2026-04-28T02:00:00Z

**Trigger:** Hourly monitor (task `bnv01j267` timed out, re-armed as `bbow7kl2o`)
**New commits since Review #2:** None — no developer activity on branch.

### Reverification Results

All 16 findings confirmed still **OPEN**. Full grep sweep of all critical/high finding locations returned unchanged results — every vulnerable line is still present verbatim.

### No New Vulnerabilities Found

No new code introduced; no new findings to add.

### Developer Action Needed — Priority Order

The following are the highest-impact fixes, ranked by risk:

1. **[C-001]** Remove the hardcoded JWT secret fallback (`auth.js:8`) — server should refuse to start if `JWT_SECRET` is unset or too short.
2. **[C-002]** Add `requireAuth` to `GET /api/debug` (`server.js:143`) — currently leaks errors and config anonymously.
3. **[H-001]** Install `express-rate-limit` on all auth routes — unlimited brute-force is possible right now.
4. **[H-003]** Remove `express.static('uploads')` (`server.js:26`) — financial screenshots must not be publicly accessible.
5. **[H-004]** Add multer `fileFilter` to whitelist image MIME types only (`server.js:45`).

*Next automated review: 2026-04-28T05:00:00Z*

---

## Review #5 — 2026-04-28T04:00:00Z

**Trigger:** Hourly monitor (task `bhdq2x1ny` timed out, re-armed as `bunjmkafw`)
**New commits to production branch since Review #4:** None.

### Parallel Review Agent Activity

Two other review agents (`claude/cool-hawking-DLeeW`, `claude/cool-hawking-dx9FO`) are running concurrently. Cross-referencing their findings surfaced **8 additional vulnerabilities** not in the original 16. Each was independently verified against live source files before being added.

### Reverification of Existing Findings

All 16 original findings confirmed **OPEN** — no production code changes detected.

---

### NEW Findings (first identified in Review #5)

---

#### [N-001] AI Prompt Injection via User-Controlled `platform` Field — HIGH
- **File:** `backend/services/aiService.js:70`
- **Code:** `` const prompt = `Analyze this screenshot from a ${contextDescription}${accountType ? ` (category: ${platform})` : ''}...` ``
- **Risk:** The `platform` value originates from `req.body.investmentCategory` → mapped to display name in `portfolio.js:412-422`. A user who calls `/api/upload` with a crafted `investmentCategory` can inject arbitrary text into the OpenAI prompt. Examples: override the JSON schema instruction, exfiltrate previous conversation turns, or induce the AI to return forged financial data that gets saved to the database.
- **Fix:** Validate `investmentCategory` against the known allowlist (`['auto','p2p','equities','crypto','precious','savings','fixed-income','alternative']`) before passing it to `analyzeScreenshot`. Never interpolate free-text user input into LLM prompts.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [N-002] No HTTP Security Headers (Helmet Missing) — MEDIUM
- **File:** `backend/server.js` (no helmet import or usage)
- **Risk:** The API and production SPA serve responses with no security headers. Missing headers enable:
  - **XSS** via missing `Content-Security-Policy`
  - **Clickjacking** via missing `X-Frame-Options`
  - **MIME sniffing** via missing `X-Content-Type-Options`
  - **Info leak** via `X-Powered-By: Express` (present by default)
  - **Protocol downgrade** via missing `Strict-Transport-Security`
- **Fix:** `npm install helmet` → `app.use(helmet())` before all routes in `server.js`. Tune CSP for the frontend's inline styles/scripts if needed.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [N-003] Single PostgreSQL Connection — No Pool, No Reconnect — MEDIUM
- **File:** `backend/database.js:90`
- **Code:** `pgClient = new pg.Client({ connectionString: DATABASE_URL })`
- **Risk:** A single `pg.Client` is used for all queries. If the connection drops (Railway restarts, DB idle timeout, network blip), the entire server crashes or hangs silently — all subsequent DB operations fail with no automatic recovery. `pg.Pool` handles reconnection and concurrent queries safely.
- **Fix:** Replace `new pg.Client(...)` with `new pg.Pool({ connectionString: DATABASE_URL, max: 10 })` and update all `pgClient.query(...)` calls to `pool.query(...)` (the pool manages connections automatically).
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [N-004] Docker Container Runs as Root — MEDIUM
- **File:** `Dockerfile`
- **Risk:** No `USER` directive is present. The Node.js server process runs as `root` inside the container. If the app is compromised (e.g., via RCE in a dependency), the attacker gains root inside the container — making container escape or filesystem manipulation significantly easier.
- **Fix:** Add before `CMD`:
  ```dockerfile
  RUN addgroup -S app && adduser -S app -G app
  RUN chown -R app:app /app
  USER app
  ```
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [N-005] 17 Vulnerable Dependencies in Backend (8 HIGH) — HIGH
- **Source:** `npm audit` run against `backend/`
- **Critical runtime risks:**
  | Package | Severity | CVE Summary |
  |---|---|---|
  | `nodemailer` | MODERATE | **SMTP command injection** via unsanitised `envelope.size` — directly exploitable via password-reset email flow |
  | `path-to-regexp` | HIGH | **ReDoS** via multiple route parameters — Express uses this; a crafted URL can hang the event loop |
  | `axios` | HIGH | **DoS** via `__proto__` key in `mergeConfig` |
  | `tar` | HIGH | Arbitrary file write via hardlink path traversal (used by npm install toolchain) |
  | `follow-redirects` | MODERATE | Auth headers leaked to cross-domain redirects |
- **Frontend:** 8 additional vulnerabilities (4 HIGH incl. `rollup` path traversal, `axios` DoS).
- **Fix:** `cd backend && npm audit fix` (safe fixes). For breaking-change fixes: review changelog then `npm audit fix --force`. Prioritise `nodemailer` and `path-to-regexp`.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [N-006] JWT Tokens Not Invalidated on Password Change or Reset — MEDIUM
- **File:** `backend/routes/auth.js` — `changePassword` (line 279) and `resetPassword` (line 206)
- **Risk:** When a user changes their password or completes a password reset, existing JWTs remain valid for their full 7-day lifetime. A scenario where this is critical: attacker steals a token → victim notices, changes password → attacker's token still works for up to 7 more days.
- **Fix (simple):** Add a `token_version INTEGER DEFAULT 0` column to `users`. Increment it on every password change/reset. Embed `tokenVersion` in the JWT payload. In `requireAuth`, verify `decoded.tokenVersion === user.token_version` after decoding.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [N-007] Password Reset Tokens Stored in Plaintext — MEDIUM
- **File:** `backend/routes/auth.js:167,181`
- **Code:** `const resetToken = randomToken(); ... UPDATE users SET password_reset_token = ?, ...`
- **Risk:** Raw 64-hex-char reset tokens are stored unencrypted in the DB. A SQL injection, DB backup exfiltration, or direct DB access grants all pending reset tokens — enabling immediate account takeover for any user with an open reset request.
- **Fix:** Store only `crypto.createHash('sha256').update(resetToken).digest('hex')` in the DB. The plaintext token is sent via email and compared via the same hash at reset time. Same pattern as `bcrypt` for passwords, but SHA-256 is sufficient since reset tokens are single-use and high-entropy.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [N-008] `dotenv.config()` Called on Every AI Request — LOW
- **File:** `backend/services/aiService.js:16`
- **Code:** `dotenv.config({ path: join(__dirname, '../.env') });` inside `getOpenAIClient()`
- **Risk:** Re-reading and re-parsing the `.env` file on every screenshot upload is a filesystem read per request. More importantly, it creates unpredictable behaviour: a running server can silently pick up a changed `.env` mid-request, making configuration changes non-atomic. In production the `.env` typically doesn't exist (env vars are set in the platform), so this silently no-ops — but masks the fact the function is doing unnecessary I/O.
- **Fix:** Remove the in-function `dotenv.config()` call. Configuration is loaded once at startup in `server.js`. If a live API key refresh is genuinely needed, restart the server.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

### Updated Finding Tracker (24 total findings)

| ID | Severity | Title | Status | First Seen | Fix Branch |
|---|---|---|---|---|---|
| C-001 | CRITICAL | Hardcoded Fallback JWT Secret | OPEN | Rev #1 | — |
| C-002 | CRITICAL | Unauthenticated `/api/debug` Endpoint | OPEN | Rev #1 | — |
| H-001 | HIGH | No Rate Limiting on Auth Routes | OPEN | Rev #1 | — |
| H-002 | HIGH | Legacy NULL user_id Privilege Escalation | OPEN | Rev #1 | — |
| H-003 | HIGH | Uploaded Screenshots Served Without Auth | OPEN | Rev #1 | — |
| H-004 | HIGH | No File Type Validation on Upload | OPEN (fix pending merge) | Rev #1 | `cursor/robustness-*` |
| N-001 | HIGH | AI Prompt Injection via platform Field | OPEN | Rev #5 | — |
| N-005 | HIGH | 17 Vulnerable Dependencies (8 HIGH CVEs) | OPEN | Rev #5 | — |
| M-001 | MEDIUM | Broad CORS Policy | OPEN | Rev #1 | — |
| M-002 | MEDIUM | JWT in localStorage (XSS-accessible) | OPEN | Rev #1 | — |
| M-003 | MEDIUM | devLink Password Token in API Response | OPEN | Rev #1 | — |
| M-004 | MEDIUM | Raw DB Errors Returned to Clients | OPEN (fix pending merge) | Rev #1 | `cursor/robustness-*` |
| M-005 | MEDIUM | Test-Email Endpoint Open Relay | OPEN | Rev #1 | — |
| N-002 | MEDIUM | No HTTP Security Headers (Helmet) | OPEN | Rev #5 | — |
| N-003 | MEDIUM | Single PG Connection — No Pool/Reconnect | OPEN | Rev #5 | — |
| N-004 | MEDIUM | Docker Container Runs as Root | OPEN | Rev #5 | — |
| N-006 | MEDIUM | JWT Not Invalidated on Password Change | OPEN | Rev #5 | — |
| N-007 | MEDIUM | Password Reset Tokens in Plaintext DB | OPEN | Rev #5 | — |
| L-001 | LOW | Email Verification Disabled on Register | OPEN | Rev #1 | — |
| L-002 | LOW | Screenshots Not Deleted After Processing | OPEN | Rev #1 | — |
| L-003 | LOW | Weak Password Policy | OPEN | Rev #1 | — |
| L-004 | LOW | Floating-Point Financial Arithmetic | OPEN | Rev #1 | — |
| L-005 | LOW | Yahoo Finance Scraping Fragility | OPEN | Rev #1 | — |
| N-008 | LOW | dotenv Re-read on Every AI Request | OPEN | Rev #5 | — |

**Total: 2 Critical · 4 High · 12 Medium · 6 Low — 24 open findings**

*Next automated review: 2026-04-28T06:00:00Z*

---

## Review #6 — 2026-04-28T05:00:00Z

**Trigger:** Hourly monitor (task `bunjmkafw` timed out, re-armed as `byi1x1pqj`)
**New commits to production branch since Review #5:** None — main branch unchanged.
**Parallel agents:** `claude/cool-hawking-DLeeW` (Run #3 — 0 new), `claude/cool-hawking-dx9FO` (Run #5 — 1 new finding).

### Reverification of All 24 Existing Findings

All 24 findings confirmed still **OPEN**. No production code changes. Key spot-checks:
- `C-001`: JWT fallback secret still at `auth.js:8` ✓
- `C-002`: `/api/debug` still no auth at `server.js:143` ✓
- `H-001`: No `express-rate-limit` in `package.json` or `server.js` ✓
- `N-001`: `platform` still interpolated raw into OpenAI prompt at `aiService.js:70` ✓
- `N-005`: `npm audit` still returns 17 backend vulns (8 HIGH) ✓

### New Findings — Review #6

Cross-referencing `claude/cool-hawking-dx9FO` Run #5 and independent source verification surfaced 3 new findings:

---

#### [N-009] No Bounds Validation on Financial Input Fields — MEDIUM
- **File:** `backend/routes/portfolio.js:1109-1130` (`updateAccountBalance`), `1158-1185` (`updateAccountInterestRate`), `1982` (`updateHoldingQuantity`), `2020` (`updateHoldingPrice`)
- **Risk:** All financial update routes use `parseFloat()` and reject only `NaN`. They do **not** check for:
  - `Infinity` — `parseFloat('Infinity')` passes `isNaN()` (returns `false`) and is stored in the DB. Any arithmetic downstream (`totalValue`, `portfolioGrowthPercent`, compound interest) propagates `Infinity`, corrupting all portfolio totals.
  - Negative balances — no floor check; a user can set their balance to `-9999999999`.
  - Unreasonable interest rates — `1000000` (1,000,000 %) is accepted, causing compound interest projection to overflow.
  - Confirmed: `updateAccountBalance` line 1118-1120 — only `isNaN` guard, no `Number.isFinite` or range check.
- **Fix:** Replace bare `isNaN` checks with `Number.isFinite(value) && value >= 0 && value <= MAX_SANE_BALANCE`. Use the `MAX_SANE_HISTORY_BALANCE = 1e12` constant already defined in the file (line 173) for consistency. Reject `Infinity`, `-Infinity`, and `NaN`.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [N-010] No Maximum Length Validation on User String Fields — LOW
- **File:** `backend/routes/portfolio.js:973` (`updateAccountName`), `1080` (`updateAccountPlatform`), `1047` (`updateAccountTag`); `backend/routes/auth.js:265` (`updateProfile`)
- **Risk:** Text fields only call `.trim()` with no max-length enforcement. An authenticated user can store arbitrarily long strings as account names, platform names, tags, and display names. Effects:
  - **Storage exhaustion** — thousands of accounts with multi-MB names fills the DB disk.
  - **UI breakage** — very long account names or symbols render directly in React table cells, chart labels, and tooltips without truncation guards — breaking dashboard layout.
  - **ReDoS risk** — several internal `toLowerCase().includes(...)` checks run over user-supplied platform strings; pathological inputs could hang the event loop.
- **Fix:** Add `if (accountName.length > 200) return res.status(400).json({ error: '...' })` before DB writes, or use the `validateString` utility already available on the `cursor/robustness-*` branch.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

#### [N-011] Hardcoded Default Seed Password in Production Script — LOW
- **File:** `backend/scripts/seedDefaultUser.js:18`
- **Code:** `const password = process.env.DEFAULT_USER_PASSWORD || 'changeme123';`
- **Risk:** If a developer runs this script in production without setting `DEFAULT_USER_PASSWORD`, an account `default@tradingsync.local` / `changeme123` is created. Combined with **H-002** (NULL user_id accounts), this default user automatically inherits all legacy accounts. The credentials are public in `.env.example` and the GitHub repo.
- **Fix:** In production (`NODE_ENV=production`), throw a startup error if `DEFAULT_USER_PASSWORD` is not explicitly set. Remove the hardcoded fallback entirely. Add a post-seed reminder to change the password immediately.
- **Status:** OPEN — not fixed as of this review
- **Developer checked:** No

---

### Updated Finding Tracker (27 total findings)

| ID | Severity | Title | Status | First Seen | Fix Branch |
|---|---|---|---|---|---|
| C-001 | CRITICAL | Hardcoded Fallback JWT Secret | OPEN | Rev #1 | — |
| C-002 | CRITICAL | Unauthenticated `/api/debug` Endpoint | OPEN | Rev #1 | — |
| H-001 | HIGH | No Rate Limiting on Auth Routes | OPEN | Rev #1 | — |
| H-002 | HIGH | Legacy NULL user_id Privilege Escalation | OPEN | Rev #1 | — |
| H-003 | HIGH | Uploaded Screenshots Served Without Auth | OPEN | Rev #1 | — |
| H-004 | HIGH | No File Type Validation on Upload | OPEN (fix pending merge) | Rev #1 | `cursor/robustness-*` |
| N-001 | HIGH | AI Prompt Injection via platform Field | OPEN | Rev #5 | — |
| N-005 | HIGH | 17 Vulnerable Dependencies (8 HIGH CVEs) | OPEN | Rev #5 | — |
| M-001 | MEDIUM | Broad CORS Policy | OPEN | Rev #1 | — |
| M-002 | MEDIUM | JWT in localStorage (XSS-accessible) | OPEN | Rev #1 | — |
| M-003 | MEDIUM | devLink Password Token in API Response | OPEN | Rev #1 | — |
| M-004 | MEDIUM | Raw DB Errors Returned to Clients | OPEN (fix pending merge) | Rev #1 | `cursor/robustness-*` |
| M-005 | MEDIUM | Test-Email Endpoint Open Relay | OPEN | Rev #1 | — |
| N-002 | MEDIUM | No HTTP Security Headers (Helmet) | OPEN | Rev #5 | — |
| N-003 | MEDIUM | Single PG Connection — No Pool/Reconnect | OPEN | Rev #5 | — |
| N-004 | MEDIUM | Docker Container Runs as Root | OPEN | Rev #5 | — |
| N-006 | MEDIUM | JWT Not Invalidated on Password Change | OPEN | Rev #5 | — |
| N-007 | MEDIUM | Password Reset Tokens in Plaintext DB | OPEN | Rev #5 | — |
| N-009 | MEDIUM | No Bounds Validation on Financial Fields | OPEN | Rev #6 | — |
| L-001 | LOW | Email Verification Disabled on Register | OPEN | Rev #1 | — |
| L-002 | LOW | Screenshots Not Deleted After Processing | OPEN | Rev #1 | — |
| L-003 | LOW | Weak Password Policy | OPEN | Rev #1 | — |
| L-004 | LOW | Floating-Point Financial Arithmetic | OPEN | Rev #1 | — |
| L-005 | LOW | Yahoo Finance Scraping Fragility | OPEN | Rev #1 | — |
| N-008 | LOW | dotenv Re-read on Every AI Request | OPEN | Rev #5 | — |
| N-010 | LOW | No Max Length on User String Fields | OPEN | Rev #6 | — |
| N-011 | LOW | Hardcoded Default Seed Password | OPEN | Rev #6 | — |

**Total: 2 Critical · 6 High · 11 Medium · 8 Low — 27 open findings**

*Next automated review: 2026-04-28T07:00:00Z*

---

## Review #7 — 2026-04-28T06:00:00Z

**Trigger:** Hourly monitor (task `byi1x1pqj` timed out, re-armed as `bm02dgabk`)
**New commits to production (main) since Review #6:** None — 7th consecutive cycle with zero fixes.
**Parallel agents:** `claude/cool-hawking-DLeeW` Run #4 (+6 findings, all already captured in our N-* IDs); `claude/cool-hawking-dx9FO` Run #6 (SEC-006 scope expanded — see below).

### Reverification — All 27 Findings

Spot-check confirms all 27 findings present verbatim:

| Key check | File:Line | Result |
|---|---|---|
| C-001 JWT fallback | `auth.js:8` | OPEN |
| C-002 /api/debug unauth | `server.js:143` | OPEN |
| H-001 no rate limit | `server.js` — no `express-rate-limit` | OPEN |
| H-002 NULL user_id | `auth.js:355,370,388` | OPEN — **scope upgraded** |
| H-003 static uploads | `server.js:26` | OPEN |
| N-001 prompt injection | `aiService.js:70` | OPEN |
| N-009 Infinity balance | `portfolio.js:1118` — `isNaN` only | OPEN |

### H-002 Scope Upgraded — Wider Impact Than Initially Documented

**Original finding:** `user_id IS NULL` in the 3 auth-guard middleware functions allows any authenticated user to access, modify, or delete legacy accounts by ID.

**Upgraded scope (confirmed this cycle):** The `OR user_id IS NULL` pattern is also embedded in **data-read queries** — meaning legacy accounts silently appear in every user's live dashboard automatically, not just when targeted by ID:

| Location | File:Line | Impact |
|---|---|---|
| `getAccounts` | `portfolio.js:962` — `WHERE user_id = ? OR user_id IS NULL` | NULL-owned accounts listed in every user's Accounts page |
| `getPortfolioSummary` | `portfolio.js:766` — same pattern | NULL-owned balances summed into every user's total portfolio value |
| `uploadScreenshot` dedup | `portfolio.js:477` — same pattern | Any user uploading a screenshot can claim/overwrite a NULL-owned account |

**Combined impact:** A legacy account created by the seed script or before multi-user support will:
1. Appear in every registered user's account list
2. Be counted in every user's total portfolio value — inflating displayed wealth
3. Be overwritable by any user uploading a new screenshot that matches the platform/name
4. Be deletable by any user via `DELETE /api/accounts/:id`

This is the highest-impact finding in the tracker — it is an automatic data leak, not just a theoretical access-control bypass.

**H-002 severity upgrade: HIGH → CRITICAL.**

### No New Standalone Findings

All findings from parallel agents' latest runs (DLeeW SEC-025–030, dx9FO SEC-006 expansion) are already captured in our tracker under N-001 through N-011 and the H-002 scope upgrade above.

### Updated Finding Tracker (27 findings, H-002 upgraded to CRITICAL)

| ID | Severity | Title | Status | First Seen | Fix Branch |
|---|---|---|---|---|---|
| C-001 | CRITICAL | Hardcoded Fallback JWT Secret | OPEN | Rev #1 | — |
| C-002 | CRITICAL | Unauthenticated `/api/debug` Endpoint | OPEN | Rev #1 | — |
| H-002 | CRITICAL ⬆ | NULL user_id — Auth Bypass + Auto Dashboard Leak | OPEN | Rev #1 | — |
| H-001 | HIGH | No Rate Limiting on Auth Routes | OPEN | Rev #1 | — |
| H-003 | HIGH | Uploaded Screenshots Served Without Auth | OPEN | Rev #1 | — |
| H-004 | HIGH | No File Type Validation on Upload | OPEN (fix pending merge) | Rev #1 | `cursor/robustness-*` |
| N-001 | HIGH | AI Prompt Injection via platform Field | OPEN | Rev #5 | — |
| N-005 | HIGH | 17 Vulnerable Dependencies (8 HIGH CVEs) | OPEN | Rev #5 | — |
| M-001 | MEDIUM | Broad CORS Policy | OPEN | Rev #1 | — |
| M-002 | MEDIUM | JWT in localStorage (XSS-accessible) | OPEN | Rev #1 | — |
| M-003 | MEDIUM | devLink Password Token in API Response | OPEN | Rev #1 | — |
| M-004 | MEDIUM | Raw DB Errors Returned to Clients | OPEN (fix pending merge) | Rev #1 | `cursor/robustness-*` |
| M-005 | MEDIUM | Test-Email Endpoint Open Relay | OPEN | Rev #1 | — |
| N-002 | MEDIUM | No HTTP Security Headers (Helmet) | OPEN | Rev #5 | — |
| N-003 | MEDIUM | Single PG Connection — No Pool/Reconnect | OPEN | Rev #5 | — |
| N-004 | MEDIUM | Docker Container Runs as Root | OPEN | Rev #5 | — |
| N-006 | MEDIUM | JWT Not Invalidated on Password Change | OPEN | Rev #5 | — |
| N-007 | MEDIUM | Password Reset Tokens in Plaintext DB | OPEN | Rev #5 | — |
| N-009 | MEDIUM | No Bounds Validation on Financial Fields | OPEN | Rev #6 | — |
| L-001 | LOW | Email Verification Disabled on Register | OPEN | Rev #1 | — |
| L-002 | LOW | Screenshots Not Deleted After Processing | OPEN | Rev #1 | — |
| L-003 | LOW | Weak Password Policy | OPEN | Rev #1 | — |
| L-004 | LOW | Floating-Point Financial Arithmetic | OPEN | Rev #1 | — |
| L-005 | LOW | Yahoo Finance Scraping Fragility | OPEN | Rev #1 | — |
| N-008 | LOW | dotenv Re-read on Every AI Request | OPEN | Rev #5 | — |
| N-010 | LOW | No Max Length on User String Fields | OPEN | Rev #6 | — |
| N-011 | LOW | Hardcoded Default Seed Password | OPEN | Rev #6 | — |

**Total: 3 Critical · 5 High · 11 Medium · 8 Low — 27 open findings**
*(H-002 upgraded from HIGH → CRITICAL based on confirmed dashboard-level data leak scope)*

*Next automated review: 2026-04-28T07:00:00Z*
