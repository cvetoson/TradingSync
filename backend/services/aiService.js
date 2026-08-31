// AI Service for analyzing screenshots using OpenAI Vision API
import OpenAI from 'openai';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load .env from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Function to get or refresh OpenAI client (always reloads .env)
export function getOpenAIClient() {
  // Always reload .env to get latest values
  dotenv.config({ path: join(__dirname, '../.env') });
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  
  // Always create a new client to ensure fresh API key
  return new OpenAI({ apiKey });
}

// Client is created lazily when analyzeScreenshot is called (avoids crash on startup if key missing)

/**
 * Analyzes one or more screenshots of the SAME account and extracts portfolio data
 * using OpenAI Vision API. Long position lists don't fit one phone screen, so users
 * can send several scrolled views in one batch; the model merges them into one result.
 * @param {string|string[]} filePath - Path(s) to the uploaded screenshot(s)
 * @param {string} platform - Investment category display name
 * @param {string} accountType - Account type (p2p, stocks, crypto, etc.)
 * @returns {Promise<Object>} Extracted data object
 */
export async function analyzeScreenshot(filePath, platform, accountType = null) {
  try {
    const filePaths = (Array.isArray(filePath) ? filePath : [filePath]).filter(Boolean);
    if (!filePaths.length) throw new Error('No screenshot to analyze');
    console.log(`Analyzing ${filePaths.length} screenshot(s) from ${platform}${accountType ? ` (${accountType})` : ' (auto-detect)'}`);

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables. Please check backend/.env file and restart the server.');
    }

    const imageParts = filePaths.map((p) => {
      const ext = p.split('.').pop().toLowerCase();
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      return {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${fs.readFileSync(p).toString('base64')}`,
          // Position lists are dense small print (tickers, P&L); the default 'auto'
          // detail downscales a tall screenshot and misreads digits and symbols.
          detail: 'high',
        },
      };
    });

    // Create a detailed prompt for extracting portfolio data
    let contextDescription = '';
    if (accountType) {
      const accountTypeContext = {
        'p2p': 'P2P lending platform with fixed interest rates',
        'stocks': 'stock trading, ETF, or equity investment platform',
        'crypto': 'cryptocurrency or digital asset platform',
        'precious': 'gold, silver, or precious metals platform (XAG, XAU)',
        'savings': 'savings account or deposit product',
        'bank': 'banking or fixed income investment',
        'unknown': 'investment or trading platform'
      };
      contextDescription = accountTypeContext[accountType] || accountTypeContext['unknown'];
    } else {
      // Auto-detect mode - let AI determine the type
      contextDescription = 'investment, trading, or financial platform';
    }
    
    const prompt = `Analyze this screenshot from a ${contextDescription}${accountType ? ` (category: ${platform})` : ''}. Extract all relevant financial information and return it as a JSON object with the following structure:

{
  "accounts": [
    {
      "balance": <current balance/value as a number - THIS IS THE CURRENT TOTAL VALUE (invested amount + generated profit)>,
      "interestRate": <annual interest rate as a number (TAE, APY, etc.), or null if not applicable>,
      "currency": <currency code like "EUR", "USD", "GBP">,
      "accountName": <name or identifier of this specific account/vault>,
      "accountType": <one of: "p2p", "stocks", "crypto", "precious", "bank", "savings", "unknown">,
      "investedAmount": <initial investment amount as a number, or null if not visible>,
      "investmentDate": <date when investment was made in format "YYYY-MM-DD" or "DD.MM.YYYY", or null if not visible>,
      "balanceAsOfDate": <for P2P/savings/deposits: the STATEMENT or "as of" / "updated" date that applies to the balance shown (DD.MM.YYYY or YYYY-MM-DD), or null. If the screenshot shows "25.02.2026" and the balance next to it, use that date so the app can compound interest from that day to today>,
      "generatedProfit": <profit generated so far as a number, or null if not visible>
    }
  ],
  "totalBalance": <sum of all account balances as a number>,
  "currency": <primary currency code>,
  "platform": <DETECT THE ACTUAL PLATFORM/APP NAME from the screenshot - look for logos, app names, brand names like "Bondora", "Revolut", "Trading 212", "IBKR", "Moneyfit", "Iuvo", "Ledger", etc. If you cannot detect it, use "Unknown Platform">,
  "holdings": [
    {
      "symbol": <stock/crypto symbol (e.g., "TSLA", "ASML", "AMD", "META", "NFLX")>,
      "quantity": <number of shares/coins (e.g., 0.42, 0.06, 0.41)>,
      "currentPrice": <current price per unit at time of screenshot, or null if not visible>,
      "purchasePrice": <purchase price per unit if visible, or null>,
      "currentValue": <TOTAL current value of this position as shown (e.g. 1052.01 for "€1,052.01"), or null>,
      "profitLoss": <unrealised profit/loss of this position in money as shown, signed (e.g. 322.77 for "+€322.77", -119.65 for "−€119.65"), or null if not shown>,
      "profitLossPercent": <unrealised profit/loss in percent as shown, signed (e.g. 44.26 for "(44.26%)", -78.81 for "(78.81%)" in red / with a minus), or null>,
      "portfolioPercent": <this position's share of the portfolio in percent if shown (e.g. 13.93 for "13.93%"), or null>,
      "assetType": <"stock", "crypto", "etf", "bond", or "precious" for gold/silver/XAG/XAU>,
      "name": <full name of the asset (e.g., "Tesla", "ASML Holding", "Advanced Micro Devices")>,
      "currency": <currency of the price/value - DETECT from symbols: € or EUR → "EUR", $ or USD → "USD", £ or GBP → "GBP", Fr or CHF → "CHF", HK$ or HKD → "HKD">
    }
  ]
}

CRITICAL INSTRUCTIONS:
- IMPORTANT: Detect the actual platform/app name from the screenshot - look for app logos, brand names, company names visible in the UI (e.g., "Bondora", "Revolut", "Trading 212", "IBKR", "Moneyfit", "Iuvo", "Ledger", "Go & Grow", etc.)
- If you cannot detect the platform name, use "Unknown Platform" for the "platform" field
- If you see MULTIPLE accounts/vaults/savings products in the screenshot, extract EACH ONE separately in the "accounts" array
- Each account should have its own balance and interest rate (TAE, APY, etc.)
- For example, if you see 3 vaults with values 1029.51€ (9.42%), 408.47€ (9.42%), and 644.63€ (8.33%), create 3 separate account objects
- Numbers may use European formatting: "1.029,51 €" = 1029.51, "408,47 €" = 408.47
- Convert European format: replace dots with nothing (thousands), replace comma with dot (decimal)
- Look for labels like "Current Value", "Valor actual", "Текуща стойност", "TAE", "APY", "Annual Equivalent Rate"
- For Revolut/Revolut-like apps: extract each vault/savings product as a separate account
- **CRITICAL FOR INVESTMENT ACCOUNTS**: If you see fields like "Invested: 1,063.99 EUR", "Investment Date: 30.12.2024", and "Generated Profit so far: 99.73 EUR":
  - Extract "investedAmount" as the initial investment (e.g., 1063.99)
  - Extract "investmentDate" as the date when investment was made (e.g., "2024-12-30" or "30.12.2024")
  - Extract "generatedProfit" as the profit generated so far (e.g., 99.73)
  - Calculate "balance" as: investedAmount + generatedProfit (e.g., 1063.99 + 99.73 = 1163.72)
  - The "balance" field MUST be the CURRENT TOTAL VALUE (invested + profit), NOT just the invested amount
- The "totalBalance" should be the sum of all individual account balances
- **GOLD & SILVER (precious metals)**: If you see Gold, Silver, XAG (silver), XAU (gold), or precious metals in the account name, platform, or in a holding name/symbol, use accountType "precious" and for that holding use assetType "precious". Use symbol "XAG" for silver and "XAU" for gold when visible.
- **CRITICAL FOR CURRENCY DETECTION**: Detect currency from the screenshot for EACH value:
  - € or "EUR" or "€" next to a number → currency: "EUR"
  - $ or "USD" or "US$" or "USD" → currency: "USD"
  - £ or "GBP" or "£" or "GBp" → currency: "GBP"
  - "CHF" or "Fr" → currency: "CHF"
  - HK$, HKD, or "元" in a Hong Kong context → currency: "HKD"
  - **Multi-exchange brokers (IBKR, etc.)**: The "Last" / price column is often in the **listing currency** (SEHK, HKEX → HKD; NASDAQ/NYSE → USD; ASML → EUR; LSE → GBP), even when **cash** or **net liquidation** is shown in EUR. Prefer the **exchange column** (e.g. "1211 SEHK", "TICKER HKEX") for that row's price currency — do **not** set every holding to EUR just because "EUR Cash" or the portfolio summary is in euros.
  - **IBIS / Xetra (Germany)**: Row labels like "DTE IBIS" mean Deutsche Telekom on Xetra in **EUR** (~30); use symbol **"DTE.DE"** or currency **EUR** — do not confuse with the unrelated US ticker **DTE** (different company, USD).
  - Set "currency" for each account from the displayed balance (e.g., "1,210.14 €" → EUR)
  - Set "currency" for each holding from the value/price column (e.g., "508.65 €" → EUR, "33.40 $" → USD)
  - If the account header shows "Portfolio in EUR" or similar, use that for the primary "currency" field only (account-level); **per-holding** currency still follows the exchange/price column when visible
- **CRITICAL FOR STOCK/ETF ACCOUNTS**: If you see a brokerage account with multiple holdings (stocks, ETFs, bonds):
  - Extract EACH individual holding as a separate object in the "holdings" array
  - For each holding, extract: symbol (e.g., "TSLA", "ASML", "ROMANIA" for bonds, "XAG" for silver, "XAU" for gold), quantity (e.g., 0.42, 0.06), name (e.g., "Tesla", "ASML Holding", "Silver", "Gold")
  - **IMPORTANT FOR SYMBOLS**: Use the visible name/ticker from the screenshot. For bonds like "Romania 5.25% 05/32", use "ROMANIA" as the symbol (NOT the ISIN code unless it's clearly visible in the screenshot)
  - Extract the current value shown for each holding (e.g., "149,20 €" for Tesla, "543,42 €" for Romania bond, "44,21 €" for cash)
  - **CRITICAL**: Extract "currentValue" field for each holding - this is the TOTAL VALUE shown in the screenshot (e.g., 149.20, 543.42, 44.21)
  - If price per share is visible (e.g., "411,70 $"), extract it as "currentPrice"
  - **CRITICAL**: Set "currency" for each holding from the value/price column - if you see "508.65 €" use "EUR", if "33.40 $" use "USD", if "£29.21" use "GBP", if the row shows **SEHK / HKEX / Hong Kong** and no "€" on that price, use **"HKD"** (e.g. numeric ticker 1211 on SEHK with Last 103.90 → HKD). Prefer symbol **"1211.HK"** when the screenshot shows a Hong Kong listing.
  - **European brokers (Trading 212, Revolut, etc.)**: If ALL values in the portfolio are shown in € (euro) with no per-row exchange labels, set currency "EUR" for every holding. **If** the screenshot shows **per-row exchange codes** (SEHK, NASDAQ, NYSE, AEB, …), use the **local listing currency** for each row instead of forcing EUR for all rows.
  - **IMPORTANT**: Also extract "Cash balance" or "Cash" as a holding with:
    - symbol: "CASH" or "CASH_BALANCE"
    - quantity: 1 (or the cash amount if shown as quantity)
    - currentValue: the cash amount (e.g., 44.21)
    - currentPrice: the cash amount (same as currentValue for cash)
  - For bonds, extract the currentValue shown (e.g., "543,42 €" = 543.42) and use a simple name like "ROMANIA" as the symbol
  - The "balance" field for the account should be the TOTAL account value (sum of all holdings + cash)
  - Example: If you see "Brokerage account" with total "1210,14 €" and individual holdings like "Tesla: 149,20 € (0.42 TSLA)", "Romania 5.25% 05/32: 543,42 €", "Cash balance: 44,21 €", extract each holding separately with their currentValue and use "ROMANIA" (not ISIN) as the symbol for the bond
- **POSITION LISTS (Trading 212, Revolut, eToro, IBKR "Portfolio" tab, etc.)**: Each row is one position. Typical layout: logo, full name, then "TICKER · 13.93%" (ticker and portfolio share) on the left; the position's TOTAL VALUE on the right (e.g. "€1,052.01"); and below it the unrealised P&L in money and percent (e.g. "+€322.77 (44.26%)" in green, or "−€119.65 (78.81%)" in red = negative).
  - Extract EVERY row — do not stop early, do not summarise, do not merge rows. If there are 18 rows, return 18 holdings.
  - "currentValue" = the big number on the right. "profitLoss" and "profitLossPercent" = the line under it, negative when red or prefixed with −/-.
  - "portfolioPercent" = the percentage next to the ticker.
  - The number of shares is usually NOT shown in such lists: set "quantity" to null rather than inventing one.
  - If the screenshot does not show an account total, set the account "balance" and "totalBalance" to the SUM of all holdings' currentValue.
- Return ONLY valid JSON, no additional text or explanation
- If a field cannot be determined, use null for that field
- Numbers should be actual numbers, not strings`
      + (imageParts.length > 1 ? `

MULTIPLE SCREENSHOTS (${imageParts.length} images): They all show the SAME account - scrolled views of one long position list, or different tabs of one app. Return ONE merged result:
- One combined "holdings" array covering every position visible in ANY screenshot.
- Overlapping rows (the same position visible in more than one screenshot because of scrolling) must appear ONLY ONCE - use the clearest/most complete values for it.
- Do not create one account per screenshot: merge into the same accounts array as if it were one tall screenshot.
- The account "balance" is the account total if any screenshot shows it; otherwise the sum of the merged holdings' currentValue.` : '');

    // Call OpenAI Vision API
    // Benchmarked on an 18-row Trading 212 position list (values, P&L €, P&L %):
    // gpt-4o ≈ 11/18 P&L correct, gpt-4.1 11/18, gpt-5.4-nano 13/18,
    // gpt-5.4-mini 18/18 in ~9s (3/3 runs), gpt-5-mini 18/18 but ~31s.
    const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
    const client = getOpenAIClient();
    
    const FALLBACK_MODEL = 'gpt-4o';
    // gpt-5* / o-series take max_completion_tokens and only the default temperature.
    const requestFor = (modelId) => ({
      model: modelId,
      ...(/^(gpt-5|o\d)/i.test(modelId) ? { max_completion_tokens: 8000 } : { max_tokens: 4000, temperature: 0.1 }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imageParts
          ]
        }
      ],
      // max_tokens used to be 1000: enough for a single balance, but an 18-position list
      // is ~3k tokens of JSON — the reply was cut mid-object and every such upload
      // "succeeded" with nothing extracted.
      response_format: { type: 'json_object' }
    });

    let response;
    try {
      response = await client.chat.completions.create(requestFor(model));
    } catch (e) {
      // The key on this deployment may not have the preferred model; fall back once.
      const noModel = e?.status === 404 || /does not exist|do not have access/i.test(e?.message || '');
      if (!noModel || model === FALLBACK_MODEL) throw e;
      console.warn(`[AI] model ${model} unavailable (${e.message}); falling back to ${FALLBACK_MODEL}`);
      response = await client.chat.completions.create(requestFor(FALLBACK_MODEL));
    }

    const choice = response.choices[0];
    if (choice.finish_reason === 'length') {
      throw new Error('AI response was truncated (the screenshot has too many rows for one pass). Try a screenshot with fewer positions');
    }

    // Extract the JSON response
    const content = (choice.message.content || '').trim();
    
    // Try to parse JSON (might be wrapped in markdown code blocks)
    let jsonData;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
      jsonData = JSON.parse(jsonMatch ? jsonMatch[1] : content);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      throw new Error('AI returned invalid JSON format');
    }

    // Validate and normalize the extracted data
    // Support both old format (single account) and new format (multiple accounts)
    let accounts = [];
    
    if (jsonData.accounts && Array.isArray(jsonData.accounts) && jsonData.accounts.length > 0) {
      // New format: multiple accounts
      accounts = jsonData.accounts.map(acc => {
        const investedAmount = acc.investedAmount ? parseFloat(acc.investedAmount) : null;
        const generatedProfit = acc.generatedProfit ? parseFloat(acc.generatedProfit) : null;
        
        // Calculate balance: if investedAmount and generatedProfit are present, use their sum
        // Otherwise, use the balance field directly
        let balance = parseFloat(acc.balance) || 0;
        if (investedAmount !== null && generatedProfit !== null) {
          // Current value = invested amount + generated profit
          balance = investedAmount + generatedProfit;
        }
        
        // Parse investment date (handle both YYYY-MM-DD and DD.MM.YYYY formats)
        let investmentDate = null;
        if (acc.investmentDate) {
          const dateStr = acc.investmentDate.trim();
          // Try to parse DD.MM.YYYY format
          if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
            const [day, month, year] = dateStr.split('.');
            investmentDate = `${year}-${month}-${day}`;
          } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Already in YYYY-MM-DD format
            investmentDate = dateStr;
          }
        }

        let balanceAsOfDate = null;
        const asOfRaw = acc.balanceAsOfDate ?? acc.balance_as_of_date;
        if (asOfRaw) {
          const dateStr = String(asOfRaw).trim();
          if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
            const [day, month, year] = dateStr.split('.');
            balanceAsOfDate = `${year}-${month}-${day}`;
          } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            balanceAsOfDate = dateStr;
          }
        }
        
        return {
          balance: balance,
          interestRate: acc.interestRate ? parseFloat(acc.interestRate) : null,
          currency: acc.currency || jsonData.currency || 'EUR',
          accountName: acc.accountName || platform,
          accountType: acc.accountType || detectAccountType(platform),
          investedAmount: investedAmount,
          investmentDate: investmentDate,
          balanceAsOfDate,
          generatedProfit: generatedProfit
        };
      });
    } else if (jsonData.balance !== undefined) {
      // Old format: single account (backward compatibility)
      const investedAmount = jsonData.investedAmount ? parseFloat(jsonData.investedAmount) : null;
      const generatedProfit = jsonData.generatedProfit ? parseFloat(jsonData.generatedProfit) : null;
      
      let balance = parseFloat(jsonData.balance) || 0;
      if (investedAmount !== null && generatedProfit !== null) {
        balance = investedAmount + generatedProfit;
      }
      
      let investmentDate = null;
      if (jsonData.investmentDate) {
        const dateStr = jsonData.investmentDate.trim();
        if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
          const [day, month, year] = dateStr.split('.');
          investmentDate = `${year}-${month}-${day}`;
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          investmentDate = dateStr;
        }
      }
      let balanceAsOfDate = null;
      const asOfRaw = jsonData.balanceAsOfDate ?? jsonData.balance_as_of_date;
      if (asOfRaw) {
        const dateStr = String(asOfRaw).trim();
        if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
          const [day, month, year] = dateStr.split('.');
          balanceAsOfDate = `${year}-${month}-${day}`;
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          balanceAsOfDate = dateStr;
        }
      }
      
      accounts = [{
        balance: balance,
        interestRate: jsonData.interestRate ? parseFloat(jsonData.interestRate) : null,
        currency: jsonData.currency || 'EUR',
        accountName: jsonData.accountName || platform,
        accountType: jsonData.accountType || detectAccountType(platform),
        investedAmount: investedAmount,
        investmentDate: investmentDate,
        balanceAsOfDate,
        generatedProfit: generatedProfit
      }];
    } else {
      // Fallback: create empty account
      accounts = [{
        balance: 0,
        interestRate: null,
        currency: jsonData.currency || 'EUR',
        accountName: platform,
        accountType: detectAccountType(platform),
        investedAmount: null,
        investmentDate: null,
        generatedProfit: null
      }];
    }
    
    const holdingsOut = jsonData.holdings && Array.isArray(jsonData.holdings)
        ? jsonData.holdings.map(h => {
            const currentValue = h.currentValue != null ? parseFloat(h.currentValue) : (h.current_value != null ? parseFloat(h.current_value) : (h.value != null ? parseFloat(h.value) : (h.amount != null ? parseFloat(h.amount) : null)));
            return {
              symbol: h.symbol,
              quantity: parseFloat(h.quantity) || 0,
              purchasePrice: h.purchasePrice ? parseFloat(h.purchasePrice) : (h.purchase_price != null ? parseFloat(h.purchase_price) : null),
              currentPrice: h.currentPrice ? parseFloat(h.currentPrice) : (h.current_price != null ? parseFloat(h.current_price) : null),
              currentValue,
              profitLoss: h.profitLoss != null && Number.isFinite(parseFloat(h.profitLoss)) ? parseFloat(h.profitLoss) : null,
              profitLossPercent: h.profitLossPercent != null && Number.isFinite(parseFloat(h.profitLossPercent)) ? parseFloat(h.profitLossPercent) : null,
              portfolioPercent: h.portfolioPercent != null && Number.isFinite(parseFloat(h.portfolioPercent)) ? parseFloat(h.portfolioPercent) : null,
              name: h.name || null,
              assetType: h.assetType || h.asset_type || 'stock',
              currency: h.currency || jsonData.currency || 'EUR'
            };
          })
        : null;

    // --- Sanity passes over what the model read -------------------------------------
    for (const h of holdingsOut || []) {
      // A red row's percent is often returned unsigned ("(78.81%)"): the money sign wins.
      if (h.profitLoss != null && h.profitLossPercent != null &&
          Math.sign(h.profitLoss) !== 0 && Math.sign(h.profitLoss) !== Math.sign(h.profitLossPercent)) {
        h.profitLossPercent = -h.profitLossPercent;
      }
      // Money P&L and % P&L describe the same cost basis; if they disagree, at least one
      // digit was misread and storing either would pin a wrong cost forever.
      if (h.currentValue != null && h.profitLoss != null && h.profitLossPercent != null) {
        const cost = h.currentValue - h.profitLoss;
        if (cost > 0) {
          const impliedPct = (h.profitLoss / cost) * 100;
          const tolerance = Math.max(1, Math.abs(h.profitLossPercent) * 0.03);
          if (Math.abs(impliedPct - h.profitLossPercent) > tolerance) {
            console.warn(`[AI] ${h.symbol}: P&L ${h.profitLoss} vs ${h.profitLossPercent}% inconsistent (implied ${impliedPct.toFixed(2)}%) — dropping both`);
            h.profitLoss = null;
            h.profitLossPercent = null;
            h.pnlUnreliable = true;
          }
        }
      }
    }
    // Position lists rarely show a total; every model tried invents one (±30%). When the
    // rows sum to something and the reported balance is far from it, the rows win.
    const valued = (holdingsOut || []).filter((h) => h.currentValue != null && h.currentValue > 0);
    const holdingsSum = valued.reduce((sum, h) => sum + h.currentValue, 0);
    if (valued.length >= 2 && holdingsSum > 0 && accounts.length === 1) {
      const reported = accounts[0].balance;
      if (!(reported > 0) || Math.abs(reported - holdingsSum) > holdingsSum * 0.1) {
        if (reported > 0) console.warn(`[AI] reported balance ${reported} ≠ holdings sum ${holdingsSum.toFixed(2)} — using the sum`);
        accounts[0].balance = holdingsSum;
        accounts[0].balanceFromHoldings = true;
      }
    }

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    const extractedData = {
      accounts: accounts,
      totalBalance: totalBalance,
      currency: jsonData.currency || 'EUR',
      platform: jsonData.platform || platform,
      holdings: holdingsOut,
      extractedAt: new Date().toISOString()
    };

    console.log('Successfully extracted data:', extractedData);
    return extractedData;

  } catch (error) {
    console.error('Error analyzing screenshot with OpenAI:', error);
    
    // If it's an authentication error, provide helpful message
    if (error.message.includes('401') || error.message.includes('API key')) {
      console.error('⚠️ OpenAI API key is invalid or expired. Please:');
      console.error('   1. Go to https://platform.openai.com/api-keys');
      console.error('   2. Create a new API key');
      console.error('   3. Update backend/.env with the new key');
      console.error('   4. Restart the server');
    }
    
    // Fallback to basic detection if API fails
    const fallbackData = {
      accounts: [{
        balance: 0,
        interestRate: null,
        accountType: detectAccountType(platform),
        currency: 'EUR',
        accountName: platform
      }],
      totalBalance: 0,
      currency: 'EUR',
      platform: platform,
      holdings: null,
      error: error.message,
      extractedAt: new Date().toISOString()
    };
    return fallbackData;
  }
}

/**
 * Detects account type based on platform name
 */
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
  if (platformLower.includes('bank')) {
    return 'bank';
  }
  return 'unknown';
}

