# TradingSyncApp – Stable version

**Version**: 2.0.0  
**Date**: February 8, 2026  
**Status**: Stable baseline – keep this version as stable.

---

## What’s in this stable release

- **Portfolio & accounts**: Summary, pie chart, account list, balance from total portfolio or sum of holdings where appropriate.
- **Holdings**: Per-account holdings with quantity, price, total value (EUR). Price source: **Live** (Yahoo/CoinGecko) or **Screenshot** (manual/bonds like Romania).
- **Brokerage balance**: Uses total balance or sum of holdings when a single-holding balance would be misleading.
- **Live vs Screenshot**: Bonds/CASH/static symbols (e.g. ROMANIA) always Screenshot; others get live price when available (15‑min cache, “Last updated” on badge).
- **Link to live stock**: Verify symbol (Yahoo + optional ISIN/bond resolution and exchange suffixes); clear error for bonds/ISIN when no price found; Update to save symbol and switch to Live.
- **Bonds / ISIN (e.g. XS2829209720)**: No external bond API required; keep as Screenshot with manual price. Optional `FINNHUB_API_KEY` for future bond data if needed.
- **USD/EUR**: Backend returns `priceCurrency` and `totalValueEur`; UI shows price per share in $ or € and total value in EUR.
- **Account detail**: Defensive handling for missing quantity/price and invalid dates; no crash on bad data.
- **Screenshot upload & AI**: Multi-account extraction, account types, platform detection, history and projections (P2P compound interest) as in v1.

---

## Run this stable version

- Backend: `cd backend && npm run dev` (needs `OPENAI_API_KEY`, optional `EXCHANGE_RATE_USD_TO_EUR`, `FINNHUB_API_KEY` for bonds).
- Frontend: `cd frontend && npm run dev`
- Or from root: `npm run dev`

---

*Use this snapshot as the reference stable release. Further changes can be developed on a branch or tagged from here.*
