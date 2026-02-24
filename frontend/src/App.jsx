import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import UploadModal from './components/UploadModal';
import AccountDetailView from './components/AccountDetailView';
import PlatformDetailView from './components/PlatformDetailView';
import Login from './components/Login';
import Register from './components/Register';
import CheckEmailPage from './components/CheckEmailPage';
import VerifyEmailPage from './components/VerifyEmailPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import SettingsModal from './components/SettingsModal';
import { getPortfolioSummary, getAccountHoldings } from './services/api';

function AppContent() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return showRegister ? (
      <Register onSwitchToLogin={() => setShowRegister(false)} />
    ) : (
      <Login onSwitchToRegister={() => setShowRegister(true)} />
    );
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
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadPortfolio();
  }, [refreshTrigger]);

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
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Trading Sync</h1>
            <p className="text-blue-100">Your unified portfolio dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition"
              title="Settings"
            >
              <span>{user?.displayName || user?.email || 'User'}</span>
              <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition"
            >
              Log out
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-white text-xl">Loading portfolio...</div>
          </div>
        ) : (
          <Dashboard 
            portfolioData={portfolioData} 
            onUploadClick={() => setShowUploadModal(true)}
            onRefresh={loadPortfolio}
            onViewAccountDetails={(account) => setSelectedAccount(account)}
            onViewPlatformDetails={(platform) => setSelectedPlatform(platform)}
          />
        )}

        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
        )}

        {showUploadModal && (
          <UploadModal
            onClose={() => setShowUploadModal(false)}
            onSuccess={handleUploadSuccess}
          />
        )}

        {selectedPlatform && (
          <PlatformDetailView
            platform={selectedPlatform}
            currency={portfolioData?.currency || 'EUR'}
            onClose={() => setSelectedPlatform(null)}
            onViewAccountDetails={() => {}}
            onAddNewAccount={() => {
              setSelectedPlatform(null);
              setShowUploadModal(true);
            }}
            onUpdate={async () => {
              const data = await getPortfolioSummary();
              setPortfolioData(data);
              setSelectedPlatform((prev) => {
                if (!prev || !data?.platforms) return prev;
                return data.platforms.find((p) => p.name === prev.name) || prev;
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
              if (accountId && isStockCrypto) {
                try {
                  await getAccountHoldings(accountId);
                } catch (_) {}
              }
              setRefreshTrigger((prev) => prev + 1);
            }}
            onAddNewAccount={() => {
              setSelectedAccount(null);
              setShowUploadModal(true);
            }}
            onUpdate={async () => {
              const data = await getPortfolioSummary();
              setPortfolioData(data);
              setSelectedAccount((prev) => {
                if (!prev || !data?.accounts) return prev;
                const updated = data.accounts.find((acc) => acc.id === prev.id);
                return updated || prev;
              });
            }}
          />
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/check-email" element={<CheckEmailRoute />} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
