import { useState } from 'react';
import AccountDetailsModal from './AccountDetailsModal';

const ACCOUNT_TYPES = [
  { value: 'p2p',     label: 'P2P Lending',          color: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' },
  { value: 'stocks',  label: 'ETF & Stocks',          color: 'bg-blue-500/10 text-blue-500 border border-blue-500/20' },
  { value: 'crypto',  label: 'Cryptocurrency',        color: 'bg-amber-500/10 text-amber-500 border border-amber-500/20' },
  { value: 'precious',label: 'Gold & Silver',         color: 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' },
  { value: 'savings', label: 'Savings & Deposits',    color: 'bg-purple-500/10 text-purple-500 border border-purple-500/20' },
  { value: 'bank',    label: 'Fixed Income & Bonds',  color: 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' },
  { value: 'unknown', label: 'Alternative Investments', color: 'bg-slate-500/10 text-slate-500 border border-slate-500/20' }
];

export default function AccountCard({ account, currency, onUpdate, onViewDetails }) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'EUR', minimumFractionDigits: 2
  }).format(account.currentValue);

  const typeConfig = ACCOUNT_TYPES.find(t => t.value === account.accountType) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];

  return (
    <>
      <div
        className="rounded-lg p-4 border transition-colors relative group"
        style={{ background: 'var(--bg-inner)', borderColor: 'var(--border)' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <button
          onClick={() => setShowDetailsModal(true)}
          className="absolute top-3.5 right-3.5 transition-opacity opacity-0 group-hover:opacity-100"
          style={{ color: 'var(--text-3)' }}
          title="Edit account details"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <div className="pr-6">
          <h4
            className="font-semibold text-sm leading-tight cursor-pointer transition"
            style={{ color: 'var(--text-1)' }}
            onClick={() => onViewDetails && onViewDetails(account)}
            title="Click to view detailed history"
          >
            {account.accountName || account.platform || typeConfig.label}
          </h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{account.platform || 'Unknown Platform'}</p>
        </div>

        <div className="mt-3">
          <div className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>{formattedValue}</div>
          {account.interestRate && (
            <div className="text-xs text-emerald-500 mt-1 font-medium">{account.interestRate}% APY</div>
          )}
          {account.holdingsCount > 0 && (
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {account.holdingsCount} holding{account.holdingsCount !== 1 ? 's' : ''}
            </div>
          )}
          <div className="text-xs mt-2" style={{ color: 'var(--text-4)' }}>
            {new Date(account.lastUpdated).toLocaleDateString()}
          </div>
        </div>

        <div className="absolute bottom-3.5 right-3.5">
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${typeConfig.color}`}>
            {typeConfig.label}
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
