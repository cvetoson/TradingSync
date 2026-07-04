/**
 * Market Data Service
 * Fetches current prices for stocks, bonds (including ISIN), precious metals, and cryptocurrencies.
 *
 * Sources:
 * - Stocks/ETFs/Bonds/Precious metals → Stooq (stooq.com, keyless CSV)
 * - FX rates                          → Frankfurter (frankfurter.app, ECB-backed, no key)
 * - Crypto                            → CoinGecko (no key)
 * - ISIN → ticker fallback            → OpenFIGI (Bloomberg, optional OPENFIGI_API_KEY)
 */

import { stooqLatestClose, stooqHistoricalCloses, toStooqSymbol } from './stooqPrices.js';
export {
  fetchUsdToEurRate,
  fetchGbpToEurRate,
  fetchChfToEurRate,
  fetchHkdToEurRate,
} from './frankfurterFx.js';
import { fetchChfToEurRate } from './frankfurterFx.js';

function looksLikeIsin(s) {
  return /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(String(s).trim().toUpperCase());
}

/**
 * Fetch a price using a Yahoo-style ticker (e.g. 'BMW.DE', 'VUSA.L') — translated to
 * Stooq format internally (.DE → .de, .L → .uk, etc.).
 */
async function fetchTickerPrice(ticker) {
  return await stooqLatestClose(ticker);
}

/**
 * OpenFIGI (Bloomberg) maps ISIN → listings (ticker, exchange, name). Free without registration;
 * optional OPENFIGI_API_KEY in env for higher rate limits. Used as a fallback when Stooq doesn't
 * recognize an obscure bond ISIN directly.
 * @see https://www.openfigi.com/api
 */
async function openfigiIsinMappings(isin) {
  const clean = String(isin).trim().toUpperCase();
  if (!looksLikeIsin(clean)) return [];
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.OPENFIGI_API_KEY) {
      headers['X-OPENFIGI-APIKEY'] = process.env.OPENFIGI_API_KEY;
    }
    const res = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers,
      body: JSON.stringify([{ idType: 'ID_ISIN', idValue: clean }])
    });
    if (!res.ok) return [];
    const json = await res.json();
    const first = Array.isArray(json) ? json[0] : null;
    if (!first || first.error) return [];
    return Array.isArray(first.data) ? first.data : [];
  } catch (e) {
    return [];
  }
}

/** Map common OpenFIGI exchCode values to Yahoo-style suffixes (we then translate to Stooq via toStooqSymbol). */
function openfigiExchToSuffixes(exchCode) {
  if (!exchCode || typeof exchCode !== 'string') return [];
  const e = exchCode.toUpperCase();
  const map = {
    XETRA: ['.DE'], XETR: ['.DE'], XET: ['.DE'], GER: ['.DE'],
    GETTEX: ['.DE', '.MU'], XBER: ['.DE'], XMUN: ['.MU'],
    LSE: ['.L'], XLON: ['.L'], SWX: ['.SW'], XSWX: ['.SW'],
    ENXT: ['.PA'], XPAR: ['.PA'], XMAD: ['.MC'],
    XAMS: ['.AS'], XBRU: ['.BR'], XVIE: ['.VI'],
  };
  return map[e] || [];
}

function tickerCandidatesFromOpenfigiRow(row) {
  const candidates = [];
  const t = row && row.ticker;
  if (!t || typeof t !== 'string') return candidates;
  const trimmed = t.trim();
  if (!trimmed) return candidates;
  candidates.push(trimmed);
  if (trimmed.includes(' ')) {
    candidates.push(trimmed.replace(/\s+/g, '-'));
    candidates.push(trimmed.replace(/\s+/g, ''));
    const first = trimmed.split(/\s+/)[0];
    if (first && first.length >= 2 && first !== trimmed) candidates.push(first);
  }
  const suff = openfigiExchToSuffixes(row.exchCode);
  const base = trimmed.split(/\s+/)[0];
  if (base && /^[A-Z0-9.-]{1,20}$/i.test(base)) {
    for (const s of suff) candidates.push(base + s);
  }
  return [...new Set(candidates)];
}

/** ISIN → alternate tickers via OpenFIGI → try each against Stooq. */
async function priceViaOpenfigiIsin(sym, preciousTickers) {
  if (preciousTickers || !looksLikeIsin(sym)) return null;
  const rows = await openfigiIsinMappings(sym);
  for (const row of rows) {
    for (const cand of tickerCandidatesFromOpenfigiRow(row)) {
      const p = await fetchTickerPrice(cand);
      if (p != null && !Number.isNaN(Number(p))) return Number(p);
    }
  }
  return null;
}

/**
 * Fetches current price for a stock, bond (or ISIN), precious metal, or crypto symbol.
 * Stocks/bonds/metals → Stooq; crypto → CoinGecko.
 */
export async function fetchCurrentPrice(symbol, assetType = 'stock') {
  try {
    const effectiveType = (assetType === 'precious') ? 'stock' : assetType;
    if (effectiveType === 'stock' || effectiveType === 'etf' || effectiveType === 'bond') {
      const sym = String(symbol).trim().toUpperCase();
      // Precious metals: Stooq quotes XAU/USD as XAUUSD, XAG/USD as XAGUSD.
      const preciousTickers = sym === 'XAG' ? ['XAGUSD'] : sym === 'XAU' ? ['XAUUSD'] : null;
      // LSE/European symbol routing (kept identical to prior logic — the constant lists are battle-tested).
      const lseGbpEtfs = ['EQQQ', 'IITU', 'VUSA', 'VWRL', 'EIMI', 'VFEM', 'XAIX'];
      const lseUsdEtfs = ['ECAR', 'NVDA', 'META', 'SMSD'];
      const lseUsdStocks = ['LASE'];
      const lseChfEtfs = ['ABBN'];
      const xetraStocks = ['IFX', 'DTE'];
      const madridStocks = ['TEF'];
      const parisStocks = ['MLAA'];
      const tryUsFirst = ['META', 'NVDA'];
      const tryLseFirst = lseGbpEtfs.includes(sym) || lseUsdEtfs.includes(sym) || lseChfEtfs.includes(sym) || lseUsdStocks.includes(sym);
      const isIsin = looksLikeIsin(sym);

      // Tickers in any of the explicit exchange lists are routed deliberately above.
      // If those routings come up null, don't fall through to the last-resort suffix sweep —
      // it can match an unrelated listing on another exchange (e.g. LASE → Laser Photonics on NASDAQ).
      const inExplicitList =
        lseGbpEtfs.includes(sym) || lseUsdEtfs.includes(sym) || lseUsdStocks.includes(sym) ||
        lseChfEtfs.includes(sym) || xetraStocks.includes(sym) || madridStocks.includes(sym) ||
        parisStocks.includes(sym) || tryUsFirst.includes(sym);

      let price = null;
      let usedLseTicker = false;
      if (preciousTickers) {
        for (const t of preciousTickers) {
          price = await fetchTickerPrice(t);
          if (price != null) return price;
        }
        return null;
      } else if (tryUsFirst.includes(sym)) {
        // US listings: Stooq needs explicit .US suffix; bare ticker returns no data.
        price = await fetchTickerPrice(sym + '.US');
        if (price == null) price = await fetchTickerPrice(sym);
        if (price == null) {
          price = await fetchTickerPrice(sym + '.L');
          usedLseTicker = price != null;
        }
      } else if (lseChfEtfs.includes(sym)) {
        price = await fetchTickerPrice(sym + '.SW');
        usedLseTicker = price != null;
        if (price == null) {
          price = await fetchTickerPrice(sym + '.L');
          usedLseTicker = price != null;
        }
        if (price == null) price = await fetchTickerPrice(sym);
      } else if (tryLseFirst) {
        price = await fetchTickerPrice(sym + '.L');
        usedLseTicker = price != null;
        if (price == null) price = await fetchTickerPrice(sym);
      } else if (xetraStocks.includes(sym)) {
        price = await fetchTickerPrice(sym + '.DE');
        if (price == null) price = await fetchTickerPrice(sym);
      } else if (madridStocks.includes(sym)) {
        price = await fetchTickerPrice(sym + '.MC');
        if (price == null) price = await fetchTickerPrice(sym);
      } else if (parisStocks.includes(sym)) {
        price = await fetchTickerPrice(sym + '.PA');
        if (price == null) price = await fetchTickerPrice(sym);
      } else if (/^\d{3,5}$/.test(sym)) {
        // Numeric SEHK codes (e.g. 1211 → Hong Kong)
        price = await fetchTickerPrice(sym + '.HK');
        if (price == null) price = await fetchTickerPrice(sym);
      } else {
        // Default path: try bare, then .US (Stooq's US suffix), then suffix sweep below.
        price = await fetchTickerPrice(sym);
        if (price == null) price = await fetchTickerPrice(sym + '.US');
      }

      // LSE GBP ETFs: Stooq quotes some in pence (e.g. EQQQ=49208), some in pounds (e.g. VUSA=100).
      // Magnitude heuristic: pence range is 1000-50000 for typical retail ETF prices.
      if (price != null && usedLseTicker && lseGbpEtfs.includes(sym) && price >= 1000 && price < 50000) {
        price = price / 100;
      }

      // SMSD GDR multiplier hack: Yahoo price was way below broker price; preserved for parity.
      // Verify against current broker statement before relying on this — Stooq's GDR pricing may differ.
      const SMSD_GDR_MULTIPLIER = 2.06;
      if (price != null && sym === 'SMSD' && usedLseTicker) price = price * SMSD_GDR_MULTIPLIER;

      // LSE CHF (Swiss): convert to EUR for consistent output
      if (price != null && lseChfEtfs.includes(sym)) {
        const chfToEur = await fetchChfToEurRate();
        const CHF_TO_EUR = chfToEur || 0.95;
        price = price * CHF_TO_EUR;
      }

      if (price != null) return price;

      // Last-resort suffix sweep for tickers NOT in any explicit list. Skip .US — too many
      // collisions with unrelated US-listed tickers (e.g. Laser Photonics matching "LASE").
      if (!inExplicitList) {
        const suffixes = ['.L', '.DE', '.PA', '.VI', '.BR', '.SW', '.AS'];
        for (const suffix of suffixes) {
          price = await fetchTickerPrice(sym + suffix);
          if (price != null) return price;
        }
      }

      // ISINs / bonds: resolve via OpenFIGI then try those tickers on Stooq
      if (isIsin || assetType === 'bond') {
        const viaFig = await priceViaOpenfigiIsin(sym, preciousTickers);
        if (viaFig != null) return viaFig;
      }

      return null;
    } else if (assetType === 'crypto') {
      // CoinGecko: free tier, no key. Maps ticker symbols to coin IDs.
      const SYMBOL_TO_COINGECKO_ID = {
        btc: 'bitcoin', eth: 'ethereum', usdt: 'tether', bnb: 'binancecoin', sol: 'solana',
        usdc: 'usd-coin', xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', avax: 'avalanche-2',
        trx: 'tron', dot: 'polkadot', link: 'chainlink', matic: 'matic-network', shib: 'shiba-inu',
        dai: 'dai', ltc: 'litecoin', bch: 'bitcoin-cash', xlm: 'stellar', uni: 'uniswap',
        atom: 'cosmos', etc: 'ethereum-classic', xmr: 'monero', near: 'near', fil: 'filecoin',
        apt: 'aptos', arb: 'arbitrum', op: 'optimism', inj: 'injective-protocol', stx: 'blockstack',
        pepe: 'pepe', wld: 'worldcoin-wld', sui: 'sui', zro: 'layerzero'
      };
      const symbolLower = symbol.toLowerCase();
      const coinId = SYMBOL_TO_COINGECKO_ID[symbolLower] || symbolLower;
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (!response.ok) {
        console.warn(`Failed to fetch crypto price for ${symbol}: ${response.statusText}`);
        return null;
      }
      const data = await response.json();
      const result = data && data[coinId] && data[coinId].usd;
      if (result != null) return result;
      return null;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error.message);
    return null;
  }
}

/** Map a range string ('6mo', '1y', '2y') to days. */
function rangeToDays(range) {
  if (range === '6mo') return 180;
  if (range === '1y') return 365;
  if (range === '2y') return 730;
  return 180;
}

/** Pre-build the list of tickers to try for historical projection, mirroring fetchCurrentPrice. */
function getTickersForHistorical(symbol, assetType) {
  const sym = String(symbol).trim().toUpperCase();
  const effectiveType = (assetType === 'precious') ? 'stock' : assetType;
  if (effectiveType !== 'stock' && effectiveType !== 'etf' && effectiveType !== 'bond') return [sym];

  const preciousTickers = sym === 'XAG' ? ['XAGUSD'] : sym === 'XAU' ? ['XAUUSD'] : null;
  if (preciousTickers) return preciousTickers;

  const lseGbpEtfs = ['EQQQ', 'IITU', 'VUSA', 'VWRL', 'EIMI', 'VFEM', 'XAIX'];
  const lseUsdEtfs = ['ECAR', 'NVDA', 'META', 'SMSD'];
  const lseUsdStocks = ['LASE'];
  const lseChfEtfs = ['ABBN'];
  const xetraStocks = ['IFX', 'DTE'];
  const madridStocks = ['TEF'];
  const parisStocks = ['MLAA'];
  const tryUsFirst = ['META', 'NVDA'];
  const tryLseFirst = lseGbpEtfs.includes(sym) || lseUsdEtfs.includes(sym) || lseChfEtfs.includes(sym) || lseUsdStocks.includes(sym);

  if (tryUsFirst.includes(sym)) return [sym, sym + '.L'];
  if (lseChfEtfs.includes(sym)) return [sym + '.SW', sym + '.L', sym];
  if (xetraStocks.includes(sym)) return [sym + '.DE', sym];
  if (madridStocks.includes(sym)) return [sym + '.MC', sym];
  if (parisStocks.includes(sym)) return [sym + '.PA', sym];
  if (tryLseFirst) return [sym + '.L', sym];
  if (/^\d{3,5}$/.test(sym)) return [sym + '.HK', sym];
  const suffixes = ['.L', '.DE', '.PA', '.VI', '.BR', '.SW', '.AS'];
  return [sym, ...suffixes.map((s) => sym + s)];
}

/**
 * Get a 3-month projected price for a symbol.
 * Stocks/precious: 6mo trend via Stooq daily closes.
 * Crypto: 2y CoinGecko-ID-style trend (via Stooq forex pair like BTCUSD).
 */
export async function getProjectedPrice3M(symbol, currentPrice, assetType = 'stock') {
  if (currentPrice == null || currentPrice <= 0 || Number.isNaN(Number(currentPrice))) return null;
  const price = Number(currentPrice);
  if (assetType === 'crypto') {
    // For crypto, Stooq has BTCUSD, ETHUSD, etc. (forex-style).
    const cryptoSym = `${symbol.toUpperCase()}USD`;
    const closes = await stooqHistoricalCloses(cryptoSym, 730);
    if (closes && closes.length >= 2) {
      const dailyReturns = [];
      for (let i = 1; i < closes.length; i++) {
        const prev = closes[i - 1];
        if (prev > 0) dailyReturns.push((closes[i] - prev) / prev);
      }
      if (dailyReturns.length === 0) return null;
      const fullAvg = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const recentWindow = 30;
      const recentReturns = dailyReturns.length >= recentWindow ? dailyReturns.slice(-recentWindow) : dailyReturns;
      const recentAvg = recentReturns.length > 0 ? recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length : fullAvg;
      const avgDaily = dailyReturns.length >= recentWindow ? 0.6 * recentAvg + 0.4 * fullAvg : fullAvg;
      const projected = price * Math.pow(1 + avgDaily, 90);
      if (projected > 0 && Number.isFinite(projected)) return { projectedPrice: projected, source: 'trend_crypto' };
    }
    return null;
  }

  const sym = String(symbol).trim().toUpperCase();
  let tickersToTry = getTickersForHistorical(symbol, assetType || 'stock');
  if (looksLikeIsin(sym)) {
    const rows = await openfigiIsinMappings(sym);
    const extra = [];
    for (const row of rows) {
      extra.push(...tickerCandidatesFromOpenfigiRow(row));
    }
    if (extra.length > 0) {
      tickersToTry = [...new Set([...tickersToTry, ...extra])];
    }
  }
  let closes = null;
  for (const ticker of tickersToTry) {
    closes = await stooqHistoricalCloses(ticker, rangeToDays('6mo'));
    if (closes && closes.length >= 2) break;
  }
  if (closes && closes.length >= 2) {
    const dailyReturns = [];
    for (let i = 1; i < closes.length; i++) dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    const avgDaily = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const projected = price * Math.pow(1 + avgDaily, 90);
    if (projected > 0 && Number.isFinite(projected)) return { projectedPrice: projected, source: 'trend' };
  }
  return null;
}

/**
 * Fetches current prices for multiple symbols. Stooq has no documented rate limit
 * but we keep small concurrency + a small inter-batch delay to be polite.
 */
export async function fetchMultiplePrices(symbols, assetType = 'stock') {
  const prices = {};
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const batchPromises = batch.map(async (symbol) => {
      const price = await fetchCurrentPrice(symbol, assetType);
      return { symbol, price };
    });
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(({ symbol, price }) => {
      prices[symbol] = price;
    });
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  return prices;
}
