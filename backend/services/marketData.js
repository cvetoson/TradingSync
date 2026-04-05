/**
 * Market Data Service
 * Fetches current prices for stocks, bonds (including ISIN), and cryptocurrencies
 */

const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; TradingSync/3.0)' };

function looksLikeIsin(s) {
  return /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(String(s).trim().toUpperCase());
}

/**
 * Resolve ISIN or name to a Yahoo ticker via search API
 */
export async function yahooSearchTicker(query) {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0`;
    const res = await fetch(url, { headers: YAHOO_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const quote = data.quotes && data.quotes[0];
    if (quote && quote.symbol) return quote.symbol;
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch price (and optionally currency) from Yahoo chart API for a given ticker
 * @returns {number|null} price, or { price, currency } when withMeta=true
 */
/**
 * OpenFIGI (Bloomberg) maps ISIN → listings (ticker, exchange, name). Free without registration;
 * optional OPENFIGI_API_KEY in env for higher rate limits. Does not replace a price vendor — we only
 * use it to discover Yahoo-compatible tickers Yahoo search missed.
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

/** Map common OpenFIGI exchCode values to Yahoo suffixes to try (best-effort). */
function openfigiExchToYahooSuffixes(exchCode) {
  if (!exchCode || typeof exchCode !== 'string') return [];
  const e = exchCode.toUpperCase();
  const map = {
    XETRA: ['.DE'],
    XETR: ['.DE'],
    XET: ['.DE'],
    GER: ['.DE'],
    GETTEX: ['.DE', '.MU'],
    XBER: ['.DE'],
    XMUN: ['.MU'],
    LSE: ['.L'],
    XLON: ['.L'],
    SWX: ['.SW'],
    XSWX: ['.SW'],
    ENXT: ['.PA'],
    XPAR: ['.PA'],
    XMAD: ['.MC'],
    XAMS: ['.AS'],
    XBRU: ['.BR'],
    XVIE: ['.VI']
  };
  return map[e] || [];
}

/**
 * Yahoo chart candidates from one OpenFIGI row (bond tickers often contain spaces).
 */
function yahooTickerCandidatesFromOpenfigiRow(row) {
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
  const suff = openfigiExchToYahooSuffixes(row.exchCode);
  const base = trimmed.split(/\s+/)[0];
  if (base && /^[A-Z0-9.-]{1,20}$/i.test(base)) {
    for (const s of suff) candidates.push(base + s);
  }
  return [...new Set(candidates)];
}

/**
 * After Yahoo search + chart + suffix sweep failed: try OpenFIGI ISIN → alternate tickers → Yahoo chart.
 */
async function yahooPriceViaOpenfigiIsin(sym, preciousTickers) {
  if (preciousTickers || !looksLikeIsin(sym)) return null;
  const rows = await openfigiIsinMappings(sym);
  for (const row of rows) {
    for (const cand of yahooTickerCandidatesFromOpenfigiRow(row)) {
      const p = await yahooChartPrice(cand);
      if (p != null && !Number.isNaN(Number(p))) return Number(p);
    }
    if (row.name && typeof row.name === 'string') {
      const resolved = await yahooSearchTicker(row.name);
      if (resolved) {
        const p = await yahooChartPrice(resolved);
        if (p != null && !Number.isNaN(Number(p))) return Number(p);
      }
    }
  }
  return null;
}

async function yahooChartPrice(ticker, withMeta = false) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: YAHOO_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart && data.chart.result && data.chart.result[0];
    if (result && result.meta && result.meta.regularMarketPrice != null) {
      const price = result.meta.regularMarketPrice;
      const currency = (result.meta.currency || '').toUpperCase() || null;
      if (withMeta) return { price, currency: currency || null };
      return price;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch current USD to EUR rate from Yahoo (USDEUR=X = EUR per 1 USD).
 * Used for XAG/XAU and other USD→EUR conversions so values match Yahoo/Revolut.
 */
export async function fetchUsdToEurRate() {
  try {
    const rate = await yahooChartPrice('USDEUR=X');
    if (rate != null && rate > 0.5 && rate < 1.5) return rate;
    return null;
  } catch (e) {
    return null;
  }
}

/** Fetch GBP to EUR rate (GBPEUR=X = EUR per 1 GBP). Used for LSE holdings. */
export async function fetchGbpToEurRate() {
  try {
    const rate = await yahooChartPrice('GBPEUR=X');
    if (rate != null && rate > 0.9 && rate < 1.5) return rate;
    return null;
  } catch (e) {
    return null;
  }
}

/** Fetch CHF to EUR rate (CHFEUR=X = EUR per 1 CHF). Used for Swiss stocks (ABB). */
export async function fetchChfToEurRate() {
  try {
    const rate = await yahooChartPrice('CHFEUR=X');
    if (rate != null && rate > 0.8 && rate < 1.2) return rate;
    return null;
  } catch (e) {
    return null;
  }
}

/** Fetch HKD to EUR rate (HKDEUR=X = EUR per 1 HKD). Used for Hong Kong listings (e.g. 1211.HK). */
export async function fetchHkdToEurRate() {
  try {
    const rate = await yahooChartPrice('HKDEUR=X');
    if (rate != null && rate > 0.05 && rate < 0.2) return rate;
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Fetches current price for a stock, bond (or ISIN), or crypto symbol
 * Uses Yahoo Finance API (free). For ISINs/bonds, tries search then chart.
 */
export async function fetchCurrentPrice(symbol, assetType = 'stock') {
  try {
    const effectiveType = (assetType === 'precious') ? 'stock' : assetType;
    if (effectiveType === 'stock' || effectiveType === 'etf' || effectiveType === 'bond') {
      const sym = String(symbol).trim().toUpperCase();
      // Precious metals: try spot then futures (Yahoo chart often has SI=F, GC=F)
      const preciousTickers = sym === 'XAG' ? ['XAGUSD', 'SI=F'] : sym === 'XAU' ? ['XAUUSD', 'GC=F'] : null;
      // LSE/European symbols: single config for currency. ABBN = Swiss (CHF), try .SW first.
      const lseGbpEtfs = ['EQQQ', 'IITU', 'VUSA', 'VWRL', 'EIMI', 'VFEM', 'XAIX'];
      const lseUsdEtfs = ['ECAR', 'NVDA', 'META', 'SMSD']; // USD on LSE
      const lseUsdStocks = ['LASE']; // Try .L first (Revolut may quote LSE)
      const lseChfEtfs = ['ABBN']; // Swiss stocks, try .SW first for CHF
      // XETRA/IBIS: plain "DTE" hits US DTE Energy (~$150); DTE.DE is Deutsche Telekom (~€31).
      const xetraStocks = ['IFX', 'DTE'];
      const madridStocks = ['TEF']; // Madrid - try .MC first (Telefonica etc.)
      const parisStocks = ['MLAA']; // Paris - try .PA first (L'Agence Automobiliere etc.)
      const tryUsFirst = ['META', 'NVDA'];
      const tryLseFirst = lseGbpEtfs.includes(sym) || lseUsdEtfs.includes(sym) || lseChfEtfs.includes(sym) || lseUsdStocks.includes(sym);
      let ticker = preciousTickers ? preciousTickers[0] : sym;
      const isIsin = looksLikeIsin(sym);

      if ((isIsin || assetType === 'bond') && !preciousTickers) {
        const resolved = await yahooSearchTicker(sym);
        if (resolved) ticker = resolved;
      }

      // Numeric-only symbols (e.g. 1211 on SEHK): Yahoo search resolves to the correct listing (1211.HK)
      if (!isIsin && assetType !== 'bond' && !preciousTickers && /^\d{3,5}$/.test(sym)) {
        const resolved = await yahooSearchTicker(sym);
        if (resolved) ticker = resolved;
      }

      let price = null;
      let usedLseTicker = false;
      if (tryUsFirst.includes(sym) && !preciousTickers) {
        price = await yahooChartPrice(sym);
        if (price == null) {
          price = await yahooChartPrice(sym + '.L');
          usedLseTicker = price != null;
        }
      } else if (lseChfEtfs.includes(sym) && !preciousTickers) {
        price = await yahooChartPrice(sym + '.SW');
        usedLseTicker = price != null;
        if (price == null) {
          price = await yahooChartPrice(sym + '.L');
          usedLseTicker = price != null;
        }
        if (price == null) price = await yahooChartPrice(sym);
      } else if (tryLseFirst && !preciousTickers) {
        price = await yahooChartPrice(sym + '.L');
        usedLseTicker = price != null;
        if (price == null) price = await yahooChartPrice(sym);
      } else if (xetraStocks.includes(sym) && !preciousTickers) {
        price = await yahooChartPrice(sym + '.DE');
        if (price == null) price = await yahooChartPrice(sym);
      } else if (madridStocks.includes(sym) && !preciousTickers) {
        price = await yahooChartPrice(sym + '.MC');
        if (price == null) price = await yahooChartPrice(sym);
      } else if (parisStocks.includes(sym) && !preciousTickers) {
        price = await yahooChartPrice(sym + '.PA');
        if (price == null) price = await yahooChartPrice(sym);
      } else {
        price = await yahooChartPrice(ticker);
      }
      // LSE GBP ETFs: Yahoo returns pence (1000-50000) for most; 10-1000 is often GBP. Only divide when clearly pence.
      if (price != null && usedLseTicker && lseGbpEtfs.includes(sym) && price >= 1000 && price < 50000) price = price / 100;
      // SMSD.L (Samsung GDR): Yahoo price ~1072 vs broker ~2205 USD/GDR; multiplier 2205/1072≈2.06 so 0.115*price→€213
      const SMSD_GDR_MULTIPLIER = 2.06;
      if (price != null && sym === 'SMSD' && usedLseTicker) price = price * SMSD_GDR_MULTIPLIER;
      // LSE CHF (Swiss): convert to EUR for consistent output
      if (price != null && lseChfEtfs.includes(sym)) {
        const chfToEur = await fetchChfToEurRate();
        const CHF_TO_EUR = chfToEur || 0.95;
        price = price * CHF_TO_EUR;
      }
      if (price != null && preciousTickers) return price;
      for (let i = 1; price == null && preciousTickers && i < preciousTickers.length; i++) {
        price = await yahooChartPrice(preciousTickers[i]);
      }
      if (price != null) return price;

      if (preciousTickers) return null;

      const suffixes = ['.L', '.DE', '.PA', '.VI', '.BR', '.SW', '.AS'];
      for (const suffix of suffixes) {
        price = await yahooChartPrice(sym + suffix);
        // LSE GBP ETFs: pence (1000-50000) to GBP; 10-1000 is already GBP
        if (price != null && suffix === '.L' && lseGbpEtfs.includes(sym) && price >= 1000 && price < 50000) price = price / 100;
        if (price != null) return price;
      }

      if (price == null) {
        const viaFig = await yahooPriceViaOpenfigiIsin(sym, preciousTickers);
        if (viaFig != null) return viaFig;
      }

      return null;
    } else if (assetType === 'crypto') {
      // For crypto, use CoinGecko API (free tier). CoinGecko uses coin IDs (e.g. bitcoin) not symbols (btc).
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

/**
 * Fetch historical daily close prices from Yahoo (for trend-based projection)
 * @param {string} ticker - Yahoo ticker symbol
 * @param {string} range - '6mo', '1y', or '2y'
 * @returns {Promise<number[]|null>} array of closing prices (oldest first) or null
 */
async function yahooHistoricalCloses(ticker, range = '6mo') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
    const res = await fetch(url, { headers: YAHOO_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart && data.chart.result && data.chart.result[0];
    if (!result) return null;
    const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
    const closes = quote && quote.close;
    if (!Array.isArray(closes)) return null;
    const valid = closes.filter((c) => c != null && !Number.isNaN(c));
    return valid.length >= 2 ? valid : null;
  } catch (e) {
    return null;
  }
}

/**
 * Get Yahoo tickers to try for historical data (matches fetchCurrentPrice resolution).
 * LSE/European symbols need .L, .SW etc. or Yahoo returns no data → flat projection.
 */
function getTickersForHistorical(symbol, assetType) {
  const sym = String(symbol).trim().toUpperCase();
  const effectiveType = (assetType === 'precious') ? 'stock' : assetType;
  if (effectiveType !== 'stock' && effectiveType !== 'etf' && effectiveType !== 'bond') return [sym];

  const preciousTickers = sym === 'XAG' ? ['XAGUSD', 'SI=F'] : sym === 'XAU' ? ['XAUUSD', 'GC=F'] : null;
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
  const suffixes = ['.L', '.DE', '.PA', '.VI', '.BR', '.SW', '.AS'];
  return [sym, ...suffixes.map((s) => sym + s)];
}

/**
 * Get a 3-month projected price for a symbol (for chart projection).
 * Uses Yahoo Finance and CoinGecko only (no API keys).
 * Crypto: 2y Yahoo history, 60% recent (last 30d) + 40% full-history average daily return.
 * Stocks/precious: 6mo Yahoo trend. Uses same ticker resolution as fetchCurrentPrice (LSE .L, .SW, etc.).
 * @returns {{ projectedPrice: number, source: 'trend'|'trend_crypto' }|null}
 */
export async function getProjectedPrice3M(symbol, currentPrice, assetType = 'stock') {
  if (currentPrice == null || currentPrice <= 0 || Number.isNaN(Number(currentPrice))) return null;
  const price = Number(currentPrice);
  if (assetType === 'crypto') {
    const cryptoYahoo = symbol.includes('-') ? symbol : `${symbol.toUpperCase()}-USD`;
    const closes = await yahooHistoricalCloses(cryptoYahoo, '2y');
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
  const isIsin = looksLikeIsin(sym);
  let tickersToTry = getTickersForHistorical(symbol, assetType || 'stock');
  if ((isIsin || assetType === 'bond') && tickersToTry.length === 1 && tickersToTry[0] === sym) {
    const resolved = await yahooSearchTicker(sym);
    if (resolved) tickersToTry = [resolved, sym];
  }
  if (/^\d{3,5}$/.test(sym) && tickersToTry[0] === sym) {
    const resolved = await yahooSearchTicker(sym);
    if (resolved) tickersToTry = [resolved, ...tickersToTry.filter((t) => t !== resolved)];
  }
  if (looksLikeIsin(sym)) {
    const rows = await openfigiIsinMappings(sym);
    const extra = [];
    for (const row of rows) {
      extra.push(...yahooTickerCandidatesFromOpenfigiRow(row));
    }
    if (extra.length > 0) {
      tickersToTry = [...new Set([...tickersToTry, ...extra])];
    }
  }
  let closes = null;
  for (const ticker of tickersToTry) {
    closes = await yahooHistoricalCloses(ticker, '6mo');
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
 * Fetches current prices for multiple symbols at once
 */
export async function fetchMultiplePrices(symbols, assetType = 'stock') {
  const prices = {};
  
  // Fetch prices in parallel (but limit concurrency to avoid rate limits)
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
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return prices;
}
