import { useState, useEffect } from 'react';
import { updateAccountName, updateAccountType, updateAccountPlatform, updateAccountBalance, updateAccountInterestRate, updateAccountContributedAmount, updateAccountTag, deleteAccount } from '../services/api';

/** Parse amount from free text: 10000, 10,000, 10.000 (EU thousands), 1.234,56 (EU), 1,234.56 (US). Separators optional. */
function parseMoneyInput(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/\u202f/g, '');
  if (s === '') return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(s.replace(/,/g, ''));
  }
  if (lastDot !== -1 && lastComma === -1) {
    const parts = s.split('.');
    if (parts.length > 1 && parts.every((p) => /^\d+$/.test(p))) {
      const lastSeg = parts[parts.length - 1];
      if (parts.length === 2 && lastSeg.length <= 2) {
        return parseFloat(`${parts[0]}.${lastSeg}`);
      }
      return parseFloat(parts.join(''));
    }
    return parseFloat(s.replace(/,/g, ''));
  }
  if (lastComma !== -1) {
    const parts = s.split(',');
    if (parts.length === 2) {
      const after = parts[1];
      if (after.length <= 2 && parts[0].length > 0) {
        return parseFloat(parts[0].replace(/\./g, '') + '.' + after);
      }
    }
    return parseFloat(s.replace(/,/g, ''));
  }
  return parseFloat(s);
}

const ACCOUNT_TYPES = [
  { value: 'p2p',     label: 'P2P Lending',           color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30', ring: 'ring-emerald-500' },
  { value: 'stocks',  label: 'ETF & Stocks',           color: 'bg-blue-500/10 text-blue-500 border-blue-500/30',         ring: 'ring-blue-500' },
  { value: 'crypto',  label: 'Cryptocurrency',         color: 'bg-amber-500/10 text-amber-500 border-amber-500/30',      ring: 'ring-amber-500' },
  { value: 'precious',label: 'Gold & Silver',          color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',   ring: 'ring-yellow-500' },
  { value: 'savings', label: 'Savings & Deposits',     color: 'bg-purple-500/10 text-purple-500 border-purple-500/30',   ring: 'ring-purple-500' },
  { value: 'bank',    label: 'Fixed Income & Bonds',   color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30',   ring: 'ring-indigo-500' },
  { value: 'unknown', label: 'Alternative Investments', color: 'bg-slate-500/10 text-slate-500 border-slate-500/30',     ring: 'ring-slate-500' }
];

export default function AccountDetailsModal({ account, currency, onClose, onUpdate }) {
  const [accountName, setAccountName] = useState(account.accountName || '');
  const [platform, setPlatform] = useState(account.platform || '');
  const [accountType, setAccountType] = useState(account.accountType || account.account_type || 'unknown');
  const [currentValue, setCurrentValue] = useState((account.currentValue || account.balance || 0).toString());
  const [contributedAmount, setContributedAmount] = useState(
    account.contributedAmount != null
      ? String(account.contributedAmount)
      : (account.contributed_amount != null ? String(account.contributed_amount) : '')
  );
  const [interestRate, setInterestRate] = useState((account.interestRate || account.interest_rate || '').toString());
  const [tag, setTag] = useState(account.tag != null ? String(account.tag) : '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setAccountName(account.accountName || '');
    setPlatform(account.platform || '');
    setAccountType(account.accountType || account.account_type || 'unknown');
    setCurrentValue((account.currentValue || account.balance || 0).toString());
    setContributedAmount(
      account.contributedAmount != null
        ? String(account.contributedAmount)
        : (account.contributed_amount != null ? String(account.contributed_amount) : '')
    );
    setInterestRate((account.interestRate || account.interest_rate || '').toString());
    setTag(account.tag != null ? String(account.tag) : '');
  }, [account]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = [];
      if (accountName.trim() !== (account.accountName || '')) { await updateAccountName(account.id, accountName.trim()); updates.push('name'); }
      if (platform.trim() !== (account.platform || '')) { await updateAccountPlatform(account.id, platform.trim()); updates.push('platform'); }
      const prevType = account.accountType || account.account_type || 'unknown';
      if (accountType !== prevType) { await updateAccountType(account.id, accountType); updates.push('type'); }
      const newBalance = parseMoneyInput(currentValue);
      const oldBalance = account.currentValue || account.balance || 0;
      if (Number.isNaN(newBalance)) {
        alert('Please enter a valid amount for Current Value (e.g. 10000 or 10,000).');
        setIsSaving(false);
        return;
      }
      if (newBalance !== oldBalance) { await updateAccountBalance(account.id, newBalance); updates.push('balance'); }
      const newIR = interestRate.trim() === '' ? null : parseMoneyInput(interestRate);
      if (interestRate.trim() !== '' && Number.isNaN(newIR)) {
        alert('Please enter a valid interest rate (e.g. 7.5 or 7,5).');
        setIsSaving(false);
        return;
      }
      const oldIR = account.interestRate || account.interest_rate || null;
      if (newIR !== oldIR && (newIR === null || !Number.isNaN(newIR))) { await updateAccountInterestRate(account.id, newIR); updates.push('interestRate'); }
      const newContributed = contributedAmount.trim() === '' ? null : parseMoneyInput(contributedAmount);
      if (contributedAmount.trim() !== '' && Number.isNaN(newContributed)) {
        alert('Please enter a valid amount for Amount Added (e.g. 10000 or 10,000), or leave it blank.');
        setIsSaving(false);
        return;
      }
      const oldContributed = account.contributedAmount != null
        ? Number(account.contributedAmount)
        : (account.contributed_amount != null ? Number(account.contributed_amount) : null);
      if (newContributed !== oldContributed) {
        await updateAccountContributedAmount(account.id, newContributed);
        updates.push('contributedAmount');
      }
      const newTag = tag.trim();
      const oldTag = (account.tag != null ? String(account.tag) : '').trim();
      if (newTag !== oldTag) { await updateAccountTag(account.id, newTag); updates.push('tag'); }
      if (updates.length > 0 && onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating account:', error);
      alert('Failed to update account. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount(account.id);
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || error.message || 'Failed to delete account.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-1)' };
  const inputCls = "w-full px-3 py-2.5 rounded-md text-sm transition focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelCls = "block text-xs font-medium mb-1.5 uppercase tracking-wider";

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[100] p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-xl border shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>Account Details</h2>
          <button onClick={onClose} className="p-1 rounded-md transition" style={{ color: 'var(--text-3)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className={labelCls} style={{ color: 'var(--text-3)' }}>Account Name</label>
            <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} className={inputCls} style={inputStyle} placeholder="Enter account name" />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--text-3)' }}>Platform / App Name</label>
            <input type="text" value={platform} onChange={e => setPlatform(e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. Bondora, Revolut" />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-4)' }}>The name of the app or platform where this account is held</p>
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--text-3)' }}>Tag (optional)</label>
            <input type="text" value={tag} onChange={e => setTag(e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. Tag 1, invested for family" />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-4)' }}>Group accounts on the Dashboard allocation chart (By Tag).</p>
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--text-3)' }}>Investment Category</label>
            <div className="grid grid-cols-2 gap-2">
              {ACCOUNT_TYPES.map(type => (
                <button key={type.value} onClick={() => setAccountType(type.value)}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition border ${type.color} ${accountType === type.value ? `ring-1 ${type.ring}` : 'opacity-60 hover:opacity-100'}`}>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <label className={labelCls} style={{ color: 'var(--text-3)' }}>Current Value</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-3)' }}>{currency || 'EUR'}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  className={`${inputCls} pl-12`}
                  style={inputStyle}
                  placeholder="10000 or 10,000"
                />
              </div>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-4)' }}>
                Plain number or with thousands separators (e.g. <span className="font-mono">10000</span> or <span className="font-mono">10,000</span>). EU decimals like <span className="font-mono">1.234,56</span> are accepted.
              </p>
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--text-3)' }}>Interest Rate (% APY)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className={`${inputCls} pr-8`}
                  style={inputStyle}
                  placeholder="e.g. 7.5 or 7,5"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: 'var(--text-3)' }}>%</span>
              </div>
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--text-3)' }}>Amount Added (for growth %)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-3)' }}>{currency || 'EUR'}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={contributedAmount}
                  onChange={(e) => setContributedAmount(e.target.value)}
                  className={`${inputCls} pl-12`}
                  style={inputStyle}
                  placeholder="Optional baseline (blank = not set)"
                />
              </div>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-4)' }}>
                Used to calculate growth % for P2P/B2B/savings style accounts.
              </p>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--text-3)' }}>Last Updated</span>
              <span style={{ color: 'var(--text-2)' }}>{new Date(account.lastUpdated).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-md border text-sm transition" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }} disabled={isSaving || isDeleting}>Cancel</button>
            <button onClick={handleSave} disabled={isSaving || isDeleting} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition text-sm disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <button onClick={() => setShowDeleteConfirm(true)} disabled={isSaving || isDeleting}
              className="w-full px-4 py-2.5 rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[110] p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl border shadow-2xl max-w-sm w-full p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-1)' }}>Delete Account</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>
              Are you sure you want to delete <span className="font-medium" style={{ color: 'var(--text-1)' }}>{account.accountName || account.platform}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-2.5 border rounded-md text-sm transition" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }} disabled={isDeleting}>Cancel</button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-500 transition text-sm disabled:opacity-50">
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
