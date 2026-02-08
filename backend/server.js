import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './database.js';
import { backfillAccountHistory } from './routes/backfillHistory.js';
import { uploadScreenshot, getPortfolioSummary, getAccounts, updateAccountName, updateAccountType, updateAccountPlatform, updateAccountBalance, updateAccountInterestRate, getAccountHistory, getAccountHoldings, updateAccountWithScreenshot, deleteAccount, deleteHistoryEntry, updateHoldingSymbol, updateHoldingQuantity, updateHoldingPrice, verifyHoldingSymbol } from './routes/portfolio.js';

dotenv.config();

// #region agent log
const debugLog = (location, message, data, hypothesisId) => {
  fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location,message,data:{...data},timestamp:Date.now(),runId:'upload-debug',hypothesisId})}).catch(()=>{});
};
// #endregion

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

// Routes
app.post('/api/upload', (req, res, next) => {
  debugLog('server.js:55', 'Upload route hit', {method:req.method,path:req.path,hasBody:!!req.body}, 'A');
  next();
}, upload.single('screenshot'), (req, res, next) => {
  debugLog('server.js:multer', 'Multer processed', {hasFile:!!req.file,fileSize:req.file?.size,fileName:req.file?.filename}, 'B');
  next();
}, uploadScreenshot);
app.get('/api/portfolio/summary', getPortfolioSummary);
app.get('/api/accounts', getAccounts);
app.get('/api/accounts/:id/history', getAccountHistory);
app.get('/api/accounts/:id/holdings', getAccountHoldings);
app.put('/api/accounts/:id/name', updateAccountName);
app.put('/api/accounts/:id/type', updateAccountType);
app.put('/api/accounts/:id/platform', updateAccountPlatform);
app.put('/api/accounts/:id/balance', updateAccountBalance);
app.put('/api/accounts/:id/interest-rate', updateAccountInterestRate);
app.put('/api/accounts/:id/update', upload.single('screenshot'), updateAccountWithScreenshot);
app.delete('/api/accounts/:id', deleteAccount);
app.delete('/api/history/:id', deleteHistoryEntry);
app.get('/api/holdings/verify-symbol', verifyHoldingSymbol);
app.put('/api/holdings/:id/symbol', updateHoldingSymbol);
app.put('/api/holdings/:id/quantity', updateHoldingQuantity);
app.put('/api/holdings/:id/price', updateHoldingPrice);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Trading Sync API is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
