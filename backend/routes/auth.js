import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
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

  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const hash = await bcrypt.hash(password, 10);
  const verificationToken = randomToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.run(
    `INSERT INTO users (email, password_hash, display_name, email_verified, email_verification_token, email_verification_expires)
     VALUES (?, ?, ?, 0, ?, ?)`,
    [emailNorm, hash, (displayName || '').trim() || null, verificationToken, expiresAt],
    async function (err) {
      if (err) {
        if (err.message?.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Email already registered' });
        }
        return res.status(500).json({ error: err.message });
      }

      const emailResult = await sendVerificationEmail(emailNorm, verificationToken, APP_URL);
      if (emailResult.devLink) {
        console.log('📧 Verification link (dev):', emailResult.devLink);
        return res.status(201).json({
          success: true,
          message: 'Check your email to verify your account',
          email: emailNorm,
          devLink: emailResult.devLink,
        });
      }

      res.status(201).json({
        success: true,
        message: 'Check your email to verify your account',
        email: emailNorm,
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
      if (err) return res.status(500).json({ error: err.message });
      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired verification link' });
      }

      db.run(
        'UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?',
        [user.id],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          const jwtToken = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
          );
          res.json({
            success: true,
            token: jwtToken,
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
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: 'Invalid email or password' });

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

      if (!user.email_verified) {
        return res.status(403).json({
          error: 'Please verify your email before signing in',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      res.json({
        success: true,
        token,
        user: { id: user.id, email: user.email, displayName: user.display_name },
      });
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
    if (err) return res.status(500).json({ error: err.message });
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If that email exists, we sent a reset link' });
    }

    db.run(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [resetToken, expiresAt, user.id],
      async (updateErr) => {
        if (updateErr) return res.status(500).json({ error: updateErr.message });

        const emailResult = await sendPasswordResetEmail(emailNorm, resetToken, APP_URL);
        if (emailResult.devLink) {
          console.log('📧 Password reset link (dev):', emailResult.devLink);
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

  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const hash = await bcrypt.hash(password, 10);

  db.get(
    'SELECT id, email FROM users WHERE password_reset_token = ? AND password_reset_expires > ?',
    [token, new Date().toISOString()],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset link' });
      }

      db.run(
        'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
        [hash, user.id],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
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
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  db.get('SELECT password_hash FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(oldPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, userId], function (updateErr) {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      res.json({ success: true, message: 'Password updated' });
    });
  });
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
  db.get('SELECT id FROM accounts WHERE id = ? AND (user_id = ? OR user_id IS NULL)', [accountId, userId], (err, row) => {
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
    'SELECT h.id FROM account_history h JOIN accounts a ON h.account_id = a.id WHERE h.id = ? AND (a.user_id = ? OR a.user_id IS NULL)',
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
    'SELECT h.id FROM holdings h JOIN accounts a ON h.account_id = a.id WHERE h.id = ? AND (a.user_id = ? OR a.user_id IS NULL)',
    [holdingId, userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Holding not found' });
      next();
    }
  );
}
