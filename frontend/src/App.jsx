import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import UploadModal from './components/UploadModal';
import AccountDetailView from './components/AccountDetailView';
import PlatformDetailView from './components/PlatformDetailView';
import { getPortfolioSummary, getAccountHoldings } from './services/api';

function App() {
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState(null);

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
            onViewPlatformDetails={(platform) => setSelectedPlatform(platform)}
          />
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

export default App;
