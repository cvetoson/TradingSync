import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import Dashboard from './components/Dashboard';
import UploadModal from './components/UploadModal';
import AccountDetailView from './components/AccountDetailView';
import PlatformDetailView from './components/PlatformDetailView';
import AnalyticsPage from './components/AnalyticsPage';
import ReportsPage from './components/ReportsPage';
import Login from './components/Login';
import Register from './components/Register';
import SplashScreen from './components/SplashScreen';
import CheckEmailPage from './components/CheckEmailPage';
import VerifyEmailPage from './components/VerifyEmailPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import SettingsModal from './components/SettingsModal';
import { getPortfolioSummary, getAccountHoldings } from './services/api';

/** PlatformDetailView category tab → UploadModal manual form `manualAccountType` value */
const PLATFORM_CATEGORY_TO_MANUAL = {
  stocks: 'equities',
  crypto: 'crypto',
  p2p: 'p2p',
  precious: 'precious',
  savings: 'savings',
  bank: 'fixed-income',
  unknown: 'alternative'
};

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(() => {
    try { return sessionStorage.getItem('splashDismissed') === '1'; } catch { return false; }
  });

  const dismissSplash = (toRegister = false) => {
    try { sessionStorage.setItem('splashDismissed', '1'); } catch {}
    setSplashDismissed(true);
    setShowRegister(toRegister);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
        <div className="flex items-center gap-3 text-[var(--text-3)]">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (!splashDismissed) {
      return (
        <SplashScreen
          onSignIn={() => dismissSplash(false)}
          onCreateAccount={() => dismissSplash(true)}
        />
      );
    }
    return showRegister
      ? <Register onSwitchToLogin={() => setShowRegister(false)} />
      : <Login onSwitchToRegister={() => setShowRegister(true)} />;
  }

  return <DashboardContent />;
}

function CheckEmailRoute() {
  const location = useLocation();
  const email = location?.state?.email || 'your email';
  const devLink = location?.state?.devLink;
  return <CheckEmailPage email={email} devLink={devLink} />;
}

function DashboardContent() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadPrefill, setUploadPrefill] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activePage, setActivePage] = useState('portfolio');

  useEffect(() => { loadPortfolio(); }, [refreshTrigger]);

  const loadPortfolio = async () => {
    try {
      setLoading(true);
      const data = await getPortfolioSummary();
      setPortfolioData(data);
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    setUploadPrefill(null);
    setRefreshTrigger(prev => prev + 1);
    addToast('Account updated successfully', 'success');
  };

  const handleUploadError = (msg) => {
    addToast(msg || 'Upload failed. Please try again.', 'error');
  };

  const initials = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-page)' }}>
      {/* Sidebar */}
      <aside className="w-14 sm:w-52 flex flex-col py-5 shrink-0 border-r"
        style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}>
        {/* Brand */}
        <div className="px-3 lg:px-4 mb-8 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="hidden sm:block font-semibold text-sm tracking-tight" style={{ color: 'var(--text-1)' }}>Trading Sync</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 sm:px-3 space-y-1">
          {[
            { id: 'portfolio', label: 'Portfolio', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /> },
            { id: 'analytics', label: 'Analytics', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
            { id: 'reports', label: 'Reports', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className="w-full flex items-center gap-3 px-2 sm:px-3 py-2.5 rounded-lg transition text-sm"
              style={activePage === item.id
                ? { background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
                : { color: 'var(--sidebar-text)' }}
              title={item.label}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {item.icon}
              </svg>
              <span className="hidden sm:block font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 sm:px-3 space-y-1 border-t pt-3 mt-2" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-2 sm:px-3 py-2.5 rounded-lg transition text-sm"
            style={{ color: 'var(--sidebar-text)' }}
            title="Settings"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:block">Settings</span>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-2 sm:px-3 py-2.5 rounded-lg transition text-sm"
            style={{ color: 'var(--sidebar-text)' }}
            title="Log out"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:block">Log out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-6 shrink-0 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-sidebar)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
            {activePage === 'portfolio' ? 'Portfolio' : activePage === 'analytics' ? 'Analytics' : 'Reports'}
          </h2>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2.5"
            style={{ background: 'transparent' }}
            title="Open settings"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <span className="text-sm hidden sm:block" style={{ color: 'var(--text-2)' }}>
              {user?.displayName || user?.email}
            </span>
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex items-center gap-3" style={{ color: 'var(--text-3)' }}>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Loading portfolio...</span>
              </div>
            </div>
          ) : activePage === 'analytics' ? (
            <AnalyticsPage portfolioData={portfolioData} currency={portfolioData?.currency || 'EUR'} />
          ) : activePage === 'reports' ? (
            <ReportsPage portfolioData={portfolioData} currency={portfolioData?.currency || 'EUR'} />
          ) : (
            <Dashboard
              portfolioData={portfolioData}
              onUploadClick={() => { setUploadPrefill(null); setShowUploadModal(true); }}
              onRefresh={loadPortfolio}
              onViewAccountDetails={(account) => setSelectedAccount(account)}
              onViewPlatformDetails={(platform) => setSelectedPlatform(platform)}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showUploadModal && (
        <UploadModal
          prefill={uploadPrefill}
          onClose={() => { setShowUploadModal(false); setUploadPrefill(null); }}
          onSuccess={handleUploadSuccess}
        />
      )}

      {selectedPlatform && (
        <PlatformDetailView
          platform={selectedPlatform}
          currency={portfolioData?.currency || 'EUR'}
          onClose={() => setSelectedPlatform(null)}
          onViewAccountDetails={() => {}}
          onAddNewAccount={(opts) => {
            if (opts?.platform && opts?.category) {
              setUploadPrefill({
                platform: opts.platform,
                manualAccountType: PLATFORM_CATEGORY_TO_MANUAL[opts.category] || 'p2p'
              });
            } else {
              setUploadPrefill(null);
            }
            setSelectedPlatform(null);
            setShowUploadModal(true);
          }}
          onUpdate={async () => {
            const data = await getPortfolioSummary();
            setPortfolioData(data);
            setSelectedPlatform(prev => {
              if (!prev || !data?.platforms) return prev;
              return data.platforms.find(p => p.name === prev.name) || prev;
            });
          }}
        />
      )}

      {selectedAccount && (
        <AccountDetailView
          key={selectedAccount.id}
          account={selectedAccount}
          currency={portfolioData?.currency || 'EUR'}
          onClose={async () => {
            const accountId = selectedAccount?.id;
            const accType = selectedAccount?.accountType || selectedAccount?.account_type;
            const isStockCrypto = accType === 'stocks' || accType === 'crypto' || accType === 'precious';
            setSelectedAccount(null);
            if (accountId && isStockCrypto) { try { await getAccountHoldings(accountId); } catch (_) {} }
            setRefreshTrigger(prev => prev + 1);
          }}
          onAddNewAccount={() => { setUploadPrefill(null); setSelectedAccount(null); setShowUploadModal(true); }}
          onUpdate={async () => {
            const data = await getPortfolioSummary();
            setPortfolioData(data);
            setSelectedAccount(prev => {
              if (!prev || !data?.accounts) return prev;
              return data.accounts.find(acc => acc.id === prev.id) || prev;
            });
          }}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/check-email" element={<CheckEmailRoute />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
