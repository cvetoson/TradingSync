/**
 * Stooq.com price fetcher — keyless CSV API. Covers Xetra (.de), LSE (.uk),
 * Paris (.fr), Madrid (.mc), Swiss (.ch), HK (.hk), Milan (.mi), and US (bare or .us).
 * Forex pairs as bare strings: XAUUSD, XAGUSD, EURUSD, GBPUSD, etc.
 *
 * Quote endpoint: https://stooq.com/q/l/?s=<sym>&f=sd2t2ohlcv&h&e=csv
 *   → "Symbol,Date,Time,Open,High,Low,Close,Volume\nIFX.DE,2026-04-28,17:30:00,52.92,..."
 *   Missing symbols return "N/D" in every column.
 *
 * Daily history: https://stooq.com/q/d/l/?s=<sym>&i=d&d1=YYYYMMDD&d2=YYYYMMDD
 *   → "Date,Open,High,Low,Close,Volume\n2025-10-29,..."
 *
 * No documented rate limit; use sensibly.
 */

const QUOTE_BASE = 'https://stooq.com/q/l/';
const HIST_BASE = 'https://stooq.com/q/d/l/';

/**
 * Map a Yahoo-style suffix on a ticker to the Stooq equivalent. Returns the
 * lowercased Stooq ticker. Unknown suffixes pass through (lowercased).
 */
export function toStooqSymbol(ticker) {
  const t = String(ticker || '').trim();
  if (!t) return '';
  const upper = t.toUpperCase();
  // Forex pairs (XAU/USD, XAG/USD, USD/EUR, ...) → strip slash, lowercase
  if (upper.includes('/')) return upper.replace('/', '').toLowerCase();
  // Yahoo-style suffix → Stooq suffix
  const m = upper.match(/^(.+?)(\.[A-Z]+)$/);
  if (!m) return t.toLowerCase();
  const base = m[1].toLowerCase();
  const yahooSuffix = m[2];
  const map = {
    '.L': '.uk',     // London (LSE)
    '.DE': '.de',    // Xetra
    '.PA': '.fr',    // Paris (Euronext)
    '.MC': '.mc',    // Madrid (BME)
    '.SW': '.ch',    // Swiss (SIX)
    '.AS': '.nl',    // Amsterdam (Euronext)
    '.BR': '.be',    // Brussels (Euronext)
    '.MI': '.mi',    // Milan (BIT)
    '.HK': '.hk',    // Hong Kong (HKEX)
    '.MU': '.de',    // Munich → Xetra equivalent on Stooq
    '.VI': '.at',    // Vienna (WBAG)
    '.F': '.de',     // Frankfurt floor → Xetra equivalent
    '.US': '.us',    // US explicit
  };
  const stooqSuffix = map[yahooSuffix];
  if (!stooqSuffix) return t.toLowerCase();
  return base + stooqSuffix;
}

function parseCsv(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  return lines.slice(1).map((row) => {
    const cells = row.split(',');
    const obj = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = cells[i];
    return obj;
  });
}

/**
 * Fetch the latest close for a Yahoo-style or Stooq-style ticker.
 * Returns Number or null.
 */
export async function stooqLatestClose(ticker) {
  const sym = toStooqSymbol(ticker);
  if (!sym) return null;
  try {
    const url = `${QUOTE_BASE}?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=csv`;
    const res = await fetch(url, { headers: { 'User-Agent': 'TradingSync/3.6' } });
    if (!res.ok) return null;
    const text = await res.text();
    const rows = parseCsv(text);
    const row = rows[0];
    if (!row) return null;
    const close = row.Close;
    if (!close || close === 'N/D') return null;
    const n = Number(close);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch (e) {
    return null;
  }
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Fetch daily closes for a ticker over the last `days` calendar days.
 * Returns oldest-first array of numbers, or null.
 */
export async function stooqHistoricalCloses(ticker, days = 180) {
  const sym = toStooqSymbol(ticker);
  if (!sym) return null;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(1, days));
  try {
    const url = `${HIST_BASE}?s=${encodeURIComponent(sym)}&i=d&d1=${ymd(start)}&d2=${ymd(end)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'TradingSync/3.6' } });
    if (!res.ok) return null;
    const text = await res.text();
    const rows = parseCsv(text);
    const closes = rows
      .map((r) => Number(r.Close))
      .filter((c) => Number.isFinite(c) && c > 0);
    return closes.length >= 2 ? closes : null;
  } catch (e) {
    return null;
  }
}
