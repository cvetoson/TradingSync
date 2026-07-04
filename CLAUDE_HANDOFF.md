# TradingSync Handoff Notes (for Claude / any assistant)

Last updated: 2026-04-28

## Current Git State

- Branch: `main`
- Latest pushed commit: `aa64394`
- Remote: `origin/main` is up to date with local

## Production Status

- Production URL: [https://tradingsync-production.up.railway.app/](https://tradingsync-production.up.railway.app/)
- Latest UI updates are live in production.

## What Was Updated Recently

### Splash / Landing

- Headline changed to: `Every Asset. One PLACE.`
- Removed `Scroll to rotate` hint.
- Increased 3D pie/gear size in splash (`PortfolioGears3D` scale from `0.6` to `0.72`).
- Made splash non-scrollable (viewport-locked):
  - `SplashScreen.css`: splash shell fixed to `100vh` and `overflow: hidden`
  - `SplashScreen.jsx`: sets `body` and `html` overflow to hidden while splash is mounted
- 3D rotation now auto-rotates (no scroll dependency) to avoid interaction issues on non-scroll splash.

### Theme / Accent

- Updated app accent from blue to orange (`#c8923e`) globally in `frontend/src/index.css`.
- Sidebar active colors and utility blue mappings now render with orange accent.

### Auth / Sign-in

- Kept new splash screens on frontend.
- Sign-in flow works (confirmed after backend was running).
- Temporary debug instrumentation used during troubleshooting was removed.

## Files Touched for Latest UX/Theming Work

- `frontend/src/components/SplashScreen.jsx`
- `frontend/src/components/SplashScreen.css`
- `frontend/src/components/PortfolioGears3D.jsx`
- `frontend/src/index.css`

## Also Included In Last Push (Data Robustness)

The pushed commit also contains portfolio/analytics hardening changes:

- `backend/routes/portfolio.js`
- `backend/services/calculations.js`
- `frontend/src/components/AccountDetailView.jsx`
- `frontend/src/components/AccountDetailsModal.jsx`
- `frontend/src/components/AnalyticsPage.jsx`

These changes sanitize malformed numeric/history values and improve growth/history stability.

## Local Run Commands

From repo root:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Important Operational Note

If login fails with generic network/500 in local dev, verify backend is actually running first.

Quick check:

```bash
curl http://localhost:3001/api/health
```

Expected: JSON `status: "ok"`.

