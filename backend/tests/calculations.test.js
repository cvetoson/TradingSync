import { describe, it, expect, vi } from 'vitest';

vi.mock('../database.js', () => ({
  getDatabase: vi.fn(() => ({})),
}));

vi.mock('../services/marketData.js', () => ({
  fetchCurrentPrice: vi.fn(),
}));

import { calculateFutureValue, calculatePortfolioValue } from '../services/calculations.js';

describe('calculateFutureValue', () => {
  it('returns principal unchanged at 0% interest rate', () => {
    expect(calculateFutureValue(1000, 0, 12, 0)).toBeCloseTo(1000, 5);
  });

  it('applies compound interest over a full year', () => {
    // FV = 1000 * (1 + 0.12)^(365/365) = 1000 * 1.12 = 1120
    expect(calculateFutureValue(1000, 12, 0, 365)).toBeCloseTo(1120, 0);
  });

  it('returns 0 for zero balance regardless of rate', () => {
    expect(calculateFutureValue(0, 10, 12, 0)).toBe(0);
  });

  it('handles months-only input', () => {
    // 12 months × 30 days = 360 days
    const expected = 1000 * Math.pow(1.1, 360 / 365);
    expect(calculateFutureValue(1000, 10, 12, 0)).toBeCloseTo(expected, 5);
  });

  it('handles days-only input', () => {
    const expected = 1000 * Math.pow(1.1, 180 / 365);
    expect(calculateFutureValue(1000, 10, 0, 180)).toBeCloseTo(expected, 5);
  });

  it('combines months and days correctly', () => {
    // 6 months + 15 days = 6*30 + 15 = 195 days
    const expected = 1000 * Math.pow(1.08, 195 / 365);
    expect(calculateFutureValue(1000, 8, 6, 15)).toBeCloseTo(expected, 5);
  });
});

describe('calculatePortfolioValue', () => {
  it('returns raw balance for stocks account', async () => {
    const account = { balance: '1500.50', account_type: 'stocks', last_updated: new Date().toISOString() };
    expect(await calculatePortfolioValue(account)).toBe(1500.50);
  });

  it('returns raw balance for crypto account', async () => {
    const account = { balance: '800', account_type: 'crypto', last_updated: new Date().toISOString() };
    expect(await calculatePortfolioValue(account)).toBe(800);
  });

  it('returns raw balance for precious metals account', async () => {
    const account = { balance: '2000', account_type: 'precious', last_updated: new Date().toISOString() };
    expect(await calculatePortfolioValue(account)).toBe(2000);
  });

  it('returns raw balance for other account types', async () => {
    const account = { balance: '500', account_type: 'bank', last_updated: new Date().toISOString() };
    expect(await calculatePortfolioValue(account)).toBe(500);
  });

  it('returns 0 for NaN / invalid balance string', async () => {
    const account = { balance: 'invalid', account_type: 'stocks', last_updated: new Date().toISOString() };
    expect(await calculatePortfolioValue(account)).toBe(0);
  });

  it('applies compound interest for P2P accounts over 1 year', async () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const account = {
      balance: '1000',
      account_type: 'p2p',
      interest_rate: 10,
      last_updated: oneYearAgo.toISOString(),
    };
    // FV ≈ 1000 * (1.10)^1 = 1100
    expect(await calculatePortfolioValue(account)).toBeCloseTo(1100, 0);
  });

  it('uses 0% rate for P2P with null interest_rate', async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const account = {
      balance: '500',
      account_type: 'p2p',
      interest_rate: null,
      last_updated: thirtyDaysAgo.toISOString(),
    };
    // With 0% interest, value should stay at 500
    expect(await calculatePortfolioValue(account)).toBeCloseTo(500, 1);
  });
});
