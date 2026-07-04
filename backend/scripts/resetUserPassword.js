/**
 * Reset a user's password in the configured database (SQLite or PostgreSQL).
 * Usage: node backend/scripts/resetUserPassword.js <email> [newPassword]
 * If newPassword is omitted, a random temporary password is generated.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, getDatabase, closeDatabase } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const email = String(process.argv[2] || '').trim().toLowerCase();
let newPassword = process.argv[3];

if (!email) {
  console.error('Usage: node backend/scripts/resetUserPassword.js <email> [newPassword]');
  process.exit(1);
}

if (!newPassword) {
  newPassword = `Sync-${crypto.randomBytes(4).toString('hex')}!`;
}

async function run() {
  await initDatabase();
  const db = getDatabase();
  const hash = await bcrypt.hash(newPassword, 10);

  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, email_verified = 1 WHERE email = ?`,
      [hash, email],
      function (err) {
        if (err) return reject(err);
        if (this.changes === 0) return reject(new Error(`No user found for ${email}`));
        resolve();
      }
    );
  });

  const ok = await bcrypt.compare(newPassword, hash);
  console.log(`✅ Password reset for ${email}`);
  console.log(`Temporary password: ${newPassword}`);
  console.log(`Hash verify: ${ok ? 'ok' : 'FAILED'}`);
  await closeDatabase();
}

run().catch((err) => {
  console.error('Reset failed:', err.message);
  closeDatabase().finally(() => process.exit(1));
});
