import { useState, useEffect } from 'react';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function SettingsModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || '');
  }, [user]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);
    try {
      await api.updateProfile(displayName);
      updateUser({ displayName: displayName || null });
      setProfileSuccess('Profile updated');
    } catch (err) {
      setProfileError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    setPasswordLoading(true);
    try {
      await api.changePassword(oldPassword, newPassword, confirmPassword);
      setPasswordSuccess('Password updated');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-1)' };
  const inputCls = 'w-full px-3 py-2 rounded-md text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-[var(--text-4)]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Settings</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md transition"
              style={{ color: 'var(--text-3)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-inner)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Profile section */}
          <section className="mb-8">
            <h3 className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Profile</h3>
            <form onSubmit={handleProfileSubmit} className="space-y-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-3)' }}>Email</label>
                <p className="text-sm" style={{ color: 'var(--text-1)' }}>{user?.email}</p>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-3)' }}>Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Your name"
                />
              </div>
              {profileError && (
                <p className="text-red-400 text-sm">{profileError}</p>
              )}
              {profileSuccess && (
                <p className="text-green-400 text-sm">{profileSuccess}</p>
              )}
              <button
                type="submit"
                disabled={profileLoading}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition"
              >
                {profileLoading ? 'Saving...' : 'Save profile'}
              </button>
            </form>
          </section>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)', marginBottom: '2rem' }} />

          {/* Theme section */}
          <section className="mb-8">
            <h3 className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Appearance</h3>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-2 text-xs transition px-3 py-2 rounded-md border"
              style={{ color: 'var(--text-3)', borderColor: 'var(--border)', background: 'var(--bg-inner)' }}
            >
              {theme === 'dark' ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Dark mode (default)</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span>Light mode</span>
                </>
              )}
            </button>
          </section>

          {/* Change password section */}
          <section>
            <h3 className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Change password</h3>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-3)' }}>Current password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-3)' }}>New password (min 8 characters)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-3)' }}>Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              {passwordError && (
                <p className="text-red-400 text-sm">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-green-400 text-sm">{passwordSuccess}</p>
              )}
              <button
                type="submit"
                disabled={passwordLoading}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition"
              >
                {passwordLoading ? 'Updating...' : 'Change password'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
