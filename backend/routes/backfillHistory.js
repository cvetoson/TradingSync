import { getDatabase } from '../database.js';

/**
 * Backfill history for existing accounts that don't have history records
 * This creates an initial history entry using the current account balance
 */
export function backfillAccountHistory() {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    // Get all accounts
    db.all('SELECT * FROM accounts', [], (err, accounts) => {
      if (err) {
        reject(err);
        return;
      }

      let processed = 0;
      let created = 0;
      let errors = 0;

      if (accounts.length === 0) {
        resolve({ processed: 0, created: 0, errors: 0 });
        return;
      }

      accounts.forEach((account) => {
        // Check if this account already has history
        db.get(
          'SELECT COUNT(*) as count FROM account_history WHERE account_id = ?',
          [account.id],
          (historyErr, result) => {
            if (historyErr) {
              errors++;
              processed++;
              if (processed === accounts.length) {
                resolve({ processed, created, errors });
              }
              return;
            }

            // If no history exists, create an initial entry (count may be string in PostgreSQL)
            if (Number(result?.count ?? 0) === 0) {
              db.run(
                `INSERT INTO account_history (account_id, balance, interest_rate, currency, recorded_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  account.id,
                  account.balance || 0,
                  account.interest_rate || null,
                  account.currency || 'EUR',
                  account.last_updated || account.created_at || new Date().toISOString()
                ],
                (insertErr) => {
                  processed++;
                  if (insertErr) {
                    console.error(`Error backfilling history for account ${account.id}:`, insertErr);
                    errors++;
                  } else {
                    created++;
                  }

                  if (processed === accounts.length) {
                    resolve({ processed, created, errors });
                  }
                }
              );
            } else {
              processed++;
              if (processed === accounts.length) {
                resolve({ processed, created, errors });
              }
            }
          }
        );
      });
    });
  });
}
