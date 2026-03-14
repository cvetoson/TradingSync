import { initDatabase, getDatabase } from '../database.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  await initDatabase();
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM accounts', [], (err, row) => {
      if (err) return reject(err);
      console.log('Accounts:', row.count);
      db.all('SELECT id, platform, account_name, account_type, balance FROM accounts ORDER BY id', [], (err2, rows) => {
        if (err2) return reject(err2);
        rows.forEach((r) => console.log(`  ${r.id}. ${r.platform} – ${r.account_name || '(no name)'} (${r.account_type}) – ${r.balance}`));
        resolve();
      });
    });
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
