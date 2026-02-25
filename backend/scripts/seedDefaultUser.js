/**
 * Creates default user in the configured database (SQLite or PostgreSQL).
 * Run from project root: node backend/scripts/seedDefaultUser.js
 * Uses DATABASE_PUBLIC_URL / DATABASE_URL from backend/.env
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

import bcrypt from 'bcryptjs';
import { initDatabase, getDatabase, isPostgreSQL } from '../database.js';

const email = process.env.DEFAULT_USER_EMAIL || 'default@tradingsync.local';
const password = process.env.DEFAULT_USER_PASSWORD || 'changeme123';

async function run() {
  await initDatabase();
  const db = getDatabase();

  const hash = await bcrypt.hash(password, 10);

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    if (row) {
      db.run('UPDATE accounts SET user_id = ? WHERE user_id IS NULL', [row.id], () => {
        console.log(`✅ Default user exists. Log in with: ${email} / ${password}`);
        process.exit(0);
      });
      return;
    }
    db.run(
      'INSERT INTO users (email, password_hash, display_name, email_verified) VALUES (?, ?, ?, 1)',
      [email, hash, 'Default User'],
      function (e) {
        if (e) {
          console.error(e);
          process.exit(1);
        }
        const userId = this.lastID;
        db.run('UPDATE accounts SET user_id = ? WHERE user_id IS NULL', [userId], () => {
          console.log(`✅ Default user created. Log in with: ${email} / ${password}`);
          process.exit(0);
        });
      }
    );
  });
}

console.log(`Using ${isPostgreSQL() ? 'PostgreSQL' : 'SQLite'}...`);
run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
