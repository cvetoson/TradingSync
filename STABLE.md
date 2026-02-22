# TradingSyncApp – Stable version 3.5

**Version**: 3.5.0  
**Date**: February 22, 2026  
**Status**: Stable – production-ready.

---

## What’s in this stable release

- **Portfolio totals refresh** (v3.5): AccountCard and Dashboard totals now update correctly after viewing holdings; getPortfolioSummary prefers synced account.balance when higher than holdings sum.
- **Portfolio & accounts**: Summary, pie chart, account list. Balance from total portfolio or sum of holdings (stocks/crypto/precious).
- **Holdings**: Per-account holdings with quantity, price, total value (EUR). Price source: **Live** (Yahoo/CoinGecko) or **Screenshot** (manual/bonds).
- **Live price not editable**: Live holdings have read-only price; edit only for Screenshot/manual.
- **Live badge**: Click green “Live” to open verify modal (change symbol or switch to manual).
- **Remove holding**: Actions column trash icon with confirm (DELETE `/api/holdings/:id`).
- **Price & currency editable**: For Screenshot holdings, edit price and choose € EUR or $ USD.
- **Live vs Screenshot**: Bonds/CASH/static symbols (e.g. ROMANIA) Screenshot; others get live price (15‑min cache except XAG/XAU).
- **XAG/XAU (Gold & Silver)**: Category “Gold & Silver”; always fetch live price (no cache); USD→EUR via live rate; SI=F/GC=F fallback when spot ticker fails.
- **Live USD/EUR rate**: All USD→EUR conversions use Yahoo **USDEUR=X**; override with `EXCHANGE_RATE_USD_TO_EUR` in env; fallback 0.846.
- **Value Over Time**: 3‑month projection for stocks/crypto/precious (Yahoo + optional analyst target); chart and totals use live USD/EUR.
- **Account balance sync**: On delete/update price/update quantity, account balance is recomputed from holdings sum (EUR) using live rate.
- **Bonds / ISIN**: Yahoo search + chart only; keep as Screenshot when no match.
- **Verify symbol**: Crypto accounts infer asset type from account when holding has none (fixes ETH etc. in verify modal).
- **Projections**: Trend-based only (Yahoo historical data). Crypto: 2y history + recent weighting. Stocks/precious: 6mo trend. No API keys required.

---

## Run this stable version

- Backend: `cd backend && npm run dev` (requires `OPENAI_API_KEY`; optional `EXCHANGE_RATE_USD_TO_EUR`).
- Frontend: `cd frontend && npm run dev`
- Root: `npm run dev`

---

*Stable baseline for v3.5. Tag or branch from here for further work.*
