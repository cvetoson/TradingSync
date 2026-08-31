import { useState } from 'react';
import { updateAccountWithScreenshot } from '../services/api';
import ScreenshotPicker from './ScreenshotPicker';
import useModalBehavior from '../hooks/useModalBehavior';

export default function UpdateAccountModal({ account, onClose, onSuccess, onAddNewAccount }) {
  useModalBehavior(onClose);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!files.length) {
      setError('Please select at least one screenshot');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const result = await updateAccountWithScreenshot(account.id, files);
      console.log('[UpdateAccountModal] Update successful:', result);
      onSuccess();
      onClose(); // Close modal on success
    } catch (err) {
      console.error('[UpdateAccountModal] Update error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Network Error';
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="surface-card border rounded-xl border-app shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-strong">Update Account</h2>
          <button
            onClick={onClose}
            className="p-2 -m-1 rounded-md text-dim hover:text-dim"
            disabled={uploading}
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 tip-box rounded-md">
          <p className="text-sm">
            <strong>{account.accountName || account.platform}</strong>
          </p>
          <p className="text-xs text-[var(--accent)] mt-1">
            Update this account with new screenshots, or add a new account from a different screenshot.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mid mb-2">
              New Screenshots
            </label>
            <ScreenshotPicker files={files} onChange={(f) => { setFiles(f); setError(''); }} disabled={uploading} inputId="update-account-shots" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-app rounded-md text-mid hover-dim transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 btn-gold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={uploading || !files.length}
              >
                {uploading ? 'Updating...' : 'Update Account'}
              </button>
            </div>
            {onAddNewAccount && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddNewAccount();
                }}
                className="w-full px-4 py-2 border border-green-500 text-green-700 rounded-lg hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
                disabled={uploading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Account
              </button>
            )}
          </div>
        </form>

        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
          <p className="text-xs text-yellow-800">
            ⚠️ <strong>Note:</strong> This replaces the account's holdings with what the screenshots show.
            If the position list is long, scroll and add a screenshot of each part — they are read together as one account.
          </p>
        </div>
      </div>
    </div>
  );
}
