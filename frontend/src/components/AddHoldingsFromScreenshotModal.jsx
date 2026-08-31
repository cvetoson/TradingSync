import { useState } from 'react';
import { addHoldingsFromScreenshot } from '../services/api';
import ScreenshotPicker from './ScreenshotPicker';
import useModalBehavior from '../hooks/useModalBehavior';

export default function AddHoldingsFromScreenshotModal({ account, onClose, onSuccess }) {
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
      const result = await addHoldingsFromScreenshot(account.id, files);
      onSuccess(result);
      onClose();
    } catch (err) {
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
          <h2 className="text-2xl font-bold text-strong">Add Holdings from Screenshot</h2>
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

        <div className="mb-4 p-3 bg-green-50 rounded-md">
          <p className="text-sm text-green-800">
            <strong>{account.accountName || account.platform}</strong>
          </p>
          <p className="text-xs text-green-700 mt-1">
            Upload a screenshot of additional holdings. They will be added to your existing holdings (not replaced).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mid mb-2">
              Screenshot
            </label>
            <ScreenshotPicker files={files} onChange={(f) => { setFiles(f); setError(''); }} disabled={uploading} inputId="add-holdings-shots" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
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
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploading || !files.length}
            >
              {uploading ? 'Adding...' : 'Add Holdings'}
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-yellow-50 rounded-md">
          <p className="text-xs text-yellow-800">
            💡 The AI will extract holdings from the screenshot and add them to this account. Existing holdings are kept.
          </p>
        </div>
      </div>
    </div>
  );
}
