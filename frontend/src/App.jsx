import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import UploadModal from './components/UploadModal';
import AccountDetailView from './components/AccountDetailView';
import { getPortfolioSummary } from './services/api';

function App() {
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState(null);

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
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Trading Sync</h1>
          <p className="text-blue-100">Your unified portfolio dashboard</p>
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
          />
        )}

        {showUploadModal && (
          <UploadModal
            onClose={() => setShowUploadModal(false)}
            onSuccess={handleUploadSuccess}
          />
        )}

        {selectedAccount && (
          <AccountDetailView
            account={selectedAccount}
            currency={portfolioData?.currency || 'EUR'}
            onClose={() => setSelectedAccount(null)}
            onUpdate={async () => {
              // Reload portfolio and update selected account
              const data = await getPortfolioSummary();
              setPortfolioData(data);
              // Update selected account with fresh data
              if (data?.accounts) {
                const updatedAccount = data.accounts.find(acc => acc.id === selectedAccount.id);
                if (updatedAccount) {
                  setSelectedAccount(updatedAccount);
                }
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;
