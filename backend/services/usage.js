// Free-tier metering and entitlement lookups (S11).
import { getDatabase } from '../database.js';
import {
  currentPeriod,
  isPremiumUser,
  FREE_MAX_ACCOUNTS,
  FREE_MAX_AI_IMPORTS_PER_MONTH,
} from '../lib/entitlement.js';

const get = (db, sql, p) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
const run = (db, sql, p) => new Promise((res, rej) => db.run(sql, p, (e) => (e ? rej(e) : res())));

/** Everything the enforcement points and the entitlement endpoint need, in one read. */
export async function getEntitlementState(userId, now = new Date()) {
  const db = getDatabase();
  const user = await get(db, 'SELECT premium, premium_until FROM users WHERE id = ?', [userId]);
  const acc = await get(db, 'SELECT COUNT(*) AS c FROM accounts WHERE user_id = ?', [userId]);
  const usage = await get(db, 'SELECT ai_imports FROM usage_counters WHERE user_id = ? AND period = ?', [userId, currentPeriod(now)]);
  const premium = isPremiumUser(user, now);
  return {
    premium,
    premiumUntil: user?.premium_until ?? null,
    accountsUsed: Number(acc?.c) || 0,
    aiImportsUsed: Number(usage?.ai_imports) || 0,
    canCreateAccount: premium || (Number(acc?.c) || 0) < FREE_MAX_ACCOUNTS,
    canAiImport: premium || (Number(usage?.ai_imports) || 0) < FREE_MAX_AI_IMPORTS_PER_MONTH,
  };
}

/** Count one successful AI extraction against this month (no-op decrement, ever). */
export async function recordAiImport(userId, now = new Date()) {
  const db = getDatabase();
  await run(
    db,
    `INSERT INTO usage_counters (user_id, period, ai_imports) VALUES (?, ?, 1)
     ON CONFLICT(user_id, period) DO UPDATE SET ai_imports = usage_counters.ai_imports + 1`,
    [userId, currentPeriod(now)]
  );
}
