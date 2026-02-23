import { useState } from 'react';
import AccountCard from './AccountCard';
import AccountDetailView from './AccountDetailView';

const CATEGORY_TABS = [
  { value: 'stocks', label: 'ETF & Stocks' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'p2p', label: 'P2P Lending' },
  { value: 'precious', label: 'Gold & Silver' },
  { value: 'savings', label: 'Savings & Deposits' },
  { value: 'bank', label: 'Fixed Income & Bonds' },
  { value: 'unknown', label: 'Other' }
];

export default function PlatformDetailView({ platform, currency, onClose, onViewAccountDetails, onUpdate, onAddNewAccount }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const categoriesWithAccounts = CATEGORY_TABS.filter(
    (tab) => platform.categories?.[tab.value]?.length > 0
  );
  const defaultCategory = categoriesWithAccounts[0]?.value;
  const currentCategory = activeCategory || defaultCategory;
  const accountsInCategory = platform.categories?.[currentCategory] || [];

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 2
    }).format(value);

  const handleViewAccount = (account) => {
    setSelectedAccount(account);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{platform.name}</h2>
            <p className="text-lg font-semibold text-blue-600 mt-1">
              {formatCurrency(platform.value)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Investment category tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="flex gap-1 overflow-x-auto">
            {categoriesWithAccounts.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveCategory(tab.value)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  currentCategory === tab.value
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-1 text-xs text-gray-400">
                  ({platform.categories[tab.value].length})
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Accounts in selected category */}
        <div className="space-y-3">
          {accountsInCategory.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              currency={currency}
              onUpdate={onUpdate}
              onViewDetails={handleViewAccount}
            />
          ))}
        </div>
      </div>

      {selectedAccount && (
        <AccountDetailView
          key={selectedAccount.id}
          account={selectedAccount}
          currency={currency}
          onClose={() => setSelectedAccount(null)}
          onAddNewAccount={onAddNewAccount || onClose}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}
