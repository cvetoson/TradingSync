import sqlite3 from 'sqlite3';
import pg from 'pg';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

let pgClient = null;
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
      if (isInsert && !/RETURNING\s+/i.test(sql)) {
        pgSql = sql.replace(/;\s*$/, '') + ' RETURNING id';
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
          if (typeof callback === 'function') callback(err);
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
    if (!pgClient) {
      throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return createPgAdapter(pgClient);
  }
  if (!sqliteDb) {
    sqliteDb = new sqlite3.Database(dbPath);
  }
  return sqliteDb;
}

async function initPostgres() {
  pgClient = new pg.Client({ connectionString: DATABASE_URL });
  await pgClient.connect();

  const run = (sql, params = []) => pgClient.query(sql, params);

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

  await run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      platform TEXT NOT NULL,
      account_name TEXT,
      account_type TEXT,
      balance DOUBLE PRECISION DEFAULT 0,
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
      currency TEXT DEFAULT 'EUR',
      asset_type TEXT,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL,
          account_name TEXT,
          account_type TEXT,
          balance REAL DEFAULT 0,
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
        if (!err && cols && !cols.some((c) => c.name === 'user_id')) {
          db.run(`ALTER TABLE accounts ADD COLUMN user_id INTEGER REFERENCES users(id)`);
        }
      });

      db.all(`PRAGMA table_info(users)`, (err, cols) => {
        if (!err && cols) {
          if (!cols.some((c) => c.name === 'email_verified')) {
            db.run(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`);
            db.run(`UPDATE users SET email_verified = 1`);
          }
          if (!cols.some((c) => c.name === 'email_verification_token')) {
            db.run(`ALTER TABLE users ADD COLUMN email_verification_token TEXT`);
          }
          if (!cols.some((c) => c.name === 'email_verification_expires')) {
            db.run(`ALTER TABLE users ADD COLUMN email_verification_expires DATETIME`);
          }
          if (!cols.some((c) => c.name === 'password_reset_token')) {
            db.run(`ALTER TABLE users ADD COLUMN password_reset_token TEXT`);
          }
          if (!cols.some((c) => c.name === 'password_reset_expires')) {
            db.run(`ALTER TABLE users ADD COLUMN password_reset_expires DATETIME`);
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
          currency TEXT DEFAULT 'EUR',
          asset_type TEXT,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
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
  });
}

export function isPostgreSQL() {
  return !!isPostgres;
}
