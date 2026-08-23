import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHoldingCostBasisEur,
  holdingValueInEur,
  holdingPurchaseCostInEur,
  accountTier,
  normalizeLseGbpQuote,
} from '../lib/portfolioUtils.js';

const USD = 0.85, GBP = 1.17, HKD = 0.11;

// ── resolveHoldingCostBasisEur ──────────────────────────────────────────────

describe('resolveHoldingCostBasisEur', () => {
  it('prefers the stored pinned value over recomputation', () => {
    const h = { symbol: 'NVDA', quantity: 2, purchase_price: 180, currency: 'USD', cost_basis_eur: 300 };
    const r = resolveHoldingCostBasisEur(h, USD, GBP, HKD);
    assert.equal(r.costEur, 300);
    assert.equal(r.needsPin, false);
  });

  it('pinned value is immune to FX changes', () => {
    const h = { symbol: 'NVDA', quantity: 2, purchase_price: 180, currency: 'USD', cost_basis_eur: 300 };
    const before = resolveHoldingCostBasisEur(h, 0.85, GBP, HKD).costEur;
    const after = resolveHoldingCostBasisEur(h, 0.95, GBP, HKD).costEur;
    assert.equal(before, after);
  });

  it('computes from purchase_price and flags needsPin when no stored value', () => {
    const h = { symbol: 'NVDA', quantity: 2, purchase_price: 180, currency: 'USD' };
    const r = resolveHoldingCostBasisEur(h, USD, GBP, HKD);
    assert.ok(Math.abs(r.costEur - 2 * 180 * USD) < 1e-9);
    assert.equal(r.needsPin, true);
  });

  it('unpinned computation DOES move with FX (why pinning matters)', () => {
    const h = { symbol: 'NVDA', quantity: 2, purchase_price: 180, currency: 'USD' };
    const before = resolveHoldingCostBasisEur(h, 0.85, GBP, HKD).costEur;
    const after = resolveHoldingCostBasisEur(h, 0.95, GBP, HKD).costEur;
    assert.notEqual(before, after);
  });

  it('returns null cost and no pin when purchase price unknown', () => {
    const h = { symbol: 'NVDA', quantity: 2, currency: 'USD' };
    const r = resolveHoldingCostBasisEur(h, USD, GBP, HKD);
    assert.equal(r.costEur, null);
    assert.equal(r.needsPin, false);
  });

  it('ignores a stored zero/negative pin and recomputes', () => {
    const h = { symbol: 'NVDA', quantity: 2, purchase_price: 180, currency: 'USD', cost_basis_eur: 0 };
    const r = resolveHoldingCostBasisEur(h, USD, GBP, HKD);
    assert.ok(r.costEur > 0);
    assert.equal(r.needsPin, true);
  });
});

// ── instrument registry overrides ───────────────────────────────────────────

describe('instrument registry overrides', () => {
  it('registry marks an unknown symbol as GBP pence listing', () => {
    const registry = { NEWETF: { symbol: 'NEWETF', currency: 'GBP', price_divisor: 100 } };
    const h = { symbol: 'NEWETF', quantity: 10, current_price: 2500, currency: 'EUR' };
    // 2500 pence → £25 → EUR
    const v = holdingValueInEur(h, USD, GBP, HKD, registry);
    assert.ok(Math.abs(v - 10 * 25 * GBP) < 1e-6);
  });

  it('without registry the unknown symbol is not treated as pence', () => {
    const h = { symbol: 'NEWETF', quantity: 10, current_price: 2500, currency: 'EUR' };
    const v = holdingValueInEur(h, USD, GBP, HKD);
    assert.equal(v, 25000);
  });

  it('registry EUR-native prevents USD conversion', () => {
    const registry = { SAP: { symbol: 'SAP', currency: 'EUR', price_divisor: 1 } };
    const h = { symbol: 'SAP', quantity: 3, current_price: 200, currency: 'USD' };
    const v = holdingValueInEur(h, USD, GBP, HKD, registry);
    assert.equal(v, 600);
  });

  it('registry applies to cost basis the same way as value', () => {
    const registry = { SAP: { symbol: 'SAP', currency: 'EUR', price_divisor: 1 } };
    const h = { symbol: 'SAP', quantity: 3, purchase_price: 150, currency: 'USD' };
    const c = holdingPurchaseCostInEur(h, USD, GBP, HKD, registry);
    assert.equal(c, 450);
  });

  it('hardcoded LSE GBP list still works with no registry (back-compat)', () => {
    const h = { symbol: 'EQQQ', quantity: 2, current_price: 30000, currency: 'EUR' };
    const v = holdingValueInEur(h, USD, GBP, HKD);
    assert.ok(Math.abs(v - 2 * 300 * GBP) < 1e-6);
  });
});

// ── accountTier ─────────────────────────────────────────────────────────────

describe('accountTier', () => {
  it('P2P with interest rate is accruing', () => {
    assert.equal(accountTier({ account_type: 'p2p', interest_rate: 7.5 }), 'accruing');
  });
  it('savings with interest rate is accruing', () => {
    assert.equal(accountTier({ accountType: 'savings', interestRate: 3 }), 'accruing');
  });
  it('P2P without interest rate is manual', () => {
    assert.equal(accountTier({ account_type: 'p2p' }), 'manual');
  });
  it('stocks with holdings is priced', () => {
    assert.equal(accountTier({ account_type: 'stocks', holdings_count: 4 }), 'priced');
  });
  it('crypto with holdings is priced (camelCase fields)', () => {
    assert.equal(accountTier({ accountType: 'crypto', holdingsCount: 2 }), 'priced');
  });
  it('stocks without holdings is manual', () => {
    assert.equal(accountTier({ account_type: 'stocks', holdings_count: 0 }), 'manual');
  });
  it('bank account is manual', () => {
    assert.equal(accountTier({ account_type: 'bank' }), 'manual');
  });
  it('handles null account', () => {
    assert.equal(accountTier(null), 'manual');
  });
});

describe('normalizeLseGbpQuote (LSE pence → pounds)', () => {
  it('divides a pence quote above the old 50,000 ceiling (EQQQ ≈ 52,027p → £520.27)', () => {
    assert.equal(normalizeLseGbpQuote(52027), 520.27);
  });
  it('divides a pence quote inside the old range (IITU ≈ 3,660p → £36.60)', () => {
    assert.equal(normalizeLseGbpQuote(3660), 36.6);
  });
  it('leaves a pounds quote alone (VUSA ≈ £100)', () => {
    assert.equal(normalizeLseGbpQuote(100), 100);
  });
  it('treats exactly the threshold as pence', () => {
    assert.equal(normalizeLseGbpQuote(1000), 10);
  });
  it('returns null for non-finite or non-positive input', () => {
    assert.equal(normalizeLseGbpQuote(null), null);
    assert.equal(normalizeLseGbpQuote(NaN), null);
    assert.equal(normalizeLseGbpQuote(0), null);
    assert.equal(normalizeLseGbpQuote(-5), null);
  });
});
