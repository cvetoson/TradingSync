/**
 * Yahoo Finance v8 chart API — keyless quote + history source.
 *
 * Became the primary equity/metal source on 2026-08-31 when Stooq removed its
 * CSV endpoints (/q/l/ and /q/d/l/ now return an HTML error page for every
 * symbol). Yahoo's chart endpoint needs no API key or crumb:
 *   https://query1.finance.yahoo.com/v8/finance/chart/<ticker>?interval=1d&range=1d
 * meta.regularMarketPrice carries the live quote in the listing currency
 * (GBp for LSE pence lines — same magnitude Stooq used, so the existing
 * pence normalisation keeps working unchanged).
 *
 * Tickers arrive Yahoo-style already (BMW.DE, VUSA.L, 1211.HK, bare AAPL).
 * Two Stooq-isms are translated: 'SYM.US' → 'SYM', and 6-letter forex pairs
 * ('XAUUSD') → Yahoo's '=X' form.
 */

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

export function toYahooSymbol(ticker) {
  const t = String(ticker || '').trim();
  if (!t) return '';
  const upper = t.toUpperCase();
  if (upper.endsWith('.US')) return upper.slice(0, -3);
  // Yahoo has no XAU/XAG spot pairs; front-month futures track spot closely.
  if (upper === 'XAUUSD') return 'GC=F';
  if (upper === 'XAGUSD') return 'SI=F';
  if (/^[A-Z]{6}$/.test(upper) && (upper.endsWith('USD') || upper.startsWith('USD') || upper.endsWith('EUR') || upper.startsWith('EUR'))) {
    return `${upper}=X`; // forex pair (EURUSD, ...)
  }
  return upper;
}

async function chart(ticker, params) {
  const sym = toYahooSymbol(ticker);
  if (!sym) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${CHART_BASE}${encodeURIComponent(sym)}?${params}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null; // 404 unknown symbol, 429 rate limited → try again next tick
    const data = await res.json();
    return data?.chart?.result?.[0] || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Latest market price in the listing currency, or null. */
export async function yahooLatestClose(ticker) {
  const result = await chart(ticker, 'interval=1d&range=1d');
  const price = Number(result?.meta?.regularMarketPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

/** Daily closes covering roughly the past `days` days (oldest first), or []. */
export async function yahooHistoricalCloses(ticker, days) {
  const d = Number(days) || 180;
  const range = d <= 7 ? '5d' : d <= 35 ? '1mo' : d <= 100 ? '3mo' : d <= 200 ? '6mo' : d <= 400 ? '1y' : '2y';
  const result = await chart(ticker, `interval=1d&range=${range}`);
  const closes = result?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(closes)) return [];
  return closes.filter((c) => Number.isFinite(Number(c)) && Number(c) > 0).map(Number);
}
