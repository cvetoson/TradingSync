import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { logError } from '../lib/errorLog.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production — refusing to start with the built-in development secret.');
  }
  console.warn('⚠️  JWT_SECRET not set — using an insecure development-only secret.');
  return 'dev-secret-change-in-production';
})();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// httpOnly cookie holding the JWT. Keeping the token out of JS-readable storage
// (localStorage) removes the XSS-token-theft risk.
const AUTH_COOKIE = 'auth_token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches JWT default expiry

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS-only in production
    sameSite: 'lax', // sent on top-level navigation, blocked on cross-site POST (CSRF defense)
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
}

function clearAuthCookie(res) {
  // Options (except maxAge) must match those used to set it, or the browser won't clear it.
  const { maxAge, ...opts } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE, opts);
}

/** Extract the JWT from the auth cookie, falling back to an Authorization: Bearer header. */
function extractToken(req) {
  if (req.cookies && req.cookies[AUTH_COOKIE]) return req.cookies[AUTH_COOKIE];
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function logout(req, res) {
  clearAuthCookie(res);
  res.json({ success: true });
}

// Canonical production host, used only when APP_URL is not configured. Reset links
// must NEVER be derived from request headers (X-Forwarded-Host / Host): the reset
// token is a bearer credential, so a client-supplied host would let an attacker
// poison a victim's reset email and capture the token.
const PROD_FALLBACK_APP_URL = 'https://tradingsync-production.up.railway.app';

/**
 * Resolve the public app base URL for links in emails.
 * Priority: explicit APP_URL → hardcoded canonical production host → dev frontend port.
 */
function resolveAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  APP_URL not set — email links use the canonical production host. Set APP_URL explicitly.');
    return PROD_FALLBACK_APP_URL;
  }
  const devPort = process.env.VITE_DEV_PORT || 5173;
  return `http://localhost:${devPort}`;
}

export async function register(req, res) {
  const db = getDatabase();
  const { email, password, confirmPassword, displayName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  const emailNorm = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Non-string passwords (e.g. JSON numbers) make bcryptjs throw; the async rejection
  // would otherwise escape Express 4 and crash the process (unauthenticated DoS).
  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Password must be a string' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  let hash;
  try {
    hash = await bcrypt.hash(password, 10);
  } catch (e) {
    logError('POST /auth/register', e?.message || 'hash failed', 500);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
  const displayNameVal = (displayName || '').trim() || null;

  // TODO: Add email verification – require verify before login, send verification email on register
  db.run(
    `INSERT INTO users (email, password_hash, display_name, email_verified, email_verification_token, email_verification_expires)
     VALUES (?, ?, ?, 1, NULL, NULL)`,
    [emailNorm, hash, displayNameVal],
    function (err) {
      if (err) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('unique') || msg.includes('duplicate key')) {
          // Known tradeoff: the distinct 409 lets an attacker probe which emails are
          // registered, but the clear error is deliberately kept for signup UX.
          // Login and forgot-password stay generic, and this route is rate-limited.
          logError('POST /auth/register', 'duplicate_email', 409);
          return res.status(409).json({
            error: 'This email is already registered. Sign in or use Forgot password to reset.',
          });
        }
        logError('POST /auth/register', err.message, 500);
        return res.status(500).json({ error: 'Registration failed. Please try again.' });
      }

      const jwtToken = jwt.sign(
        { userId: this.lastID, email: emailNorm },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      setAuthCookie(res, jwtToken);
      res.status(201).json({
        success: true,
        user: { id: this.lastID, email: emailNorm, displayName: displayNameVal },
      });
    }
  );
}

export async function verifyEmail(req, res) {
  const db = getDatabase();
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  db.get(
    'SELECT id, email, display_name FROM users WHERE email_verification_token = ? AND email_verification_expires > ?',
    [token, new Date().toISOString()],
    (err, user) => {
      if (err) {
        logError('POST /auth/verify-email', err.message, 500);
        return res.status(500).json({ error: 'Verification failed. Please try again.' });
      }
      if (!user) {
        return res.status(400).json({ error: 'This link is invalid or has expired. Request a new one.' });
      }

      db.run(
        'UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?',
        [user.id],
        (updateErr) => {
          if (updateErr) {
            logError('POST /auth/verify-email', updateErr.message, 500);
            return res.status(500).json({ error: 'Verification failed. Please try again.' });
          }
          const jwtToken = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
          );
          setAuthCookie(res, jwtToken);
          res.json({
            success: true,
            user: { id: user.id, email: user.email, displayName: user.display_name },
          });
        }
      );
    }
  );
}

export async function login(req, res) {
  const db = getDatabase();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const emailNorm = String(email).trim().toLowerCase();

  db.get(
    'SELECT id, email, password_hash, display_name, email_verified FROM users WHERE email = ?',
    [emailNorm],
    async (err, user) => {
      if (err) {
        logError('POST /auth/login', err.message, 500);
        return res.status(500).json({ error: 'Sign in failed. Please try again.' });
      }
      if (!user) return res.status(401).json({ error: 'Invalid email or password' });

      try {
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

        const token = jwt.sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        setAuthCookie(res, token);
        res.json({
          success: true,
          user: { id: user.id, email: user.email, displayName: user.display_name },
        });
      } catch (e) {
        logError('POST /auth/login', e?.message || 'Unknown', 500);
        res.status(500).json({ error: 'Sign in failed. Please try again.' });
      }
    }
  );
}

export async function forgotPassword(req, res) {
  const db = getDatabase();
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailNorm = String(email).trim().toLowerCase();
  const resetToken = randomToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  db.get('SELECT id, email FROM users WHERE email = ?', [emailNorm], async (err, user) => {
    if (err) {
      logError('POST /auth/forgot-password', err.message, 500);
      return res.status(500).json({ error: 'Could not process request. Please try again.' });
    }
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If that email exists, we sent a reset link' });
    }

    db.run(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [resetToken, expiresAt, user.id],
      async (updateErr) => {
        if (updateErr) {
          logError('POST /auth/forgot-password', updateErr.message, 500);
          return res.status(500).json({ error: 'Could not process request. Please try again.' });
        }

        const emailResult = await sendPasswordResetEmail(emailNorm, resetToken, resolveAppUrl());
        if (!emailResult.sent) {
          console.error('📧 Password reset email failed:', emailResult.error);
        }
        // The reset link is a bearer credential for the victim's account: returning
        // it to the (unauthenticated) caller allows account takeover. Only expose it
        // in local development, where no email provider is configured.
        if (emailResult.devLink && process.env.NODE_ENV !== 'production') {
          return res.json({
            success: true,
            message: 'If that email exists, we sent a reset link',
            devLink: emailResult.devLink,
          });
        }
        res.json({ success: true, message: 'If that email exists, we sent a reset link' });
      }
    );
  });
}

export async function resetPassword(req, res) {
  const db = getDatabase();
  const { token, password, confirmPassword } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Password must be a string' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  let hash;
  try {
    hash = await bcrypt.hash(password, 10);
  } catch (e) {
    logError('POST /auth/reset-password', e?.message || 'hash failed', 500);
    return res.status(500).json({ error: 'Could not reset password. Please try again.' });
  }

  db.get(
    'SELECT id, email FROM users WHERE password_reset_token = ? AND password_reset_expires > ?',
    [token, new Date().toISOString()],
    (err, user) => {
      if (err) {
        logError('POST /auth/reset-password', err.message, 500);
        return res.status(500).json({ error: 'Could not reset password. Please try again.' });
      }
      if (!user) {
        return res.status(400).json({
          error: 'This reset link is invalid or has expired. Request a new one from Forgot password.',
        });
      }

      db.run(
        'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
        [hash, user.id],
        (updateErr) => {
          if (updateErr) {
            logError('POST /auth/reset-password', updateErr.message, 500);
            return res.status(500).json({ error: 'Could not reset password. Please try again.' });
          }
          res.json({ success: true, message: 'Password updated. You can now sign in.' });
        }
      );
    }
  );
}

export async function getProfile(req, res) {
  const db = getDatabase();
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  db.get('SELECT id, email, display_name FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, displayName: user.display_name });
  });
}

export async function updateProfile(req, res) {
  const db = getDatabase();
  const userId = req.userId;
  const { displayName } = req.body;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const name = (displayName ?? '').trim() || null;
  db.run('UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, displayName: name });
  });
}

export async function changePassword(req, res) {
  const db = getDatabase();
  const userId = req.userId;
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old password and new password are required' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New passwords do not match' });
  }
  if (typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'New password must be a string' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  db.get('SELECT password_hash FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });

    try {
      const ok = await bcrypt.compare(oldPassword, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

      const hash = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, userId], function (updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        res.json({ success: true, message: 'Password updated' });
      });
    } catch (e) {
      logError('PUT /auth/change-password', e?.message || 'hash failed', 500);
      res.status(500).json({ error: 'Could not update password. Please try again.' });
    }
  });
}


// ---------------------------------------------------------------------------
// Account deletion (Apple App Store requirement 5.1.1(v)): removes the user and
// every row derived from their data, then clears the session. Password-gated so
// a borrowed unlocked phone cannot destroy the account.
const UPLOADS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

export async function deleteUserAccount(req, res) {
  const db = getDatabase();
  const userId = req.userId;
  const { password } = req.body || {};
  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Password is required to delete the account' });
  }

  const get = (sql, params) => new Promise((resolve, reject) => db.get(sql, params, (e, row) => (e ? reject(e) : resolve(row))));
  const all = (sql, params) => new Promise((resolve, reject) => db.all(sql, params, (e, rows) => (e ? reject(e) : resolve(rows || []))));
  const run = (sql, params) => new Promise((resolve, reject) => db.run(sql, params, (e) => (e ? reject(e) : resolve())));

  try {
    const user = await get('SELECT id, password_hash FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    let ok = false;
    try { ok = await bcrypt.compare(password, user.password_hash); } catch { ok = false; }
    if (!ok) return res.status(401).json({ error: 'Incorrect password' });

    const accounts = await all('SELECT id, screenshot_path FROM accounts WHERE user_id = ?', [userId]);
    const accountIds = accounts.map((a) => a.id);

    // Collect uploaded screenshot files before their rows disappear.
    const filePaths = new Set(accounts.map((a) => a.screenshot_path).filter(Boolean));
    if (accountIds.length > 0) {
      const ph = accountIds.map(() => '?').join(',');
      for (const row of await all(`SELECT file_path FROM screenshots WHERE account_id IN (${ph})`, accountIds)) {
        if (row.file_path) filePaths.add(row.file_path);
      }
      // Children first: FKs on production PostgreSQL reject orphaning deletes.
      for (const table of ['account_history', 'screenshots', 'holdings', 'transactions', 'cash_flows']) {
        await run(`DELETE FROM ${table} WHERE account_id IN (${ph})`, accountIds);
      }
      await run('DELETE FROM accounts WHERE user_id = ?', [userId]);
    }
    await run('DELETE FROM users WHERE id = ?', [userId]);

    // Best-effort file cleanup, strictly inside the uploads directory.
    for (const fp of filePaths) {
      try {
        const resolved = path.resolve(fp);
        if (resolved.startsWith(UPLOADS_DIR + path.sep)) fs.unlinkSync(resolved);
      } catch { /* already gone or unreadable — the DB rows are what matters */ }
    }

    clearAuthCookie(res);
    console.log(`Account deleted: user ${userId}, ${accountIds.length} accounts, ${filePaths.size} files`);
    return res.json({ success: true, message: 'Account and all data deleted' });
  } catch (err) {
    console.error('deleteUserAccount error:', err);
    return res.status(500).json({ error: 'Failed to delete the account' });
  }
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    req.userId = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch {
    req.userId = null;
    next();
  }
}

export function requireAccountAuth(req, res, next) {
  const accountId = req.params.id;
  if (!accountId) return next();
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const db = getDatabase();
  db.get('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [accountId, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Account not found' });
    next();
  });
}

export function requireHistoryAuth(req, res, next) {
  const historyId = req.params.id;
  if (!historyId) return next();
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const db = getDatabase();
  db.get(
    'SELECT h.id FROM account_history h JOIN accounts a ON h.account_id = a.id WHERE h.id = ? AND a.user_id = ?',
    [historyId, userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'History entry not found' });
      next();
    }
  );
}

export function requireHoldingAuth(req, res, next) {
  const holdingId = req.params.id;
  if (!holdingId) return next();
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const db = getDatabase();
  db.get(
    'SELECT h.id FROM holdings h JOIN accounts a ON h.account_id = a.id WHERE h.id = ? AND a.user_id = ?',
    [holdingId, userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Holding not found' });
      next();
    }
  );
}
