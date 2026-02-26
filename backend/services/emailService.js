import dns from 'dns';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Force IPv4 for SMTP – Railway often can't reach Gmail over IPv6 (ENETUNREACH)
dns.setDefaultResultOrder('ipv4first');

const EMAIL_TIMEOUT_MS = 15000; // 15s – avoid hanging on slow/failing SMTP

let transporter = null;
let resendClient = null;
let lastEmailError = null;

export function getLastEmailError() {
  return lastEmailError;
}

function getResend() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

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
    transporter = null;
  }
  return transporter;
}

/**
 * Send an email. Returns { sent: true } or { sent: false, error }.
 * Uses SMTP if configured, else Resend (RESEND_API_KEY), else fails.
 */
export async function sendEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'Trading Sync <noreply@tradingsync.app>';

  // 1. Try SMTP first (Gmail, etc.)
  const transport = await getTransporter();
  if (transport) {
    try {
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
      await Promise.race([sendPromise, timeoutPromise]);
      return { sent: true };
    } catch (err) {
      lastEmailError = err.message;
      console.error('SMTP error:', err.message);
      return { sent: false, error: err.message };
    }
  }

  // 2. Fall back to Resend
  const resend = getResend();
  if (resend) {
    try {
      const { error } = await resend.emails.send({
        from: from.includes('<') ? from : `Trading Sync <${from}>`,
        to: [to],
        subject,
        html: html || text || '',
      });
      if (error) {
        lastEmailError = error.message;
        console.error('Resend error:', error.message);
        return { sent: false, error: error.message };
      }
      return { sent: true };
    } catch (err) {
      lastEmailError = err.message;
      console.error('Resend error:', err.message);
      return { sent: false, error: err.message };
    }
  }

  lastEmailError = 'No email configured';
  return { sent: false, error: 'No email configured' };
}

/**
 * Send verification email. Returns devLink when no SMTP (for dev).
 * When no SMTP: skip Ethereal (can hang on Railway) and return link immediately.
 */
export async function sendVerificationEmail(email, token, appUrl) {
  const base = (appUrl || '').replace(/\/+$/, '');
  const verifyUrl = `${base}/verify-email?token=${encodeURIComponent(token)}`;
  if (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
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
  if (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
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
