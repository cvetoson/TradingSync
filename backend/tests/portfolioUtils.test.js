import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFlexibleNumberInput,
  isEurNativeSymbol,
  holdingValueInEur,
  holdingPurchaseCostInEur,
  compoundP2PToNow,
  isP2pOrSavingsType,
  inferAssetType,
  coerceFiniteNumber,
  sanitizeHistoryBalance,
  parseBalanceAsOfIso,
} from '../lib/portfolioUtils.js';

// ── parseFlexibleNumberInput ──────────────────���────────────────────────────

describe('parseFlexibleNumberInput', () => {
  it('returns null for null', () => assert.equal(parseFlexibleNumberInput(null), null));
  it('returns null for undefined', () => assert.equal(parseFlexibleNumberInput(undefined), null));
  it('returns null for empty string', () => assert.equal(parseFlexibleNumberInput(''), null));
  it('passes through a finite number unchanged', () => assert.equal(parseFlexibleNumberInput(42.5), 42.5));
  it('returns NaN for Infinity passed as number', () => assert.ok(Number.isNaN(parseFlexibleNumberInput(Infinity))));
  it('parses plain integer string', () => assert.equal(parseFlexibleNumberInput('1234'), 1234));
  it('parses decimal with dot "1234.56"', () => assert.equal(parseFlexibleNumberInput('1234.56'), 1234.56));
  it('parses decimal with comma "1234,56"', () => assert.equal(parseFlexibleNumberInput('1234,56'), 1234.56));
  it('parses European format "1.234,56" → 1234.56', () => assert.equal(parseFlexibleNumberInput('1.234,56'), 1234.56));
  it('parses US format "1,234.56" → 1234.56', () => assert.equal(parseFlexibleNumberInput('1,234.56'), 1234.56));
  it('parses large integer with dots "1.234.567" → 1234567', () => assert.equal(parseFlexibleNumberInput('1.234.567'), 1234567));
  it('parses "0,5" → 0.5', () => assert.equal(parseFlexibleNumberInput('0,5'), 0.5));
  it('parses zero', () => assert.equal(parseFlexibleNumberInput('0'), 0));
});

// ── isEurNativeSymbol ──────────────────────────────────────────────────────

describe('isEurNativeSymbol', () => {
  it('returns true for IFX (EUR_NATIVE_SYMBOLS)', () => assert.equal(isEurNativeSymbol('IFX', 'stock'), true));
  it('returns true for DTE (EUR_NATIVE_SYMBOLS)', () => assert.equal(isEurNativeSymbol('DTE', 'stock'), true));
  it('returns true for Xetra WKN-style 4-char alphanumeric starting with digit "2B76"', () =>
    assert.equal(isEurNativeSymbol('2B76', 'etf'), true));
  it('returns false for pure numeric SEHK code "1211"', () =>
    assert.equal(isEurNativeSymbol('1211', 'stock'), false));
  it('returns false for 5-digit numeric "12345"', () =>
    assert.equal(isEurNativeSymbol('12345', 'stock'), false));
  it('returns false when asset type is crypto', () =>
    assert.equal(isEurNativeSymbol('2B76', 'crypto'), false));
  it('returns false when asset type is bond', () =>
    assert.equal(isEurNativeSymbol('2B76', 'bond'), false));
  it('returns false when asset type is precious', () =>
    assert.equal(isEurNativeSymbol('2B76', 'precious'), false));
  it('returns false for typical US ticker like AAPL', () =>
    assert.equal(isEurNativeSymbol('AAPL', 'stock'), false));
});

// ── holdingValueInEur ───────────────────────────��─────────────────────────

describe('holdingValueInEur', () => {
  const USD_TO_EUR = 0.92;
  const GBP_TO_EUR = 1.17;
  const HKD_TO_EUR = 0.12;

  it('converts USD holding to EUR', () => {
    const h = { quantity: 10, current_price: 100, currency: 'USD', symbol: 'AAPL', asset_type: 'stock' };
    const result = holdingValueInEur(h, USD_TO_EUR, GBP_TO_EUR, HKD_TO_EUR);
    assert.equal(result, 10 * 100 * USD_TO_EUR);
  });

  it('leaves EUR native symbol value unchanged', () => {
    const h = { quantity: 5, current_price: 30, currency: 'EUR', symbol: 'IFX', asset_type: 'stock' };
    const result = holdingValueInEur(h, USD_TO_EUR, GBP_TO_EUR, HKD_TO_EUR);
    assert.equal(result, 5 * 30);
  });

  it('converts LSE GBP ETF pence price to EUR (VUSA: 1500p → £15 × gbpToEur)', () => {
    const h = { quantity: 10, current_price: 1500, currency: 'GBP', symbol: 'VUSA', asset_type: 'etf' };
    const result = holdingValueInEur(h, USD_TO_EUR, GBP_TO_EUR, HKD_TO_EUR);
    // 1500 pence → £15, then 10 × 15 × GBP_TO_EUR
    assert.equal(result, 10 * 15 * GBP_TO_EUR);
  });

  it('converts HKD holding to EUR', () => {
    const h = { quantity: 100, current_price: 50, currency: 'HKD', symbol: '0700.HK', asset_type: 'stock' };
    const result = holdingValueInEur(h, USD_TO_EUR, GBP_TO_EUR, HKD_TO_EUR);
    assert.equal(result, 100 * 50 * HKD_TO_EUR);
  });

  it('returns 0 for zero quantity', () => {
    const h = { quantity: 0, current_price: 100, currency: 'USD', symbol: 'AAPL', asset_type: 'stock' };
    assert.equal(holdingValueInEur(h, USD_TO_EUR, GBP_TO_EUR, HKD_TO_EUR), 0);
  });
});

// ── holdingPurchaseCostInEur ────────────────────────────���─────────────────

describe('holdingPurchaseCostInEur', () => {
  const USD_TO_EUR = 0.92;
  const GBP_TO_EUR = 1.17;
  const HKD_TO_EUR = 0.12;

  it('returns null when purchase_price is null', () => {
    const h = { quantity: 10, purchase_price: null, currency: 'USD', symbol: 'AAPL', asset_type: 'stock' };
    assert.equal(holdingPurchaseCostInEur(h, USD_TO_EUR, GBP_TO_EUR, HKD_TO_EUR), null);
  });

  it('returns null when quantity is 0', () => {
    const h = { quantity: 0, purchase_price: 100, currency: 'USD', symbol: 'AAPL', asset_type: 'stock' };
    assert.equal(holdingPurchaseCostInEur(h, USD_TO_EUR, GBP_TO_EUR, HKD_TO_EUR), null);
  });

  it('returns null when purchase_price is 0', () => {
    const h = { quantity: 5, purchase_price: 0, currency: 'USD', symbol: 'AAPL', asset_type: 'stock' };
    assert.equal(holdingPurchaseCostInEur(h, USD_TO_EUR, GBP_TO_EUR, HKD_TO_EUR), null);
  });

  it('converts USD purchase cost to EUR', () => {
    const h = { quantity: 10, purchase_price: 80, currency: 'USD', symbol: 'AAPL', asset_type: 'stock' };
    const result = holdingPurchaseCostInEur(h, USD_TO_EUR, GBP_TO_EUR, HKD_TO_EUR);
    assert.equal(result, 10 * 80 * USD_TO_EUR);
  });

  it('converts GBP pence purchase cost (VUSA) to EUR', () => {
    const h = { quantity: 10, purchase_price: 1200, currency: 'GBP', symbol: 'VUSA', asset_type: 'etf' };
    const result = holdingPurchaseCostInEur(h, USD_TO_EUR, GBP_TO_EUR, HKD_TO_EUR);
    assert.equal(result, 10 * 12 * GBP_TO_EUR);
  });
});

// ── compoundP2PToNow ───────────────────────────────────���───────────────────

describe('compoundP2PToNow', () => {
  it('returns baseBalance when fromIsoYmd is null', () => {
    assert.equal(compoundP2PToNow(1000, 10, null), 1000);
  });

  it('returns baseBalance when annualRatePct is null', () => {
    assert.equal(compoundP2PToNow(1000, null, '2024-01-01'), 1000);
  });

  it('returns baseBalance unchanged when rate is 0 regardless of days', () => {
    const past = '2020-01-01';
    assert.equal(compoundP2PToNow(1000, 0, past), 1000);
  });

  it('returns >= baseBalance for a positive rate and past date', () => {
    const past = '2024-01-01';
    const result = compoundP2PToNow(1000, 10, past);
    assert.ok(result >= 1000, `Expected >= 1000, got ${result}`);
  });

  it('correctly compounds for exactly 365 days elapsed (≈1 year)', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const past = new Date(today);
    past.setDate(past.getDate() - 365);
    const isoYmd = past.toISOString().slice(0, 10);
    const result = compoundP2PToNow(1000, 10, isoYmd);
    const expected = 1000 * Math.pow(1.1, 365 / 365);
    assert.ok(Math.abs(result - expected) < 0.01, `Expected ~${expected}, got ${result}`);
  });
});

// ── isP2pOrSavingsType ──────────────────────────────────���─────────────────

describe('isP2pOrSavingsType', () => {
  it('returns true for "p2p"', () => assert.equal(isP2pOrSavingsType('p2p'), true));
  it('returns true for "P2P" (case-insensitive)', () => assert.equal(isP2pOrSavingsType('P2P'), true));
  it('returns true for "savings"', () => assert.equal(isP2pOrSavingsType('savings'), true));
  it('returns false for "stocks"', () => assert.equal(isP2pOrSavingsType('stocks'), false));
  it('returns false for empty string', () => assert.equal(isP2pOrSavingsType(''), false));
  it('returns false for null', () => assert.equal(isP2pOrSavingsType(null), false));
});

// ── inferAssetType ────────────────────────────────────────────────────────

describe('inferAssetType', () => {
  it('returns "precious" for XAU symbol', () =>
    assert.equal(inferAssetType({ symbol: 'XAU' }), 'precious'));
  it('returns "precious" for XAG symbol', () =>
    assert.equal(inferAssetType({ symbol: 'XAG' }), 'precious'));
  it('respects explicit assetType field', () =>
    assert.equal(inferAssetType({ symbol: 'AAPL', assetType: 'stock' }), 'stock'));
  it('returns "etf" when name contains "ETF"', () =>
    assert.equal(inferAssetType({ symbol: 'VUSA', name: 'Vanguard S&P 500 ETF' }), 'etf'));
  it('returns "etf" when name contains known ETF issuer "iShares"', () =>
    assert.equal(inferAssetType({ name: 'iShares Core MSCI World' }), 'etf'));
  it('returns "bond" when name contains "treasury"', () =>
    assert.equal(inferAssetType({ name: 'US Treasury Bond' }), 'bond'));
  it('returns "crypto" when name contains "bitcoin"', () =>
    assert.equal(inferAssetType({ name: 'Bitcoin' }), 'crypto'));
  it('returns "stock" as default fallback', () =>
    assert.equal(inferAssetType({ symbol: 'AAPL', name: 'Apple Inc' }), 'stock'));
});

// ── coerceFiniteNumber ────────────────────────────────────────────────────

describe('coerceFiniteNumber', () => {
  it('returns the number for a valid integer', () => assert.equal(coerceFiniteNumber(42), 42));
  it('returns the number for a valid float', () => assert.equal(coerceFiniteNumber(3.14), 3.14));
  it('parses a numeric string', () => assert.equal(coerceFiniteNumber('100'), 100));
  it('returns fallback (0) for NaN', () => assert.equal(coerceFiniteNumber(NaN), 0));
  it('returns fallback (0) for Infinity', () => assert.equal(coerceFiniteNumber(Infinity), 0));
  it('returns fallback (0) for non-numeric string', () => assert.equal(coerceFiniteNumber('abc'), 0));
  it('returns custom fallback for NaN', () => assert.equal(coerceFiniteNumber(NaN, -1), -1));
});

// ── sanitizeHistoryBalance ────────────────────────────────────────────────

describe('sanitizeHistoryBalance', () => {
  it('passes valid positive balance through', () => assert.equal(sanitizeHistoryBalance(500.75), 500.75));
  it('passes 0 through', () => assert.equal(sanitizeHistoryBalance(0), 0));
  it('returns null for negative value', () => assert.equal(sanitizeHistoryBalance(-1), null));
  it('returns null for value above 1e12', () => assert.equal(sanitizeHistoryBalance(1e12 + 1), null));
  it('returns null for NaN', () => assert.equal(sanitizeHistoryBalance(NaN), null));
  it('returns null for Infinity', () => assert.equal(sanitizeHistoryBalance(Infinity), null));
  it('returns null for a non-numeric string', () => assert.equal(sanitizeHistoryBalance('bad'), null));
});

// ── parseBalanceAsOfIso ───────────────────────────────────────────────────

describe('parseBalanceAsOfIso', () => {
  it('returns null for null input', () => assert.equal(parseBalanceAsOfIso(null), null));
  it('returns null when no date fields present', () => assert.equal(parseBalanceAsOfIso({}), null));
  it('parses DD.MM.YYYY format to YYYY-MM-DD', () =>
    assert.equal(parseBalanceAsOfIso({ balanceAsOfDate: '15.03.2024' }), '2024-03-15'));
  it('passes through YYYY-MM-DD unchanged', () =>
    assert.equal(parseBalanceAsOfIso({ balanceAsOfDate: '2024-03-15' }), '2024-03-15'));
  it('uses balance_as_of_date field', () =>
    assert.equal(parseBalanceAsOfIso({ balance_as_of_date: '2024-06-01' }), '2024-06-01'));
  it('reads investmentDate as fallback', () =>
    assert.equal(parseBalanceAsOfIso({ investmentDate: '2024-07-04' }), '2024-07-04'));
});
