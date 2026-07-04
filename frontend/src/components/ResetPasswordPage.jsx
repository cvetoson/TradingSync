import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import AuthCard from './AuthCard';

const inputCls = 'auth-input w-full px-3.5 py-2.5 rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-30';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!token) {
      setError('Invalid reset link');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password, confirmPassword);
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset password. The link may have expired — request a new one.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCard subtitle="Invalid reset link">
        <div className="space-y-4">
          <p className="text-center text-sm" style={{ color: 'var(--text-2)' }}>This password reset link is invalid or has expired.</p>
          <Link
            to="/forgot-password"
            className="auth-submit block w-full text-center py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition"
          >
            Request a new link
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (success) {
    return (
      <AuthCard subtitle="Password updated">
        <p className="text-center text-sm" style={{ color: 'var(--text-2)' }}>Your password has been reset. Redirecting to sign in…</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="Set a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-md text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>New password (min 8 characters)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputCls}
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="auth-submit w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition disabled:opacity-50 mt-1"
        >
          {loading ? 'Updating...' : 'Update password'}
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
