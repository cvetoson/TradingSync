/**
 * Price Service
 *
 * Background price refresh + instrument registry + daily balance snapshots.
 *
 * Core principle (from the validated prototype): quantities change rarely — on
 * trades and deposits — while prices change constantly. Separating the two keeps
 * consolidation tractable. This service owns the "prices" half: a scheduled job
 * refreshes holdings' current_price in the DB, so request handlers serve cached
 * prices instead of fanning out to Yahoo on every page load.
 */
import { getDatabase } from '../database.js';
import { fetchCurrentPrice, fetchUsdToEurRate, fetchGbpToEurRate, fetchHkdToEurRate } from './marketData.js';
import {
  LSE_GBP_ETF_SYMBOLS,
  LSE_USD_ETF_SYMBOLS,
  LSE_CHF_SYMBOLS,
  EUR_NATIVE_SYMBOLS,
  isEurNativeSymbol,
} from '../lib/portfolioUtils.js';

const dbAll = (db, sql, params = []) =>
  new Promise((resolve, reject) => db.all(sql, params, (e, rows) => (e ? reject(e) : resolve(rows || []))));
const dbGet = (db, sql, params = []) =>
  new Promise((resolve, reject) => db.get(sql, params, (e, row) => (e ? reject(e) : resolve(row))));
const dbRun = (db, sql, params = []) =>
  new Promise((resolve, reject) => db.run(sql, params, (e) => (e ? reject(e) : resolve())));

/**
 * Seed the instrument registry from the previously hardcoded listing knowledge.
 * price_divisor 100 = broker/AI-sourced prices may arrive in pence (GBX).
 * INSERT OR IGNORE semantics: user/db edits win over the seed.
 */
const SEED_INSTRUMENTS = [
  ...LSE_GBP_ETF_SYMBOLS.map((s) => [s, 'GBP', 100, `${s}.L`, 'LSE ETF quoted in pence']),
  ...LSE_USD_ETF_SYMBOLS.map((s) => [s, 'USD', 1, `${s}.L`, 'LSE USD line']),
  ...LSE_CHF_SYMBOLS.map((s) => [s, 'CHF', 1, `${s}.SW`, 'Swiss listing']),
  ...EUR_NATIVE_SYMBOLS.map((s) => [s, 'EUR', 1, null, 'European EUR-native listing']),
];

export async function seedInstruments() {
  const db = getDatabase();
  for (const [symbol, currency, divisor, yahoo, notes] of SEED_INSTRUMENTS) {
    try {
      const existing = await dbGet(db, 'SELECT symbol FROM instruments WHERE symbol = ?', [symbol]);
      if (!existing) {
        await dbRun(
          db,
          'INSERT INTO instruments (symbol, currency, price_divisor, yahoo_symbol, notes) VALUES (?, ?, ?, ?, ?)',
          [symbol, currency, divisor, yahoo, notes]
        );
      }
    } catch (e) {
      console.warn('seedInstruments:', symbol, e?.message);
    }
  }
}

/** Load the registry into a map keyed by uppercase symbol. */
export async function loadInstrumentRegistry() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, 'SELECT symbol, currency, price_divisor, yahoo_symbol FROM instruments');
    const map = {};
    for (const r of rows) map[String(r.symbol).toUpperCase()] = r;
    return map;
  } catch (e) {
    return {};
  }
}

function isStaticHolding(holding) {
  const sym = String(holding.symbol || '').trim().toUpperCase();
  const assetT = (holding.asset_type || '').toLowerCase();
  return assetT === 'bond' || sym.includes('CASH') || sym === 'ROMANIA';
}

/**
 * Fetch a fresh native price for one holding and persist it in EUR (or HKD native),
 * mirroring the conversion rules of the request-path fetch so cached and fresh
 * prices are always in the same unit.
 * @returns {boolean} whether a price was stored
 */
export async function refreshHoldingPrice(db, holding, rates, registry) {
  const sym = String(holding.symbol || '').trim().toUpperCase();
  const assetT = (holding.asset_type || '').toLowerCase();
  let price;
  try {
    price = await fetchCurrentPrice(holding.symbol, holding.asset_type);
  } catch (e) {
    price = null;
  }
  if (price == null || !Number.isFinite(Number(price)) || Number(price) <= 0) return false;
  price = Number(price);

  const reg = registry ? registry[sym] : null;
  const regCurrency = reg ? String(reg.currency || 'EUR').toUpperCase() : null;
  const isGbpListing = reg ? regCurrency === 'GBP' : LSE_GBP_ETF_SYMBOLS.includes(sym);
  const isChfListing = reg ? regCurrency === 'CHF' : LSE_CHF_SYMBOLS.includes(sym);
  const eurNative = reg ? regCurrency === 'EUR' : isEurNativeSymbol(sym, assetT);
  const isHkd = sym.endsWith('.HK') || (holding.currency || '').toUpperCase() === 'HKD' || regCurrency === 'HKD';

  if (isChfListing || eurNative) {
    // fetchCurrentPrice already returns EUR for CHF listings; EUR-natives are native EUR
    await dbRun(db, 'UPDATE holdings SET current_price = ?, currency = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [price, 'EUR', holding.id]);
  } else if (isGbpListing) {
    await dbRun(db, 'UPDATE holdings SET current_price = ?, currency = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [price * rates.gbpToEur, 'EUR', holding.id]);
  } else if (isHkd) {
    await dbRun(db, 'UPDATE holdings SET current_price = ?, currency = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [price, 'HKD', holding.id]);
  } else {
    // Default: USD quote (US stocks, LSE USD lines, crypto, XAG/XAU)
    await dbRun(db, 'UPDATE holdings SET current_price = ?, currency = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [price * rates.usdToEur, 'EUR', holding.id]);
  }
  return true;
}

/** Refresh every priceable holding whose stored price is older than maxAgeMinutes. */
export async function refreshAllPrices(maxAgeMinutes) {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
  const holdings = await dbAll(
    db,
    `SELECT * FROM holdings WHERE last_updated IS NULL OR last_updated < ?`,
    [cutoff]
  );
  const priceable = holdings.filter((h) => !isStaticHolding(h));
  if (priceable.length === 0) return { refreshed: 0, failed: 0 };

  const [usdToEur, gbpToEur, hkdToEur] = await Promise.all([
    fetchUsdToEurRate(),
    fetchGbpToEurRate(),
    fetchHkdToEurRate(),
  ]);
  const rates = {
    usdToEur: Number(process.env.EXCHANGE_RATE_USD_TO_EUR) || usdToEur || 0.846,
    gbpToEur: gbpToEur || 1.17,
    hkdToEur: hkdToEur || 0.11,
  };
  const registry = await loadInstrumentRegistry();

  let refreshed = 0;
  let failed = 0;
  for (const holding of priceable) {
    try {
      const ok = await refreshHoldingPrice(db, holding, rates, registry);
      if (ok) refreshed++;
      else failed++;
    } catch (e) {
      failed++;
    }
    // Small gap between symbols to stay polite with the free Yahoo endpoints
    await new Promise((r) => setTimeout(r, 250));
  }
  return { refreshed, failed };
}

/**
 * Once per calendar day, write every account's current balance into account_history.
 * The consolidated value curve can never be backfilled — snapshots must accrue from
 * the day the feature ships, even if nothing reads them yet.
 */
export async function snapshotDailyBalances() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  const accounts = await dbAll(db, 'SELECT id, balance, interest_rate, currency FROM accounts');
  let written = 0;
  for (const account of accounts) {
    try {
      const existing = await dbGet(
        db,
        'SELECT id FROM account_history WHERE account_id = ? AND DATE(recorded_at) = DATE(?)',
        [account.id, today]
      );
      if (existing) continue;
      const balance = Number(account.balance);
      if (!Number.isFinite(balance)) continue;
      await dbRun(
        db,
        'INSERT INTO account_history (account_id, balance, interest_rate, currency, recorded_at) VALUES (?, ?, ?, ?, ?)',
        [account.id, balance, account.interest_rate, account.currency || 'EUR', new Date().toISOString()]
      );
      written++;
    } catch (e) {
      console.warn('snapshotDailyBalances:', account.id, e?.message);
    }
  }
  return written;
}

let schedulerHandle = null;

/**
 * Start the background scheduler. PRICE_REFRESH_MINUTES=0 disables it.
 * The first tick runs shortly after boot so a restarted server converges quickly.
 */
export function startPriceScheduler() {
  const minutes = process.env.PRICE_REFRESH_MINUTES !== undefined
    ? Number(process.env.PRICE_REFRESH_MINUTES)
    : 20;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.log('⏸  Price scheduler disabled (PRICE_REFRESH_MINUTES=0)');
    return;
  }

  const tick = async () => {
    try {
      const { refreshed, failed } = await refreshAllPrices(minutes);
      const snapshots = await snapshotDailyBalances();
      if (refreshed || failed || snapshots) {
        console.log(`🔄 Price refresh: ${refreshed} updated, ${failed} failed · ${snapshots} daily snapshots written`);
      }
    } catch (e) {
      console.warn('Price scheduler tick failed:', e?.message);
    }
  };

  seedInstruments()
    .then(() => setTimeout(tick, 15 * 1000))
    .catch((e) => console.warn('seedInstruments failed:', e?.message));
  schedulerHandle = setInterval(tick, minutes * 60 * 1000);
  if (schedulerHandle.unref) schedulerHandle.unref();
  console.log(`⏱  Price scheduler: every ${minutes} min (daily snapshots included)`);
}

export function stopPriceScheduler() {
  if (schedulerHandle) clearInterval(schedulerHandle);
  schedulerHandle = null;
}
