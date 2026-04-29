# TradingSync Test Plan

## Status Legend
- [ ] Planned
- [x] Implemented & passing

---

## 1. Portfolio Utility Functions (`backend/lib/portfolioUtils.js`)

### `parseFlexibleNumberInput`
- [x] returns null for null/undefined/empty input
- [x] passes through a plain number unchanged
- [x] returns NaN for Infinity passed as number
- [x] parses integer string "1234"
- [x] parses decimal with dot "1234.56"
- [x] parses decimal with comma as separator "1234,56"
- [x] parses European format "1.234,56" → 1234.56
- [x] parses US format "1,234.56" → 1234.56
- [x] parses large integer with dots "1.234.567" → 1234567
- [x] parses "0,5" → 0.5
- [x] parses zero

### `isEurNativeSymbol`
- [x] returns true for EUR_NATIVE_SYMBOLS (IFX, DTE)
- [x] returns true for Xetra WKN-style 4-char alphanumeric starting with digit (e.g. 2B76)
- [x] returns false for pure numeric SEHK codes (e.g. 1211)
- [x] returns false for 5-digit numeric code
- [x] returns false when asset type is crypto
- [x] returns false when asset type is bond
- [x] returns false when asset type is precious
- [x] returns false for typical US ticker (AAPL)

### `holdingValueInEur`
- [x] converts USD holding to EUR using usdToEur rate
- [x] leaves EUR native symbol value unchanged
- [x] converts LSE GBP ETF pence to EUR (divides by 100 first, then applies gbpToEur)
- [x] converts HKD holding to EUR using hkdToEur rate
- [x] returns 0 for zero quantity

### `holdingPurchaseCostInEur`
- [x] returns null when purchase_price is null
- [x] returns null when quantity is 0
- [x] returns null when purchase_price is 0
- [x] converts USD purchase cost to EUR
- [x] converts GBP pence purchase cost (VUSA) to EUR

### `compoundP2PToNow`
- [x] returns baseBalance when fromIsoYmd is null
- [x] returns baseBalance when annualRatePct is null
- [x] returns baseBalance unchanged when rate is 0 regardless of days
- [x] returns >= baseBalance for a positive rate and past date
- [x] correctly compounds for exactly 365 days elapsed (≈1 year)

### `isP2pOrSavingsType`
- [x] returns true for "p2p"
- [x] returns true for "P2P" (case-insensitive)
- [x] returns true for "savings"
- [x] returns false for "stocks"
- [x] returns false for empty string
- [x] returns false for null

### `inferAssetType`
- [x] returns "precious" for XAU and XAG symbols
- [x] respects explicit assetType field
- [x] returns "etf" when name contains "ETF"
- [x] returns "etf" when name contains known ETF issuer "iShares"
- [x] returns "bond" when name contains "treasury"
- [x] returns "crypto" when name contains "bitcoin"
- [x] returns "stock" as default fallback

### `coerceFiniteNumber`
- [x] returns the number for a valid integer
- [x] returns the number for a valid float
- [x] parses a numeric string
- [x] returns fallback (0) for NaN
- [x] returns fallback (0) for Infinity
- [x] returns fallback (0) for non-numeric string
- [x] returns custom fallback for NaN

### `sanitizeHistoryBalance`
- [x] passes valid positive balance through
- [x] passes 0 through
- [x] returns null for negative value
- [x] returns null for value above 1e12
- [x] returns null for NaN
- [x] returns null for Infinity
- [x] returns null for a non-numeric string

### `parseBalanceAsOfIso`
- [x] returns null for null input
- [x] returns null when no date fields present
- [x] parses DD.MM.YYYY format to YYYY-MM-DD
- [x] passes through YYYY-MM-DD unchanged
- [x] uses balance_as_of_date field
- [x] reads investmentDate as fallback

---

## 2. Calculations (`backend/services/calculations.js`)

### `calculateFutureValue`
- [x] returns balance unchanged when rate is 0 and 0 months/days
- [x] applies compound interest correctly for 12 months
- [x] applies compound interest correctly for 365 days
- [x] applies compound interest correctly for 30 days
- [x] handles large interest rate (100%) for 1 year
- [x] returns 0 for 0 balance regardless of rate

### `calculatePortfolioValue`
- [x] stocks: returns balance directly
- [x] crypto: returns balance directly
- [x] precious: returns balance directly
- [x] unknown/savings type: returns balance directly
- [x] p2p with 0% interest: resolves to balance
- [x] p2p with 10% interest and 1-year-old last_updated: value grows
- [x] p2p type: treats non-finite balance as 0

---

## Implementation Notes

- Test runner: Node.js built-in `node:test` (v22, no extra deps needed)
- Test files: `backend/tests/portfolioUtils.test.js`, `backend/tests/calculations.test.js`
- Pure helpers extracted to: `backend/lib/portfolioUtils.js`
- Run with: `cd backend && npm test`
- Results: **84 tests, 84 pass, 0 fail**

## What Was Done

1. Created `backend/lib/portfolioUtils.js` — all pure utility functions extracted from `backend/routes/portfolio.js`
2. Updated `backend/routes/portfolio.js` to import from `portfolioUtils.js` (no behaviour change)
3. Created `backend/tests/portfolioUtils.test.js` — 71 unit tests for utility functions
4. Created `backend/tests/calculations.test.js` — 13 unit tests for calculation functions
5. Added `"test"` script to `backend/package.json`
