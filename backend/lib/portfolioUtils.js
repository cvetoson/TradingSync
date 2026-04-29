export const LSE_GBP_ETF_SYMBOLS = ['EQQQ', 'IITU', 'VUSA', 'VWRL', 'EIMI', 'VFEM', 'XAIX'];
export const LSE_USD_ETF_SYMBOLS = ['ECAR', 'NVDA', 'META', 'SMSD'];
export const LSE_CHF_SYMBOLS = ['ABBN'];
export const EUR_NATIVE_SYMBOLS = ['IFX', 'TEF', 'MLAA', 'DTE'];

/** Yahoo chart for these is already EUR (e.g. 2B76.DE iShares UCITS); must not apply USD→EUR. */
export function isEurNativeSymbol(sym, assetTypeLower) {
  const s = String(sym || '').trim().toUpperCase();
  if (EUR_NATIVE_SYMBOLS.includes(s)) return true;
  const t = (assetTypeLower || 'stock').toLowerCase();
  if (t === 'bond' || t === 'crypto' || t === 'precious') return false;
  // Pure numeric 3–5 digit symbols (e.g. 1211 SEHK) are not German WKN; WKN is alphanumeric like 2B76.
  if (/^\d{3,5}$/.test(s)) return false;
  return /^[0-9][A-Z0-9]{3}$/.test(s);
}

/** Compute holding value in EUR from raw DB data; applies pence→GBP for LSE European ETFs */
export function holdingValueInEur(h, usdToEur, gbpToEur, hkdToEur) {
  const q = Number(h.quantity) || 0;
  let p = Number(h.current_price) ?? Number(h.purchase_price) ?? 0;
  const sym = String(h.symbol || '').trim().toUpperCase();
  const assetT = (h.asset_type || h.assetType || 'stock').toLowerCase();
  let currency = isEurNativeSymbol(sym, assetT) ? 'EUR' : (h.currency || 'EUR').toUpperCase();
  if (sym.endsWith('.HK')) currency = 'HKD';
  const isPence = LSE_GBP_ETF_SYMBOLS.includes(sym) && p >= 1000 && p < 50000;
  const isUsdLseEtf = LSE_USD_ETF_SYMBOLS.includes(sym);
  if (isPence) p = p / 100;
  let value = q * p;
  const hk = hkdToEur != null && hkdToEur > 0 ? hkdToEur : 0.11;
  if (currency === 'USD' || isUsdLseEtf) value *= usdToEur;
  else if (currency === 'GBP' || isPence) value *= gbpToEur;
  else if (currency === 'HKD') value *= hk;
  return value;
}

/** Compute cost basis in EUR from purchase_price. Returns null when cost basis is unknown. */
export function holdingPurchaseCostInEur(h, usdToEur, gbpToEur, hkdToEur) {
  const q = Number(h.quantity) || 0;
  let p = h.purchase_price != null ? Number(h.purchase_price) : null;
  if (!q || p == null || Number.isNaN(p) || p <= 0) return null;
  const sym = String(h.symbol || '').trim().toUpperCase();
  const assetT = (h.asset_type || h.assetType || 'stock').toLowerCase();
  let currency = isEurNativeSymbol(sym, assetT) ? 'EUR' : (h.currency || 'EUR').toUpperCase();
  if (sym.endsWith('.HK')) currency = 'HKD';
  const isPence = LSE_GBP_ETF_SYMBOLS.includes(sym) && p >= 1000 && p < 50000;
  const isUsdLseEtf = LSE_USD_ETF_SYMBOLS.includes(sym);
  if (isPence) p = p / 100;
  let value = q * p;
  const hk = hkdToEur != null && hkdToEur > 0 ? hkdToEur : 0.11;
  if (currency === 'USD' || isUsdLseEtf) value *= usdToEur;
  else if (currency === 'GBP' || isPence) value *= gbpToEur;
  else if (currency === 'HKD') value *= hk;
  return value;
}

/** P2P/savings: parse balanceAsOfDate / investmentDate to YYYY-MM-DD */
export function parseBalanceAsOfIso(accountData) {
  if (!accountData) return null;
  const explicit = accountData.balanceAsOfDate || accountData.balance_as_of_date;
  if (explicit) {
    const s = String(explicit).trim();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
      const [day, month, year] = s.split('.');
      return `${year}-${month}-${day}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  const inv = accountData.investmentDate;
  if (inv && /^\d{4}-\d{2}-\d{2}$/.test(String(inv).trim())) return String(inv).trim();
  return null;
}

export function isPastCalendarDate(isoYmd) {
  if (!isoYmd) return false;
  const d = new Date(`${isoYmd}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

/** Compound APY from as-of date (inclusive start) to now (inclusive end-of-day). */
export function compoundP2PToNow(baseBalance, annualRatePct, fromIsoYmd) {
  if (baseBalance == null || annualRatePct == null || !fromIsoYmd) return baseBalance;
  const from = new Date(`${fromIsoYmd}T12:00:00`);
  const to = new Date();
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.floor((to - from) / 86400000));
  const r = annualRatePct / 100;
  return baseBalance * Math.pow(1 + r, days / 365);
}

export function isP2pOrSavingsType(t) {
  const u = (t || '').toLowerCase();
  return u === 'p2p' || u === 'savings';
}

/** Best-effort asset type inference when AI/symbol lookup is incomplete. */
export function inferAssetType(holding) {
  const sym = String(holding?.symbol || '').trim().toUpperCase();
  if (sym === 'XAG' || sym === 'XAU') return 'precious';
  const explicit = String(holding?.assetType || holding?.asset_type || '').trim().toLowerCase();
  if (explicit) return explicit;
  const text = `${holding?.name || ''} ${holding?.title || ''} ${holding?.symbol || ''}`.toLowerCase();
  if (/\b(etf|ucits|index fund|exchange traded fund)\b/.test(text)) return 'etf';
  if (/\b(ishares|vanguard|invesco|xtrackers|lyxor|amundi|wisdomtree|spdr)\b/.test(text)) return 'etf';
  if (/\b(bond|treasury|note|sovereign|corp(?:orate)?)\b/.test(text)) return 'bond';
  if (/\b(bitcoin|ethereum|solana|ripple|crypto|coin)\b/.test(text)) return 'crypto';
  return 'stock';
}

/** Parse locale-friendly numeric amount (supports 1,234.56 and 1.234,56). */
export function parseFlexibleNumberInput(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  const s = String(raw).trim().replace(/\s/g, '').replace(/ /g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(s.replace(/,/g, ''));
  }
  if (lastComma !== -1) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2 && parts[0].length > 0) {
      return parseFloat(`${parts[0].replace(/\./g, '')}.${parts[1]}`);
    }
    return parseFloat(s.replace(/,/g, ''));
  }
  if (lastDot !== -1 && lastComma === -1) {
    const parts = s.split('.');
    if (parts.length > 1 && parts.every((p) => /^\d+$/.test(p))) {
      if (parts.length === 2) {
        const a = parts[0];
        const b = parts[1];
        if (b.length <= 2) return parseFloat(`${a}.${b}`);
        if (b.length === 3 && a.length <= 3) return parseFloat(a + b);
        return parseFloat(s);
      }
      const lastSeg = parts[parts.length - 1];
      if (lastSeg.length <= 2) {
        return parseFloat(parts.slice(0, -1).join('') + '.' + lastSeg);
      }
      return parseFloat(parts.join(''));
    }
  }
  return parseFloat(s);
}

/** DB drivers may return DOUBLE PRECISION as string; avoid string + number bugs in totals. */
export function coerceFiniteNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const MAX_SANE_HISTORY_BALANCE = 1e12;

/** Drop corrupted snapshot balances so Value History change/% stays meaningful (~€1T ceiling per row). */
export function sanitizeHistoryBalance(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > MAX_SANE_HISTORY_BALANCE) return null;
  return n;
}

/**
 * If AI provided a statement date in the past, treat extracted balance as that date and project to today.
 * @returns {{ accountBalance: number, historyBalance: number, recordedAt: string }}
 */
export function resolveP2pSnapshotFromUpload(accountData, extractedBalance, interestRate, finalAccountType) {
  const b = Number(extractedBalance);
  if (!isP2pOrSavingsType(finalAccountType) || interestRate == null || !Number.isFinite(b) || b <= 0) {
    return { accountBalance: b, historyBalance: b, recordedAt: new Date().toISOString() };
  }
  const asOf = parseBalanceAsOfIso(accountData);
  if (!asOf || !isPastCalendarDate(asOf)) {
    return { accountBalance: b, historyBalance: b, recordedAt: new Date().toISOString() };
  }
  const projected = compoundP2PToNow(b, interestRate, asOf);
  return {
    accountBalance: projected,
    historyBalance: b,
    recordedAt: `${asOf}T12:00:00.000Z`
  };
}
