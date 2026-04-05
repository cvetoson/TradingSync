import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const AUTH_KEY = 'tradingsync_token';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Token expired or invalid - clear storage so user is redirected to login
      localStorage.removeItem('tradingsync_token');
      localStorage.removeItem('tradingsync_user');
    }
    return Promise.reject(err);
  }
);

export async function login(email, password) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
  return data;
}

export async function register(email, password, confirmPassword, displayName) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/register`, {
    email,
    password,
    confirmPassword,
    displayName: displayName || undefined,
  });
  return data;
}

export async function verifyEmail(token) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/verify-email`, { token });
  return data;
}

export async function forgotPassword(email) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
  return data;
}

export async function resetPassword(token, password, confirmPassword) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
    token,
    password,
    confirmPassword,
  });
  return data;
}

export async function getProfile() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function updateProfile(displayName) {
  const { data } = await api.put('/auth/profile', { displayName });
  return data;
}

export async function changePassword(oldPassword, newPassword, confirmPassword) {
  const { data } = await api.put('/auth/change-password', {
    oldPassword,
    newPassword,
    confirmPassword,
  });
  return data;
}

export async function getPortfolioSummary() {
  const response = await api.get('/portfolio/summary', {
    params: { _t: Date.now() }
  });
  return response.data;
}

export async function uploadScreenshot(file, investmentCategory, accountType) {
  const formData = new FormData();
  formData.append('screenshot', file);
  formData.append('investmentCategory', investmentCategory);
  formData.append('accountType', accountType || 'unknown');

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function getAccounts() {
  const response = await api.get('/accounts');
  return response.data;
}

export async function createAccount(accountName, platform, accountType) {
  const response = await api.post('/accounts', {
    accountName: accountName || 'Manual',
    platform: platform || 'Manual',
    accountType: accountType || 'stocks'
  });
  return response.data;
}

export async function createHolding(accountId, symbol, quantity, price, currency, assetType) {
  const body = { symbol, quantity };
  if (price != null && price !== '') body.price = parseFloat(price);
  if (currency) body.currency = currency;
  if (assetType) body.assetType = assetType;
  const response = await api.post(`/accounts/${accountId}/holdings`, body);
  return response.data;
}

export async function updateAccountName(accountId, accountName) {
  const response = await api.put(`/accounts/${accountId}/name`, {
    accountName: accountName
  });
  return response.data;
}

export async function updateAccountType(accountId, accountType) {
  const response = await api.put(`/accounts/${accountId}/type`, {
    accountType: accountType
  });
  return response.data;
}

export async function updateAccountPlatform(accountId, platform) {
  const response = await api.put(`/accounts/${accountId}/platform`, {
    platform: platform
  });
  return response.data;
}

export async function updateAccountTag(accountId, tag) {
  const response = await api.put(`/accounts/${accountId}/tag`, {
    tag: tag ?? ''
  });
  return response.data;
}

export async function getAccountHistory(accountId) {
  const response = await api.get(`/accounts/${accountId}/history`);
  return response.data;
}

export async function updateAccountWithScreenshot(accountId, file) {
  const formData = new FormData();
  formData.append('screenshot', file);

  const response = await api.put(`/accounts/${accountId}/update`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function addHoldingsFromScreenshot(accountId, file) {
  const formData = new FormData();
  formData.append('screenshot', file);

  const response = await api.post(`/accounts/${accountId}/add-holdings`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function deleteAccount(accountId) {
  const response = await api.delete(`/accounts/${accountId}`);
  return response.data;
}

export async function deleteHistoryEntry(historyId) {
  const response = await api.delete(`/history/${historyId}`);
  return response.data;
}

export async function getAccountHoldings(accountId) {
  const response = await api.get(`/accounts/${accountId}/holdings`, {
    params: { _t: Date.now() }
  });
  return response.data;
}

export async function getHoldingsProjection(accountId) {
  const response = await api.get(`/accounts/${accountId}/holdings/projection`);
  return response.data;
}

export async function updateAccountBalance(accountId, balance) {
  const response = await api.put(`/accounts/${accountId}/balance`, {
    balance: balance
  });
  return response.data;
}

export async function updateAccountInterestRate(accountId, interestRate) {
  const response = await api.put(`/accounts/${accountId}/interest-rate`, {
    interestRate: interestRate
  });
  return response.data;
}

export async function verifyHoldingSymbol(symbol, assetType = 'stock') {
  const response = await api.get('/holdings/verify-symbol', {
    params: { symbol: symbol.trim().toUpperCase(), assetType }
  });
  return response.data;
}

export async function updateHoldingSymbol(holdingId, symbol) {
  const response = await api.put(`/holdings/${holdingId}/symbol`, {
    symbol: symbol
  });
  return response.data;
}

export async function updateHoldingQuantity(holdingId, quantity) {
  const response = await api.put(`/holdings/${holdingId}/quantity`, {
    quantity: quantity
  });
  return response.data;
}

export async function updateHoldingPrice(holdingId, price, currency) {
  const body = { price };
  if (currency === 'USD' || currency === 'EUR') body.currency = currency;
  const response = await api.put(`/holdings/${holdingId}/price`, body);
  return response.data;
}

export async function deleteHolding(holdingId) {
  const response = await api.delete(`/holdings/${holdingId}`);
  return response.data;
}
