/**
 * FX rates from Frankfurter (https://frankfurter.app) — keyless, ECB-backed.
 * ECB publishes daily reference rates around 16:00 CET. For weekend/holiday queries
 * Frankfurter returns the most recent business-day rate.
 */

async function frankfurterRate(from, to) {
  try {
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data && data.rates && data.rates[to];
    return rate != null ? Number(rate) : null;
  } catch (e) {
    return null;
  }
}

/** USD → EUR (EUR per 1 USD). */
export async function fetchUsdToEurRate() {
  const rate = await frankfurterRate('USD', 'EUR');
  if (rate != null && rate > 0.5 && rate < 1.5) return rate;
  return null;
}

/** GBP → EUR (EUR per 1 GBP). */
export async function fetchGbpToEurRate() {
  const rate = await frankfurterRate('GBP', 'EUR');
  if (rate != null && rate > 0.9 && rate < 1.5) return rate;
  return null;
}

/** CHF → EUR (EUR per 1 CHF). */
export async function fetchChfToEurRate() {
  const rate = await frankfurterRate('CHF', 'EUR');
  if (rate != null && rate > 0.8 && rate < 1.2) return rate;
  return null;
}

/** HKD → EUR (EUR per 1 HKD). */
export async function fetchHkdToEurRate() {
  const rate = await frankfurterRate('HKD', 'EUR');
  if (rate != null && rate > 0.05 && rate < 0.2) return rate;
  return null;
}
