import { useState } from 'react';
import AccountDetailsModal from './AccountDetailsModal';

const ACCOUNT_TYPES = [
  { value: 'p2p', label: 'P2P Lending', color: 'bg-green-100 text-green-800' },
  { value: 'stocks', label: 'ETF & Stocks', color: 'bg-blue-100 text-blue-800' },
  { value: 'crypto', label: 'Cryptocurrency', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'savings', label: 'Savings & Deposits', color: 'bg-purple-100 text-purple-800' },
  { value: 'bank', label: 'Fixed Income & Bonds', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'unknown', label: 'Alternative Investments', color: 'bg-gray-100 text-gray-800' }
];

export default function AccountCard({ account, currency, onUpdate, onViewDetails }) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2
  }).format(account.currentValue);

  const handleEditClick = () => {
    setShowDetailsModal(true);
  };

  const getAccountTypeColor = (type) => {
    const typeConfig = ACCOUNT_TYPES.find(t => t.value === type);
    return typeConfig ? typeConfig.color : 'bg-gray-100 text-gray-800';
  };

  const getAccountTypeLabel = (type) => {
    const typeConfig = ACCOUNT_TYPES.find(t => t.value === type);
    return typeConfig ? typeConfig.label : 'Alternative Investments';
  };

  return (
    <>
      <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative">
        {/* Gear Icon - Top Right */}
        <button
          onClick={handleEditClick}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          title="Edit account details"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <div className="flex justify-between items-start mb-2 pr-8">
          <div className="flex-1">
            <h4 
              className="font-semibold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => onViewDetails && onViewDetails(account)}
              title="Click to view detailed history"
            >
              {account.accountName || account.platform || getAccountTypeLabel(account.accountType)}
            </h4>
            <p className="text-sm text-gray-500">{account.platform || 'Unknown Platform'}</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold text-gray-900">{formattedValue}</div>
          {account.interestRate && (
            <div className="text-sm text-gray-600 mt-1">
              Interest Rate: {account.interestRate}% APY
            </div>
          )}
          {account.holdingsCount > 0 && (
            <div className="text-sm text-gray-600 mt-1">
              {account.holdingsCount} holding{account.holdingsCount !== 1 ? 's' : ''}
            </div>
          )}
          <div className="text-xs text-gray-400 mt-2">
            Updated: {new Date(account.lastUpdated).toLocaleString()}
          </div>
        </div>
        {/* Account Type Badge - Bottom Right (Display Only) */}
        <div className="absolute bottom-4 right-4">
          <span 
            className={`px-2 py-1 rounded text-xs font-medium ${getAccountTypeColor(account.accountType)}`}
          >
            {getAccountTypeLabel(account.accountType)}
          </span>
        </div>
      </div>
      
      {showDetailsModal && (
        <AccountDetailsModal
          account={account}
          currency={currency}
          onClose={() => setShowDetailsModal(false)}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}
