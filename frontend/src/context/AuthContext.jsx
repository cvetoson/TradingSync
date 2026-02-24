import { createContext, useContext, useState, useEffect } from 'react';

const AUTH_KEY = 'tradingsync_token';
const USER_KEY = 'tradingsync_user';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (stored && storedUser) {
      try {
        setToken(stored);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = (token, user) => {
    setToken(token);
    setUser(user);
    localStorage.setItem(AUTH_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const updateUser = (updates) => {
    if (!user) return;
    const next = { ...user, ...updates };
    setUser(next);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
  };

  const value = { user, token, loading, login, logout, updateUser, isAuthenticated: !!token };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getStoredToken() {
  return localStorage.getItem(AUTH_KEY);
}
