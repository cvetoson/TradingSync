import { getDatabase } from '../database.js';
import { fetchCurrentPrice } from './marketData.js';
import { isP2pOrSavingsType } from '../lib/portfolioUtils.js';

/**
 * Calculates the current portfolio value for an account
 * Handles different account types:
 * - P2P/savings: Uses balance + interest calculations
 * - Stocks: Uses current market prices
 * - Crypto: Uses current market prices
 */
export async function calculatePortfolioValue(account) {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    try {
      const balanceNum = Number(account.balance);
      const balance = Number.isFinite(balanceNum) ? balanceNum : 0;
      // Savings accrues exactly like P2P: the account tier, UI badge, and daily
      // history backfill all already treat 'savings' as compounding.
      if (isP2pOrSavingsType(account.account_type)) {
        // For P2P/savings, calculate based on balance and interest rate
        // Future value = balance * (1 + interest_rate/100) ^ (days/365)
        const interestRate = account.interest_rate || 0;
        
        // Calculate days since last update
        const lastUpdated = new Date(account.last_updated);
        const now = new Date();
        const daysSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60 * 24);
        
        // Compound interest calculation: Future Value = Present Value * (1 + rate)^(days/365)
        const rateDecimal = interestRate / 100;
        const currentValue = balance * Math.pow(1 + rateDecimal, daysSinceUpdate / 365);
        
        resolve(currentValue);
    } else if (account.account_type === 'stocks' || account.account_type === 'crypto' || account.account_type === 'precious') {
      // For stocks/crypto/precious, just use the balance from the account
      // Don't recalculate from holdings - use the value that was uploaded
      resolve(balance);
    } else {
      // For other types, just return balance
      resolve(balance);
    }
    } catch (error) {
      console.error('Error calculating portfolio value:', error);
      reject(error);
    }
  });
}
