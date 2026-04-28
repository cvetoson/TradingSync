import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import PortfolioGears3D from './PortfolioGears3D';
import './SplashScreen.css';

export default function SplashScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState('idle'); // 'idle' | 'signin' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(email, password);
      login(res.token, res.user);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const res = await api.register(email, password, confirmPassword, displayName);
      login(res.token, res.user);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setError('');
    setMode(next);
  };

  return (
    <div className="splash-shell">
      <div className="splash-bg" />
      <div className="splash-sticky">
        <header className="splash-header">
          <div className="splash-logo">
            <span className="splash-logo-dot" />
            TradingSync
          </div>
          <nav className="splash-nav">
            <a>Intro</a><a>Features</a><a>Pricing</a>
          </nav>
        </header>

        <div className="splash-grid">
          <div className="splash-text">
            <h1>
              Every<br />
              position.<br />
              <span className="splash-accent">One</span> machine.
            </h1>
            <p className="splash-sub">
              Every brokerage, wallet, and bank turning together as one machine. Watch your portfolio actually move.
            </p>

            {mode === 'idle' && (
              <div className="splash-cta">
                <button className="splash-btn splash-btn-primary" onClick={() => switchMode('signin')}>Sign in</button>
                <button className="splash-btn" onClick={() => switchMode('register')}>Create account</button>
              </div>
            )}

            {mode === 'signin' && (
              <form className="splash-form" onSubmit={handleSignIn}>
                {error && <div className="splash-form-error">{error}</div>}
                <input
                  className="splash-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
                <input
                  className="splash-input"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button className="splash-btn splash-btn-primary splash-btn-block" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
                <div className="splash-form-meta">
                  <Link to="/forgot-password" className="splash-link">Forgot password?</Link>
                  <span>
                    No account?{' '}
                    <button type="button" className="splash-link" onClick={() => switchMode('register')}>Create one</button>
                  </span>
                </div>
              </form>
            )}

            {mode === 'register' && (
              <form className="splash-form" onSubmit={handleRegister}>
                {error && <div className="splash-form-error">{error}</div>}
                <input
                  className="splash-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
                <input
                  className="splash-input"
                  type="text"
                  placeholder="Display name (optional)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
                <input
                  className="splash-input"
                  type="password"
                  placeholder="Password (min 8)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <input
                  className="splash-input"
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button className="splash-btn splash-btn-primary splash-btn-block" type="submit" disabled={loading}>
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
                <div className="splash-form-meta">
                  <span>
                    Already have an account?{' '}
                    <button type="button" className="splash-link" onClick={() => switchMode('signin')}>Sign in</button>
                  </span>
                </div>
              </form>
            )}
          </div>

          <div className="splash-canvas-wrap">
            <PortfolioGears3D />
          </div>
        </div>

        <footer className="splash-footer">
          <div className="splash-legend">
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#4a7fb8' }} />Equities 30%</div>
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#c8923e' }} />Crypto 20%</div>
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#8d9748' }} />Bonds 15%</div>
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#8b6dab' }} />Cash 15%</div>
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#c1614a' }} />Real estate 10%</div>
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#7a7a8c' }} />Alt 10%</div>
          </div>
          <div className="splash-scroll-hint">
            <span>Scroll to rotate</span>
            <span className="splash-scroll-bar" />
          </div>
        </footer>
      </div>
    </div>
  );
}
