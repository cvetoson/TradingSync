import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../services/api';
import AuthCard from './AuthCard';

const inputCls = 'auth-input w-full px-3.5 py-2.5 rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-30';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devLink, setDevLink] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setDevLink(null);
    try {
      const res = await api.forgotPassword(email);
      setSent(true);
      if (res.devLink) setDevLink(res.devLink);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send reset link. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthCard subtitle="Check your email">
        <div className="space-y-4">
          <p className="text-center text-sm" style={{ color: 'var(--text-2)' }}>
            If an account exists for <strong style={{ color: 'var(--text-1)' }}>{email}</strong>, we sent a password reset link.
          </p>
          {devLink ? (
            <div className="space-y-2">
              <p className="text-center text-sm" style={{ color: 'var(--accent)' }}>
                Email could not be sent. Use this link to reset your password:
              </p>
              <a
                href={devLink}
                className="auth-submit block w-full text-center py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition"
              >
                Reset password →
              </a>
            </div>
          ) : (
            <p className="text-center text-sm" style={{ color: 'var(--text-3)' }}>
              The link expires in 1 hour. Check your inbox (and your spam folder).
            </p>
          )}
          <Link
            to="/"
            className="block w-full text-center py-2.5 px-4 rounded-lg text-sm font-medium transition"
            style={{ background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="Reset your password">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-md text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="auth-submit w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition disabled:opacity-50 mt-1"
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-3)' }}>
        <Link to="/" className="text-blue-500 hover:text-blue-400 font-medium transition">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
