import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import AuthCard from './AuthCard';

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
          <p className="text-blue-100 text-center">This password reset link is invalid or has expired.</p>
          <Link
            to="/forgot-password"
            className="block w-full text-center py-2.5 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition"
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
        <p className="text-green-200 text-center mb-4">Your password has been reset. Redirecting to sign in...</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="Set a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/20 border border-red-400/50 text-red-100 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-blue-100 mb-1">New password (min 8 characters)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100 mb-1">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Updating...' : 'Update password'}
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
