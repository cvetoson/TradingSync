import { useState } from 'react';
import { uploadScreenshot } from '../services/api';

const INVESTMENT_CATEGORIES = [
  { 
    value: 'auto', 
    label: 'Auto Detect', 
    description: 'Let AI automatically detect the investment type from the screenshot',
    accountType: 'unknown'
  },
  { 
    value: 'p2p', 
    label: 'P2P Lending', 
    description: 'Peer-to-peer lending platforms with fixed interest rates (e.g., Bondora, Iuvo, Moneyfit)',
    accountType: 'p2p'
  },
  { 
    value: 'equities', 
    label: 'ETF & Stocks', 
    description: 'Stock trading platforms, ETFs, and equity investments (e.g., Trading 212, IBKR)',
    accountType: 'stocks'
  },
  { 
    value: 'crypto', 
    label: 'Cryptocurrency', 
    description: 'Digital assets and cryptocurrency platforms (e.g., Revolut Crypto, Ledger)',
    accountType: 'crypto'
  },
  { 
    value: 'savings', 
    label: 'Savings & Deposits', 
    description: 'High-yield savings accounts and deposit products',
    accountType: 'savings'
  },
  { 
    value: 'fixed-income', 
    label: 'Fixed Income & Bonds', 
    description: 'Bonds, treasury securities, and fixed-income investments',
    accountType: 'bank'
  },
  { 
    value: 'alternative', 
    label: 'Alternative Investments', 
    description: 'Other investment types and platforms',
    accountType: 'unknown'
  }
];

export default function UploadModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [investmentCategory, setInvestmentCategory] = useState('');
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

  const handleSubmit = async (e) => {
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
      // For auto-detect, pass null so backend can detect automatically
      const accountType = investmentCategory === 'auto' ? null : selectedCategory?.accountType;
      await uploadScreenshot(file, investmentCategory, accountType);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Upload Screenshot</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Investment Category
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Screenshot
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                required
              />
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
                    <p className="mt-2 text-sm text-gray-600">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
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

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-800">
            💡 <strong>Tip:</strong> Upload a clear screenshot of your account balance. 
            The AI will extract your portfolio data automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
