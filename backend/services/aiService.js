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
function getOpenAIClient() {
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
 * Analyzes a screenshot and extracts portfolio data using OpenAI Vision API
 * @param {string} filePath - Path to the uploaded screenshot
 * @param {string} platform - Investment category display name
 * @param {string} accountType - Account type (p2p, stocks, crypto, etc.)
 * @returns {Promise<Object>} Extracted data object
 */
export async function analyzeScreenshot(filePath, platform, accountType = null) {
  try {
    console.log(`Analyzing screenshot from ${platform}${accountType ? ` (${accountType})` : ' (auto-detect)'} at ${filePath}`);
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables. Please check backend/.env file and restart the server.');
    }

    // Read the image file and convert to base64
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Determine image MIME type
    const ext = filePath.split('.').pop().toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';

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
      "purchasePrice": <purchase price if visible, or null>,
      "assetType": <"stock", "crypto", "etf", "bond", or "precious" for gold/silver/XAG/XAU>,
      "name": <full name of the asset (e.g., "Tesla", "ASML Holding", "Advanced Micro Devices")>,
      "currency": <currency of the price/value - DETECT from symbols: € or EUR → "EUR", $ or USD → "USD", £ or GBP → "GBP", Fr or CHF → "CHF">
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
  - Set "currency" for each account from the displayed balance (e.g., "1,210.14 €" → EUR)
  - Set "currency" for each holding from the value/price column (e.g., "508.65 €" → EUR, "33.40 $" → USD)
  - If the account header shows "Portfolio in EUR" or similar, use that for the primary "currency" field
- **CRITICAL FOR STOCK/ETF ACCOUNTS**: If you see a brokerage account with multiple holdings (stocks, ETFs, bonds):
  - Extract EACH individual holding as a separate object in the "holdings" array
  - For each holding, extract: symbol (e.g., "TSLA", "ASML", "ROMANIA" for bonds, "XAG" for silver, "XAU" for gold), quantity (e.g., 0.42, 0.06), name (e.g., "Tesla", "ASML Holding", "Silver", "Gold")
  - **IMPORTANT FOR SYMBOLS**: Use the visible name/ticker from the screenshot. For bonds like "Romania 5.25% 05/32", use "ROMANIA" as the symbol (NOT the ISIN code unless it's clearly visible in the screenshot)
  - Extract the current value shown for each holding (e.g., "149,20 €" for Tesla, "543,42 €" for Romania bond, "44,21 €" for cash)
  - **CRITICAL**: Extract "currentValue" field for each holding - this is the TOTAL VALUE shown in the screenshot (e.g., 149.20, 543.42, 44.21)
  - If price per share is visible (e.g., "411,70 $"), extract it as "currentPrice"
  - **CRITICAL**: Set "currency" for each holding from the value/price column - if you see "508.65 €" use "EUR", if "33.40 $" use "USD", if "£29.21" use "GBP"
  - **European brokers (Trading 212, Revolut, etc.)**: If ALL values in the portfolio are shown in € (euro), set currency "EUR" for every holding - the broker converts to EUR for display
  - **IMPORTANT**: Also extract "Cash balance" or "Cash" as a holding with:
    - symbol: "CASH" or "CASH_BALANCE"
    - quantity: 1 (or the cash amount if shown as quantity)
    - currentValue: the cash amount (e.g., 44.21)
    - currentPrice: the cash amount (same as currentValue for cash)
  - For bonds, extract the currentValue shown (e.g., "543,42 €" = 543.42) and use a simple name like "ROMANIA" as the symbol
  - The "balance" field for the account should be the TOTAL account value (sum of all holdings + cash)
  - Example: If you see "Brokerage account" with total "1210,14 €" and individual holdings like "Tesla: 149,20 € (0.42 TSLA)", "Romania 5.25% 05/32: 543,42 €", "Cash balance: 44,21 €", extract each holding separately with their currentValue and use "ROMANIA" (not ISIN) as the symbol for the bond
- Return ONLY valid JSON, no additional text or explanation
- If a field cannot be determined, use null for that field
- Numbers should be actual numbers, not strings`;

    // Call OpenAI Vision API
    // Try gpt-4o first, fallback to gpt-4o-mini or gpt-4-turbo if needed
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    const client = getOpenAIClient();
    
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1 // Low temperature for more consistent extraction
    });

    // Extract the JSON response
    const content = response.choices[0].message.content.trim();
    
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
        
        return {
          balance: balance,
          interestRate: acc.interestRate ? parseFloat(acc.interestRate) : null,
          currency: acc.currency || jsonData.currency || 'EUR',
          accountName: acc.accountName || platform,
          accountType: acc.accountType || detectAccountType(platform),
          investedAmount: investedAmount,
          investmentDate: investmentDate,
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
      
      accounts = [{
        balance: balance,
        interestRate: jsonData.interestRate ? parseFloat(jsonData.interestRate) : null,
        currency: jsonData.currency || 'EUR',
        accountName: jsonData.accountName || platform,
        accountType: jsonData.accountType || detectAccountType(platform),
        investedAmount: investedAmount,
        investmentDate: investmentDate,
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
    
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    
    const extractedData = {
      accounts: accounts,
      totalBalance: totalBalance,
      currency: jsonData.currency || 'EUR',
      platform: jsonData.platform || platform,
      holdings: jsonData.holdings && Array.isArray(jsonData.holdings) 
        ? jsonData.holdings.map(h => {
            const currentValue = h.currentValue != null ? parseFloat(h.currentValue) : (h.current_value != null ? parseFloat(h.current_value) : (h.value != null ? parseFloat(h.value) : (h.amount != null ? parseFloat(h.amount) : null)));
            return {
              symbol: h.symbol,
              quantity: parseFloat(h.quantity) || 0,
              purchasePrice: h.purchasePrice ? parseFloat(h.purchasePrice) : (h.purchase_price != null ? parseFloat(h.purchase_price) : null),
              currentPrice: h.currentPrice ? parseFloat(h.currentPrice) : (h.current_price != null ? parseFloat(h.current_price) : null),
              currentValue,
              assetType: h.assetType || h.asset_type || 'stock',
              currency: h.currency || jsonData.currency || 'EUR'
            };
          })
        : null,
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

