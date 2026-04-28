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

*Next automated review: 2026-04-28T01:00:00Z*
