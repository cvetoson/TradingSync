import { getDatabase } from '../database.js';
import { analyzeScreenshot } from '../services/aiService.js';
import { calculatePortfolioValue } from '../services/calculations.js';
import { fetchCurrentPrice } from '../services/marketData.js';

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

// Helper function to save holdings for an account
function saveHoldings(accountId, holdings, currency) {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:60',message:'saveHoldings entry',data:{accountId,holdingsCount:holdings?.length||0},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'J'})}).catch(()=>{});
  // #endregion
  if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
    return Promise.resolve();
  }

  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.error('[SAVE_HOLDINGS] Timeout - DELETE callback never executed');
      reject(new Error('saveHoldings timeout - database operation took too long'));
    }, 10000); // 10 second timeout

    // Delete existing holdings for this account
    console.log('[SAVE_HOLDINGS] Starting delete for account', accountId);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:69',message:'Deleting existing holdings',data:{accountId},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'J'})}).catch(()=>{});
    // #endregion
    
    db.run('DELETE FROM holdings WHERE account_id = ?', [accountId], (deleteErr) => {
      clearTimeout(timeout);
      console.log('[SAVE_HOLDINGS] DELETE callback called', {hasError:!!deleteErr,error:deleteErr?.message});
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:75',message:'DELETE callback executed',data:{hasError:!!deleteErr,error:deleteErr?.message},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      if (deleteErr) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:77',message:'Error deleting holdings',data:{error:deleteErr.message},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        console.error('Error deleting existing holdings:', deleteErr);
        reject(deleteErr);
        return;
      }

      try {
        console.log('[SAVE_HOLDINGS] Starting insert logic', {totalHoldings:holdings.length});
        // Insert new holdings
        let insertedCount = 0;
        let errorOccurred = false;
        const totalHoldings = holdings.length;
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:90',message:'Starting holdings insert',data:{totalHoldings},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'J'})}).catch(()=>{});
        // #endregion

        if (totalHoldings === 0) {
          resolve();
          return;
        }

        holdings.forEach((holding) => {
        if (errorOccurred) return;

        const symbol = holding.symbol;
        if (!symbol) {
          console.warn('Skipping holding without symbol:', holding);
          insertedCount++;
          if (insertedCount === totalHoldings) {
            resolve();
          }
          return;
        }

        // Normalize value from screenshot (multiple possible keys from AI)
        const rawCurrentValue = holding.currentValue ?? holding.current_value ?? holding.value ?? holding.amount;
        const currentValueNum = rawCurrentValue != null ? parseFloat(rawCurrentValue) : null;

        let quantity = parseFloat(holding.quantity) || 0;
        let purchasePrice = holding.purchasePrice ? parseFloat(holding.purchasePrice) : (holding.purchase_price != null ? parseFloat(holding.purchase_price) : null);
        let currentPrice = holding.currentPrice ? parseFloat(holding.currentPrice) : (holding.current_price != null ? parseFloat(holding.current_price) : null);
        const assetType = holding.assetType || holding.asset_type || 'stock';
        const holdingCurrency = holding.currency || currency || 'EUR';

        // If we have a currentValue from screenshot (the total value shown, e.g., 543.42 for Romania, 44.21 for cash) — always use it as static value
        if (currentValueNum != null && !isNaN(currentValueNum)) {
          const totalValue = currentValueNum;

          // For cash, quantity is 1 and price is the cash amount
          if (symbol === 'CASH' || symbol === 'CASH_BALANCE' || symbol.toUpperCase().includes('CASH')) {
            quantity = 1;
            currentPrice = totalValue;
            purchasePrice = totalValue;
          } else {
            // For other holdings (stocks, bonds, etc.): use total value as static number so it shows even without a ticker
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
          // AI sent currentPrice but no currentValue — use it as static value so we don't show €0.00
          if (purchasePrice == null) purchasePrice = currentPrice;
          if (quantity <= 0) quantity = 1;
        } else if (!currentPrice && quantity > 0 && purchasePrice != null) {
          currentPrice = purchasePrice;
        }

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:150',message:'Inserting holding',data:{symbol,quantity,insertedCount,totalHoldings},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        db.run(
          `INSERT INTO holdings (account_id, symbol, quantity, purchase_price, current_price, currency, asset_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [accountId, symbol, quantity, purchasePrice, currentPrice, holdingCurrency, assetType],
          (insertErr) => {
            if (insertErr) {
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:155',message:'Error inserting holding',data:{symbol,error:insertErr.message},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'J'})}).catch(()=>{});
              // #endregion
              console.error(`Error saving holding ${symbol}:`, insertErr);
              errorOccurred = true;
              reject(insertErr);
              return;
            }
            
            insertedCount++;
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:163',message:'Holding inserted',data:{symbol,insertedCount,totalHoldings,isComplete:insertedCount===totalHoldings},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'J'})}).catch(()=>{});
            // #endregion
            if (insertedCount === totalHoldings) {
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:165',message:'All holdings saved',data:{accountId,totalHoldings},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'J'})}).catch(()=>{});
              // #endregion
              resolve();
            }
          }
        );
        });
      } catch (insertError) {
        clearTimeout(timeout);
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:catch',message:'Error in holdings insert',data:{error:insertError.message,stack:insertError.stack?.substring(0,200)},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        console.error('Error in saveHoldings insert logic:', insertError);
        reject(insertError);
      }
    });
  });
}

// Helper function to detect account type (same as in aiService)
function detectAccountType(platform) {
  const platformLower = platform.toLowerCase();
  
  if (platformLower.includes('bondora') || platformLower.includes('iuvo') || platformLower.includes('moneyfit')) {
    return 'p2p';
  } else if (platformLower.includes('trading') || platformLower.includes('ibkr')) {
    return 'stocks';
  } else if (platformLower.includes('revolut') || platformLower.includes('ledger')) {
    return 'crypto';
  } else if (platformLower.includes('bank') || platformLower.includes('savings')) {
    return 'savings';
  }
  
  return 'unknown';
}

// Upload screenshot and extract data
export async function uploadScreenshot(req, res) {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:179',message:'uploadScreenshot entry',data:{hasFile:!!req.file,bodyKeys:Object.keys(req.body||{})},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    console.log('[UPLOAD] Starting upload process');
    if (!req.file) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:182',message:'No file uploaded',data:{},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error('[UPLOAD] No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const investmentCategory = req.body.investmentCategory || 'unknown';
    let accountType = req.body.accountType || null;
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:190',message:'File received',data:{filePath,investmentCategory,accountType,fileSize:req.file.size},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.log('[UPLOAD] File path:', filePath, 'Category:', investmentCategory, 'Type:', accountType);
    
    // Map investment category to a display name
    const categoryDisplayNames = {
      'auto': 'Auto Detect',
      'p2p': 'P2P Lending',
      'equities': 'ETF & Stocks',
      'crypto': 'Cryptocurrency',
      'savings': 'Savings & Deposits',
      'fixed-income': 'Fixed Income & Bonds',
      'alternative': 'Alternative Investments'
    };
    const platform = categoryDisplayNames[investmentCategory] || investmentCategory;

    // If auto-detect or no accountType provided, let AI determine it
    // Otherwise use the provided accountType
    const aiAccountType = (investmentCategory === 'auto' || !accountType) ? null : accountType;

    // Analyze screenshot with AI
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:209',message:'Starting AI analysis',data:{filePath,platform,aiAccountType},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log('[UPLOAD] Analyzing screenshot with AI...');
    const extractedData = await analyzeScreenshot(filePath, platform, aiAccountType);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:211',message:'AI analysis complete',data:{hasData:!!extractedData,accountsCount:extractedData?.accounts?.length||0,holdingsCount:extractedData?.holdings?.length||0,hasError:!!extractedData?.error},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log('[UPLOAD] AI extraction complete. Accounts:', extractedData?.accounts?.length || 0, 'Holdings:', extractedData?.holdings?.length || 0);

    if (!extractedData) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:213',message:'No extracted data',data:{},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error('[UPLOAD] Failed to extract data from screenshot');
      return res.status(500).json({ error: 'Failed to extract data from screenshot' });
    }

    // Check if extraction failed due to API key error
    if (extractedData.error && (extractedData.error.includes('401') || extractedData.error.includes('API key'))) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:219',message:'API key error',data:{error:extractedData.error},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:234',message:'Starting account processing',data:{accountsCount:accounts.length},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    return new Promise((resolve, reject) => {
      const createdAccounts = [];
      let processedCount = 0;
      const totalAccounts = accounts.length;

      if (totalAccounts === 0) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:240',message:'No accounts found',data:{},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'H'})}).catch(()=>{});
        // #endregion
        return res.status(400).json({ error: 'No accounts found in screenshot' });
      }

      accounts.forEach((accountData, index) => {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:270',message:'Processing account',data:{index,accountName:accountData.accountName,balance:accountData.balance},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        // Use detected platform name from AI, or fallback to category display name
        const detectedPlatform = extractedData.platform || platform;
        const accountName = accountData.accountName || `${detectedPlatform} ${index + 1}`;
        const balance = accountData.balance || 0;
        const interestRate = accountData.interestRate || null;
        // Use provided accountType from request, or from extracted data, or fallback to detection
        const finalAccountType = accountData.accountType || defaultAccountType || detectAccountType(detectedPlatform);

        // Check if this specific account already exists
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:280',message:'Checking existing account',data:{detectedPlatform,accountName},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        db.get(
          'SELECT * FROM accounts WHERE platform = ? AND account_name = ? ORDER BY last_updated DESC LIMIT 1',
          [detectedPlatform, accountName],
          (err, existingAccount) => {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:283',message:'Account check result',data:{hasError:!!err,hasExistingAccount:!!existingAccount,accountId:existingAccount?.id},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'G'})}).catch(()=>{});
            // #endregion
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
                          if ((finalAccountType === 'stocks' || finalAccountType === 'crypto') && extractedData.holdings) {
                            // #region agent log
                            fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:331',message:'Saving holdings for existing account (non-blocking)',data:{accountId:existingAccount.id,holdingsCount:extractedData.holdings.length},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'G'})}).catch(()=>{});
                            // #endregion
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
                            // #region agent log
                            fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:337',message:'Sending response',data:{accountsCount:createdAccounts.length},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'G'})}).catch(()=>{});
                            // #endregion
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
                          if ((finalAccountType === 'stocks' || finalAccountType === 'crypto') && extractedData.holdings) {
                            // #region agent log
                            fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:419',message:'Saving holdings for new account (non-blocking)',data:{accountId,holdingsCount:extractedData.holdings.length},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'G'})}).catch(()=>{});
                            // #endregion
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
                            // #region agent log
                            fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:427',message:'Sending response for new account',data:{accountsCount:createdAccounts.length},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'G'})}).catch(()=>{});
                            // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:474',message:'Upload error caught',data:{error:error.message,stack:error.stack?.substring(0,200)},timestamp:Date.now(),runId:'upload-debug',hypothesisId:'I'})}).catch(()=>{});
    // #endregion
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
        // Calculate current values for each account
        const portfolioData = await Promise.all(
          accounts.map(async (account) => {
          try {
            let currentValue = await calculatePortfolioValue(account).catch(() => account.balance || 0);
            if (typeof currentValue !== 'number' || Number.isNaN(currentValue)) currentValue = account.balance || 0;

            // For stock/crypto accounts, if we have holdings, use the holdings total instead
            if ((account.account_type === 'stocks' || account.account_type === 'crypto') && (account.holdings_count || 0) > 0) {
              const holdingsResult = await new Promise((resolve) => {
                db.all(
                  'SELECT * FROM holdings WHERE account_id = ?',
                  [account.id],
                  async (err, holdings) => {
                    if (err) {
                      resolve({ totalValue: currentValue });
                      return;
                    }
                    const list = holdings || [];
                    const totalValue = list.reduce((sum, h) => sum + (Number(h.quantity) || 0) * (Number(h.current_price) || Number(h.purchase_price) || 0), 0);
                    resolve({ totalValue });
                  }
                );
              });
              if (holdingsResult && holdingsResult.totalValue > 0) currentValue = holdingsResult.totalValue;
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

  const validTypes = ['p2p', 'stocks', 'crypto', 'bank', 'savings', 'unknown'];
  
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
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:getAccountHoldings',message:'Holdings from DB',data:{accountId,holdingsCount:(holdings||[]).length},timestamp:Date.now(),runId:'holdings-debug',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion

      try {
        const STATIC_ONLY_SYMBOLS = ['CASH', 'CASH_BALANCE', 'ROMANIA'];
        const normalizedSymbol = (s) => String(s || '').trim().toUpperCase();
        const num = (v) => (v != null && v !== '' ? Number(v) : 0);
        const USD_TO_EUR = Number(process.env.EXCHANGE_RATE_USD_TO_EUR) || 0.92;

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
            const isPriceRecent = lastUpdated && lastUpdated > fifteenMinutesAgo;

            let currentPrice = holding.current_price != null ? Number(holding.current_price) : null;
            let priceFetchFailed = false;
            let priceLastUpdated = holding.last_updated || null;
            let priceCurrency = (holding.currency || 'EUR').toUpperCase();

            if (useStaticValueOnly) {
              currentPrice = currentPrice ?? (holding.purchase_price != null ? Number(holding.purchase_price) : null);
              if (currentPrice == null && holding.purchase_price != null) currentPrice = Number(holding.purchase_price);
              priceFetchFailed = true;
              priceCurrency = (holding.currency || 'EUR').toUpperCase();
            } else if (currentPrice == null || !isPriceRecent) {
              try {
                currentPrice = await fetchCurrentPrice(holding.symbol, holding.asset_type);
              } catch (e) {
                currentPrice = null;
              }
              if (currentPrice != null) {
                priceLastUpdated = new Date().toISOString();
                priceCurrency = 'USD';
                db.run(
                  'UPDATE holdings SET current_price = ?, currency = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
                  [currentPrice, 'USD', holding.id]
                );
              } else {
                priceFetchFailed = true;
                if (holding.purchase_price != null) currentPrice = Number(holding.purchase_price);
                priceCurrency = (holding.currency || 'EUR').toUpperCase();
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

            const totalValueEur = priceCurrency === 'USD' ? totalValue * USD_TO_EUR : totalValue;

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

        const totalValueEur = holdingsWithPrices.reduce((sum, h) => sum + (h.totalValueEur || (h.priceCurrency === 'USD' ? (h.totalValue || 0) * USD_TO_EUR : (h.totalValue || 0))), 0);

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

          // #region agent log
          const accountSummaries = (accounts || []).map((acc, i) => ({ index: i, accountName: acc.accountName || acc.account_name, balance: acc.balance }));
          fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:updateAccountWithScreenshot',message:'Extracted accounts and totalBalance',data:{accountId,existingAccountName:existingAccount.account_name,accountsCount:accounts.length,accountSummaries,totalBalance:extractedData.totalBalance,holdingsCount:(extractedData.holdings||[]).length},timestamp:Date.now(),runId:'balance-debug',hypothesisId:'B1'})}).catch(()=>{});
          // #endregion

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
          const isBrokerage = existingAccount.account_type === 'stocks' || existingAccount.account_type === 'crypto';
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
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:updateAccountWithScreenshot',message:'Using totalBalance for brokerage',data:{accountId,selectedBalance,totalBalance,balance},timestamp:Date.now(),runId:'balance-debug',hypothesisId:'B2'})}).catch(()=>{});
              // #endregion
            } else if (useHoldingsSum) {
              balance = sumFromHoldings;
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:updateAccountWithScreenshot',message:'Using sum of holdings for brokerage',data:{accountId,selectedBalance,sumFromHoldings,balance},timestamp:Date.now(),runId:'balance-debug',hypothesisId:'B3'})}).catch(()=>{});
              // #endregion
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
                      if ((existingAccount.account_type === 'stocks' || existingAccount.account_type === 'crypto') && extractedData.holdings) {
                        // #region agent log
                        fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'portfolio.js:updateAccountWithScreenshot',message:'Saving holdings after update',data:{accountId,holdingsCount:extractedData.holdings.length},timestamp:Date.now(),runId:'holdings-debug',hypothesisId:'H4'})}).catch(()=>{});
                        // #endregion
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

// Verify symbol: fetch live price to confirm ticker is valid (for "Screenshot" → "Live" flow)
export async function verifyHoldingSymbol(req, res) {
  const symbol = (req.query.symbol || req.body?.symbol || '').trim().toUpperCase();
  const assetType = req.query.assetType || req.body?.assetType || 'stock';

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
      ? 'Price not found for this bond/ISIN. Yahoo often has no data for non-US bonds (e.g. Romanian). You can keep it as Screenshot, or set FINNHUB_API_KEY in the backend for optional bond data.'
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

      res.json({
        success: true,
        message: 'Holding quantity updated successfully',
        holdingId: holdingId,
        quantity: quantityValue
      });
    }
  );
}

// Update holding price
export function updateHoldingPrice(req, res) {
  const db = getDatabase();
  const holdingId = req.params.id;
  const { price } = req.body;

  if (!holdingId || price === undefined || price === null) {
    return res.status(400).json({ error: 'holdingId and price are required' });
  }

  const priceValue = parseFloat(price);
  if (isNaN(priceValue) || priceValue < 0) {
    return res.status(400).json({ error: 'price must be a valid positive number' });
  }

  db.run(
    'UPDATE holdings SET current_price = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
    [priceValue, holdingId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Holding not found' });
      }

      res.json({
        success: true,
        message: 'Holding price updated successfully',
        holdingId: holdingId,
        price: priceValue
      });
    }
  );
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
