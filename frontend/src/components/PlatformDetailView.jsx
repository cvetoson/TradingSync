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

  const categoriesWithAccounts = CATEGORY_TABS.filter(tab => platform.categories?.[tab.value]?.length > 0);
  const defaultCategory = categoriesWithAccounts[0]?.value;
  const currentCategory = activeCategory || defaultCategory;
  const accountsInCategory = platform.categories?.[currentCategory] || [];

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'EUR', minimumFractionDigits: 2 }).format(value);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-xl border shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>{platform.name}</h2>
            <p className="text-lg font-semibold text-blue-500 mt-0.5">{formatCurrency(platform.value)}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md transition" style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-inner)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <nav className="flex gap-1 overflow-x-auto">
            {categoriesWithAccounts.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveCategory(tab.value)}
                className="px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
                style={currentCategory === tab.value
                  ? { borderColor: '#3b82f6', color: '#3b82f6' }
                  : { borderColor: 'transparent', color: 'var(--text-3)' }
                }
              >
                {tab.label}
                <span className="ml-1 text-xs" style={{ color: 'var(--text-4)' }}>
                  ({platform.categories[tab.value].length})
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="space-y-3">
          {accountsInCategory.map(account => (
            <AccountCard key={account.id} account={account} currency={currency} onUpdate={onUpdate} onViewDetails={setSelectedAccount} />
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
