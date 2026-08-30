import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { currentPeriod, isPremiumUser, entitlementPayload, upgradeRequired } from '../lib/entitlement.js';

describe('entitlement rules', () => {
  it('currentPeriod is the UTC calendar month', () => {
    assert.equal(currentPeriod(new Date('2026-08-31T23:59:59Z')), '2026-08');
    assert.equal(currentPeriod(new Date('2026-09-01T00:00:01Z')), '2026-09');
  });
  it('non-premium user: flag unset or falsy', () => {
    assert.equal(isPremiumUser(null), false);
    assert.equal(isPremiumUser({ premium: 0 }), false);
    assert.equal(isPremiumUser({}), false);
  });
  it('premium without expiry never expires', () => {
    assert.equal(isPremiumUser({ premium: 1, premium_until: null }), true);
  });
  it('premium honours the expiry timestamp', () => {
    const now = new Date('2026-08-30T12:00:00Z');
    assert.equal(isPremiumUser({ premium: 1, premium_until: '2026-09-01T00:00:00Z' }, now), true);
    assert.equal(isPremiumUser({ premium: 1, premium_until: '2026-08-01T00:00:00Z' }, now), false);
  });
  it('payload: free users see numeric limits, premium sees null', () => {
    const free = entitlementPayload({ premium: false, accountsUsed: 1, aiImportsUsed: 2 });
    assert.equal(free.limits.accounts, 2);
    assert.equal(free.limits.aiImportsPerMonth, 3);
    const prem = entitlementPayload({ premium: true, accountsUsed: 9, aiImportsUsed: 99 });
    assert.equal(prem.limits.accounts, null);
  });
  it('upgradeRequired carries the machine-readable code', () => {
    const b = upgradeRequired('account_limit', 'x');
    assert.equal(b.code, 'upgrade_required');
    assert.equal(b.reason, 'account_limit');
  });
});

describe('usage counter upsert (sqlite)', () => {
  let dir, db;
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'ts-usage-'));
    db = new sqlite3.Database(join(dir, 'u.db'));
    await new Promise((res, rej) => db.run(`CREATE TABLE usage_counters (
      user_id INTEGER NOT NULL, period TEXT NOT NULL, ai_imports INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, period))`, (e) => (e ? rej(e) : res())));
  });
  after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

  const upsert = (userId, period) => new Promise((res, rej) => db.run(
    `INSERT INTO usage_counters (user_id, period, ai_imports) VALUES (?, ?, 1)
     ON CONFLICT(user_id, period) DO UPDATE SET ai_imports = usage_counters.ai_imports + 1`,
    [userId, period], (e) => (e ? rej(e) : res())));
  const read = (userId, period) => new Promise((res, rej) => db.get(
    'SELECT ai_imports FROM usage_counters WHERE user_id = ? AND period = ?', [userId, period],
    (e, r) => (e ? rej(e) : res(r?.ai_imports ?? 0))));

  it('increments within a month and isolates users and months', async () => {
    await upsert(1, '2026-08'); await upsert(1, '2026-08'); await upsert(1, '2026-08');
    await upsert(2, '2026-08'); await upsert(1, '2026-09');
    assert.equal(await read(1, '2026-08'), 3);
    assert.equal(await read(2, '2026-08'), 1);
    assert.equal(await read(1, '2026-09'), 1);  // quota resets by period key
  });
});
