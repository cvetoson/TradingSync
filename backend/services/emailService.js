import nodemailer from 'nodemailer';

const EMAIL_TIMEOUT_MS = 15000; // 15s – avoid hanging on slow/failing SMTP

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: port ? parseInt(port, 10) : 587,
      secure: port === '465',
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
    });
  } else {
    // Dev fallback: create Ethereal test account (fake SMTP)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('📧 Email: using Ethereal test account. Check console for verification/reset links.');
  }

  return transporter;
}

/**
 * Send an email. Returns { sent: true, previewUrl? } or { sent: false, error, devLink? }
 * Wraps sendMail in a timeout so we never hang.
 */
export async function sendEmail({ to, subject, html, text }) {
  try {
    const transport = await getTransporter();
    const from = process.env.EMAIL_FROM || 'Trading Sync <noreply@tradingsync.app>';
    const sendPromise = transport.sendMail({
      from,
      to,
      subject,
      html: html || text,
      text: text || html?.replace(/<[^>]*>/g, '') || '',
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Email send timed out')), EMAIL_TIMEOUT_MS)
    );
    const info = await Promise.race([sendPromise, timeoutPromise]);

    const previewUrl = nodemailer.getTestMessageUrl?.(info);
    if (previewUrl) {
      console.log('📧 Email preview:', previewUrl);
    }

    return { sent: true, previewUrl };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { sent: false, error: err.message };
  }
}

/**
 * Send verification email. Returns devLink when no SMTP (for dev).
 * When no SMTP: skip Ethereal (can hang on Railway) and return link immediately.
 */
export async function sendVerificationEmail(email, token, appUrl) {
  const base = (appUrl || '').replace(/\/+$/, '');
  const verifyUrl = `${base}/verify-email?token=${encodeURIComponent(token)}`;
  if (!process.env.SMTP_HOST) {
    return { sent: false, devLink: verifyUrl };
  }
  const html = `
    <h2>Verify your email</h2>
    <p>Thanks for signing up for Trading Sync. Click the link below to verify your email:</p>
    <p><a href="${verifyUrl}" style="color:#4F46E5;font-weight:bold">Verify my email</a></p>
    <p>Or copy this link: ${verifyUrl}</p>
    <p>This link expires in 24 hours.</p>
    <p>If you didn't create an account, you can ignore this email.</p>
  `;
  const result = await sendEmail({ to: email, subject: 'Verify your Trading Sync email', html });
  if (!result.sent) return { ...result, devLink: verifyUrl };
  return result;
}

/**
 * Send password reset email.
 * Returns devLink when no SMTP or when send fails (fallback so user can still reset).
 */
export async function sendPasswordResetEmail(email, token, appUrl) {
  const base = (appUrl || '').replace(/\/+$/, '');
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  if (!process.env.SMTP_HOST) {
    return { sent: false, devLink: resetUrl };
  }
  const html = `
    <h2>Reset your password</h2>
    <p>You requested a password reset for Trading Sync. Click the link below to set a new password:</p>
    <p><a href="${resetUrl}" style="color:#4F46E5;font-weight:bold">Reset password</a></p>
    <p>Or copy this link: ${resetUrl}</p>
    <p>This link expires in 1 hour.</p>
    <p>If you didn't request this, you can ignore this email.</p>
  `;
  const result = await sendEmail({ to: email, subject: 'Reset your Trading Sync password', html });
  if (!result.sent) return { ...result, devLink: resetUrl };
  return result;
}
