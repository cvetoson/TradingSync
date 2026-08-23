import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIncomingHolding, holdingValueInEur } from '../lib/portfolioUtils.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

describe('normalizeIncomingHolding (value-only broker lists, e.g. Trading 212)', () => {
  // Row from the real screenshot: "Invesco EQQQ Nasdaq-100 (Dist)  €1,052.01  +€322.77 (44.26%)"
  const eqqq = { symbol: 'EQQQ', currentValue: 1052.01, profitLoss: 322.77, profitLossPercent: 44.26, currency: 'EUR', assetType: 'etf' };

  it('keeps a hand-entered quantity and derives the price from the value', () => {
    const h = normalizeIncomingHolding(eqqq, 'EUR', { existingQuantity: 1.39357269, existingSource: 'manual', livePrice: 613.92 });
    close(h.quantity, 1.39357269);
    close(h.quantity * h.currentPrice, 1052.01);
    assert.equal(h.quantitySource, 'manual');
  });

  it('derives the quantity from a live price — also for an existing row whose quantity may be stale', () => {
    for (const opts of [{ livePrice: 613.92 }, { livePrice: 613.92, existingQuantity: 1.39357269 }]) {
      const h = normalizeIncomingHolding(eqqq, 'EUR', opts);
      close(h.quantity, 1052.01 / 613.92);
      close(h.currentPrice, 613.92);
      assert.equal(h.quantitySource, 'derived');
    }
  });

  it('without a live price keeps the existing quantity but marks it provisional', () => {
    const h = normalizeIncomingHolding(eqqq, 'EUR', { existingQuantity: 66.67 });
    close(h.quantity, 66.67);
    close(h.quantity * h.currentPrice, 1052.01);
    assert.equal(h.quantitySource, 'placeholder');
  });

  it('falls back to a 1 × value placeholder when nothing else is known', () => {
    const h = normalizeIncomingHolding(eqqq, 'EUR');
    assert.equal(h.quantity, 1);
    close(h.currentPrice, 1052.01);
    assert.equal(h.quantitySource, 'placeholder');
  });

  it('cost basis = value − profitLoss; purchase price follows the quantity', () => {
    const h = normalizeIncomingHolding(eqqq, 'EUR', { existingQuantity: 1.39357269, existingSource: 'manual' });
    close(h.costBasis, 1052.01 - 322.77);
    close(h.purchasePrice * h.quantity, 729.24);
    assert.equal(h.profitLoss, 322.77);
    assert.equal(h.profitLossPercent, 44.26);
  });

  it('cost basis from percent alone when money P&L is missing', () => {
    const h = normalizeIncomingHolding({ symbol: 'X', currentValue: 144, profitLossPercent: 44 }, 'EUR');
    close(h.costBasis, 100);
  });

  it('negative P&L (red row) yields a cost basis above the value', () => {
    // "Laser Photonics €32.18 −€119.65 (78.81%)"
    const h = normalizeIncomingHolding({ symbol: 'LASE', currentValue: 32.18, profitLoss: -119.65, profitLossPercent: -78.81 }, 'EUR');
    close(h.costBasis, 151.83);
  });

  it('never fabricates a purchase price from the current value', () => {
    const h = normalizeIncomingHolding({ symbol: 'NVDA', currentValue: 497.33 }, 'EUR', { existingQuantity: 2.27 });
    assert.equal(h.purchasePrice, null);
    assert.equal(h.costBasis, null);
  });

  it('respects an explicit purchase price over the P&L-derived one', () => {
    const h = normalizeIncomingHolding({ symbol: 'A', quantity: 2, currentValue: 200, profitLoss: 50, purchasePrice: 80 }, 'EUR');
    assert.equal(h.purchasePrice, 80);
  });

  it('quantity visible in the screenshot wins over everything', () => {
    const h = normalizeIncomingHolding({ symbol: 'A', quantity: 4, currentValue: 200 }, 'EUR', { existingQuantity: 9, livePrice: 10 });
    assert.equal(h.quantity, 4);
    assert.equal(h.currentPrice, 50);
    assert.equal(h.quantitySource, 'screenshot');
  });

  it('cash rows are 1 × amount with zero P&L', () => {
    const h = normalizeIncomingHolding({ symbol: 'CASH', currentValue: 44.21 }, 'EUR');
    assert.equal(h.quantity, 1);
    assert.equal(h.currentPrice, 44.21);
    assert.equal(h.costBasis, 44.21);
  });
});

describe('holdingValueInEur: stored currency is authoritative', () => {
  const USD = 0.8468, GBP = 1.1673, HKD = 0.11;
  const registry = { NVDA: { symbol: 'NVDA', currency: 'USD', price_divisor: 1 }, EQQQ: { symbol: 'EQQQ', currency: 'GBP', price_divisor: 100 } };

  it('does not re-apply USD→EUR to a USD-listed symbol already stored in EUR', () => {
    const h = { symbol: 'NVDA', quantity: 2.2738819, current_price: 183.864736, currency: 'EUR' };
    close(holdingValueInEur(h, USD, GBP, HKD, registry), 2.2738819 * 183.864736);
    close(holdingValueInEur(h, USD, GBP, HKD, null), 2.2738819 * 183.864736);
  });

  it('still converts a USD-listed symbol stored in USD', () => {
    const h = { symbol: 'NVDA', quantity: 1, current_price: 100, currency: 'USD' };
    close(holdingValueInEur(h, USD, GBP, HKD, registry), 100 * USD);
  });

  it('falls back to the listing currency when the row has no currency', () => {
    const h = { symbol: 'NVDA', quantity: 1, current_price: 100, currency: null };
    close(holdingValueInEur(h, USD, GBP, HKD, registry), 100 * USD);
  });

  it('treats a stored LSE GBP price above the old 50,000 ceiling as pence', () => {
    const h = { symbol: 'EQQQ', quantity: 1, current_price: 52594, currency: 'EUR' };
    close(holdingValueInEur(h, USD, GBP, HKD, registry), 525.94 * GBP);
  });
});
