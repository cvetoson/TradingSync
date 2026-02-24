/**
 * Migration: Add users table and user_id to accounts.
 * Run once. Creates default user and assigns existing accounts to it.
 */
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'trading_sync.db');

const db = new sqlite3.Database(dbPath);

async function run() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Create users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) { reject(err); return; }
        console.log('✅ users table ready');
      });

      // 2. Add user_id to accounts if not exists
      db.run(`PRAGMA table_info(accounts)`, (err, cols) => {
        if (err) { reject(err); return; }
        const hasUserId = cols?.some((c) => c.name === 'user_id');
        if (!hasUserId) {
          db.run(`ALTER TABLE accounts ADD COLUMN user_id INTEGER REFERENCES users(id)`, (e) => {
            if (e) { reject(e); return; }
            console.log('✅ user_id added to accounts');
          });
        }
      });

      // 3. Create default user and assign existing accounts (run after tables exist)
      setTimeout(async () => {
        const defaultEmail = process.env.DEFAULT_USER_EMAIL || 'default@tradingsync.local';
        const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'changeme123';
        const hash = await bcrypt.hash(defaultPassword, 10);

        db.get('SELECT id FROM users WHERE email = ?', [defaultEmail], (err, row) => {
          if (err) { reject(err); return; }
          if (row) {
            console.log('✅ Default user exists');
            db.run('UPDATE accounts SET user_id = ? WHERE user_id IS NULL', [row.id], () => {
              console.log('✅ Orphan accounts assigned to default user');
              resolve();
            });
            return;
          }
          db.run(
            'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
            [defaultEmail, hash, 'Default User'],
            function (e) {
              if (e) { reject(e); return; }
              const userId = this.lastID;
              db.run('UPDATE accounts SET user_id = ? WHERE user_id IS NULL', [userId], () => {
                console.log(`✅ Default user created (${defaultEmail}). Assign existing accounts.`);
                resolve();
              });
            }
          );
        });
      }, 100);
    });
  });
}

run()
  .then(() => {
    db.close();
    console.log('Migration complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    db.close();
    process.exit(1);
  });
