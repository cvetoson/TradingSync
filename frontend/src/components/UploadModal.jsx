import { useState, useEffect } from 'react';
import { uploadScreenshot, getAccounts, createAccount, createHolding } from '../services/api';

const INVESTMENT_CATEGORIES = [
  { value: 'auto', label: 'Auto Detect', description: 'Let AI automatically detect the investment type from the screenshot', accountType: 'unknown' },
  { value: 'p2p', label: 'P2P Lending', description: 'Peer-to-peer lending platforms with fixed interest rates (e.g., Bondora, Iuvo, Moneyfit)', accountType: 'p2p' },
  { value: 'equities', label: 'ETF & Stocks', description: 'Stock trading platforms, ETFs, and equity investments (e.g., Trading 212, IBKR)', accountType: 'stocks' },
  { value: 'crypto', label: 'Cryptocurrency', description: 'Digital assets and cryptocurrency platforms (e.g., Revolut Crypto, Ledger)', accountType: 'crypto' },
  { value: 'savings', label: 'Savings & Deposits', description: 'High-yield savings accounts and deposit products', accountType: 'savings' },
  { value: 'fixed-income', label: 'Fixed Income & Bonds', description: 'Bonds, treasury securities, and fixed-income investments', accountType: 'bank' },
  { value: 'precious', label: 'Gold & Silver', description: 'Gold, silver, and precious metals (XAG, XAU)', accountType: 'precious' },
  { value: 'alternative', label: 'Alternative Investments', description: 'Other investment types and platforms', accountType: 'unknown' }
];

const MANUAL_ASSET_TYPES = [
  { value: 'stock', label: 'Stock / ETF' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'precious', label: 'Gold & Silver' }
];

export default function UploadModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'manual'
  const [file, setFile] = useState(null);
  const [investmentCategory, setInvestmentCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Manual entry state
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [createNewAccount, setCreateNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountPlatform, setNewAccountPlatform] = useState('Manual');
  const [manualSymbol, setManualSymbol] = useState('');
  const [manualQuantity, setManualQuantity] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualAssetType, setManualAssetType] = useState('stock');

  useEffect(() => {
    if (mode === 'manual') {
      getAccounts().then(data => setAccounts(data || [])).catch(() => setAccounts([]));
    }
  }, [mode]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith('image/')) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please select an image file');
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }
    if (!investmentCategory) {
      setError('Please select an investment category');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const selectedCategory = INVESTMENT_CATEGORIES.find(cat => cat.value === investmentCategory);
      const accountType = investmentCategory === 'auto' ? null : selectedCategory?.accountType;
      await uploadScreenshot(file, investmentCategory, accountType);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const symbol = manualSymbol.trim().toUpperCase();
    const qty = parseFloat(manualQuantity);
    if (!symbol) {
      setError('Please enter a symbol (e.g. TSLA, BTC)');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity');
      return;
    }
    if (!createNewAccount && !selectedAccountId) {
      setError('Please select an account or create a new one');
      return;
    }
    if (createNewAccount && !newAccountName.trim()) {
      setError('Please enter an account name');
      return;
    }

    setUploading(true);
    try {
      let accountId = selectedAccountId;
      if (createNewAccount) {
        const accountType = manualAssetType === 'crypto' ? 'crypto' : manualAssetType === 'precious' ? 'precious' : 'stocks';
        const { account } = await createAccount(newAccountName.trim(), newAccountPlatform.trim() || 'Manual', accountType);
        accountId = account.id;
      }
      await createHolding(accountId, symbol, qty, manualPrice || undefined, undefined, manualAssetType);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to add holding. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const holdingsAccounts = accounts.filter(a => ['stocks', 'crypto', 'precious'].includes(a.account_type || ''));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Add New</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          <button
            type="button"
            onClick={() => { setMode('upload'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-t-lg transition-colors ${mode === 'upload' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Upload Screenshot
          </button>
          <button
            type="button"
            onClick={() => { setMode('manual'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-t-lg transition-colors ${mode === 'manual' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Add Manually
          </button>
        </div>

        {mode === 'upload' ? (
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Investment Category</label>
              <select
                value={investmentCategory}
                onChange={(e) => setInvestmentCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select investment category</option>
                {INVESTMENT_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              {investmentCategory && (
                <p className="mt-1 text-xs text-gray-500">
                  {INVESTMENT_CATEGORIES.find(cat => cat.value === investmentCategory)?.description}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Screenshot</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="file-upload" required />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {file ? (
                    <div>
                      <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">{file.name}</p>
                    </div>
                  ) : (
                    <div>
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors" disabled={uploading}>Cancel</button>
              <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">💡 <strong>Tip:</strong> Upload a clear screenshot of your account balance. The AI will extract your portfolio data automatically.</p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={createNewAccount} onChange={(e) => { setCreateNewAccount(e.target.checked); setSelectedAccountId(''); }} className="rounded" />
                  <span className="text-sm">Create new account</span>
                </label>
                {!createNewAccount ? (
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select account</option>
                    {holdingsAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name || acc.platform} ({acc.account_type || 'stocks'})
                      </option>
                    ))}
                    {holdingsAccounts.length === 0 && <option value="" disabled>No accounts yet — create one below</option>}
                  </select>
                ) : (
                  <div className="space-y-2 pl-6">
                    <input
                      type="text"
                      placeholder="Account name (e.g. Trading 212)"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Platform (e.g. Manual)"
                      value={newAccountPlatform}
                      onChange={(e) => setNewAccountPlatform(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
              <input
                type="text"
                placeholder="e.g. TSLA, BTC, XAU"
                value={manualSymbol}
                onChange={(e) => setManualSymbol(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 0.5"
                value={manualQuantity}
                onChange={(e) => setManualQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price (optional — leave empty for live price)</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Manual price or leave empty"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Asset type</label>
              <select
                value={manualAssetType}
                onChange={(e) => setManualAssetType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MANUAL_ASSET_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors" disabled={uploading}>Cancel</button>
              <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={uploading}>
                {uploading ? 'Adding...' : 'Add Holding'}
              </button>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">💡 <strong>Tip:</strong> Add holdings you know you own (e.g. 0.5 shares of TSLA). Leave price empty to fetch live price automatically.</p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
