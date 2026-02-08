import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export async function getPortfolioSummary() {
  const response = await axios.get(`${API_BASE_URL}/portfolio/summary`);
  return response.data;
}

export async function uploadScreenshot(file, investmentCategory, accountType) {
  const formData = new FormData();
  formData.append('screenshot', file);
  formData.append('investmentCategory', investmentCategory);
  formData.append('accountType', accountType || 'unknown');

  const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function getAccounts() {
  const response = await axios.get(`${API_BASE_URL}/accounts`);
  return response.data;
}

export async function updateAccountName(accountId, accountName) {
  const response = await axios.put(`${API_BASE_URL}/accounts/${accountId}/name`, {
    accountName: accountName
  });
  return response.data;
}

export async function updateAccountType(accountId, accountType) {
  const response = await axios.put(`${API_BASE_URL}/accounts/${accountId}/type`, {
    accountType: accountType
  });
  return response.data;
}

export async function updateAccountPlatform(accountId, platform) {
  const response = await axios.put(`${API_BASE_URL}/accounts/${accountId}/platform`, {
    platform: platform
  });
  return response.data;
}

export async function getAccountHistory(accountId) {
  const response = await axios.get(`${API_BASE_URL}/accounts/${accountId}/history`);
  return response.data;
}

export async function updateAccountWithScreenshot(accountId, file) {
  const formData = new FormData();
  formData.append('screenshot', file);

  const response = await axios.put(`${API_BASE_URL}/accounts/${accountId}/update`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function deleteAccount(accountId) {
  const response = await axios.delete(`${API_BASE_URL}/accounts/${accountId}`);
  return response.data;
}

export async function deleteHistoryEntry(historyId) {
  const response = await axios.delete(`${API_BASE_URL}/history/${historyId}`);
  return response.data;
}

export async function getAccountHoldings(accountId) {
  const response = await axios.get(`${API_BASE_URL}/accounts/${accountId}/holdings`);
  return response.data;
}

export async function updateAccountBalance(accountId, balance) {
  const response = await axios.put(`${API_BASE_URL}/accounts/${accountId}/balance`, {
    balance: balance
  });
  return response.data;
}

export async function updateAccountInterestRate(accountId, interestRate) {
  const response = await axios.put(`${API_BASE_URL}/accounts/${accountId}/interest-rate`, {
    interestRate: interestRate
  });
  return response.data;
}

export async function verifyHoldingSymbol(symbol, assetType = 'stock') {
  const response = await axios.get(`${API_BASE_URL}/holdings/verify-symbol`, {
    params: { symbol: symbol.trim().toUpperCase(), assetType }
  });
  return response.data;
}

export async function updateHoldingSymbol(holdingId, symbol) {
  const response = await axios.put(`${API_BASE_URL}/holdings/${holdingId}/symbol`, {
    symbol: symbol
  });
  return response.data;
}

export async function updateHoldingQuantity(holdingId, quantity) {
  const response = await axios.put(`${API_BASE_URL}/holdings/${holdingId}/quantity`, {
    quantity: quantity
  });
  return response.data;
}

export async function updateHoldingPrice(holdingId, price, currency) {
  const body = { price };
  if (currency === 'USD' || currency === 'EUR') body.currency = currency;
  const response = await axios.put(`${API_BASE_URL}/holdings/${holdingId}/price`, body);
  return response.data;
}

export async function deleteHolding(holdingId) {
  const response = await axios.delete(`${API_BASE_URL}/holdings/${holdingId}`);
  return response.data;
}
