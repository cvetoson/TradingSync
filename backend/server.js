import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './database.js';
import { backfillAccountHistory } from './routes/backfillHistory.js';
import { requireAuth, requireAccountAuth, requireHistoryAuth, requireHoldingAuth, register, login, verifyEmail, forgotPassword, resetPassword, getProfile, updateProfile, changePassword } from './routes/auth.js';
import { uploadScreenshot, getPortfolioSummary, getAccounts, createAccount, createHolding, updateAccountName, updateAccountType, updateAccountPlatform, updateAccountBalance, updateAccountInterestRate, getAccountHistory, getAccountHoldings, getHoldingsProjection, updateAccountWithScreenshot, addHoldingsFromScreenshot, deleteAccount, deleteHistoryEntry, updateHoldingSymbol, updateHoldingQuantity, updateHoldingPrice, deleteHolding, verifyHoldingSymbol } from './routes/portfolio.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize database
initDatabase();

// Backfill history for existing accounts (run once on startup)
backfillAccountHistory()
  .then((result) => {
    if (result.created > 0) {
      console.log(`✅ Backfilled history for ${result.created} account(s)`);
    }
  })
  .catch((err) => {
    console.error('Error backfilling history:', err);
  });

// Auth routes (public)
app.post('/api/auth/register', register);
app.post('/api/auth/verify-email', verifyEmail);
app.post('/api/auth/login', login);
app.post('/api/auth/forgot-password', forgotPassword);
app.post('/api/auth/reset-password', resetPassword);

// Protected routes (require authentication)
app.get('/api/auth/me', requireAuth, getProfile);
app.put('/api/auth/profile', requireAuth, updateProfile);
app.put('/api/auth/change-password', requireAuth, changePassword);
app.post('/api/upload', requireAuth, upload.single('screenshot'), uploadScreenshot);
app.get('/api/portfolio/summary', requireAuth, getPortfolioSummary);
app.get('/api/accounts', requireAuth, getAccounts);
app.post('/api/accounts', requireAuth, createAccount);
app.post('/api/accounts/:id/holdings', requireAuth, requireAccountAuth, createHolding);
app.get('/api/accounts/:id/history', requireAuth, requireAccountAuth, getAccountHistory);
app.get('/api/accounts/:id/holdings', requireAuth, requireAccountAuth, getAccountHoldings);
app.get('/api/accounts/:id/holdings/projection', requireAuth, requireAccountAuth, getHoldingsProjection);
app.put('/api/accounts/:id/name', requireAuth, requireAccountAuth, updateAccountName);
app.put('/api/accounts/:id/type', requireAuth, requireAccountAuth, updateAccountType);
app.put('/api/accounts/:id/platform', requireAuth, requireAccountAuth, updateAccountPlatform);
app.put('/api/accounts/:id/balance', requireAuth, requireAccountAuth, updateAccountBalance);
app.put('/api/accounts/:id/interest-rate', requireAuth, requireAccountAuth, updateAccountInterestRate);
app.put('/api/accounts/:id/update', requireAuth, requireAccountAuth, upload.single('screenshot'), updateAccountWithScreenshot);
app.post('/api/accounts/:id/add-holdings', requireAuth, requireAccountAuth, upload.single('screenshot'), addHoldingsFromScreenshot);
app.delete('/api/accounts/:id', requireAuth, requireAccountAuth, deleteAccount);
app.delete('/api/history/:id', requireAuth, requireHistoryAuth, deleteHistoryEntry);
app.get('/api/holdings/verify-symbol', requireAuth, verifyHoldingSymbol);
app.put('/api/holdings/:id/symbol', requireAuth, requireHoldingAuth, updateHoldingSymbol);
app.put('/api/holdings/:id/quantity', requireAuth, requireHoldingAuth, updateHoldingQuantity);
app.put('/api/holdings/:id/price', requireAuth, requireHoldingAuth, updateHoldingPrice);
app.delete('/api/holdings/:id', requireAuth, requireHoldingAuth, deleteHolding);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Trading Sync API is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
