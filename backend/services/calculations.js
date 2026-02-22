import { getDatabase } from '../database.js';
import { fetchCurrentPrice } from './marketData.js';

/**
 * Calculates the current portfolio value for an account
 * Handles different account types:
 * - P2P: Uses balance + interest calculations
 * - Stocks: Uses current market prices
 * - Crypto: Uses current market prices
 */
export async function calculatePortfolioValue(account) {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    try {
      if (account.account_type === 'p2p') {
        // For P2P, calculate based on balance and interest rate
        // Future value = balance * (1 + interest_rate/100) ^ (days/365)
        const balance = account.balance || 0;
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
      resolve(account.balance || 0);
    } else {
      // For other types, just return balance
      resolve(account.balance || 0);
    }
    } catch (error) {
      console.error('Error calculating portfolio value:', error);
      reject(error);
    }
  });
}

/**
 * Calculates future value for P2P accounts
 * @param {number} balance - Current balance
 * @param {number} interestRate - Annual interest rate
 * @param {number} months - Number of months
 * @param {number} days - Additional days
 * @returns {number} Future value
 */
export function calculateFutureValue(balance, interestRate, months = 0, days = 0) {
  const totalDays = months * 30 + days;
  const years = totalDays / 365;
  
  // Compound interest: FV = PV * (1 + r)^t
  return balance * Math.pow(1 + (interestRate / 100), years);
}
