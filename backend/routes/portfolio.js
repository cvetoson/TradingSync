import { getDatabase } from '../database.js';
import { analyzeScreenshot } from '../services/aiService.js';
import { calculatePortfolioValue } from '../services/calculations.js';
import { fetchCurrentPrice, getProjectedPrice3M, fetchUsdToEurRate, fetchGbpToEurRate } from '../services/marketData.js';

const LSE_GBP_ETF_SYMBOLS = ['EQQQ', 'IITU', 'VUSA', 'VWRL', 'EIMI', 'VFEM', 'XAIX'];
const LSE_USD_ETF_SYMBOLS = ['ECAR', 'NVDA', 'META', 'SMSD'];
const LSE_CHF_SYMBOLS = ['ABBN']; // Swiss stocks; marketData returns EUR (CHF converted)
const EUR_NATIVE_SYMBOLS = ['IFX', 'TEF', 'MLAA']; // XETRA/Madrid/Paris - Yahoo returns EUR, do NOT convert

/** Promise wrapper for db.run so we can await DB writes before returning */
function dbRun(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

/** Compute holding value in EUR from raw DB data; applies pence→GBP for LSE European ETFs */
function holdingValueInEur(h, usdToEur, gbpToEur) {
  const q = Number(h.quantity) || 0;
  let p = Number(h.current_price) ?? Number(h.purchase_price) ?? 0;
  const sym = String(h.symbol || '').trim().toUpperCase();
  const currency = EUR_NATIVE_SYMBOLS.includes(sym) ? 'EUR' : (h.currency || 'EUR').toUpperCase();
  const isPence = LSE_GBP_ETF_SYMBOLS.includes(sym) && p >= 1000 && p < 50000;
  const isUsdLseEtf = LSE_USD_ETF_SYMBOLS.includes(sym);
  if (isPence) p = p / 100;
  let value = q * p;
  if (currency === 'USD' || isUsdLseEtf) value *= usdToEur;
  else if (currency === 'GBP' || isPence) value *= gbpToEur;
  return value;
}

/**
 * Generates daily calculated history entries for P2P accounts from upload date to today
 * This calculates what the balance should be each day based on interest rate
 */
function generateDailyHistoryForAccount(accountId, uploadBalance, interestRate, currency) {
  const db = getDatabase();
  const interestRateDecimal = interestRate / 100;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get the most recent history entry to find the upload date
  db.get(
    'SELECT * FROM account_history WHERE account_id = ? ORDER BY recorded_at DESC LIMIT 1',
    [accountId],
    (err, lastEntry) => {
      if (err || !lastEntry) return;
      
      const uploadDate = new Date(lastEntry.recorded_at);
      uploadDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((today - uploadDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 0) return; // No days to calculate
      
      // Generate entries for each day from upload date to today (excluding upload day itself)
      for (let day = 1; day <= daysDiff; day++) {
        const date = new Date(uploadDate);
        date.setDate(date.getDate() + day);
        date.setHours(12, 0, 0, 0);
        
        // Calculate forward using compound interest: value = base_value * (1 + rate)^(days/365)
        const calculatedBalance = uploadBalance * Math.pow(1 + interestRateDecimal, day / 365);
        
        // Check if entry for this date already exists
        db.get(
          'SELECT id FROM account_history WHERE account_id = ? AND DATE(recorded_at) = DATE(?)',
          [accountId, date.toISOString()],
          (checkErr, existing) => {
            if (!existing) {
              // Insert calculated entry
              db.run(
                'INSERT INTO account_history (account_id, balance, interest_rate, currency, recorded_at) VALUES (?, ?, ?, ?, ?)',
                [accountId, calculatedBalance, interestRate, currency, date.toISOString()],
                () => {} // Silent insert
              );
            }
          }
        );
      }
    }
  );
}

// Deduplicate holdings by symbol (merge quantities and values; keep one entry per symbol)
function deduplicateHoldings(holdings) {
  const bySymbol = new Map();
  for (const h of holdings || []) {
    const sym = (h.symbol || '').trim().toUpperCase();
    if (!sym) continue;
    const existing = bySymbol.get(sym);
    if (!existing) {
      bySymbol.set(sym, { ...h, symbol: (h.symbol || '').trim() });
      continue;
    }
    const q1 = parseFloat(existing.quantity) || 0;
    const q2 = parseFloat(h.quantity) || 0;
    const v1 = parseFloat(existing.currentValue ?? existing.current_value ?? existing.value ?? existing.amount) || 0;
    const v2 = parseFloat(h.currentValue ?? h.current_value ?? h.value ?? h.amount) || 0;
    existing.quantity = q1 + q2;
    if (v1 + v2 > 0) existing.currentValue = v1 + v2;
    if (existing.currentValue) existing.current_value = existing.currentValue;
  }
  return Array.from(bySymbol.values());
}

// Shared insert logic for holdings (used by saveHoldings and saveHoldingsMerge)
function insertHoldings(db, accountId, holdings, currency, resolve, reject) {
  const deduped = deduplicateHoldings(holdings);
  let insertedCount = 0;
  let errorOccurred = false;
  const totalHoldings = deduped.length;
  deduped.forEach((holding) => {
    if (errorOccurred) return;
    const symbol = holding.symbol;
    if (!symbol) {
      insertedCount++;
      if (insertedCount === totalHoldings) resolve();
      return;
    }
    const rawCurrentValue = holding.currentValue ?? holding.current_value ?? holding.value ?? holding.amount;
    const currentValueNum = rawCurrentValue != null ? parseFloat(rawCurrentValue) : null;
    let quantity = parseFloat(holding.quantity) || 0;
    let purchasePrice = holding.purchasePrice ? parseFloat(holding.purchasePrice) : (holding.purchase_price != null ? parseFloat(holding.purchase_price) : null);
    let currentPrice = holding.currentPrice ? parseFloat(holding.currentPrice) : (holding.current_price != null ? parseFloat(holding.current_price) : null);
    const symUpper = (symbol || '').toUpperCase();
    const assetType = (symUpper === 'XAG' || symUpper === 'XAU') ? 'precious' : (holding.assetType || holding.asset_type || 'stock');
    const holdingCurrency = holding.currency || currency || 'EUR';
    if (currentValueNum != null && !isNaN(currentValueNum)) {
      const totalValue = currentValueNum;
      if (symbol === 'CASH' || symbol === 'CASH_BALANCE' || symbol.toUpperCase().includes('CASH')) {
        quantity = 1;
        currentPrice = totalValue;
        purchasePrice = totalValue;
      } else {
        if (quantity > 0) {
          const calculatedPrice = totalValue / quantity;
          currentPrice = calculatedPrice;
          if (purchasePrice == null) purchasePrice = calculatedPrice;
        } else {
          quantity = 1;
          currentPrice = totalValue;
          if (purchasePrice == null) purchasePrice = totalValue;
        }
      }
    } else if (currentPrice != null && !isNaN(currentPrice)) {
      if (purchasePrice == null) purchasePrice = currentPrice;
      if (quantity <= 0) quantity = 1;
    } else if (!currentPrice && quantity > 0 && purchasePrice != null) {
      currentPrice = purchasePrice;
    }
    db.run(
      `INSERT INTO holdings (account_id, symbol, quantity, purchase_price, current_price, currency, asset_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [accountId, symbol, quantity, purchasePrice, currentPrice, holdingCurrency, assetType],
      (insertErr) => {
        if (insertErr) {
          errorOccurred = true;
          reject(insertErr);
          return;
        }
        insertedCount++;
        if (insertedCount === totalHoldings) resolve();
      }
    );
  });
}

// Helper function to save holdings for an account (replaces existing)
function saveHoldings(accountId, holdings, currency) {
  if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
    return Promise.resolve();
  }
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('saveHoldings timeout')), 10000);
    db.run('DELETE FROM holdings WHERE account_id = ?', [accountId], (deleteErr) => {
      clearTimeout(timeout);
      if (deleteErr) {
        reject(deleteErr);
        return;
      }
      try {
        insertHoldings(db, accountId, holdings, currency, resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Helper: add holdings to account without deleting existing (merge mode)
function saveHoldingsMerge(accountId, holdings, currency) {
  if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
    return Promise.resolve();
  }
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    try {
      insertHoldings(db, accountId, holdings, currency, resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}

// Helper function to detect account type (same as in aiService)
function detectAccountType(platform) {
  const platformLower = (platform || '').toLowerCase();
  if (platformLower.includes('bondora') || platformLower.includes('iuvo') || platformLower.includes('moneyfit')) {
    return 'p2p';
  }
  if (platformLower.includes('trading') || platformLower.includes('ibkr')) {
    return 'stocks';
  }
  if (platformLower.includes('revolut') || platformLower.includes('ledger')) {
    return 'crypto';
  }
  if (platformLower.includes('gold') || platformLower.includes('silver') || platformLower.includes('xag') || platformLower.includes('xau') || platformLower.includes('precious')) {
    return 'precious';
  }
  if (platformLower.includes('bank') || platformLower.includes('savings')) {
    return 'savings';
  }
  return 'unknown';
}

// Upload screenshot and extract data
export async function uploadScreenshot(req, res) {
  try {
    console.log('[UPLOAD] Starting upload process');
    if (!req.file) {
      console.error('[UPLOAD] No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const investmentCategory = req.body.investmentCategory || 'unknown';
    let accountType = req.body.accountType || null;
    console.log('[UPLOAD] File path:', filePath, 'Category:', investmentCategory, 'Type:', accountType);
    
    // Map investment category to a display name
    const categoryDisplayNames = {
      'auto': 'Auto Detect',
      'p2p': 'P2P Lending',
      'equities': 'ETF & Stocks',
      'crypto': 'Cryptocurrency',
      'precious': 'Gold & Silver',
      'savings': 'Savings & Deposits',
      'fixed-income': 'Fixed Income & Bonds',
      'alternative': 'Alternative Investments'
    };
    const platform = categoryDisplayNames[investmentCategory] || investmentCategory;

    // If auto-detect or no accountType provided, let AI determine it
    // Otherwise use the provided accountType
    const aiAccountType = (investmentCategory === 'auto' || !accountType) ? null : accountType;

    // Analyze screenshot with AI
    console.log('[UPLOAD] Analyzing screenshot with AI...');
    const extractedData = await analyzeScreenshot(filePath, platform, aiAccountType);
    console.log('[UPLOAD] AI extraction complete. Accounts:', extractedData?.accounts?.length || 0, 'Holdings:', extractedData?.holdings?.length || 0);

    if (!extractedData) {
      console.error('[UPLOAD] Failed to extract data from screenshot');
      return res.status(500).json({ error: 'Failed to extract data from screenshot' });
    }

    // Check if extraction failed due to API key error
    if (extractedData.error && (extractedData.error.includes('401') || extractedData.error.includes('API key'))) {
      return res.status(500).json({ 
        error: 'OpenAI API key is invalid or expired',
        details: 'Please update your API key in backend/.env file. Get a new key at https://platform.openai.com/api-keys',
        extractedData: extractedData
      });
    }

    const db = getDatabase();
    const accounts = extractedData.accounts || [];
    const currency = extractedData.currency || 'EUR';
    // Use provided accountType, or from extracted data, or fallback to 'unknown'
    const defaultAccountType = accountType || 'unknown';

    // Process each account separately
    return new Promise((resolve, reject) => {
      const createdAccounts = [];
      let processedCount = 0;
      const totalAccounts = accounts.length;

      if (totalAccounts === 0) {
        return res.status(400).json({ error: 'No accounts found in screenshot' });
      }

      accounts.forEach((accountData, index) => {
        // Use detected platform name from AI, or fallback to category display name
        const detectedPlatform = extractedData.platform || platform;
        const accountName = accountData.accountName || `${detectedPlatform} ${index + 1}`;
        const balance = accountData.balance || 0;
        const interestRate = accountData.interestRate || null;
        // Use provided accountType from request, or from extracted data, or fallback to detection
        const finalAccountType = accountData.accountType || defaultAccountType || detectAccountType(detectedPlatform);

        // Check if this specific account already exists
        db.get(
          'SELECT * FROM accounts WHERE platform = ? AND account_name = ? ORDER BY last_updated DESC LIMIT 1',
          [detectedPlatform, accountName],
          (err, existingAccount) => {
            if (err) {
              reject(err);
              return;
            }

            if (existingAccount) {
              // Update existing account
              db.run(
                `UPDATE accounts 
                 SET balance = ?, interest_rate = ?, account_type = ?, 
                     last_updated = CURRENT_TIMESTAMP, screenshot_path = ?, raw_data = ?
                 WHERE id = ?`,
                [balance, interestRate, finalAccountType, filePath, JSON.stringify(extractedData), existingAccount.id],
                function(updateErr) {
                  if (updateErr) {
                    reject(updateErr);
                    return;
                  }

                  // Save screenshot record
                  db.run(
                    'INSERT INTO screenshots (account_id, file_path, platform, extracted_data) VALUES (?, ?, ?, ?)',
                    [existingAccount.id, filePath, detectedPlatform, JSON.stringify(extractedData)],
                    function(screenshotErr) {
                      if (screenshotErr) {
                        reject(screenshotErr);
                        return;
                      }

                      const screenshotId = this.lastID;

                      // Save account history snapshot
                      db.run(
                        'INSERT INTO account_history (account_id, balance, interest_rate, currency, screenshot_id) VALUES (?, ?, ?, ?, ?)',
                        [existingAccount.id, balance, interestRate, currency, screenshotId],
                        (historyErr) => {
                          if (historyErr) {
                            console.error('Error saving account history:', historyErr);
                            // Don't fail the whole operation if history save fails
                          }

                          // For P2P accounts, generate daily calculated values from last upload to today
                          if (finalAccountType === 'p2p' && interestRate && balance) {
                            generateDailyHistoryForAccount(existingAccount.id, balance, interestRate, currency);
                          }

                          // For stock/crypto accounts, save holdings (non-blocking)
                          if ((finalAccountType === 'stocks' || finalAccountType === 'crypto' || finalAccountType === 'precious') && extractedData.holdings) {
                            // Save holdings asynchronously without blocking the response
                            saveHoldings(existingAccount.id, extractedData.holdings, currency)
                              .then(() => {
                                console.log('[UPLOAD] Holdings saved successfully for account', existingAccount.id);
                              })
                              .catch((holdingsErr) => {
                                console.error('[UPLOAD] Error saving holdings (non-blocking):', holdingsErr);
                              });
                          }
                          
                          // Always proceed with account creation regardless of holdings
                          createdAccounts.push({ ...existingAccount, balance, interestRate, accountType: finalAccountType });
                          processedCount++;
                          if (processedCount === totalAccounts) {
                            resolve(res.json({
                              success: true,
                              accounts: createdAccounts,
                              totalBalance: extractedData.totalBalance || createdAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0),
                              message: `${createdAccounts.length} account(s) processed successfully`
                            }));
                          }
                        }
                      );
                    }
                  );
                }
              );
            } else {
              // Create new account
              db.run(
                `INSERT INTO accounts (platform, account_name, account_type, balance, interest_rate, currency, screenshot_path, raw_data)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [detectedPlatform, accountName, finalAccountType, balance, interestRate, currency, filePath, JSON.stringify(extractedData)],
                function(insertErr) {
                  if (insertErr) {
                    reject(insertErr);
                    return;
                  }

                  const accountId = this.lastID;

                  // Save screenshot record
                  db.run(
                    'INSERT INTO screenshots (account_id, file_path, platform, extracted_data) VALUES (?, ?, ?, ?)',
                    [accountId, filePath, detectedPlatform, JSON.stringify(extractedData)],
                    function(screenshotErr) {
                      if (screenshotErr) {
                        reject(screenshotErr);
                        return;
                      }

                      const screenshotId = this.lastID;

                      // Save account history snapshot for new account
                      db.run(
                        'INSERT INTO account_history (account_id, balance, interest_rate, currency, screenshot_id) VALUES (?, ?, ?, ?, ?)',
                        [accountId, balance, interestRate, currency, screenshotId],
                        (historyErr) => {
                          if (historyErr) {
                            console.error('Error saving account history:', historyErr);
                            // Don't fail the whole operation if history save fails
                          }

                          // For P2P accounts, generate daily calculated values from upload date to today
                          if (finalAccountType === 'p2p' && interestRate && balance) {
                            generateDailyHistoryForAccount(accountId, balance, interestRate, currency);
                          }

                          // For stock/crypto accounts, save holdings (non-blocking)
                          if ((finalAccountType === 'stocks' || finalAccountType === 'crypto' || finalAccountType === 'precious') && extractedData.holdings) {
                            console.log(`[UPLOAD] Saving ${extractedData.holdings.length} holdings for account ${accountId} (non-blocking)`);
                            // Save holdings asynchronously without blocking the response
                            saveHoldings(accountId, extractedData.holdings, currency)
                              .then(() => {
                                console.log(`[UPLOAD] Successfully saved holdings for account ${accountId}`);
                              })
                              .catch((holdingsErr) => {
                                console.error('[UPLOAD] Error saving holdings (non-blocking):', holdingsErr);
                              });
                          }
                          
                          // Always proceed with account creation regardless of holdings
                          createdAccounts.push({ id: accountId, platform: detectedPlatform, accountName, balance, interestRate, accountType: finalAccountType });
                          processedCount++;
                          if (processedCount === totalAccounts) {
                            console.log('[UPLOAD] All accounts processed successfully');
                            resolve(res.json({
                              success: true,
                              accounts: createdAccounts,
                              totalBalance: extractedData.totalBalance || createdAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0),
                              message: `${createdAccounts.length} account(s) created successfully`
                            }));
                          }
                        }
                      );
                    }
                  );
                }
              );
            }
          }
        );
      });
    });
  } catch (error) {
    console.error('[UPLOAD] Error uploading screenshot:', error);
    console.error('[UPLOAD] Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

function updateHoldings(accountId, holdings) {
  const db = getDatabase();
  
  // Clear existing holdings for this account
  db.run('DELETE FROM holdings WHERE account_id = ?', [accountId], () => {
    // Insert new holdings
    const stmt = db.prepare(
      'INSERT INTO holdings (account_id, symbol, quantity, purchase_price, current_price, asset_type, currency) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    holdings.forEach(holding => {
      stmt.run(
        accountId,
        holding.symbol,
        holding.quantity,
        holding.purchasePrice || null,
        holding.currentPrice || null,
        holding.assetType || 'stock',
        holding.currency || 'EUR'
      );
    });

    stmt.finalize();
  });
}

// Create a new account (for manual addition)
export function createAccount(req, res) {
  const db = getDatabase();
  const { accountName, platform, accountType } = req.body;

  const name = (accountName || 'Manual').trim();
  const plat = (platform || 'Manual').trim();
  const type = (accountType || 'stocks').trim();

  db.run(
    'INSERT INTO accounts (platform, account_name, account_type, balance, currency) VALUES (?, ?, ?, 0, ?)',
    [plat, name, type, 'EUR'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const accountId = this.lastID;
      res.status(201).json({
        success: true,
        account: { id: accountId, platform: plat, accountName: name, accountType: type }
      });
    }
  );
}

// Add a holding manually to an account
export async function createHolding(req, res) {
  const db = getDatabase();
  const accountId = req.params.id;
  const { symbol, quantity, price, currency, assetType } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  const sym = (symbol || '').trim().toUpperCase();
  if (!sym) {
    return res.status(400).json({ error: 'Symbol is required' });
  }
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }

  const asset = (assetType || 'stock').toLowerCase();
  const curr = (currency || 'EUR').toUpperCase();

  // Check account exists
  db.get('SELECT id, account_type FROM accounts WHERE id = ?', [accountId], async (accErr, account) => {
    if (accErr || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    let currentPrice = price != null && price !== '' ? parseFloat(price) : null;
    if (currentPrice != null && (isNaN(currentPrice) || currentPrice < 0)) currentPrice = null;

    // If no price provided, try to fetch live price
    if (currentPrice == null) {
      try {
        const fetched = await fetchCurrentPrice(sym, asset);
        if (fetched) currentPrice = fetched;
      } catch (e) {
        console.warn('Could not fetch price for', sym, e?.message);
      }
    }

    if (currentPrice == null || isNaN(currentPrice)) {
      currentPrice = 0;
    }

    db.run(
      'INSERT INTO holdings (account_id, symbol, quantity, purchase_price, current_price, currency, asset_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [accountId, sym, qty, currentPrice, currentPrice, curr, asset],
      function(insertErr) {
        if (insertErr) {
          return res.status(500).json({ error: insertErr.message });
        }
        syncAccountBalanceFromHoldings(accountId);
        res.status(201).json({
          success: true,
          holding: { id: this.lastID, symbol: sym, quantity: qty, currentPrice }
        });
      }
    );
  });
}

// Get portfolio summary with pie chart data
export function getPortfolioSummary(req, res) {
  const db = getDatabase();

  db.all(
    `SELECT a.*, 
            (SELECT COUNT(*) FROM holdings h WHERE h.account_id = a.id) as holdings_count
     FROM accounts a
     ORDER BY a.last_updated DESC`,
    [],
    async (err, accounts) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      accounts = accounts || [];

      try {
        // Live USD→EUR for portfolio totals (same as holdings detail)
        const usdToEur = Number(process.env.EXCHANGE_RATE_USD_TO_EUR) || (await fetchUsdToEurRate()) || 0.846;
        // Calculate current values for each account
        const portfolioData = await Promise.all(
          accounts.map(async (account) => {
          try {
            let currentValue = await calculatePortfolioValue(account).catch(() => account.balance || 0);
            if (typeof currentValue !== 'number' || Number.isNaN(currentValue)) currentValue = account.balance || 0;

            // For stock/crypto/precious accounts, if we have holdings, use the sum of holdings in EUR (match detail view)
            if ((account.account_type === 'stocks' || account.account_type === 'crypto' || account.account_type === 'precious') && (account.holdings_count || 0) > 0) {
              const [gbpToEur] = await Promise.all([fetchGbpToEurRate()]);
              const gbpRate = gbpToEur || 1.17;
              const holdingsResult = await new Promise((resolve) => {
                db.all(
                  'SELECT symbol, quantity, current_price, purchase_price, currency FROM holdings WHERE account_id = ?',
                  [account.id],
                  (err, holdings) => {
                    if (err) {
                      resolve({ totalValueEur: currentValue });
                      return;
                    }
                    const list = holdings || [];
                    const totalValueEur = list.reduce((sum, h) => sum + holdingValueInEur(h, usdToEur, gbpRate), 0);
                    resolve({ totalValueEur });
                  }
                );
              });
              // Use holdings sum; prefer synced account.balance when it's higher (getAccountHoldings just ran)
              const holdingsSum = holdingsResult?.totalValueEur;
              const freshBalance = await new Promise((resolve) => {
                db.get('SELECT balance FROM accounts WHERE id = ?', [account.id], (e, row) => resolve(row?.balance));
              });
              const useValue = (typeof freshBalance === 'number' && freshBalance > (holdingsSum || 0))
                ? freshBalance
                : holdingsSum;
              if (useValue != null && typeof useValue === 'number' && !Number.isNaN(useValue)) {
                currentValue = useValue;
              }
            }

            return {
              id: account.id,
              platform: account.platform,
              accountName: account.account_name,
              accountType: account.account_type,
              balance: account.balance,
              currentValue,
              currency: account.currency,
              interestRate: account.interest_rate,
              lastUpdated: account.last_updated,
              holdingsCount: account.holdings_count
            };
          } catch (e) {
            console.error('getPortfolioSummary account error:', account?.id, e);
            return {
              id: account.id,
              platform: account.platform,
              accountName: account.account_name,
              accountType: account.account_type,
              balance: account.balance,
              currentValue: account.balance || 0,
              currency: account.currency,
              interestRate: account.interest_rate,
              lastUpdated: account.last_updated,
              holdingsCount: account.holdings_count
            };
          }
        })
      );

        // Calculate totals
        const totalValue = portfolioData.reduce((sum, acc) => sum + acc.currentValue, 0);

        // Prepare pie chart data
        const pieData = portfolioData.map(acc => ({
          name: acc.accountName || acc.platform,
          value: acc.currentValue,
          platform: acc.platform,
          accountType: acc.accountType,
          percentage: totalValue > 0 ? ((acc.currentValue / totalValue) * 100).toFixed(2) : 0
        }));

        res.json({
          totalValue: totalValue,
          currency: 'EUR',
          accounts: portfolioData,
          pieData: pieData,
          lastUpdated: new Date().toISOString()
        });
      } catch (summaryErr) {
        console.error('getPortfolioSummary error:', summaryErr);
        return res.status(500).json({ error: summaryErr.message || 'Failed to load portfolio' });
      }
    }
  );
}

// Get all accounts
export function getAccounts(req, res) {
  const db = getDatabase();

  db.all(
    'SELECT * FROM accounts ORDER BY last_updated DESC',
    [],
    (err, accounts) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(accounts);
    }
  );
}

// Update account name
export function updateAccountName(req, res) {
  const db = getDatabase();
  const accountId = req.params.id;
  const { accountName } = req.body;

  if (!accountId || !accountName) {
    return res.status(400).json({ error: 'accountId and accountName are required' });
  }

  db.run(
    'UPDATE accounts SET account_name = ? WHERE id = ?',
    [accountName.trim(), accountId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json({
        success: true,
        message: 'Account name updated successfully',
        accountId: accountId,
        accountName: accountName.trim()
      });
    }
  );
}

// Update account type
export function updateAccountType(req, res) {
  const db = getDatabase();
  const accountId = req.params.id;
  const { accountType } = req.body;

  const validTypes = ['p2p', 'stocks', 'crypto', 'precious', 'bank', 'savings', 'unknown'];
  
  if (!accountId || !accountType) {
    return res.status(400).json({ error: 'accountId and accountType are required' });
  }

  if (!validTypes.includes(accountType)) {
    return res.status(400).json({ error: `accountType must be one of: ${validTypes.join(', ')}` });
  }

  db.run(
    'UPDATE accounts SET account_type = ? WHERE id = ?',
    [accountType, accountId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json({
        success: true,
        message: 'Account type updated successfully',
        accountId: accountId,
        accountType: accountType
      });
    }
  );
}

// Update account platform
export function updateAccountPlatform(req, res) {
  const db = getDatabase();
  const accountId = req.params.id;
  const { platform } = req.body;

  if (!accountId || !platform) {
    return res.status(400).json({ error: 'accountId and platform are required' });
  }

  db.run(
    'UPDATE accounts SET platform = ? WHERE id = ?',
    [platform.trim(), accountId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json({
        success: true,
        message: 'Platform name updated successfully',
        accountId: accountId,
        platform: platform.trim()
      });
    }
  );
}

// Update account balance
export function updateAccountBalance(req, res) {
  const db = getDatabase();
  const accountId = req.params.id;
  const { balance } = req.body;

  if (!accountId || balance === undefined || balance === null) {
    return res.status(400).json({ error: 'accountId and balance are required' });
  }

  const balanceValue = parseFloat(balance);
  if (isNaN(balanceValue)) {
    return res.status(400).json({ error: 'balance must be a valid number' });
  }

  db.run(
    'UPDATE accounts SET balance = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
    [balanceValue, accountId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Create a history entry for this manual update
      db.run(
        'INSERT INTO account_history (account_id, balance, interest_rate, currency) VALUES (?, ?, (SELECT interest_rate FROM accounts WHERE id = ?), (SELECT currency FROM accounts WHERE id = ?))',
        [accountId, balanceValue, accountId, accountId],
        (historyErr) => {
          if (historyErr) {
            console.error('Error creating history entry:', historyErr);
            // Don't fail the whole operation if history save fails
          }
        }
      );

      res.json({
        success: true,
        message: 'Account balance updated successfully',
        accountId: accountId,
        balance: balanceValue
      });
    }
  );
}

// Update account interest rate
export function updateAccountInterestRate(req, res) {
  const db = getDatabase();
  const accountId = req.params.id;
  const { interestRate } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }

  // Allow null/empty interest rate
  const interestRateValue = interestRate === null || interestRate === '' || interestRate === undefined 
    ? null 
    : parseFloat(interestRate);

  if (interestRateValue !== null && isNaN(interestRateValue)) {
    return res.status(400).json({ error: 'interestRate must be a valid number or null' });
  }

  db.run(
    'UPDATE accounts SET interest_rate = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
    [interestRateValue, accountId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json({
        success: true,
        message: 'Interest rate updated successfully',
        accountId: accountId,
        interestRate: interestRateValue
      });
    }
  );
}

// Get account holdings
export function getAccountHoldings(req, res) {
  const db = getDatabase();
  const accountId = req.params.id;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }

  db.all(
    'SELECT * FROM holdings WHERE account_id = ? ORDER BY symbol ASC',
    [accountId],
    async (err, holdings) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      try {
        const STATIC_ONLY_SYMBOLS = ['CASH', 'CASH_BALANCE', 'ROMANIA'];
        const normalizedSymbol = (s) => String(s || '').trim().toUpperCase();
        const num = (v) => (v != null && v !== '' ? Number(v) : 0);
        // Live rate from Yahoo (USDEUR=X) so e.g. 79.67 USD → 67.40 EUR; fallback env or current default
        const [fetchedRate, gbpToEur] = await Promise.all([fetchUsdToEurRate(), fetchGbpToEurRate()]);
        const USD_TO_EUR = Number(process.env.EXCHANGE_RATE_USD_TO_EUR) || fetchedRate || 0.846;
        const GBP_TO_EUR = gbpToEur || 1.17;
        const holdingsWithPrices = await Promise.all(
          (holdings || []).map(async (holding) => {
            const quantity = num(holding.quantity);
            const sym = normalizedSymbol(holding.symbol);
            const isBond = (holding.asset_type || holding.assetType || '').toLowerCase() === 'bond';
            const isCash = sym === 'CASH' || sym === 'CASH_BALANCE' || sym.includes('CASH');
            const isKnownStatic = STATIC_ONLY_SYMBOLS.some((s) => sym === s || sym.includes(s));
            const useStaticValueOnly = isBond || isCash || isKnownStatic;

            const lastUpdated = holding.last_updated ? new Date(holding.last_updated) : null;
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
            const isPreciousMetal = sym === 'XAG' || sym === 'XAU';
            // Precious metals + EUR-native: always fetch (cached may be wrong from prior USD conversion bug)
            const alwaysRefetchPrice = isPreciousMetal || EUR_NATIVE_SYMBOLS.includes(sym);
            const isPriceRecent = alwaysRefetchPrice ? false : (lastUpdated && lastUpdated > fifteenMinutesAgo);

            let currentPrice = holding.current_price != null ? Number(holding.current_price) : null;
            // For crypto with very small price (<0.001), may be wrong token id - force re-fetch
            const assetTypeLower = (holding.asset_type || holding.assetType || '').toLowerCase();
            const forceRefetchCrypto = assetTypeLower === 'crypto' && currentPrice != null && currentPrice > 0 && currentPrice < 0.001;
            // For stocks/ETFs: if stored price is unreasonably high (>10k), likely AI extracted total value as price - force refetch
            const isStockOrEtf = ['stock', 'etf'].includes(assetTypeLower);
            const forceRefetchWrongPrice = isStockOrEtf && currentPrice != null && currentPrice > 10000;
            // LSE GBP ETFs (EQQQ, IITU, VFEM, etc.) trade ~£5 (~€6). If cached price > 50 EUR, AI likely stored total as price. If < 1, wrong scale.
            const holdingCurrency = (holding.currency || 'EUR').toUpperCase();
            const forceRefetchCorruptedLseGbp = isStockOrEtf && currentPrice != null && LSE_GBP_ETF_SYMBOLS.includes(sym) &&
              (currentPrice < 1 || (holdingCurrency === 'EUR' && currentPrice > 50));
            // SMSD (Samsung LSE) trades ~$50-200; cached €903 is implausible - force refetch
            const forceRefetchSmsd = sym === 'SMSD' && currentPrice != null && currentPrice > 500;
            // META trades ~$600; cached €34 implies wrong ticker/source - force refetch
            const forceRefetchMeta = sym === 'META' && currentPrice != null && currentPrice < 100;
            // ABBN (ABB Swiss) ~CHF 80 = €76; cached €64 was USD conversion - force refetch for correct CHF→EUR
            const forceRefetchAbbn = sym === 'ABBN' && currentPrice != null && (currentPrice < 70 || currentPrice > 100);
            // EUR-native (IFX, TEF, MLAA): if stored as USD, was wrongly converted - force refetch to correct
            const forceRefetchEurNative = EUR_NATIVE_SYMBOLS.includes(sym) && (holding.currency || 'EUR').toUpperCase() === 'USD';
            const shouldFetchPrice = currentPrice == null || !isPriceRecent || forceRefetchCrypto || forceRefetchWrongPrice || forceRefetchCorruptedLseGbp || forceRefetchSmsd || forceRefetchMeta || forceRefetchAbbn || forceRefetchEurNative;
            let priceFetchFailed = false;
            let priceLastUpdated = holding.last_updated || null;
            let priceCurrency = (holding.currency || 'EUR').toUpperCase();
            let priceCameFromFetch = false;

            if (useStaticValueOnly) {
              currentPrice = currentPrice ?? (holding.purchase_price != null ? Number(holding.purchase_price) : null);
              if (currentPrice == null && holding.purchase_price != null) currentPrice = Number(holding.purchase_price);
              priceFetchFailed = true;
              priceCurrency = (holding.currency || 'EUR').toUpperCase();
            } else if (shouldFetchPrice) {
              let fetchedPrice = null;
              try {
                fetchedPrice = await fetchCurrentPrice(holding.symbol, holding.asset_type);
                currentPrice = fetchedPrice;
              } catch (e) {
                currentPrice = null;
              }
              if (currentPrice != null) {
                priceCameFromFetch = true;
                priceLastUpdated = new Date().toISOString();
                const holdingCurrency = (holding.currency || 'USD').toUpperCase();
                const assetType = (holding.asset_type || holding.assetType || '').toLowerCase();
                const symInner = normalizedSymbol(holding.symbol);
                // Yahoo returns: LSE GBP ETFs = pence; LSE USD ETFs (ECAR) + US stocks (NVDA, META) + XAG/XAU/crypto = USD
                // EUR native (IFX.DE, TEF.MC, MLAA.PA) = EUR; do NOT convert
                const isGbpPrice = LSE_GBP_ETF_SYMBOLS.includes(symInner);
                const isChfPrice = LSE_CHF_SYMBOLS.includes(symInner); // marketData already returns EUR
                const isEurNative = EUR_NATIVE_SYMBOLS.includes(symInner); // XETRA/Madrid/Paris = EUR
                const isUsdPrice = (symInner === 'XAG' || symInner === 'XAU') || assetType === 'crypto' ||
                  LSE_USD_ETF_SYMBOLS.includes(symInner) || (!isGbpPrice && !isChfPrice && !isEurNative); // Default: non-GBP/CHF/EUR = USD
                if (isChfPrice || isEurNative) {
                  priceCurrency = 'EUR';
                  holding._updatePromise = dbRun(db, 'UPDATE holdings SET current_price = ?, currency = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [currentPrice, 'EUR', holding.id]);
                } else if (isGbpPrice && holdingCurrency === 'EUR') {
                  currentPrice = currentPrice * GBP_TO_EUR;
                  priceCurrency = 'EUR';
                  holding._updatePromise = dbRun(db, 'UPDATE holdings SET current_price = ?, currency = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [currentPrice, 'EUR', holding.id]);
                } else if (isUsdPrice) {
                  currentPrice = currentPrice * USD_TO_EUR;
                  priceCurrency = 'EUR';
                  holding._updatePromise = dbRun(db, 'UPDATE holdings SET current_price = ?, currency = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [currentPrice, 'EUR', holding.id]);
                } else {
                  priceCurrency = holdingCurrency;
                  holding._updatePromise = dbRun(db, 'UPDATE holdings SET current_price = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [currentPrice, holding.id]);
                }
              } else {
                // Fetch failed - use cached price from last successful fetch if available; show "Live (X ago)" not yellow Screenshot
                let cachedPrice = holding.current_price != null ? Number(holding.current_price) : null;
                // Cached price for LSE GBP ETFs may be in pence; convert. USD ETFs (ECAR) no pence conversion
                if (cachedPrice != null && cachedPrice >= 1000 && cachedPrice < 50000 && LSE_GBP_ETF_SYMBOLS.includes(sym)) {
                  cachedPrice = cachedPrice / 100;
                  if ((holding.currency || 'EUR').toUpperCase() === 'EUR') cachedPrice = cachedPrice * GBP_TO_EUR;
                }
                if (cachedPrice != null && cachedPrice > 0) {
                  currentPrice = cachedPrice;
                  priceLastUpdated = holding.last_updated || null;
                  priceFetchFailed = false; // Keep Live badge with stale timestamp, don't show yellow Screenshot
                  priceCurrency = (holding.currency || 'EUR').toUpperCase();
                } else {
                  priceFetchFailed = true;
                  if (holding.purchase_price != null) currentPrice = Number(holding.purchase_price);
                  priceCurrency = (holding.currency || 'EUR').toUpperCase();
                }
              }
            }

            // When using CACHED price only: LSE GBP ETF may be stored in pence; convert. Skip when we just fetched (already in EUR).
            if (!priceCameFromFetch && currentPrice != null && currentPrice >= 1000 && currentPrice < 50000 && LSE_GBP_ETF_SYMBOLS.includes(sym)) {
              currentPrice = currentPrice / 100;
              if ((holding.currency || 'EUR').toUpperCase() === 'EUR') {
                currentPrice = currentPrice * GBP_TO_EUR;
                priceCurrency = 'EUR';
              } else {
                priceCurrency = 'GBP';
              }
            }
            const purchasePriceNum = holding.purchase_price != null ? Number(holding.purchase_price) : 0;
            let totalValue = 0;
            if (currentPrice != null) totalValue = quantity * currentPrice;
            else if (purchasePriceNum) totalValue = quantity * purchasePriceNum;
            if (totalValue === 0 && purchasePriceNum) totalValue = quantity * purchasePriceNum;

            const purchaseValue = purchasePriceNum ? quantity * purchasePriceNum : 0;
            const gainLoss = totalValue - purchaseValue;
            const gainLossPercent = purchaseValue > 0 ? (gainLoss / purchaseValue) * 100 : 0;

            const totalValueEur = priceCurrency === 'USD' ? totalValue * USD_TO_EUR : priceCurrency === 'GBP' ? totalValue * GBP_TO_EUR : totalValue;

            return {
              ...holding,
              quantity,
              currentPrice: currentPrice ?? undefined,
              totalValue,
              totalValueEur,
              priceCurrency,
              purchaseValue,
              gainLoss,
              gainLossPercent,
              priceFetchFailed,
              priceLastUpdated
            };
          })
        );

        // Await all DB updates so portfolio summary sees fresh data on next load
        const updatePromises = holdingsWithPrices.map((h) => h._updatePromise).filter(Boolean);
        if (updatePromises.length > 0) await Promise.all(updatePromises);
        holdingsWithPrices.forEach((h) => delete h._updatePromise);

        const totalValueEur = holdingsWithPrices.reduce((sum, h) => sum + (h.totalValueEur ?? 0), 0);

        // Sync account balance with computed total (use computed value to avoid race with DB updates)
        await syncAccountBalanceFromHoldings(accountId, totalValueEur).catch(() => {});

        res.json({
          holdings: holdingsWithPrices,
          totalValue: holdingsWithPrices.reduce((sum, h) => sum + (h.totalValue || 0), 0),
          totalValueEur,
          totalGainLoss: holdingsWithPrices.reduce((sum, h) => sum + (h.gainLoss || 0), 0),
          USD_TO_EUR
        });
      } catch (apiErr) {
        console.error('getAccountHoldings error:', apiErr);
        return res.status(500).json({ error: apiErr.message || 'Failed to load holdings' });
      }
    }
  );
}

// Get 3-month value projection for stocks/crypto account (for chart)
export async function getHoldingsProjection(req, res) {
  const db = getDatabase();
  const accountId = req.params.id;
  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }
  const usdToEur = Number(process.env.EXCHANGE_RATE_USD_TO_EUR) || (await fetchUsdToEurRate()) || 0.846;

  db.get('SELECT * FROM accounts WHERE id = ?', [accountId], async (err, account) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    const accountType = (account.account_type || account.accountType || '').toLowerCase();
    if (accountType !== 'stocks' && accountType !== 'crypto' && accountType !== 'precious') {
      return res.json({ totalValueEurNow: 0, totalValueEur3M: 0, monthly: [], perHolding: [], source: null });
    }

    db.all('SELECT id, symbol, quantity, current_price, purchase_price, currency, asset_type FROM holdings WHERE account_id = ?', [accountId], async (dbErr, holdings) => {
      if (dbErr) return res.status(500).json({ error: dbErr.message });
      const list = holdings || [];
      if (list.length === 0) {
        return res.json({ totalValueEurNow: 0, totalValueEur3M: 0, monthly: [], perHolding: [], source: null });
      }

      try {
        let totalNowEur = 0;
        let total3MEur = 0;
        const perHolding = [];
        for (const h of list) {
          const q = Number(h.quantity) || 0;
          const curPrice = h.current_price != null ? Number(h.current_price) : (h.purchase_price != null ? Number(h.purchase_price) : null);
          const price = curPrice ?? await fetchCurrentPrice(h.symbol, h.asset_type || 'stock');
          if (price == null || q <= 0) continue;
          const sym = String(h.symbol || '').trim().toUpperCase();
          const currency = EUR_NATIVE_SYMBOLS.includes(sym) ? 'EUR' : (h.currency || 'EUR').toUpperCase();
          const valueNow = q * price;
          const valueNowEur = currency === 'USD' ? valueNow * usdToEur : valueNow;
          totalNowEur += valueNowEur;

          const proj = await getProjectedPrice3M(h.symbol, price, h.asset_type || 'stock');
          const price3M = proj ? proj.projectedPrice : price;
          const value3M = q * price3M;
          const value3MEur = currency === 'USD' ? value3M * usdToEur : value3M;
          total3MEur += value3MEur;
          perHolding.push({ symbol: h.symbol, currentPrice: price, projectedPrice3M: price3M, source: proj ? proj.source : null });
        }

        const now = new Date();
        const monthly = [
          { month: 0, date: now.toISOString().slice(0, 10), valueEur: totalNowEur },
          { month: 1, date: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().slice(0, 10), valueEur: totalNowEur + (total3MEur - totalNowEur) / 3 },
          { month: 2, date: new Date(now.getFullYear(), now.getMonth() + 2, now.getDate()).toISOString().slice(0, 10), valueEur: totalNowEur + (2 * (total3MEur - totalNowEur)) / 3 },
          { month: 3, date: new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).toISOString().slice(0, 10), valueEur: total3MEur }
        ];
        const source = perHolding.some((p) => p.source) ? (perHolding.some((p) => p.source === 'trend_crypto') ? 'trend_crypto' : 'trend') : null;
        res.json({ totalValueEurNow: totalNowEur, totalValueEur3M: total3MEur, monthly, perHolding, source });
      } catch (e) {
        console.error('getHoldingsProjection error:', e);
        return res.status(500).json({ error: e.message || 'Failed to compute projection' });
      }
    });
  });
}

// Get account history with daily changes
export function getAccountHistory(req, res) {
  const db = getDatabase();
  const accountId = req.params.id;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }

  // Get account details
  db.get(
    'SELECT * FROM accounts WHERE id = ?',
    [accountId],
    (err, account) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Get history ordered by date (newest first)
      db.all(
        `SELECT * FROM account_history 
         WHERE account_id = ? 
         ORDER BY recorded_at DESC 
         LIMIT 100`,
        [accountId],
        (historyErr, history) => {
          if (historyErr) {
            return res.status(500).json({ error: historyErr.message });
          }
          
          // Ensure history is an array
          if (!Array.isArray(history)) {
            history = [];
          }

          // Calculate daily changes
          const historyWithChanges = history.map((record, index) => {
            const change = index < history.length - 1 
              ? record.balance - history[index + 1].balance 
              : 0;
            
            const changePercent = index < history.length - 1 && history[index + 1].balance > 0
              ? ((change / history[index + 1].balance) * 100).toFixed(2)
              : 0;

            return {
              ...record,
              change: change,
              changePercent: parseFloat(changePercent)
            };
          });

          res.json({
            account: {
              ...account,
              accountType: account.account_type, // Add camelCase for consistency
              account_type: account.account_type // Keep snake_case
            },
            history: historyWithChanges,
            totalRecords: history.length
          });
        }
      );
    }
  );
}

// Update account with new screenshot
export async function updateAccountWithScreenshot(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const accountId = parseInt(req.params.id);
    if (!accountId) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const filePath = req.file.path;
    const db = getDatabase();

    // First, get the existing account to preserve its type and other settings
    db.get(
      'SELECT * FROM accounts WHERE id = ?',
      [accountId],
      async (err, existingAccount) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (!existingAccount) {
          return res.status(404).json({ error: 'Account not found' });
        }

        try {
          // Analyze screenshot with AI, using existing account type as context
          const extractedData = await analyzeScreenshot(
            filePath, 
            existingAccount.platform, 
            existingAccount.account_type
          );

          if (!extractedData) {
            return res.status(500).json({ error: 'Failed to extract data from screenshot' });
          }

          // Check if extraction failed due to API key error
          if (extractedData.error && (extractedData.error.includes('401') || extractedData.error.includes('API key'))) {
            return res.status(500).json({ 
              error: 'OpenAI API key is invalid or expired',
              details: 'Please update your API key in backend/.env file. Get a new key at https://platform.openai.com/api-keys'
            });
          }

          // Extract balance and interest rate from the first account found (or use existing if multiple)
          const accounts = extractedData.accounts || [];
          if (accounts.length === 0) {
            return res.status(400).json({ error: 'No account data found in screenshot' });
          }

          // Use the first account's data, or try to match by name
          let accountData = accounts[0];
          if (accounts.length > 1) {
            const existingName = (existingAccount.account_name || '').toLowerCase();
            const matchingAccount = accounts.find(acc => {
              const name = (acc.accountName || acc.account_name || '').toLowerCase();
              return name && name === existingName;
            });
            if (matchingAccount) {
              accountData = matchingAccount;
            }
          }

          // For brokerage (stocks/crypto), prefer the full portfolio total when the selected account balance looks wrong (e.g. a single holding value)
          const isBrokerage = existingAccount.account_type === 'stocks' || existingAccount.account_type === 'crypto' || existingAccount.account_type === 'precious';
          const selectedBalance = accountData.balance ?? existingAccount.balance;
          const totalBalance = extractedData.totalBalance;
          const holdings = extractedData.holdings || [];
          const sumFromHoldings = holdings.reduce((sum, h) => sum + (parseFloat(h.currentValue) || 0), 0);
          let balance;
          if (isBrokerage) {
            const totalNum = totalBalance != null ? (typeof totalBalance === 'number' ? totalBalance : parseFloat(totalBalance)) : 0;
            const useTotal = !isNaN(totalNum) && totalNum > (selectedBalance || 0) && totalNum > (selectedBalance || 0) * 1.5;
            const useHoldingsSum = sumFromHoldings > (selectedBalance || 0) && sumFromHoldings > (selectedBalance || 0) * 1.5;
            if (useTotal) {
              balance = totalNum;
            } else if (useHoldingsSum) {
              balance = sumFromHoldings;
            } else {
              balance = accountData.balance || existingAccount.balance;
            }
          } else {
            balance = accountData.balance || existingAccount.balance;
          }
          const interestRate = accountData.interestRate || existingAccount.interest_rate;
          const currency = extractedData.currency || existingAccount.currency || 'EUR';
          const detectedPlatform = extractedData.platform || existingAccount.platform;

          // Update the account
          db.run(
            `UPDATE accounts 
             SET balance = ?, interest_rate = ?, 
                 last_updated = CURRENT_TIMESTAMP, 
                 screenshot_path = ?, 
                 raw_data = ?,
                 platform = ?
             WHERE id = ?`,
            [
              balance, 
              interestRate, 
              filePath, 
              JSON.stringify(extractedData),
              detectedPlatform,
              accountId
            ],
            function(updateErr) {
              if (updateErr) {
                return res.status(500).json({ error: updateErr.message });
              }

              // Save screenshot record
              db.run(
                'INSERT INTO screenshots (account_id, file_path, platform, extracted_data) VALUES (?, ?, ?, ?)',
                [accountId, filePath, detectedPlatform, JSON.stringify(extractedData)],
                function(screenshotErr) {
                  if (screenshotErr) {
                    console.error('Error saving screenshot record:', screenshotErr);
                    // Continue even if screenshot record fails
                  }

                  const screenshotId = this.lastID || null;

                  // Save account history snapshot
                  db.run(
                    'INSERT INTO account_history (account_id, balance, interest_rate, currency, screenshot_id) VALUES (?, ?, ?, ?, ?)',
                    [accountId, balance, interestRate, currency, screenshotId],
                    (historyErr) => {
                      if (historyErr) {
                        console.error('Error saving account history:', historyErr);
                        // Continue even if history save fails
                      }

                      // For P2P accounts, generate daily calculated values from last upload to today
                      if (existingAccount.account_type === 'p2p' && interestRate && balance) {
                        generateDailyHistoryForAccount(accountId, balance, interestRate, currency);
                      }

                      // For stock/crypto accounts, save holdings (async, but don't wait)
                      if ((existingAccount.account_type === 'stocks' || existingAccount.account_type === 'crypto' || existingAccount.account_type === 'precious') && extractedData.holdings) {
                        saveHoldings(accountId, extractedData.holdings, currency)
                          .catch((holdingsErr) => {
                            console.error('Error saving holdings:', holdingsErr);
                            // Continue anyway - don't block the response
                          });
                      }

                      // Return updated account data immediately
                      res.json({
                        success: true,
                        account: {
                          id: accountId,
                          accountName: existingAccount.account_name,
                          platform: detectedPlatform,
                          balance: balance,
                          interestRate: interestRate,
                          accountType: existingAccount.account_type,
                          currency: currency,
                          lastUpdated: new Date().toISOString()
                        },
                        message: 'Account updated successfully'
                      });
                    }
                  );
                }
              );
            }
          );
        } catch (aiError) {
          console.error('Error analyzing screenshot:', aiError);
          return res.status(500).json({ 
            error: 'Failed to analyze screenshot',
            details: aiError.message 
          });
        }
      }
    );
  } catch (error) {
    console.error('Error updating account:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Add holdings from screenshot (merge with existing, do not replace)
export async function addHoldingsFromScreenshot(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const accountId = parseInt(req.params.id);
    if (!accountId) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const filePath = req.file.path;
    const db = getDatabase();

    db.get('SELECT * FROM accounts WHERE id = ?', [accountId], async (err, account) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!account) return res.status(404).json({ error: 'Account not found' });

      const accountType = account.account_type || account.accountType || '';
      if (accountType !== 'stocks' && accountType !== 'crypto' && accountType !== 'precious') {
        return res.status(400).json({ error: 'Add holdings from screenshot is only supported for stocks, crypto, or precious metal accounts' });
      }

      try {
        const extractedData = await analyzeScreenshot(filePath, account.platform, account.account_type);
        if (!extractedData) {
          return res.status(500).json({ error: 'Failed to extract data from screenshot' });
        }
        if (extractedData.error && (extractedData.error.includes('401') || extractedData.error.includes('API key'))) {
          return res.status(500).json({ error: 'OpenAI API key is invalid or expired' });
        }

        const holdings = extractedData.holdings || [];
        if (holdings.length === 0) {
          return res.status(400).json({ error: 'No holdings found in screenshot' });
        }

        const currency = extractedData.currency || account.currency || 'EUR';
        await saveHoldingsMerge(accountId, holdings, currency);
        syncAccountBalanceFromHoldings(accountId);

        res.json({
          success: true,
          addedCount: holdings.length,
          message: `Added ${holdings.length} holding(s) to account`
        });
      } catch (aiError) {
        console.error('Error adding holdings from screenshot:', aiError);
        return res.status(500).json({ error: 'Failed to analyze screenshot', details: aiError.message });
      }
    });
  } catch (error) {
    console.error('Error adding holdings:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Verify symbol: fetch live price to confirm ticker is valid (for "Screenshot" → "Live" flow)
export async function verifyHoldingSymbol(req, res) {
  const symbol = (req.query.symbol || req.body?.symbol || '').trim().toUpperCase();
  const assetType = (req.query.assetType || req.body?.assetType || 'stock').toLowerCase();

  if (!symbol) {
    return res.status(400).json({ found: false, error: 'Symbol is required' });
  }

  const isIsin = /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(symbol);

  try {
    const price = await fetchCurrentPrice(symbol, assetType);
    if (price != null && !Number.isNaN(Number(price))) {
      return res.json({
        found: true,
        symbol,
        price: Number(price),
        currency: 'USD'
      });
    }
    const error = isIsin
      ? 'Price not found for this bond/ISIN. Yahoo often has no data for non-US bonds (e.g. Romanian). You can keep it as Screenshot.'
      : 'Price not found for this symbol';
    return res.json({ found: false, symbol, error });
  } catch (err) {
    console.error('verifyHoldingSymbol error:', err);
    return res.status(500).json({ found: false, symbol, error: err.message || 'Failed to verify symbol' });
  }
}

// Update holding symbol
export function updateHoldingSymbol(req, res) {
  const db = getDatabase();
  const holdingId = req.params.id;
  const { symbol } = req.body;

  if (!holdingId || !symbol) {
    return res.status(400).json({ error: 'holdingId and symbol are required' });
  }

  // First get the holding to know its asset type
  db.get(
    'SELECT * FROM holdings WHERE id = ?',
    [holdingId],
    async (err, holding) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!holding) {
        return res.status(404).json({ error: 'Holding not found' });
      }

      // Update symbol
      db.run(
        'UPDATE holdings SET symbol = ? WHERE id = ?',
        [symbol.trim(), holdingId],
        async (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ error: updateErr.message });
          }

          // Automatically fetch current price for the new symbol
          try {
            const currentPrice = await fetchCurrentPrice(symbol.trim(), holding.asset_type || 'stock');
            if (currentPrice) {
              db.run(
                'UPDATE holdings SET current_price = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
                [currentPrice, holdingId]
              );
            }
          } catch (priceErr) {
            console.error('Error fetching price for symbol:', symbol, priceErr);
            // Continue anyway - price fetch failure shouldn't block symbol update
          }

          res.json({
            success: true,
            message: 'Holding symbol updated successfully. Price will be fetched automatically.',
            holdingId: holdingId,
            symbol: symbol.trim()
          });
        }
      );
    }
  );
}

// Recompute account balance from holdings sum (EUR) for stocks/crypto; keeps card in sync with detail view
// When totalEur is provided, use it directly (avoids race with in-flight DB updates)
async function syncAccountBalanceFromHoldings(accountId, totalEur = null) {
  if (!accountId) return;
  const db = getDatabase();
  if (totalEur != null && typeof totalEur === 'number' && !Number.isNaN(totalEur)) {
    await dbRun(db, 'UPDATE accounts SET balance = ? WHERE id = ?', [totalEur, accountId]);
    return;
  }
  const [usdRate, gbpRate] = await Promise.all([fetchUsdToEurRate(), fetchGbpToEurRate()]);
  const usdToEur = Number(process.env.EXCHANGE_RATE_USD_TO_EUR) || usdRate || 0.846;
  const gbpToEur = gbpRate || 1.17;
  db.all(
    'SELECT symbol, quantity, current_price, purchase_price, currency FROM holdings WHERE account_id = ?',
    [accountId],
    (err, holdings) => {
      if (err) return;
      const list = holdings || [];
      const total = list.reduce((sum, h) => sum + holdingValueInEur(h, usdToEur, gbpToEur), 0);
      db.run('UPDATE accounts SET balance = ? WHERE id = ?', [total, accountId], () => {});
    }
  );
}

// Update holding quantity
export function updateHoldingQuantity(req, res) {
  const db = getDatabase();
  const holdingId = req.params.id;
  const { quantity } = req.body;

  if (!holdingId || quantity === undefined || quantity === null) {
    return res.status(400).json({ error: 'holdingId and quantity are required' });
  }

  const quantityValue = parseFloat(quantity);
  if (isNaN(quantityValue) || quantityValue < 0) {
    return res.status(400).json({ error: 'quantity must be a valid positive number' });
  }

  db.run(
    'UPDATE holdings SET quantity = ? WHERE id = ?',
    [quantityValue, holdingId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Holding not found' });
      }
      db.get('SELECT account_id FROM holdings WHERE id = ?', [holdingId], (_e, row) => {
        if (row) syncAccountBalanceFromHoldings(row.account_id);
      });
      res.json({
        success: true,
        message: 'Holding quantity updated successfully',
        holdingId: holdingId,
        quantity: quantityValue
      });
    }
  );
}

// Update holding price (optional: currency = 'USD' | 'EUR')
export function updateHoldingPrice(req, res) {
  const db = getDatabase();
  const holdingId = req.params.id;
  const { price, currency: currencyParam } = req.body;

  if (!holdingId || price === undefined || price === null) {
    return res.status(400).json({ error: 'holdingId and price are required' });
  }

  const priceValue = parseFloat(price);
  if (isNaN(priceValue) || priceValue < 0) {
    return res.status(400).json({ error: 'price must be a valid positive number' });
  }

  const currency = (currencyParam && ['USD', 'EUR'].includes(String(currencyParam).toUpperCase()))
    ? String(currencyParam).toUpperCase()
    : null;

  const sql = currency
    ? 'UPDATE holdings SET current_price = ?, currency = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?'
    : 'UPDATE holdings SET current_price = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?';
  const params = currency ? [priceValue, currency, holdingId] : [priceValue, holdingId];

  db.run(sql, params,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Holding not found' });
      }
      db.get('SELECT account_id FROM holdings WHERE id = ?', [holdingId], (_e, row) => {
        if (row) syncAccountBalanceFromHoldings(row.account_id);
      });
      res.json({
        success: true,
        message: 'Holding price updated successfully',
        holdingId: holdingId,
        price: priceValue
      });
    }
  );
}

// Delete a single holding
export function deleteHolding(req, res) {
  const db = getDatabase();
  const holdingId = req.params.id;
  if (!holdingId) {
    return res.status(400).json({ error: 'Holding ID is required' });
  }
  db.get('SELECT account_id FROM holdings WHERE id = ?', [holdingId], (getErr, row) => {
    if (getErr || !row) {
      return res.status(404).json({ error: 'Holding not found' });
    }
    const accountId = row.account_id;
    db.run('DELETE FROM holdings WHERE id = ?', [holdingId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Holding not found' });
      }
      syncAccountBalanceFromHoldings(accountId);
      res.json({ success: true, message: 'Holding removed', holdingId });
    });
  });
}

// Delete history entry
export function deleteHistoryEntry(req, res) {
  const db = getDatabase();
  const historyId = req.params.id;

  if (!historyId) {
    return res.status(400).json({ error: 'History ID is required' });
  }

  // First, check if history entry exists
  db.get('SELECT * FROM account_history WHERE id = ?', [historyId], (err, historyEntry) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!historyEntry) {
      return res.status(404).json({ error: 'History entry not found' });
    }

    // Delete the history entry
    db.run('DELETE FROM account_history WHERE id = ?', [historyId], function(deleteErr) {
      if (deleteErr) {
        return res.status(500).json({ error: deleteErr.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'History entry not found' });
      }

      res.json({
        success: true,
        message: 'History entry deleted successfully',
        historyId: historyId
      });
    });
  });
}

// Delete account
export function deleteAccount(req, res) {
  console.log('[DELETE] Starting account deletion');
  console.log('[DELETE] Account ID:', req.params.id);
  const db = getDatabase();
  const accountId = req.params.id;

  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }

  // First, check if account exists
  console.log('[DELETE] Checking if account exists...');
  db.get('SELECT * FROM accounts WHERE id = ?', [accountId], (err, account) => {
    if (err) {
      console.error('[DELETE] Database error checking account:', err);
      return res.status(500).json({ error: err.message });
    }

    if (!account) {
      console.error('[DELETE] Account not found:', accountId);
      return res.status(404).json({ error: 'Account not found' });
    }

    console.log('[DELETE] Account found:', account.account_name);
    console.log('[DELETE] Starting deletion of related records...');

    // Delete related records first (to maintain referential integrity)
    // Delete account history
    db.run('DELETE FROM account_history WHERE account_id = ?', [accountId], (historyErr) => {
      if (historyErr) {
        console.error('[DELETE] Error deleting account history:', historyErr);
        // Continue even if history deletion fails
      } else {
        console.log('[DELETE] Account history deleted');
      }

      // Delete screenshots
      db.run('DELETE FROM screenshots WHERE account_id = ?', [accountId], (screenshotErr) => {
        if (screenshotErr) {
          console.error('[DELETE] Error deleting screenshots:', screenshotErr);
          // Continue even if screenshot deletion fails
        } else {
          console.log('[DELETE] Screenshots deleted');
        }

        // Delete holdings
        db.run('DELETE FROM holdings WHERE account_id = ?', [accountId], (holdingsErr) => {
          if (holdingsErr) {
            console.error('[DELETE] Error deleting holdings:', holdingsErr);
            // Continue even if holdings deletion fails
          } else {
            console.log('[DELETE] Holdings deleted');
          }

          // Delete transactions
          db.run('DELETE FROM transactions WHERE account_id = ?', [accountId], (transactionsErr) => {
            if (transactionsErr) {
              console.error('[DELETE] Error deleting transactions:', transactionsErr);
              // Continue even if transactions deletion fails
            } else {
              console.log('[DELETE] Transactions deleted');
            }

            // Finally, delete the account itself
            console.log('[DELETE] Deleting account record...');
            db.run('DELETE FROM accounts WHERE id = ?', [accountId], function(deleteErr) {
              if (deleteErr) {
                console.error('[DELETE] Error deleting account:', deleteErr);
                return res.status(500).json({ error: deleteErr.message });
              }

              if (this.changes === 0) {
                console.error('[DELETE] No rows deleted - account not found');
                return res.status(404).json({ error: 'Account not found' });
              }

              console.log('[DELETE] Account deleted successfully. Rows affected:', this.changes);
              res.json({
                success: true,
                message: 'Account deleted successfully',
                accountId: accountId
              });
            });
          });
        });
      });
    });
  });
}
