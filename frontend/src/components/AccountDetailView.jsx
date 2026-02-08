import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAccountHistory, deleteHistoryEntry, getAccountHoldings, updateHoldingSymbol, updateHoldingQuantity, updateHoldingPrice, verifyHoldingSymbol } from '../services/api';
import UpdateAccountModal from './UpdateAccountModal';

const ACCOUNT_TYPES = [
  { value: 'p2p', label: 'P2P Lending', color: 'bg-green-100 text-green-800' },
  { value: 'stocks', label: 'ETF & Stocks', color: 'bg-blue-100 text-blue-800' },
  { value: 'crypto', label: 'Cryptocurrency', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'savings', label: 'Savings & Deposits', color: 'bg-purple-100 text-purple-800' },
  { value: 'bank', label: 'Fixed Income & Bonds', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'unknown', label: 'Alternative Investments', color: 'bg-gray-100 text-gray-800' }
];

export default function AccountDetailView({ account, currency, onClose, onUpdate }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [projectedData, setProjectedData] = useState([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [deletingHistoryId, setDeletingHistoryId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsTotalValue, setHoldingsTotalValue] = useState(0);
  const [editingSymbolId, setEditingSymbolId] = useState(null);
  const [editingSymbolValue, setEditingSymbolValue] = useState('');
  const [editingQuantityId, setEditingQuantityId] = useState(null);
  const [editingQuantityValue, setEditingQuantityValue] = useState('');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyHolding, setVerifyHolding] = useState(null);
  const [verifySymbolInput, setVerifySymbolInput] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyUpdating, setVerifyUpdating] = useState(false);

  useEffect(() => {
    // #region agent log
    const isStocksOrCrypto = account.accountType === 'stocks' || account.accountType === 'crypto' || account.account_type === 'stocks' || account.account_type === 'crypto';
    fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AccountDetailView.jsx:useEffect',message:'Effect ran',data:{accountId:account?.id,accountType:account?.accountType,account_type:account?.account_type,isStocksOrCrypto,callingLoadHoldings:isStocksOrCrypto},timestamp:Date.now(),runId:'holdings-debug',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    loadHistory();
    // Load holdings for stock/crypto accounts
    if (account.accountType === 'stocks' || account.accountType === 'crypto' || 
        account.account_type === 'stocks' || account.account_type === 'crypto') {
      loadHoldings();
    }
  }, [account.id]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await getAccountHistory(account.id);
      setHistory(data.history || []);
      
      // Prepare chart data (reverse to show oldest to newest)
      const reversedHistory = [...(data.history || [])].reverse();
      const chartDataPoints = reversedHistory.map((record, index) => ({
        date: new Date(record.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: record.balance,
        projectedValue: null,
        timestamp: new Date(record.recorded_at).getTime()
      }));
      setChartData(chartDataPoints);

      // Calculate projection for P2P accounts
      const accountType = account.account_type || account.accountType;
      const interestRate = account.interest_rate || account.interestRate;
      if (accountType === 'p2p' && interestRate && chartDataPoints.length > 0) {
        const lastValue = chartDataPoints[chartDataPoints.length - 1].value;
        const interestRateDecimal = interestRate / 100;
        const projected = [];
        
        // Project 3 months (90 days) into the future using compound interest
        // Formula: Future Value = Present Value * (1 + rate)^(days/365)
        for (let i = 1; i <= 90; i++) {
          const days = i;
          const projectedValue = lastValue * Math.pow(1 + interestRateDecimal, days / 365);
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + days);
          
          projected.push({
            date: futureDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: null,
            projectedValue: projectedValue,
            timestamp: futureDate.getTime()
          });
        }
        setProjectedData(projected);
      } else {
        setProjectedData([]);
      }
    } catch (error) {
      console.error('Error loading account history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccountTypeLabel = (type) => {
    const typeConfig = ACCOUNT_TYPES.find(t => t.value === type);
    return typeConfig ? typeConfig.label : 'Alternative Investments';
  };

  const formatCurrency = (value, currencyCode) => {
    const code = currencyCode || currency || 'EUR';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatChange = (change) => {
    const formatted = formatCurrency(Math.abs(change));
    return change >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  const isToday = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isToday(dateString)) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleString();
  };

  const formatPriceLastUpdated = (isoString) => {
    if (!isoString) return '';
    const then = new Date(isoString);
    if (Number.isNaN(then.getTime())) return '';
    const now = new Date();
    const mins = Math.floor((now - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const loadHoldings = async () => {
    try {
      setHoldingsLoading(true);
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AccountDetailView.jsx:loadHoldings',message:'Fetching holdings',data:{accountId:account.id},timestamp:Date.now(),runId:'holdings-debug',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      const data = await getAccountHoldings(account.id);
      // #region agent log
      const count = (data.holdings || []).length;
      fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AccountDetailView.jsx:loadHoldings',message:'Holdings received',data:{accountId:account.id,holdingsCount:count,totalValue:data.totalValue},timestamp:Date.now(),runId:'holdings-debug',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      setHoldings(data.holdings || []);
      setHoldingsTotalValue(data.totalValueEur != null ? data.totalValueEur : (data.totalValue || 0));
    } catch (error) {
      console.error('Error loading holdings:', error);
      setHoldings([]);
      setHoldingsTotalValue(0);
    } finally {
      setHoldingsLoading(false);
    }
  };

  const handleSymbolEdit = (holding) => {
    setEditingSymbolId(holding.id);
    setEditingSymbolValue(holding.symbol);
  };

  const handleSymbolSave = async (holdingId) => {
    try {
      await updateHoldingSymbol(holdingId, editingSymbolValue.trim());
      // Reload holdings - this will trigger automatic price fetch for the new symbol
      await loadHoldings();
      setEditingSymbolId(null);
      setEditingSymbolValue('');
      if (onUpdate) {
        onUpdate(); // Refresh account data
      }
    } catch (error) {
      console.error('Error updating symbol:', error);
      alert('Failed to update symbol. Please try again.');
    }
  };

  const handleSymbolCancel = () => {
    setEditingSymbolId(null);
    setEditingSymbolValue('');
  };

  const handleQuantityEdit = (holding) => {
    setEditingQuantityId(holding.id);
    setEditingQuantityValue(holding.quantity.toString());
  };

  const handleQuantitySave = async (holdingId) => {
    try {
      const quantity = parseFloat(editingQuantityValue);
      if (isNaN(quantity) || quantity < 0) {
        alert('Please enter a valid positive number');
        return;
      }
      await updateHoldingQuantity(holdingId, quantity);
      await loadHoldings();
      setEditingQuantityId(null);
      setEditingQuantityValue('');
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity. Please try again.');
    }
  };

  const handleQuantityCancel = () => {
    setEditingQuantityId(null);
    setEditingQuantityValue('');
  };

  const handlePriceEdit = (holding) => {
    setEditingPriceId(holding.id);
    const q = Number(holding.quantity) || 0;
    const displayPrice = holding.currentPrice ?? holding.purchase_price ?? (q > 0 ? (holding.totalValue || 0) / q : 0);
    setEditingPriceValue(displayPrice ? String(displayPrice) : '');
  };

  const handlePriceSave = async (holdingId) => {
    try {
      const price = parseFloat(editingPriceValue.replace(',', '.'));
      if (isNaN(price) || price < 0) {
        alert('Please enter a valid positive number');
        return;
      }
      await updateHoldingPrice(holdingId, price);
      await loadHoldings();
      setEditingPriceId(null);
      setEditingPriceValue('');
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Failed to update price. Please try again.');
    }
  };

  const handlePriceCancel = () => {
    setEditingPriceId(null);
    setEditingPriceValue('');
  };

  const openVerifyModal = (holding) => {
    setVerifyHolding(holding);
    setVerifySymbolInput(holding.symbol || '');
    setVerifyResult(null);
    setShowVerifyModal(true);
  };

  const closeVerifyModal = () => {
    setShowVerifyModal(false);
    setVerifyHolding(null);
    setVerifySymbolInput('');
    setVerifyResult(null);
  };

  const handleVerifySymbol = async () => {
    const sym = verifySymbolInput.trim().toUpperCase();
    if (!sym) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const data = await verifyHoldingSymbol(sym, verifyHolding?.asset_type || 'stock');
      setVerifyResult(data);
    } catch (err) {
      setVerifyResult({ found: false, error: err.response?.data?.error || err.message || 'Verification failed' });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleUpdateSymbolFromVerify = async () => {
    const sym = verifySymbolInput.trim();
    if (!sym || !verifyHolding) return;
    setVerifyUpdating(true);
    try {
      await updateHoldingSymbol(verifyHolding.id, sym);
      await loadHoldings();
      if (onUpdate) onUpdate();
      closeVerifyModal();
    } catch (err) {
      setVerifyResult(prev => ({ ...prev, found: prev?.found, error: err.response?.data?.error || err.message || 'Update failed' }));
    } finally {
      setVerifyUpdating(false);
    }
  };

  // For stock/crypto accounts, use holdings total if available, otherwise use account balance
  const isStockOrCrypto = (account.accountType === 'stocks' || account.accountType === 'crypto' || 
                           account.account_type === 'stocks' || account.account_type === 'crypto');
  const effectiveBalance = isStockOrCrypto && holdingsTotalValue > 0 
    ? holdingsTotalValue 
    : (account.currentValue || account.balance || 0);
  const accountBalance = account.currentValue || account.balance || 0;
  const valueDifference = isStockOrCrypto ? Math.abs(holdingsTotalValue - accountBalance) : 0;
  const valueMismatch = isStockOrCrypto && valueDifference > 0.01 && holdings.length > 0; // More than 1 cent difference and we have holdings
  
  // Debug logging
  useEffect(() => {
    if (holdings.length > 0) {
      console.log('[AccountDetailView] Value comparison:', {
        holdingsTotal: holdingsTotalValue,
        accountBalance: accountBalance,
        difference: valueDifference,
        shouldShowWarning: valueMismatch,
        holdingsCount: holdings.length
      });
    }
  }, [holdings, holdingsTotalValue, accountBalance, valueDifference, valueMismatch]);

  const handleDeleteHistory = async (historyId) => {
    if (confirmDeleteId !== historyId) {
      setConfirmDeleteId(historyId);
      return;
    }

    setDeletingHistoryId(historyId);
    try {
      await deleteHistoryEntry(historyId);
      // Reload history after deletion
      await loadHistory();
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Error deleting history entry:', error);
      alert('Failed to delete history entry. Please try again.');
    } finally {
      setDeletingHistoryId(null);
    }
  };

  // Combine chart data with projections (only if we have data)
  const combinedChartData = chartData.length > 0 
    ? [...chartData, ...projectedData]
    : [];

  // Calculate Y-axis domain for better scaling
  const calculateYAxisDomain = () => {
    if (combinedChartData.length === 0) return ['auto', 'auto'];
    
    const allValues = combinedChartData
      .map(d => d.value || d.projectedValue)
      .filter(v => v !== null && v !== undefined);
    
    if (allValues.length === 0) return ['auto', 'auto'];
    
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;
    
    // Add 10% padding on top and bottom, but ensure minimum range for visibility
    const padding = Math.max(range * 0.1, maxValue * 0.05);
    const minDomain = Math.max(0, minValue - padding);
    const maxDomain = maxValue + padding;
    
    return [minDomain, maxDomain];
  };

  const yAxisDomain = calculateYAxisDomain();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full p-6 max-h-[95vh] overflow-y-auto my-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">
              {account.accountName || account.platform || getAccountTypeLabel(account.account_type)}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{account.platform || 'Unknown Platform'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUpdateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              title="Update account with new screenshot"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Update Account
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Account Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Current Value</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(effectiveBalance)}
            </div>
            {isStockOrCrypto && holdingsTotalValue > 0 && holdingsTotalValue !== accountBalance && (
              <div className="text-xs text-gray-500 mt-1">
                (from holdings calculation)
              </div>
            )}
          </div>
          {(account.interestRate || account.interest_rate) && (
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Interest Rate</div>
              <div className="text-2xl font-bold text-green-600">{account.interestRate || account.interest_rate}% APY</div>
            </div>
          )}
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Category</div>
            <div className="text-lg font-semibold text-purple-600">
              {getAccountTypeLabel(account.accountType || account.account_type)}
            </div>
          </div>
        </div>

        {/* Holdings (for stock/crypto accounts) */}
        {(account.accountType === 'stocks' || account.accountType === 'crypto' || 
          account.account_type === 'stocks' || account.account_type === 'crypto') && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Holdings</h3>
              <p className="text-xs text-gray-500 mb-2">
                Live prices are from market data (Yahoo) and may differ slightly from your broker (e.g. Revolut) due to timing or feed.
              </p>
              {valueMismatch && !holdingsLoading && holdings.length > 0 && (
                <div className="flex items-start gap-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg px-4 py-3 mb-4">
                  <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-yellow-800 mb-1">⚠️ Value Mismatch Detected</div>
                    <div className="text-xs text-yellow-700 space-y-1">
                      <div>Holdings total: <strong className="text-yellow-900">{formatCurrency(holdingsTotalValue)}</strong></div>
                      <div>Account balance: <strong className="text-yellow-900">{formatCurrency(accountBalance)}</strong></div>
                      <div>Difference: <strong className="text-yellow-900">{formatCurrency(valueDifference)}</strong></div>
                    </div>
                    <div className="text-xs text-yellow-600 mt-2 italic">
                      Some holdings may be missing (e.g., cash balance) or prices may not be up to date. Check if all assets were extracted from the screenshot.
                    </div>
                  </div>
                </div>
              )}
            </div>
            {holdingsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading holdings...</div>
            ) : holdings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No holdings found. Upload a screenshot to extract individual stocks/crypto.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Symbol</th>
                      <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 w-28">Price source</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Quantity</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Price per Share</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((holding) => {
                      const isEditing = editingSymbolId === holding.id;
                      const isStaticPrice = holding.priceFetchFailed === true;
                      return (
                        <tr key={holding.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingSymbolValue}
                                  onChange={(e) => setEditingSymbolValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSymbolSave(holding.id);
                                    } else if (e.key === 'Escape') {
                                      handleSymbolCancel();
                                    }
                                  }}
                                  className="px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSymbolSave(holding.id)}
                                  className="text-green-600 hover:text-green-700"
                                  title="Save"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={handleSymbolCancel}
                                  className="text-red-600 hover:text-red-700"
                                  title="Cancel"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span>{holding.symbol}</span>
                                <button
                                  onClick={() => handleSymbolEdit(holding)}
                                  className="text-gray-400 hover:text-blue-600 transition-colors"
                                  title="Edit symbol"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-sm">
                            {isStaticPrice ? (
                              <button
                                type="button"
                                onClick={() => openVerifyModal(holding)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 transition-colors cursor-pointer"
                                title="Click to enter stock ID and switch to live price"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Screenshot
                              </button>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200"
                                title={holding.priceLastUpdated
                                  ? `Price from market API, updated ${formatPriceLastUpdated(holding.priceLastUpdated)}. Free APIs may be delayed (e.g. 15 min).`
                                  : 'Price updated from live market data (may be delayed).'}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8v8M3 21h18M3 10h18M3 7l9-4 9 4M3 10l9 4 9-4" /></svg>
                                Live
                                {holding.priceLastUpdated && (
                                  <span className="text-emerald-600 font-normal">({formatPriceLastUpdated(holding.priceLastUpdated)})</span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700 text-right">
                            {editingQuantityId === holding.id ? (
                              <div className="flex items-center gap-2 justify-end">
                                <input
                                  type="number"
                                  step="0.0001"
                                  value={editingQuantityValue}
                                  onChange={(e) => setEditingQuantityValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleQuantitySave(holding.id);
                                    } else if (e.key === 'Escape') {
                                      handleQuantityCancel();
                                    }
                                  }}
                                  className="w-24 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleQuantitySave(holding.id)}
                                  className="text-green-600 hover:text-green-700"
                                  title="Save"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={handleQuantityCancel}
                                  className="text-red-600 hover:text-red-700"
                                  title="Cancel"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 justify-end">
                                <span>{(Number(holding.quantity) || 0).toFixed(4)}</span>
                                <button
                                  onClick={() => handleQuantityEdit(holding)}
                                  className="text-gray-400 hover:text-blue-600 transition-colors"
                                  title="Edit quantity"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700 text-right">
                            {editingPriceId === holding.id ? (
                              <div className="flex items-center gap-2 justify-end">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="e.g. 543.42"
                                  value={editingPriceValue}
                                  onChange={(e) => setEditingPriceValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handlePriceSave(holding.id);
                                    } else if (e.key === 'Escape') {
                                      handlePriceCancel();
                                    }
                                  }}
                                  className="w-24 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handlePriceSave(holding.id)}
                                  className="text-green-600 hover:text-green-700"
                                  title="Save"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={handlePriceCancel}
                                  className="text-red-600 hover:text-red-700"
                                  title="Cancel"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <>
                                {holding.currentPrice 
                                  ? formatCurrency(holding.currentPrice, holding.priceCurrency)
                                  : holding.purchase_price 
                                    ? formatCurrency(holding.purchase_price, holding.priceCurrency) + ' (purchase)'
                                    : holding.totalValue && holding.totalValue > 0 && (Number(holding.quantity) || 0) > 0
                                      ? formatCurrency(holding.totalValue / (Number(holding.quantity) || 1), holding.priceCurrency) + ' (manual)'
                                      : formatCurrency(0, holding.priceCurrency)
                                }
                                {!holding.currentPrice && holding.symbol && (
                                  <div className="flex items-center gap-1 justify-end mt-1">
                                    <span className="text-xs text-yellow-600" title="Price from screenshot or manual. Click edit to change.">
                                      (manual)
                                    </span>
                                    <button
                                      onClick={() => handlePriceEdit(holding)}
                                      className="text-gray-400 hover:text-blue-600 transition-colors"
                                      title="Edit price (e.g. set as cash 543.42)"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                                {(holding.currentPrice || holding.purchase_price || (holding.totalValue && holding.totalValue > 0)) && (
                                  <button
                                    onClick={() => handlePriceEdit(holding)}
                                    className="ml-1 text-gray-400 hover:text-blue-600 transition-colors"
                                    title="Edit price"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(holding.totalValueEur ?? holding.totalValue ?? 0, 'EUR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td colSpan="4" className="py-3 px-4 text-sm text-gray-700">Total</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">
                        {formatCurrency(holdingsTotalValue ?? holdings.reduce((sum, h) => sum + (Number(h.totalValueEur) || Number(h.totalValue) || 0), 0), 'EUR')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        {!loading && chartData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Value Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={combinedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fontSize: 12 }}
                  domain={yAxisDomain}
                  allowDataOverflow={false}
                />
                <Tooltip 
                  formatter={(value) => value ? formatCurrency(value) : ''}
                  labelStyle={{ color: '#374151' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Account Value"
                  connectNulls={false}
                />
                {projectedData.length > 0 && (
                  <Line 
                    type="monotone" 
                    dataKey="projectedValue" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                    name="Projected Value"
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            {projectedData.length > 0 && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Projection based on {account.interestRate || account.interest_rate}% APY interest rate
              </p>
            )}
          </div>
        )}

        {/* History Table */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Value History</h3>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No history available yet. Upload more screenshots to track changes.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Value</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Change</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Change %</th>
                    {(account.interestRate || account.interest_rate) && (
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Interest Rate</th>
                    )}
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record, index) => {
                    const change = record.change || 0;
                    const changePercent = record.changePercent || 0;
                    const isPositive = change >= 0;
                    const isRecordToday = isToday(record.recorded_at);
                    
                    return (
                      <tr 
                        key={record.id} 
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          isRecordToday ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className={`py-3 px-4 text-sm ${
                          isRecordToday ? 'font-semibold text-blue-700' : 'text-gray-700'
                        }`}>
                          {formatDate(record.recorded_at)}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">
                          {formatCurrency(record.balance)}
                        </td>
                        <td className={`py-3 px-4 text-sm font-medium text-right ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {index < history.length - 1 ? formatChange(change) : '-'}
                        </td>
                        <td className={`py-3 px-4 text-sm font-medium text-right ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {index < history.length - 1 ? `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%` : '-'}
                        </td>
                        {(account.interestRate || account.interest_rate) && (
                          <td className="py-3 px-4 text-sm text-gray-600 text-right">
                            {record.interest_rate ? `${record.interest_rate}%` : '-'}
                          </td>
                        )}
                        <td className="py-3 px-4 text-center">
                          {confirmDeleteId === record.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleDeleteHistory(record.id)}
                                disabled={deletingHistoryId === record.id}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                                title="Confirm delete"
                              >
                                {deletingHistoryId === record.id ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={deletingHistoryId === record.id}
                                className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 transition-colors disabled:opacity-50"
                                title="Cancel"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDeleteHistory(record.id)}
                              disabled={deletingHistoryId === record.id}
                              className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                              title="Delete this history entry"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showVerifyModal && verifyHolding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Link to live stock</h3>
              <button type="button" onClick={closeVerifyModal} className="text-gray-400 hover:text-gray-600" disabled={verifyUpdating}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Enter the stock/ETF ticker (e.g. 2B76, TSLA) to fetch live price and switch this holding to &quot;Live&quot;.</p>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Stock / ETF symbol</label>
              <input
                type="text"
                value={verifySymbolInput}
                onChange={(e) => setVerifySymbolInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifySymbol()}
                placeholder="e.g. 2B76 or TSLA"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={verifyUpdating}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleVerifySymbol}
                  disabled={verifyLoading || !verifySymbolInput.trim() || verifyUpdating}
                  className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {verifyLoading ? 'Checking…' : 'Verify'}
                </button>
                {verifyResult && (
                  <button
                    type="button"
                    onClick={handleUpdateSymbolFromVerify}
                    disabled={verifyUpdating || !verifyResult.found}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {verifyUpdating ? 'Updating…' : 'Update'}
                  </button>
                )}
              </div>
              {verifyResult && (
                <div className={`text-sm p-3 rounded-lg ${verifyResult.found ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {verifyResult.found ? (
                    <>Live price: <strong>{formatCurrency(verifyResult.price, verifyResult.currency || 'USD')}</strong></>
                  ) : (
                    <>{verifyResult.error || 'Symbol not found'}</>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUpdateModal && (
        <UpdateAccountModal
          account={account}
          onClose={() => setShowUpdateModal(false)}
          onSuccess={async () => {
            // #region agent log
            const isStocksOrCrypto = account.accountType === 'stocks' || account.accountType === 'crypto' || account.account_type === 'stocks' || account.account_type === 'crypto';
            fetch('http://127.0.0.1:7244/ingest/f19eab2b-5e8f-43bd-8ad8-3185e8082f01',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AccountDetailView.jsx:onSuccess',message:'Update modal onSuccess called',data:{accountId:account?.id,isStocksOrCrypto,callingLoadHoldings:false},timestamp:Date.now(),runId:'holdings-debug',hypothesisId:'H2'})}).catch(()=>{});
            // #endregion
            setShowUpdateModal(false);
            // Reload history and refresh account data
            await loadHistory();
            if (onUpdate) {
              onUpdate();
            }
          }}
        />
      )}
    </div>
  );
}
