#!/usr/bin/env node
/**
 * Export TradingSync DB rows for one user (by email) or one account (by account id).
 *
 * Run on the machine that can reach the DB (production shell, or locally with DATABASE_PUBLIC_URL):
 *
 *   cd backend && node scripts/backupUserAccount.js --email=penchev.bg@gmail.com --out=penchev-backup.json
 *   node scripts/backupUserAccount.js --account-id=123 --out=account-123.json
 *
 * Env: same as the API — DATABASE_URL / POSTGRES_URL (Postgres) or DATABASE_PATH (SQLite).
 * Output contains password hashes — treat the file as secret.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDatabase, getDatabase } from '../database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function getRow(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function parseArgs() {
  const out = { email: null, accountId: null, outPath: null };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--email=')) out.email = a.slice('--email='.length).trim().toLowerCase();
    else if (a.startsWith('--account-id=')) out.accountId = a.slice('--account-id='.length).trim();
    else if (a.startsWith('--out=')) out.outPath = a.slice('--out='.length).trim();
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(`Usage:
  node scripts/backupUserAccount.js --email=user@example.com [--out=backup.json]
  node scripts/backupUserAccount.js --account-id=<id> [--out=backup.json]

Requires DATABASE_URL (Postgres) or DATABASE_PATH (SQLite), same as the running API.`);
    process.exit(0);
  }

  if (!args.email && !args.accountId) {
    console.error('Provide --email=... or --account-id=...');
    process.exit(1);
  }

  await initDatabase();
  const db = getDatabase();

  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'TradingSync',
    user: null,
    accounts: [],
    holdings: [],
    transactions: [],
    screenshots: [],
    account_history: [],
  };

  let accountIds = [];

  if (args.accountId) {
    const acc = await getRow(db, 'SELECT * FROM accounts WHERE id = ?', [args.accountId]);
    if (!acc) {
      console.error('Account not found:', args.accountId);
      process.exit(1);
    }
    accountIds = [Number(acc.id)];
    if (acc.user_id != null) {
      payload.user = await getRow(db, 'SELECT * FROM users WHERE id = ?', [acc.user_id]);
    }
    payload.accounts = [acc];
  } else {
    const email = args.email;
    const user = await getRow(db, 'SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      console.error('No user with email:', email);
      process.exit(1);
    }
    payload.user = user;
    const accs = await all(db, 'SELECT * FROM accounts WHERE user_id = ? ORDER BY id', [user.id]);
    payload.accounts = accs;
    accountIds = accs.map((a) => a.id);
  }

  if (accountIds.length === 0) {
    const outJson = JSON.stringify(payload, null, 2);
    if (args.outPath) fs.writeFileSync(args.outPath, outJson, 'utf8');
    else console.log(outJson);
    console.error('No accounts to export (empty portfolio for this user).');
    process.exit(0);
  }

  const placeholders = accountIds.map(() => '?').join(',');
  const q = (sql) => all(db, sql, accountIds);

  payload.holdings = await q(`SELECT * FROM holdings WHERE account_id IN (${placeholders}) ORDER BY account_id, id`);
  payload.transactions = await q(`SELECT * FROM transactions WHERE account_id IN (${placeholders}) ORDER BY account_id, id`);
  payload.screenshots = await q(`SELECT * FROM screenshots WHERE account_id IN (${placeholders}) ORDER BY account_id, id`);
  payload.account_history = await q(`SELECT * FROM account_history WHERE account_id IN (${placeholders}) ORDER BY account_id, recorded_at`);

  const outJson = JSON.stringify(payload, null, 2);
  if (args.outPath) {
    fs.writeFileSync(args.outPath, outJson, 'utf8');
    console.error('Wrote', path.resolve(args.outPath), `(${Buffer.byteLength(outJson, 'utf8')} bytes)`);
  } else {
    console.log(outJson);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
