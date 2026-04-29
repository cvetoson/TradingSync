import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFutureValue, calculatePortfolioValue } from '../services/calculations.js';

// ── calculateFutureValue ──────────────────────────────────────────────────

describe('calculateFutureValue', () => {
  it('returns balance unchanged when rate is 0 and 0 months/days', () => {
    assert.equal(calculateFutureValue(1000, 0, 0, 0), 1000);
  });

  it('applies compound interest for 12 months at 10%', () => {
    const result = calculateFutureValue(1000, 10, 12, 0);
    const expected = 1000 * Math.pow(1.1, (12 * 30) / 365);
    assert.ok(Math.abs(result - expected) < 0.001, `Expected ~${expected}, got ${result}`);
  });

  it('applies compound interest for 365 days at 10%', () => {
    // FV = 1000 * (1.10)^1 = 1100
    const result = calculateFutureValue(1000, 10, 0, 365);
    assert.ok(Math.abs(result - 1100) < 0.001, `Expected ~1100, got ${result}`);
  });

  it('applies compound interest for 30 days at 12%', () => {
    const expected = 1000 * Math.pow(1.12, 30 / 365);
    const result = calculateFutureValue(1000, 12, 0, 30);
    assert.ok(Math.abs(result - expected) < 0.001, `Expected ~${expected}, got ${result}`);
  });

  it('handles large interest rate (100%) for 1 year', () => {
    const result = calculateFutureValue(500, 100, 0, 365);
    assert.ok(Math.abs(result - 1000) < 0.01, `Expected ~1000, got ${result}`);
  });

  it('returns 0 for 0 balance regardless of rate', () => {
    assert.equal(calculateFutureValue(0, 15, 6, 0), 0);
  });
});

// ── calculatePortfolioValue ───────────────────────────────────────────────
// calculatePortfolioValue calls getDatabase() (SQLite auto-creates the DB)
// but never uses the db handle for any of the logic we test here.

describe('calculatePortfolioValue', () => {
  it('stocks type: resolves to balance directly', async () => {
    const account = { account_type: 'stocks', balance: 5000, interest_rate: 0, last_updated: new Date().toISOString() };
    const result = await calculatePortfolioValue(account);
    assert.equal(result, 5000);
  });

  it('crypto type: resolves to balance directly', async () => {
    const account = { account_type: 'crypto', balance: 2000, interest_rate: 0, last_updated: new Date().toISOString() };
    const result = await calculatePortfolioValue(account);
    assert.equal(result, 2000);
  });

  it('precious type: resolves to balance directly', async () => {
    const account = { account_type: 'precious', balance: 3000, interest_rate: 0, last_updated: new Date().toISOString() };
    const result = await calculatePortfolioValue(account);
    assert.equal(result, 3000);
  });

  it('unknown/savings type: resolves to balance directly', async () => {
    const account = { account_type: 'savings', balance: 1500, interest_rate: 5, last_updated: new Date().toISOString() };
    const result = await calculatePortfolioValue(account);
    assert.equal(result, 1500);
  });

  it('p2p type with 0% interest: resolves to balance', async () => {
    const account = {
      account_type: 'p2p',
      balance: 1000,
      interest_rate: 0,
      last_updated: new Date().toISOString(),
    };
    const result = await calculatePortfolioValue(account);
    assert.ok(Math.abs(result - 1000) < 0.01, `Expected ~1000, got ${result}`);
  });

  it('p2p type with 10% interest and last_updated 1 year ago: value grows', async () => {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    const account = {
      account_type: 'p2p',
      balance: 1000,
      interest_rate: 10,
      last_updated: lastYear.toISOString(),
    };
    const result = await calculatePortfolioValue(account);
    assert.ok(result > 1000, `Expected > 1000, got ${result}`);
    assert.ok(result < 1200, `Expected reasonable growth < 1200, got ${result}`);
  });

  it('p2p type: treats non-finite balance as 0', async () => {
    const account = {
      account_type: 'p2p',
      balance: 'invalid',
      interest_rate: 10,
      last_updated: new Date().toISOString(),
    };
    const result = await calculatePortfolioValue(account);
    assert.equal(result, 0);
  });
});
