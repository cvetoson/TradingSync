import { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../services/api';

const USER_KEY = 'tradingsync_user';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Optimistically show the cached user (non-secret) to avoid a login flash,
    // then confirm the session against the httpOnly cookie via /auth/me.
    const cached = localStorage.getItem(USER_KEY);
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch { localStorage.removeItem(USER_KEY); }
    }

    api.getProfile()
      .then((me) => {
        if (cancelled) return;
        const fresh = { id: me.id, email: me.email, displayName: me.displayName };
        setUser(fresh);
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      })
      .catch(() => {
        if (cancelled) return;
        // No valid session cookie — ensure we're logged out.
        setUser(null);
        localStorage.removeItem(USER_KEY);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    // api.js dispatches this on a 401 so an expired session logs the user out everywhere.
    const onForcedLogout = () => {
      setUser(null);
      localStorage.removeItem(USER_KEY);
    };
    window.addEventListener('auth:logout', onForcedLogout);

    return () => {
      cancelled = true;
      window.removeEventListener('auth:logout', onForcedLogout);
    };
  }, []);

  // Called after a successful login/register/verify — the JWT is already in the cookie.
  const login = (loggedInUser) => {
    setUser(loggedInUser);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
  };

  const logout = async () => {
    await api.logout(); // clears the httpOnly cookie server-side
    setUser(null);
    localStorage.removeItem(USER_KEY);
  };

  const updateUser = (updates) => {
    if (!user) return;
    const next = { ...user, ...updates };
    setUser(next);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
  };

  const value = { user, loading, login, logout, updateUser, isAuthenticated: !!user };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
