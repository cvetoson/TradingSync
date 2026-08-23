import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePortfolioValue } from '../services/calculations.js';
import { initDatabase, closeDatabase } from '../database.js';

// calculatePortfolioValue calls getDatabase() (the lazy SQLite handle is fine for these
// tests — none of them write rows). We initialize once before any DB-touching test runs,
// and close after so node:test can exit cleanly when Postgres is configured.
before(async () => {
  await initDatabase();
});
after(async () => {
  await closeDatabase();
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

  it('savings type accrues like p2p: same balance/rate/age gives the same value', async () => {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    const base = { balance: 10000, interest_rate: 8, last_updated: lastYear.toISOString() };
    const savings = await calculatePortfolioValue({ ...base, account_type: 'savings' });
    const p2p = await calculatePortfolioValue({ ...base, account_type: 'p2p' });
    assert.ok(savings > 10000, `Expected accrual > 10000, got ${savings}`);
    assert.ok(Math.abs(savings - p2p) < 0.01, `Expected savings ${savings} ≈ p2p ${p2p}`);
  });

  it('savings type with no interest rate: resolves to balance', async () => {
    const account = { account_type: 'savings', balance: 1500, interest_rate: null, last_updated: new Date().toISOString() };
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
