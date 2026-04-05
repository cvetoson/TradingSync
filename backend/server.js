import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, isPostgreSQL } from './database.js';
import { getRecentErrors } from './lib/errorLog.js';
import { getLastEmailError, sendEmail } from './services/emailService.js';
import { backfillAccountHistory } from './routes/backfillHistory.js';
import { requireAuth, requireAccountAuth, requireHistoryAuth, requireHoldingAuth, register, login, verifyEmail, forgotPassword, resetPassword, getProfile, updateProfile, changePassword } from './routes/auth.js';
import { uploadScreenshot, getPortfolioSummary, getAccounts, createAccount, createHolding, updateAccountName, updateAccountType, updateAccountPlatform, updateAccountTag, updateAccountBalance, updateAccountInterestRate, getAccountHistory, getAccountHoldings, getHoldingsProjection, updateAccountWithScreenshot, addHoldingsFromScreenshot, deleteAccount, deleteHistoryEntry, updateHoldingSymbol, updateHoldingQuantity, updateHoldingPrice, deleteHolding, verifyHoldingSymbol } from './routes/portfolio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load backend/.env so DATABASE_PUBLIC_URL is used when running from project root or any cwd
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'uploads')));

// Serve frontend in production
const frontendPath = join(__dirname, '..', 'frontend', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(frontendPath));
}

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

// Ensure uploads directory exists (multer needs it)
const uploadsDir = join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Initialize database and start server
async function start() {
  const usePostgres = isPostgreSQL();
  console.log(`📦 Using ${usePostgres ? 'PostgreSQL' : 'SQLite'} database`);
  if (!usePostgres && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  SQLite in production: data may be lost on redeploy. Set DATABASE_URL for PostgreSQL.');
  }
  await initDatabase();
  await backfillAccountHistory().then((r) => {
    if (r.created > 0) console.log(`✅ Backfilled history for ${r.created} account(s)`);
  }).catch((err) => console.error('Error backfilling history:', err));

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
  app.post('/api/upload', requireAuth, (req, res, next) => {
    upload.single('screenshot')(req, res, (multerErr) => {
      if (multerErr) {
        console.error('[UPLOAD] Multer error:', multerErr);
        const msg = multerErr.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10MB)' : multerErr.message || 'File upload failed';
        return res.status(400).json({ error: msg });
      }
      uploadScreenshot(req, res).catch((err) => {
        console.error('[UPLOAD] Handler error:', err?.message, err?.stack);
        if (!res.headersSent) {
          const msg = err?.message || 'Upload failed';
          res.status(500).json({ error: msg });
        }
      });
    });
  });
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
  app.put('/api/accounts/:id/tag', requireAuth, requireAccountAuth, updateAccountTag);
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

  // Dev: root is not the SPA (Vite default 5173); avoid "broken" empty 404
  if (process.env.NODE_ENV !== 'production') {
    app.get('/', (req, res) => {
      const uiPort = process.env.VITE_DEV_PORT || 5173;
      res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Trading Sync API</title></head>
<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1.25rem;line-height:1.5;color:#111">
  <h1 style="font-size:1.25rem;font-weight:600">Trading Sync — API only (dev)</h1>
  <p>This port serves the <strong>API</strong>. The web app runs separately.</p>
  <p>Open the UI: <a href="http://localhost:${uiPort}">http://localhost:${uiPort}</a><br/>
  <span style="color:#555;font-size:0.9rem">From the project root run <code style="background:#f3f4f6;padding:0.1rem 0.35rem;border-radius:4px">npm run dev</code> to start API + frontend together.</span></p>
  <p style="font-size:0.9rem"><a href="/api/health">GET /api/health</a></p>
</body></html>`);
    });
  }

  // Debug endpoint – for AI/remote troubleshooting (no secrets)
  app.get('/api/debug', (req, res) => {
    res.json({
      status: 'ok',
      database: isPostgreSQL() ? 'PostgreSQL' : 'SQLite',
      nodeEnv: process.env.NODE_ENV || 'development',
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasSmtp: !!(process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER)),
      smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      appUrl: process.env.APP_URL || '(not set)',
      recentErrors: getRecentErrors(),
      lastEmailError: getLastEmailError() || null,
    });
  });

  // Test email – only when EMAIL_TEST_ENABLED=true. GET /api/test-email?to=you@example.com
  app.get('/api/test-email', async (req, res) => {
    if (process.env.EMAIL_TEST_ENABLED !== 'true') {
      return res.status(404).json({ error: 'Not found' });
    }
    const to = req.query.to;
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Add ?to=your@email.com' });
    }
    const result = await sendEmail({
      to,
      subject: 'Trading Sync – test email',
      html: '<p>If you received this, email is working.</p>',
    });
    res.json({ sent: result.sent, error: result.error || null, lastEmailError: getLastEmailError() });
  });

  // SPA fallback: serve index.html for non-API routes in production
  if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(join(frontendPath, 'index.html'));
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
