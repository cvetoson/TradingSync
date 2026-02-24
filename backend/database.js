import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'trading_sync.db');

export function getDatabase() {
  return new sqlite3.Database(dbPath);
}

export function initDatabase() {
  const db = getDatabase();

  db.serialize(() => {
    // Users table - for authentication
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

    // Accounts table - stores information about each platform account
    db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        account_name TEXT,
        account_type TEXT, -- 'p2p', 'stocks', 'crypto', 'bank'
        balance REAL DEFAULT 0,
        interest_rate REAL, -- For P2P accounts
        currency TEXT DEFAULT 'EUR',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        screenshot_path TEXT,
        raw_data TEXT, -- JSON string of extracted data
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER REFERENCES users(id)
      )
    `);

    // Add user_id to accounts if missing (migration)
    db.all(`PRAGMA table_info(accounts)`, (err, cols) => {
      if (!err && cols && !cols.some((c) => c.name === 'user_id')) {
        db.run(`ALTER TABLE accounts ADD COLUMN user_id INTEGER REFERENCES users(id)`);
      }
    });

    // Add email verification and password reset columns to users (migration)
    db.all(`PRAGMA table_info(users)`, (err, cols) => {
      if (!err && cols) {
        if (!cols.some((c) => c.name === 'email_verified')) {
          db.run(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`);
          db.run(`UPDATE users SET email_verified = 1`); // existing users are verified
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

    // Holdings table - for stocks/crypto holdings
    db.run(`
      CREATE TABLE IF NOT EXISTS holdings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        symbol TEXT NOT NULL,
        quantity REAL NOT NULL,
        purchase_price REAL,
        current_price REAL,
        currency TEXT DEFAULT 'EUR',
        asset_type TEXT, -- 'stock', 'crypto', 'bond'
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )
    `);

    // Transactions table - for tracking changes
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        transaction_type TEXT, -- 'deposit', 'withdrawal', 'interest', 'dividend'
        amount REAL,
        currency TEXT,
        description TEXT,
        transaction_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )
    `);

    // Screenshots table - track uploaded screenshots
    db.run(`
      CREATE TABLE IF NOT EXISTS screenshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        file_path TEXT NOT NULL,
        platform TEXT,
        extracted_data TEXT, -- JSON string
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )
    `);

    // Account history table - track account value changes over time
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

    // Create index for faster queries
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_account_history_account_id 
      ON account_history(account_id, recorded_at DESC)
    `);

    console.log('✅ Database initialized successfully');
  });
}
