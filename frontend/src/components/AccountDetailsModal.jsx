import { useState, useEffect } from 'react';
import { updateAccountName, updateAccountType, updateAccountPlatform, updateAccountBalance, updateAccountInterestRate, deleteAccount } from '../services/api';

const ACCOUNT_TYPES = [
  { value: 'p2p', label: 'P2P Lending', description: 'Peer-to-peer lending with fixed rates', color: 'bg-green-100 text-green-800' },
  { value: 'stocks', label: 'ETF & Stocks', description: 'Stock trading, ETFs, and equity investments', color: 'bg-blue-100 text-blue-800' },
  { value: 'crypto', label: 'Cryptocurrency', description: 'Digital assets and crypto platforms', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'precious', label: 'Gold & Silver', description: 'Gold, silver, and precious metals (XAG, XAU)', color: 'bg-amber-100 text-amber-800' },
  { value: 'savings', label: 'Savings & Deposits', description: 'High-yield savings accounts', color: 'bg-purple-100 text-purple-800' },
  { value: 'bank', label: 'Fixed Income & Bonds', description: 'Bonds and fixed-income investments', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'unknown', label: 'Alternative Investments', description: 'Other investment types', color: 'bg-gray-100 text-gray-800' }
];

export default function AccountDetailsModal({ account, currency, onClose, onUpdate }) {
  const [accountName, setAccountName] = useState(account.accountName || '');
  const [platform, setPlatform] = useState(account.platform || '');
  const [accountType, setAccountType] = useState(account.accountType || account.account_type || 'unknown');
  const [currentValue, setCurrentValue] = useState((account.currentValue || account.balance || 0).toString());
  const [interestRate, setInterestRate] = useState((account.interestRate || account.interest_rate || '').toString());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setAccountName(account.accountName || '');
    setPlatform(account.platform || '');
    setAccountType(account.accountType || account.account_type || 'unknown');
    setCurrentValue((account.currentValue || account.balance || 0).toString());
    setInterestRate((account.interestRate || account.interest_rate || '').toString());
  }, [account]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = [];
      
      if (accountName.trim() !== (account.accountName || '')) {
        await updateAccountName(account.id, accountName.trim());
        updates.push('name');
      }
      
      if (platform.trim() !== (account.platform || '')) {
        await updateAccountPlatform(account.id, platform.trim());
        updates.push('platform');
      }
      
      if (accountType !== account.accountType) {
        await updateAccountType(account.id, accountType);
        updates.push('type');
      }

      // Update balance/current value
      const newBalance = parseFloat(currentValue);
      const oldBalance = account.currentValue || account.balance || 0;
      if (!isNaN(newBalance) && newBalance !== oldBalance) {
        await updateAccountBalance(account.id, newBalance);
        updates.push('balance');
      }

      // Update interest rate
      const newInterestRate = interestRate.trim() === '' ? null : parseFloat(interestRate);
      const oldInterestRate = account.interestRate || account.interest_rate || null;
      if (newInterestRate !== oldInterestRate && (newInterestRate === null || !isNaN(newInterestRate))) {
        await updateAccountInterestRate(account.id, newInterestRate);
        updates.push('interestRate');
      }

      if (updates.length > 0 && onUpdate) {
        onUpdate();
      }
      
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
      console.log('[AccountDetailsModal] Deleting account:', account.id);
      await deleteAccount(account.id);
      console.log('[AccountDetailsModal] Account deleted successfully');
      if (onUpdate) {
        onUpdate();
      }
      onClose();
    } catch (error) {
      console.error('[AccountDetailsModal] Error deleting account:', error);
      console.error('[AccountDetailsModal] Error response:', error.response);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete account. Please try again.';
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };


  const getAccountTypeColor = (type) => {
    const typeConfig = ACCOUNT_TYPES.find(t => t.value === type);
    return typeConfig ? typeConfig.color : 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Account Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Account Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Name
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter account name"
            />
          </div>

          {/* Platform Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Platform / App Name
            </label>
            <input
              type="text"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter platform name (e.g., Bondora, Revolut)"
            />
            <p className="mt-1 text-xs text-gray-500">
              The name of the app or platform where this account is held
            </p>
          </div>

          {/* Account Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Investment Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ACCOUNT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setAccountType(type.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    accountType === type.value
                      ? `${type.color} ring-2 ring-offset-2 ring-blue-500`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Account Details (Editable) */}
          <div className="border-t pt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Value
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  {currency || 'EUR'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  className="w-full pl-16 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interest Rate (% APY)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none">
                  %
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm text-gray-600">Last Updated:</span>
              <span className="text-sm font-medium text-gray-800">
                {new Date(account.lastUpdated).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSaving || isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Delete Button */}
          <div className="pt-4 border-t">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving || isDeleting}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delete Account</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{account.accountName || account.platform}</strong>? 
              This action cannot be undone and will delete all associated history, screenshots, and data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
