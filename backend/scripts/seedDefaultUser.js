/**
 * Creates default user and assigns existing accounts to it.
 * Run: node backend/scripts/seedDefaultUser.js
 */
import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'trading_sync.db');

const db = new sqlite3.Database(dbPath);
const email = process.env.DEFAULT_USER_EMAIL || 'default@tradingsync.local';
const password = process.env.DEFAULT_USER_PASSWORD || 'changeme123';

async function run() {
  const hash = await bcrypt.hash(password, 10);

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    if (row) {
      db.run('UPDATE accounts SET user_id = ? WHERE user_id IS NULL', [row.id], () => {
        console.log(`Default user exists. Log in with: ${email} / ${password}`);
        db.close();
        process.exit(0);
      });
      return;
    }
    db.run(
      'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
      [email, hash, 'Default User'],
      function (e) {
        if (e) {
          console.error(e);
          process.exit(1);
        }
        const userId = this.lastID;
        db.run('UPDATE accounts SET user_id = ? WHERE user_id IS NULL', [userId], () => {
          console.log(`Default user created. Log in with: ${email} / ${password}`);
          db.close();
          process.exit(0);
        });
      }
    );
  });
}

run();
