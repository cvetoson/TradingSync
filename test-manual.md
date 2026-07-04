# TradingSync Manual Test Plan

There are no automated tests in this repo yet. This doc is a smoke-test
checklist for manual verification before pushing to production.

Last updated: 2026-04-28

---

## Setup

From repo root:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

Verify backend is up before testing auth flows:

```bash
curl http://localhost:3001/api/health
```

Expected: JSON with `status: "ok"`.

---

## 1. Splash / landing (unauthenticated)

- [ ] Visiting `/` while logged out renders the splash with the 3D gear assembly visible on the right (or below the copy on narrow viewports).
- [ ] Headline reads **"Every Asset. One PLACE."** with `One` in the orange accent.
- [ ] The gears auto-rotate continuously; mouse movement adds parallax tilt.
- [ ] Page is **not** scrollable — `body` and `html` overflow are locked while the splash is mounted.
- [ ] Compact viewport (≤ 900px wide): copy stacks above the gear canvas, no overlap, nav and "Scroll to rotate" hint hide.

## 2. Inline sign-in

- [ ] Clicking **Sign in** swaps the two buttons for an inline email + password form in the same panel (no route change).
- [ ] Submitting valid credentials authenticates and lands on the dashboard.
- [ ] Submitting invalid credentials surfaces the backend error message in the form (red box, no crash).
- [ ] Reloading after a successful sign-in keeps the user signed in (token + user persisted in `localStorage` keys `tradingsync_token` / `tradingsync_user`).
- [ ] **Forgot password?** link navigates to `/forgot-password`.
- [ ] **Create one** link switches the panel to the register form without losing the typed email.

## 3. Inline register

- [ ] Clicking **Create account** on the splash reveals the inline register form (email, optional display name, password, confirm).
- [ ] Mismatched passwords show "Passwords do not match" and do not submit.
- [ ] Password under 8 chars shows "Password must be at least 8 characters" and does not submit.
- [ ] Successful registration logs the new user in directly (no extra confirm screen unless email-verification is enforced server-side).
- [ ] **Sign in** link from register switches back to the sign-in form.

## 4. Auth routes

- [ ] `/forgot-password` renders and accepts an email; submitting shows the expected confirmation.
- [ ] `/check-email` renders the post-registration prompt when arrived at via the register flow.
- [ ] `/verify-email?token=…` page exercises the verify endpoint.
- [ ] `/reset-password?token=…` page accepts a new password and routes back to login.

## 5. Dashboard (authenticated)

- [ ] Sidebar navigation cycles through Portfolio / Analytics / Reports without errors.
- [ ] Portfolio view loads accounts, totals, and the allocation pie chart.
- [ ] Settings modal opens, saves profile changes, and round-trips display name / theme / password.
- [ ] Logout clears storage and returns the user to the splash.

## 6. Upload + account edit (regression — recently hardened)

- [ ] Screenshot upload flow opens the modal and creates an account from the parsed result.
- [ ] Manual "Add holding" creates the row with the correct symbol, quantity, and price.
- [ ] Editing an account name / platform / interest rate / tag persists across reload.
- [ ] Account detail view's history chart renders without throwing on accounts with sparse or malformed history values (this is what the recent `calculations.js` / `portfolio.js` hardening targeted — verify no console errors and no NaN values in the chart).

## 7. Analytics + Account detail

- [ ] Analytics page time-range buttons (1W / 1M / 3M / 6M / 1Y / ALL) update the line chart.
- [ ] Sortable account table re-sorts on column header click.
- [ ] Opening an account from the table launches `AccountDetailView` with a populated holdings table and chart.

## 8. Theming / accent

- [ ] App accent reads as orange `#c8923e` throughout (sidebar active state, primary buttons, links). Confirms the global blue → orange migration in `index.css`.
- [ ] Dark mode toggle in Settings flips the theme without a flash of unstyled content.

## 9. Production smoke

After deploying to <https://tradingsync-production.up.railway.app/>:

- [ ] Splash renders.
- [ ] Sign in with a known account works against prod backend.
- [ ] One end-to-end action (e.g. upload a screenshot or open an account detail) succeeds.

---

## Out of scope / known gaps

- No unit tests for `backend/services/calculations.js` despite recent numeric/history sanitization work — the next obvious place to introduce automated tests.
- No e2e harness (Playwright / Cypress) wired up.
- 3D scene (`PortfolioGears3D`) has no automated check; visual regression is verified manually.
