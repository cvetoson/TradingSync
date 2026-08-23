// Run with --experimental-test-module-mocks (see package.json "test").
import { describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Live prices as the page-load path would see them (native currency, before FX):
// EQQQ.L in pounds (after the pence fix), NVDA in USD.
const LIVE = { EQQQ: 525.94, NVDA: 216.00 };
mock.module('../services/marketData.js', {
  namedExports: {
    fetchCurrentPrice: async (symbol) => LIVE[String(symbol).toUpperCase()] ?? null,
    fetchUsdToEurRate: async () => 0.85,
    fetchGbpToEurRate: async () => 1.17,
    fetchHkdToEurRate: async () => 0.11,
  },
});
const { refreshHoldingPrice } = await import('../services/priceService.js');

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const run = (db, sql, p = []) => new Promise((res, rej) => db.run(sql, p, (e) => (e ? rej(e) : res())));
const get = (db, sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));

describe('refreshHoldingPrice heals value-only rows', () => {
  let dir, db;
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'ts-heal-'));
    db = new sqlite3.Database(join(dir, 'h.db'));
    await run(db, `CREATE TABLE holdings (id INTEGER PRIMARY KEY, account_id INTEGER, symbol TEXT, quantity REAL,
      quantity_source TEXT, purchase_price REAL, current_price REAL, price_source TEXT, cost_basis_eur REAL, currency TEXT, asset_type TEXT, last_updated TEXT)`);
    // 1 × value placeholder (new symbol, Stooq was down at upload)
    await run(db, `INSERT INTO holdings (id, account_id, symbol, quantity, quantity_source, current_price, currency, asset_type)
      VALUES (1, 1, 'NVDA', 1, 'placeholder', 497.33, 'EUR', 'stock')`);
    // provisional: stale quantity kept, price = value ÷ qty (value 1052.01)
    await run(db, `INSERT INTO holdings (id, account_id, symbol, quantity, quantity_source, current_price, currency, asset_type)
      VALUES (2, 1, 'EQQQ', 1.39357269, 'placeholder', ${1052.01 / 1.39357269}, 'EUR', 'etf')`);
    // ordinary row: only the price moves
    await run(db, `INSERT INTO holdings (id, account_id, symbol, quantity, quantity_source, current_price, currency, asset_type)
      VALUES (3, 1, 'NVDA', 2.2738819, 'screenshot', 183.86, 'EUR', 'stock')`);
  });
  after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

  const rates = { usdToEur: 0.85, gbpToEur: 1.17, hkdToEur: 0.11 };
  const registry = { EQQQ: { symbol: 'EQQQ', currency: 'GBP', price_divisor: 100 }, NVDA: { symbol: 'NVDA', currency: 'USD', price_divisor: 1 } };

  it('turns a 1 × value placeholder into value ÷ live price', async () => {
    const h = await get(db, 'SELECT * FROM holdings WHERE id = 1');
    assert.equal(await refreshHoldingPrice(db, h, rates, registry), true);
    const r = await get(db, 'SELECT * FROM holdings WHERE id = 1');
    const liveEur = 216 * 0.85;
    close(r.current_price, liveEur);
    close(r.quantity, 497.33 / liveEur);
    close(r.quantity * r.current_price, 497.33);   // the broker's value is preserved
    assert.equal(r.quantity_source, 'derived');
  });

  it('re-derives a provisional quantity from the stored value', async () => {
    const h = await get(db, 'SELECT * FROM holdings WHERE id = 2');
    await refreshHoldingPrice(db, h, rates, registry);
    const r = await get(db, 'SELECT * FROM holdings WHERE id = 2');
    const liveEur = 525.94 * 1.17;
    close(r.current_price, liveEur);
    close(r.quantity * r.current_price, 1052.01);
    assert.equal(r.quantity_source, 'derived');
  });

  it('leaves a real quantity alone and only updates the price', async () => {
    const h = await get(db, 'SELECT * FROM holdings WHERE id = 3');
    await refreshHoldingPrice(db, h, rates, registry);
    const r = await get(db, 'SELECT * FROM holdings WHERE id = 3');
    close(r.quantity, 2.2738819);
    close(r.current_price, 216 * 0.85);
    assert.equal(r.quantity_source, 'screenshot');
  });
});
