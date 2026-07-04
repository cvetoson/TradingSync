import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import AuthCard from './AuthCard';

export default function Register({ onSwitchToLogin }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const res = await api.register(email, password, confirmPassword, displayName);
      login(res.user);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'auth-input w-full px-3.5 py-2.5 rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-30';
  const labelCls = "block text-xs font-medium mb-1.5 uppercase tracking-wider";

  return (
    <AuthCard subtitle="Create your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-md text-sm">{error}</div>
        )}
        <div>
          <label className={labelCls} style={{ color: 'var(--text-3)' }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls}
            placeholder="you@example.com" required autoComplete="email" />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--text-3)' }}>Display name (optional)</label>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls}
            placeholder="Your name" autoComplete="name" />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--text-3)' }}>Password (min 8 characters)</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls}
            placeholder="••••••••" required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--text-3)' }}>Confirm password</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls}
            placeholder="••••••••" required minLength={8} autoComplete="new-password" />
        </div>
        <button type="submit" disabled={loading}
          className="auth-submit w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition disabled:opacity-50 mt-1">
          {loading ? 'Creating account...' : 'Register'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-3)' }}>
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToLogin} className="text-blue-500 hover:text-blue-400 font-medium transition">
          Sign in
        </button>
      </p>
    </AuthCard>
  );
}
