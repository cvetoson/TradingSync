# TradingSync Test Plan

## Status Legend
- `[ ]` = TODO
- `[x]` = Done
- `[-]` = Skipped / out of scope

---

## Unit Tests

### calculations.js – `calculateFutureValue`
- [x] Returns principal unchanged at 0% interest rate
- [x] Applies compound interest over a full year (12% → ~1120)
- [x] Returns 0 for zero balance regardless of rate
- [x] Handles months-only input (12 months = 360 days)
- [x] Handles days-only input (180 days at 10%)
- [x] Combines months and days correctly

### calculations.js – `calculatePortfolioValue`
- [x] Returns raw balance for stocks account
- [x] Returns raw balance for crypto account
- [x] Returns raw balance for precious metals account
- [x] Returns raw balance for other account types (e.g. bank)
- [x] Returns 0 for NaN / invalid balance string
- [x] Applies compound interest for P2P accounts over 1 year
- [x] Uses 0% rate for P2P with null interest_rate

### auth.js – `requireAuth` middleware
- [x] Returns 401 when no Authorization header is present
- [x] Returns 401 for a non-Bearer Authorization header
- [x] Returns 401 for an invalid JWT token
- [x] Calls next() and sets req.userId for a valid token
- [x] Returns 401 for an expired token

### auth.js – `optionalAuth` middleware
- [x] Calls next with req.userId = null when no token is present
- [x] Sets req.userId for a valid token
- [x] Calls next with req.userId = null for an invalid token

---

## Integration Tests (auth routes)

### POST /api/auth/register
- [x] Returns 400 when email is missing
- [x] Returns 400 when password is missing
- [x] Returns 400 when passwords do not match
- [x] Returns 400 for invalid email format
- [x] Returns 400 for password shorter than 8 characters
- [x] Returns 201 and a JWT token on successful registration
- [x] Returns 409 for duplicate email

### POST /api/auth/login
- [x] Returns 400 when credentials are missing
- [x] Returns 401 for unknown email
- [x] Returns 401 for wrong password
- [x] Returns 200 and a JWT token for valid credentials

---

## Implementation Notes

All tests implemented and passing (32/32). Test files live in `backend/tests/`:
- `calculations.test.js` — unit tests for `backend/services/calculations.js`
- `auth.middleware.test.js` — unit tests for `requireAuth` and `optionalAuth` in `backend/routes/auth.js`
- `auth.routes.test.js` — integration tests for register and login endpoints

Run with: `cd backend && npm test`
