import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import AuthCard from './AuthCard';

export default function Login({ onSwitchToRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(email, password);
      login(res.token, res.user);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2.5 rounded-md text-sm transition focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <AuthCard subtitle="Sign in to your account">
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
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Password</label>
            <Link to="/forgot-password" className="text-xs text-blue-500 hover:text-blue-400 transition">Forgot password?</Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition disabled:opacity-50 mt-2"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-3)' }}>
        Don&apos;t have an account?{' '}
        <button type="button" onClick={onSwitchToRegister} className="text-blue-500 hover:text-blue-400 font-medium transition">
          Register
        </button>
      </p>
    </AuthCard>
  );
}
