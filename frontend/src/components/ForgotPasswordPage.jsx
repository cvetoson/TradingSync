import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../services/api';
import AuthCard from './AuthCard';

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
          <p className="text-blue-100 text-center">
            If an account exists for <strong className="text-white">{email}</strong>, we sent a password reset link.
          </p>
          {devLink ? (
            <div className="space-y-2">
              <p className="text-amber-200 text-sm text-center">
                No email configured. Use this link to reset your password (dev mode):
              </p>
              <a
                href={devLink}
                className="block w-full text-center py-2.5 px-4 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 font-medium transition border border-amber-400/50"
              >
                Reset password →
              </a>
            </div>
          ) : (
            <p className="text-blue-200 text-sm text-center">
              The link expires in 1 hour. Check your inbox for the email.
            </p>
          )}
          <Link
            to="/"
            className="block w-full text-center py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
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
          <div className="bg-red-500/20 border border-red-400/50 text-red-100 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-blue-100 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-center text-blue-100 text-sm">
        <Link to="/" className="text-blue-300 hover:text-white font-medium underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
