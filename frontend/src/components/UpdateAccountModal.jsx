import { useState } from 'react';
import { isNative, pickScreenshotFile } from '../services/native';
import { updateAccountWithScreenshot } from '../services/api';
import useModalBehavior from '../hooks/useModalBehavior';

export default function UpdateAccountModal({ account, onClose, onSuccess, onAddNewAccount }) {
  useModalBehavior(onClose);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

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

  // In the iOS shell, intercept the label tap and use the native photo sheet.
  const handleNativePick = async (e) => {
    if (!isNative || uploading) { if (isNative) e.preventDefault(); return; }
    e.preventDefault();
    try {
      const picked = await pickScreenshotFile();
      if (picked) { setFile(picked); setError(''); }
    } catch {
      setError('Could not open the photo picker');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const result = await updateAccountWithScreenshot(account.id, file);
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
      <div className="surface-card border rounded-xl border-app shadow-xl max-w-md w-full p-6">
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
            Update this account with a new screenshot, or add a new account from a different screenshot.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mid mb-2">
              New Screenshot
            </label>
            <div className="border-2 border-dashed dropzone rounded-md p-6 text-center transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                required={!isNative}
                disabled={uploading}
              />
              <label htmlFor="file-upload" className={`cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={handleNativePick}>
                {file ? (
                  <div>
                    <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-2 text-sm text-dim">{file.name}</p>
                  </div>
                ) : (
                  <div>
                    <svg className="mx-auto h-12 w-12 text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mt-2 text-sm text-dim">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-dim">PNG, JPG, GIF up to 10MB</p>
                  </div>
                )}
              </label>
            </div>
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
                disabled={uploading || !file}
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
            ⚠️ <strong>Note:</strong> The AI will extract the new balance from the screenshot. 
            Make sure the screenshot clearly shows the current account balance.
          </p>
        </div>
      </div>
    </div>
  );
}
