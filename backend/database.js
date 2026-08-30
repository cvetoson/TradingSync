import sqlite3 from 'sqlite3';
import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load backend/.env before reading env (server.js imports us before its dotenv.config runs)
dotenv.config({ path: join(__dirname, '.env') });

// Railway: DATABASE_PUBLIC_URL = reachable from local machine (use for dev/seed)
// DATABASE_URL/DATABASE_PRIVATE_URL = internal (Railway only, use in production)
const DATABASE_URL =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.POSTGRES_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  process.env.POSTGRES_PRIVATE_URL;
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'trading_sync.db');

const isPostgres = DATABASE_URL && /^postgres(ql)?:\/\//i.test(DATABASE_URL);

let pgPool = null;
let sqliteDb = null;

/** Convert SQLite ? placeholders to PostgreSQL $1, $2, ... */
function toPgParams(sql, params = []) {
  let i = 0;
  const out = sql.replace(/\?/g, () => `$${++i}`);
  return { sql: out, params };
}

/** Create a PostgreSQL adapter that mimics sqlite3 get/run/all */
function createPgAdapter(client) {
  return {
    get(sql, params, callback) {
      const { sql: pgSql, params: pgParams } = toPgParams(sql, params);
      client
        .query(pgSql, pgParams)
        .then((res) => callback(null, res.rows[0]))
        .catch((err) => callback(err));
    },
    run(sql, params, callback) {
      const isInsert = /^\s*INSERT\s+/i.test(sql.trim());
      let pgSql = sql;
      // RETURNING * (not RETURNING id): tables keyed by a natural key, e.g. instruments(symbol),
      // have no id column, and Postgres would reject the statement outright.
      if (isInsert && !/RETURNING\s+/i.test(sql)) {
        pgSql = sql.replace(/;\s*$/, '') + ' RETURNING *';
      }
      const { sql: finalSql, params: pgParams } = toPgParams(pgSql, params);
      client
        .query(finalSql, pgParams)
        .then((res) => {
          const ctx = {
            lastID: res.rows[0]?.id ?? (res.rows[0] && parseInt(res.rows[0].id, 10)) ?? undefined,
            changes: res.rowCount ?? 0,
          };
          if (typeof callback === 'function') callback.call(ctx, null);
        })
        .catch((err) => {
          // Match sqlite3's contract: `this` carries lastID/changes even on error, so
          // continue-after-error handlers reading this.lastID don't throw a TypeError.
          if (typeof callback === 'function') callback.call({ lastID: undefined, changes: 0 }, err);
        });
    },
    all(sql, params, callback) {
      const { sql: pgSql, params: pgParams } = toPgParams(sql, params);
      client
        .query(pgSql, pgParams)
        .then((res) => callback(null, res.rows || []))
        .catch((err) => callback(err));
    },
  };
}

export function getDatabase() {
  if (isPostgres) {
    if (!pgPool) {
      throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return createPgAdapter(pgPool);
  }
  if (!sqliteDb) {
    sqliteDb = new sqlite3.Database(dbPath);
  }
  return sqliteDb;
}

async function initPostgres() {
  // Pool, not Client: a single Client dies for good when the backend drops the
  // socket (idle timeouts, PG restarts) — an unhandled 'error' event would kill
  // the whole process. The pool replaces broken connections per-query.
  pgPool = new pg.Pool({ connectionString: DATABASE_URL });
  pgPool.on('error', (err) => {
    console.error('[PG POOL] idle client error:', err?.message);
  });

  const run = (sql, params = []) => pgPool.query(sql, params);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      email_verified INTEGER DEFAULT 0,
      email_verification_token TEXT,
      email_verification_expires TIMESTAMP,
      password_reset_token TEXT,
      password_reset_expires TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure new auth columns exist on existing PostgreSQL databases (backwards compatible)
  const userColsRes = await run(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
    `
  );
  const userCols = (userColsRes.rows || []).map((r) => r.column_name);
  if (!userCols.includes('email_verified')) {
    await run(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`);
    await run(`UPDATE users SET email_verified = 1 WHERE email_verified IS NULL`);
  }
  if (!userCols.includes('email_verification_token')) {
    await run(`ALTER TABLE users ADD COLUMN email_verification_token TEXT`);
  }
  if (!userCols.includes('email_verification_expires')) {
    await run(`ALTER TABLE users ADD COLUMN email_verification_expires TIMESTAMP`);
  }
  if (!userCols.includes('password_reset_token')) {
    await run(`ALTER TABLE users ADD COLUMN password_reset_token TEXT`);
  }
  if (!userCols.includes('password_reset_expires')) {
    await run(`ALTER TABLE users ADD COLUMN password_reset_expires TIMESTAMP`);
  }

  await run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      platform TEXT NOT NULL,
      account_name TEXT,
      account_type TEXT,
      balance DOUBLE PRECISION DEFAULT 0,
      contributed_amount DOUBLE PRECISION,
      interest_rate DOUBLE PRECISION,
      currency TEXT DEFAULT 'EUR',
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      screenshot_path TEXT,
      raw_data TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS holdings (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id),
      symbol TEXT NOT NULL,
      quantity DOUBLE PRECISION NOT NULL,
      purchase_price DOUBLE PRECISION,
      current_price DOUBLE PRECISION,
      cost_basis_eur DOUBLE PRECISION,
      currency TEXT DEFAULT 'EUR',
      asset_type TEXT,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Instrument registry: per-listing currency and price divisor (100 = quoted in pence),
  // so pricing is data-driven instead of hardcoded ticker lists.
  await run(`
    CREATE TABLE IF NOT EXISTS instruments (
      symbol TEXT PRIMARY KEY,
      currency TEXT NOT NULL DEFAULT 'EUR',
      price_divisor DOUBLE PRECISION NOT NULL DEFAULT 1,
      yahoo_symbol TEXT,
      notes TEXT
    )
  `);

  // Dated deposits/withdrawals per account (EUR). Enables the money-weighted
  // headline (profit = value - deposits) and, later, XIRR.
  await run(`
    CREATE TABLE IF NOT EXISTS cash_flows (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      amount_eur DOUBLE PRECISION NOT NULL,
      kind TEXT NOT NULL DEFAULT 'deposit',
      flow_date DATE NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id),
      transaction_type TEXT,
      amount DOUBLE PRECISION,
      currency TEXT,
      description TEXT,
      transaction_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS screenshots (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id),
      file_path TEXT NOT NULL,
      platform TEXT,
      extracted_data TEXT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS account_history (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      balance DOUBLE PRECISION NOT NULL,
      interest_rate DOUBLE PRECISION,
      currency TEXT DEFAULT 'EUR',
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      screenshot_id INTEGER REFERENCES screenshots(id)
    )
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_account_history_account_id
    ON account_history(account_id, recorded_at DESC)
  `);

  const accColsRes = await run(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts'
  `);
  const accountColNames = (accColsRes.rows || []).map((r) => r.column_name);
  if (!accountColNames.includes('tag')) {
    await run(`ALTER TABLE accounts ADD COLUMN tag TEXT`);
  }
  if (!accountColNames.includes('contributed_amount')) {
    await run(`ALTER TABLE accounts ADD COLUMN contributed_amount DOUBLE PRECISION`);
  }

  const holdColsRes = await run(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'holdings'
  `);
  const holdingColNames = (holdColsRes.rows || []).map((r) => r.column_name);
  if (!holdingColNames.includes('cost_basis_eur')) {
    await run(`ALTER TABLE holdings ADD COLUMN cost_basis_eur DOUBLE PRECISION`);
  }
  // 'screenshot' (read from the broker), 'derived' (value ÷ live price), 'placeholder'
  // (1 × position value — no live price was available; healed on the next refresh), 'manual'
  if (!holdingColNames.includes('quantity_source')) {
    await run(`ALTER TABLE holdings ADD COLUMN quantity_source TEXT`);
  }

  const userCols2Res = await run(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
  `);
  const userColNames = (userCols2Res.rows || []).map((r) => r.column_name);
  if (!userColNames.includes('premium')) {
    await run(`ALTER TABLE users ADD COLUMN premium INTEGER NOT NULL DEFAULT 0`);
  }
  if (!userColNames.includes('premium_until')) {
    await run(`ALTER TABLE users ADD COLUMN premium_until TIMESTAMP`);
  }

  // Free-tier metering: one row per user per calendar month.
  await run(`
    CREATE TABLE IF NOT EXISTS usage_counters (
      user_id INTEGER NOT NULL REFERENCES users(id),
      period TEXT NOT NULL,
      ai_imports INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, period)
    )
  `);
  const ucColsRes = await run(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usage_counters'
  `);
  if (!(ucColsRes.rows || []).some((r) => r.column_name === 'assistant_msgs')) {
    await run(`ALTER TABLE usage_counters ADD COLUMN assistant_msgs INTEGER NOT NULL DEFAULT 0`);
  }
  // Where current_price came from: 'live' (market API), 'screenshot', 'manual'.
  // Drives the price-source badge, so users can trust what they see.
  if (!holdingColNames.includes('price_source')) {
    await run(`ALTER TABLE holdings ADD COLUMN price_source TEXT`);
  }

  console.log('✅ PostgreSQL database initialized successfully');
}

export function initDatabase() {
  if (isPostgres) {
    return initPostgres();
  }

  const dir = dirname(dbPath);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (createErr) => {
      if (createErr) return reject(createErr);
      db.all(`PRAGMA table_info(users)`, (err, cols) => {
        if (err) return reject(err);
        const has = (name) => cols.some((c) => c.name === name);
        const steps = [];
        if (!has('email_verified')) {
          steps.push((next) => db.run(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`, next));
          steps.push((next) => db.run(`UPDATE users SET email_verified = 1 WHERE email_verified IS NULL`, next));
        }
        if (!has('email_verification_token')) steps.push((next) => db.run(`ALTER TABLE users ADD COLUMN email_verification_token TEXT`, next));
        if (!has('email_verification_expires')) steps.push((next) => db.run(`ALTER TABLE users ADD COLUMN email_verification_expires DATETIME`, next));
        if (!has('password_reset_token')) steps.push((next) => db.run(`ALTER TABLE users ADD COLUMN password_reset_token TEXT`, next));
        if (!has('password_reset_expires')) steps.push((next) => db.run(`ALTER TABLE users ADD COLUMN password_reset_expires DATETIME`, next));
        function runStep(i) {
          if (i >= steps.length) return runRestOfInit();
          steps[i]((e) => { if (e) return reject(e); runStep(i + 1); });
        }
        runStep(0);
      });
    });

    function runRestOfInit() {
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            account_name TEXT,
            account_type TEXT,
            balance REAL DEFAULT 0,
            contributed_amount REAL,
            interest_rate REAL,
            currency TEXT DEFAULT 'EUR',
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            screenshot_path TEXT,
            raw_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER REFERENCES users(id)
          )
        `);

        db.all(`PRAGMA table_info(accounts)`, (err, cols) => {
          if (!err && cols) {
            if (!cols.some((c) => c.name === 'user_id')) {
              db.run(`ALTER TABLE accounts ADD COLUMN user_id INTEGER REFERENCES users(id)`);
            }
            if (!cols.some((c) => c.name === 'tag')) {
              db.run(`ALTER TABLE accounts ADD COLUMN tag TEXT`);
            }
            if (!cols.some((c) => c.name === 'contributed_amount')) {
              db.run(`ALTER TABLE accounts ADD COLUMN contributed_amount REAL`);
            }
          }
        });

        db.run(`
        CREATE TABLE IF NOT EXISTS holdings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER,
          symbol TEXT NOT NULL,
          quantity REAL NOT NULL,
          purchase_price REAL,
          current_price REAL,
          cost_basis_eur REAL,
          currency TEXT DEFAULT 'EUR',
          asset_type TEXT,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
      `);

      db.all(`PRAGMA table_info(holdings)`, (err, cols) => {
        if (!err && cols && !cols.some((c) => c.name === 'cost_basis_eur')) {
          db.run(`ALTER TABLE holdings ADD COLUMN cost_basis_eur REAL`);
        }
        if (!err && cols && !cols.some((c) => c.name === 'quantity_source')) {
          db.run(`ALTER TABLE holdings ADD COLUMN quantity_source TEXT`);
        }
        if (!err && cols && !cols.some((c) => c.name === 'price_source')) {
          db.run(`ALTER TABLE holdings ADD COLUMN price_source TEXT`);
        }
      });
      db.all(`PRAGMA table_info(users)`, (err, cols) => {
        if (!err && cols && !cols.some((c) => c.name === 'premium')) {
          db.run(`ALTER TABLE users ADD COLUMN premium INTEGER NOT NULL DEFAULT 0`);
        }
        if (!err && cols && !cols.some((c) => c.name === 'premium_until')) {
          db.run(`ALTER TABLE users ADD COLUMN premium_until TIMESTAMP`);
        }
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS usage_counters (
          user_id INTEGER NOT NULL REFERENCES users(id),
          period TEXT NOT NULL,
          ai_imports INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, period)
        )
      `, (e) => { if (e) console.error('usage_counters create failed:', e.message); });
      db.all(`PRAGMA table_info(usage_counters)`, (err, cols) => {
        if (!err && cols && cols.length > 0 && !cols.some((c) => c.name === 'assistant_msgs')) {
          db.run(`ALTER TABLE usage_counters ADD COLUMN assistant_msgs INTEGER NOT NULL DEFAULT 0`);
        }
      });

      // Instrument registry: per-listing currency + price divisor (100 = pence quotes)
      db.run(`
        CREATE TABLE IF NOT EXISTS instruments (
          symbol TEXT PRIMARY KEY,
          currency TEXT NOT NULL DEFAULT 'EUR',
          price_divisor REAL NOT NULL DEFAULT 1,
          yahoo_symbol TEXT,
          notes TEXT
        )
      `);

      // Dated deposits/withdrawals per account (EUR) for money-weighted stats
      db.run(`
        CREATE TABLE IF NOT EXISTS cash_flows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          amount_eur REAL NOT NULL,
          kind TEXT NOT NULL DEFAULT 'deposit',
          flow_date DATE NOT NULL,
          note TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER,
          transaction_type TEXT,
          amount REAL,
          currency TEXT,
          description TEXT,
          transaction_date DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS screenshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER,
          file_path TEXT NOT NULL,
          platform TEXT,
          extracted_data TEXT,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS account_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          balance REAL NOT NULL,
          interest_rate REAL,
          currency TEXT DEFAULT 'EUR',
          recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          screenshot_id INTEGER,
          FOREIGN KEY (account_id) REFERENCES accounts(id),
          FOREIGN KEY (screenshot_id) REFERENCES screenshots(id)
        )
      `);

      db.run(
        `CREATE INDEX IF NOT EXISTS idx_account_history_account_id
        ON account_history(account_id, recorded_at DESC)`,
        (err) => {
          if (err) reject(err);
          else {
            console.log('✅ SQLite database initialized successfully');
            resolve();
          }
        }
      );
    });
  }
  });
}

export function isPostgreSQL() {
  return !!isPostgres;
}

/** Close the database connection (used by test teardown so node:test can exit cleanly). */
export async function closeDatabase() {
  if (pgPool) {
    try { await pgPool.end(); } catch (e) { /* swallow */ }
    pgPool = null;
  }
  if (sqliteDb) {
    try { await new Promise((resolve) => sqliteDb.close(() => resolve())); } catch (e) { /* swallow */ }
    sqliteDb = null;
  }
}
