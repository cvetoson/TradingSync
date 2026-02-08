/**
 * Market Data Service
 * Fetches current prices for stocks, bonds (including ISIN), and cryptocurrencies
 */

const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; TradingSync/1.0)' };

function looksLikeIsin(s) {
  return /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(String(s).trim().toUpperCase());
}

/**
 * Resolve ISIN or name to a Yahoo ticker via search API
 */
async function yahooSearchTicker(query) {
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
 * Fetch price from Yahoo chart API for a given ticker
 */
async function yahooChartPrice(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: YAHOO_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart && data.chart.result && data.chart.result[0];
    if (result && result.meta && result.meta.regularMarketPrice != null) {
      return result.meta.regularMarketPrice;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/** Optional: Finnhub bond price by ISIN (set FINNHUB_API_KEY in env). Free tier. */
async function finnhubBondPrice(isin) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token || !isin) return null;
  try {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);
    const url = `https://finnhub.io/api/v1/bond/price?isin=${encodeURIComponent(isin)}&from=${fromStr}&to=${toStr}&token=${token}`;
    const res = await fetch(url, { headers: YAHOO_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const last = data[data.length - 1];
      const p = last.price ?? last.close ?? last.p;
      if (typeof p === 'number' && !Number.isNaN(p)) return p;
    }
    if (typeof data.price === 'number') return data.price;
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
    if (assetType === 'stock' || assetType === 'etf' || assetType === 'bond') {
      const sym = String(symbol).trim();
      let ticker = sym;
      const isIsin = looksLikeIsin(sym);

      if (isIsin || assetType === 'bond') {
        const resolved = await yahooSearchTicker(sym);
        if (resolved) ticker = resolved;
      }

      let price = await yahooChartPrice(ticker);
      if (price != null) return price;

      if (ticker !== sym) return null;

      const suffixes = ['.L', '.DE', '.PA', '.VI', '.BR', '.SW', '.AS'];
      for (const suffix of suffixes) {
        price = await yahooChartPrice(sym + suffix);
        if (price != null) return price;
      }

      if (isIsin) {
        const finnhubPrice = await finnhubBondPrice(sym);
        if (finnhubPrice != null) return finnhubPrice;
      }

      return null;
    } else if (assetType === 'crypto') {
      // For crypto, use CoinGecko API (free tier)
      const symbolLower = symbol.toLowerCase();
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbolLower}&vs_currencies=usd`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        }
      );

      if (!response.ok) {
        console.warn(`Failed to fetch crypto price for ${symbol}: ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      if (data[symbolLower] && data[symbolLower].usd) {
        return data[symbolLower].usd;
      }

      return null;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error.message);
    return null;
  }
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
