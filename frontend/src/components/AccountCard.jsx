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

/** How this account's value stays current — accounts age at different rates */
function tierInfo(account) {
  const tier = account.tier;
  if (tier === 'accruing') return { label: `auto-accrual @ ${account.interestRate}%`, alwaysFresh: true };
  if (tier === 'priced') return { label: 'screenshot + live prices', alwaysFresh: false };
  return { label: 'manual updates', alwaysFresh: false };
}

/** Freshness of the stored positions: green ≤ 1d, amber ≤ 14d, red beyond */
function freshness(lastUpdated, alwaysFresh) {
  if (alwaysFresh) return { color: '#10b981', label: 'accruing daily' };
  if (!lastUpdated) return { color: 'var(--text-4)', label: 'never updated' };
  const days = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86400000);
  const color = days <= 1 ? '#10b981' : days <= 14 ? '#f59e0b' : '#ef4444';
  const label = days <= 0 ? 'updated today' : days === 1 ? 'updated yesterday' : days < 30 ? `updated ${days}d ago` : `updated ${Math.floor(days / 30)}mo ago`;
  return { color, label };
}

export default function AccountCard({ account, currency, onUpdate, onViewDetails }) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const formattedValue = new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: currency || 'EUR', minimumFractionDigits: 2
  }).format(account.currentValue);

  const typeConfig = ACCOUNT_TYPES.find(t => t.value === account.accountType) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
  const tier = tierInfo(account);
  const fresh = freshness(account.lastUpdated, tier.alwaysFresh);

  return (
    <>
      <div
        className="rounded-lg p-4 border transition-colors relative group cursor-pointer"
        style={{ background: 'var(--bg-inner)', borderColor: 'var(--border)' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        onClick={() => onViewDetails && onViewDetails(account)}
        title="Click to view detailed history"
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewDetails && onViewDetails(account); } }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowDetailsModal(true); }}
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
            className="font-semibold text-sm leading-tight transition"
            style={{ color: 'var(--text-1)' }}
          >
            {account.accountName || account.platform || typeConfig.label}
          </h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{account.platform || 'Unknown Platform'}</p>
          {account.tag && (
            <span
              className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium max-w-full truncate"
              style={{ background: 'var(--bg-card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
              title={account.tag}
            >
              {account.tag}
            </span>
          )}
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
          {/* pr-24 clears the absolutely-positioned type badge (bottom-right); on narrow
              cards the long freshness text ran underneath it */}
          <div className="flex items-center gap-1.5 mt-2 text-xs flex-wrap pr-24" style={{ color: 'var(--text-4)' }} title={tier.label}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: fresh.color }} />
            <span>{fresh.label}</span>
            <span style={{ color: 'var(--text-4)' }}>· {tier.label}</span>
            {!(account.depositsEur > 0) && (
              <span
                className="cursor-help"
                style={{ color: '#f59e0b' }}
                title={'No deposit data \u2014 this account counts as unchanged in the portfolio profit %. Set \u201cOriginal amount added\u201d in settings.'}
                aria-label="Missing deposit data"
              >
                {'\u26a0'}
              </span>
            )}
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
