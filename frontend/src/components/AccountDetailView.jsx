import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAccountHistory, deleteHistoryEntry, getAccountHoldings, getHoldingsProjection, updateHoldingSymbol, updateHoldingQuantity, updateHoldingPrice, updateHoldingPurchasePrice, deleteHolding as apiDeleteHolding, verifyHoldingSymbol, updateAccountTag } from '../services/api';
import UpdateAccountModal from './UpdateAccountModal';
import AccountDetailsModal from './AccountDetailsModal';
import AddHoldingModal from './AddHoldingModal';
import AddHoldingsFromScreenshotModal from './AddHoldingsFromScreenshotModal';
import useModalBehavior from '../hooks/useModalBehavior';

const ACCOUNT_TYPES = [
  { value: 'p2p', label: 'P2P Lending', color: 'bg-[rgba(74,222,128,0.12)] text-green-400' },
  { value: 'stocks', label: 'ETF & Stocks', color: 'bg-[rgba(200,146,62,0.12)] text-[var(--accent)]' },
  { value: 'crypto', label: 'Cryptocurrency', color: 'bg-[rgba(217,163,85,0.15)] text-[var(--accent)]' },
  { value: 'precious', label: 'Gold & Silver', color: 'bg-[rgba(217,163,85,0.15)] text-[var(--accent)]' },
  { value: 'savings', label: 'Savings & Deposits', color: 'bg-[rgba(167,139,250,0.12)] text-purple-300' },
  { value: 'bank', label: 'Fixed Income & Bonds', color: 'bg-[rgba(129,140,248,0.12)] text-indigo-300' },
  { value: 'unknown', label: 'Alternative Investments', color: 'bg-[var(--bg-inner)] text-mid' }
];

export default function AccountDetailView({ account, currency, onClose, onUpdate, onAddNewAccount }) {
  useModalBehavior(onClose);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [projectedData, setProjectedData] = useState([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAccountDetailsModal, setShowAccountDetailsModal] = useState(false);
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
  const [editingPriceCurrency, setEditingPriceCurrency] = useState('EUR');
  const [editingPurchasePriceId, setEditingPurchasePriceId] = useState(null);
  const [editingPurchasePriceValue, setEditingPurchasePriceValue] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyHolding, setVerifyHolding] = useState(null);
  const [verifySymbolInput, setVerifySymbolInput] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyUpdating, setVerifyUpdating] = useState(false);
  const [confirmRemoveHoldingId, setConfirmRemoveHoldingId] = useState(null);
  const [removingHoldingId, setRemovingHoldingId] = useState(null);
  const [projectionSource, setProjectionSource] = useState(null); // 'analyst' | 'trend' | 'p2p' | null
  const [showAddHoldingModal, setShowAddHoldingModal] = useState(false);
  const [showAddHoldingsFromScreenshotModal, setShowAddHoldingsFromScreenshotModal] = useState(false);
  const [holdingsTab, setHoldingsTab] = useState('all'); // 'all' | 'stock' | 'crypto' | 'precious' | 'bond'
  const [tagInput, setTagInput] = useState('');
  const [tagSaving, setTagSaving] = useState(false);

  useEffect(() => {
    setTagInput(account.tag != null ? String(account.tag) : '');
  }, [account.id, account.tag]);

  useEffect(() => {
    loadHistory();
    // Load holdings for stock/crypto accounts
    if (account.accountType === 'stocks' || account.accountType === 'crypto' || account.accountType === 'precious' ||
        account.account_type === 'stocks' || account.account_type === 'crypto' || account.account_type === 'precious') {
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
        setProjectionSource('p2p');
      } else if (accountType !== 'stocks' && accountType !== 'crypto' && accountType !== 'precious') {
        // Only clear for non-stock accounts; stocks/crypto/precious get projection from loadHoldings
        setProjectedData([]);
        setProjectionSource(null);
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
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatChange = (change) => {
    const formatted = formatCurrency(Math.abs(change));
    return change >= 0 ? `+${formatted}` : `−${formatted}`;
  };

  const formatPercent = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '-';
    const n = Number(value);
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
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
    // SQLite CURRENT_TIMESTAMP rows arrive as 'YYYY-MM-DD HH:MM:SS' (UTC, no zone);
    // new Date() would parse that as local time and skew the label by the UTC offset.
    const raw = String(isoString);
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
      ? `${raw.replace(' ', 'T')}Z`
      : raw;
    const then = new Date(normalized);
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

  // silent: refresh the rows in place after an inline edit — no "Loading holdings"
  // unmount (that flash was the whole screen appearing to refresh), no projection
  // refetch, no parent-wide refresh from inside the loader.
  const loadHoldings = async ({ silent = false } = {}) => {
    try {
      if (!silent) setHoldingsLoading(true);
      const data = await getAccountHoldings(account.id);
      setHoldings(data.holdings || []);
      setHoldingsTotalValue(data.totalValueEur != null ? data.totalValueEur : (data.totalValue || 0));

      const accountType = account.account_type || account.accountType;
      if (!silent && (accountType === 'stocks' || accountType === 'crypto' || accountType === 'precious') && (data.holdings || []).length > 0) {
        try {
          const proj = await getHoldingsProjection(account.id);
          if (proj && proj.monthly && proj.monthly.length > 0) {
            const points = proj.monthly.map((m) => {
              const d = new Date(m.date);
              return {
                date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: null,
                projectedValue: m.valueEur,
                timestamp: d.getTime()
              };
            });
            setProjectedData(points);
            setProjectionSource(proj.source || 'trend');
          }
        } catch (e) {
          console.error('Projection load failed:', e);
          setProjectedData([]);
          setProjectionSource(null);
        }
      }
    } catch (error) {
      console.error('Error loading holdings:', error);
      setHoldings([]);
      setHoldingsTotalValue(0);
    } finally {
      if (!silent) setHoldingsLoading(false);
    }
  };

  const handleSymbolEdit = (holding) => {
    setEditingSymbolId(holding.id);
    setEditingSymbolValue(holding.symbol);
  };

  const handleSymbolSave = async (holdingId) => {
    try {
      await updateHoldingSymbol(holdingId, editingSymbolValue.trim());
      setEditingSymbolId(null);
      setEditingSymbolValue('');
      // Reload in place - this also picks up the automatic price fetch for the new symbol
      await loadHoldings({ silent: true });
      if (onUpdate) onUpdate();
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
      setEditingQuantityId(null);
      setEditingQuantityValue('');
      await loadHoldings({ silent: true });
      if (onUpdate) onUpdate();
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
    setEditingPriceCurrency((holding.priceCurrency || holding.currency || 'EUR').toUpperCase());
  };

  const handlePriceSave = async (holdingId) => {
    try {
      const price = parseFloat(editingPriceValue.replace(',', '.'));
      if (isNaN(price) || price < 0) {
        alert('Please enter a valid positive number');
        return;
      }
      await updateHoldingPrice(holdingId, price, editingPriceCurrency);
      setEditingPriceId(null);
      setEditingPriceValue('');
      setEditingPriceCurrency('EUR');
      await loadHoldings({ silent: true });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Failed to update price. Please try again.');
    }
  };

  const handlePriceCancel = () => {
    setEditingPriceId(null);
    setEditingPriceValue('');
    setEditingPriceCurrency('EUR');
  };

  const handlePurchasePriceEdit = (holding) => {
    setEditingPurchasePriceId(holding.id);
    setEditingPurchasePriceValue(holding.purchase_price != null ? String(holding.purchase_price) : '');
  };

  const handlePurchasePriceSave = async (holdingId) => {
    try {
      const raw = editingPurchasePriceValue.trim();
      const purchasePrice = raw === '' ? '' : parseFloat(raw.replace(',', '.'));
      if (raw !== '' && (isNaN(purchasePrice) || purchasePrice < 0)) {
        alert('Please enter a valid positive number, or leave blank to clear it');
        return;
      }
      await updateHoldingPurchasePrice(holdingId, purchasePrice);
      setEditingPurchasePriceId(null);
      setEditingPurchasePriceValue('');
      await loadHoldings({ silent: true });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating purchase price:', error);
      alert('Failed to update purchase price. Please try again.');
    }
  };

  const handlePurchasePriceCancel = () => {
    setEditingPurchasePriceId(null);
    setEditingPurchasePriceValue('');
  };

  const handleRemoveHolding = (holdingId) => {
    setConfirmRemoveHoldingId(holdingId);
  };

  const handleConfirmRemoveHolding = async (holdingId) => {
    try {
      setRemovingHoldingId(holdingId);
      await apiDeleteHolding(holdingId);
      setConfirmRemoveHoldingId(null);
      await loadHoldings({ silent: true });
      if (onUpdate) await onUpdate();
    } catch (err) {
      console.error('Error removing holding:', err);
      alert('Failed to remove holding. Please try again.');
    } finally {
      setRemovingHoldingId(null);
    }
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
    const accountType = (account?.account_type || account?.accountType || '').toLowerCase();
    const effectiveAssetType = verifyHolding?.asset_type || verifyHolding?.assetType || (accountType === 'crypto' ? 'crypto' : 'stock');
    try {
      const data = await verifyHoldingSymbol(sym, effectiveAssetType);
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
      closeVerifyModal();
      await loadHoldings({ silent: true });
      if (onUpdate) onUpdate();
    } catch (err) {
      setVerifyResult(prev => ({ ...prev, found: prev?.found, error: err.response?.data?.error || err.message || 'Update failed' }));
    } finally {
      setVerifyUpdating(false);
    }
  };

  // For stock/crypto accounts: prefer account balance (from upload/screenshot) as source of truth when available
  const isStockOrCrypto = (account.accountType === 'stocks' || account.accountType === 'crypto' || account.accountType === 'precious' ||
                           account.account_type === 'stocks' || account.account_type === 'crypto' || account.account_type === 'precious');
  const accountBalance = account.currentValue || account.balance || 0;
  const latestHistoryBalance = Array.isArray(history) && history.length > 0
    ? Number(history[0]?.balance)
    : null;
  const accountBalanceNum = Number(accountBalance);
  const correctedNonMarketBalance =
    Number.isFinite(accountBalanceNum) && accountBalanceNum > 0
      ? (
          Number.isFinite(latestHistoryBalance) &&
          latestHistoryBalance > 0 &&
          accountBalanceNum > latestHistoryBalance * 20
            ? latestHistoryBalance
            : accountBalanceNum
        )
      : 0;
  const holdingsSum = holdings.length > 0 ? holdings.reduce((sum, h) => sum + (Number(h.totalValueEur) ?? Number(h.totalValue) ?? 0), 0) : 0;
  const fromHoldings = holdingsTotalValue > 0 ? holdingsTotalValue : holdingsSum;
  const effectiveBalance = isStockOrCrypto
    ? (fromHoldings > 0 ? fromHoldings : accountBalance)
    : correctedNonMarketBalance;
  const accountTypeLower = (account.accountType || account.account_type || '').toLowerCase();
  const isContributionGrowthType = ['p2p', 'savings', 'bank'].includes(accountTypeLower);
  const contributedAmountRaw = account.contributedAmount != null ? account.contributedAmount : account.contributed_amount;
  const contributedAmount = contributedAmountRaw != null ? Number(contributedAmountRaw) : null;
  const contributionGrowthPercent = isContributionGrowthType && contributedAmount != null && contributedAmount > 0
    ? ((effectiveBalance - contributedAmount) / contributedAmount) * 100
    : null;

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
      <div className="surface-card border border-app rounded-xl shadow-xl max-w-6xl w-full p-6 max-h-[95vh] overflow-y-auto my-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-3 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-strong">
              {account.accountName || account.platform || getAccountTypeLabel(account.account_type)}
            </h2>
            <p className="text-sm text-dim mt-1">{account.platform || 'Unknown Platform'}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
            <button
              onClick={() => setShowUpdateModal(true)}
              className="px-4 py-2 btn-gold text-white rounded-lg transition-colors flex items-center gap-2"
              title="Update account with new screenshot"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Update Account
            </button>
            <button
              type="button"
              onClick={() => setShowAccountDetailsModal(true)}
              className="px-4 py-2 border border-app text-mid rounded-lg hover-dim transition-colors flex items-center gap-2"
              title="Edit balance, interest rate, name, and platform without a screenshot"
            >
              <svg className="w-5 h-5 text-mid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Update manually
            </button>
            {(account.accountType === 'stocks' || account.accountType === 'crypto' || account.accountType === 'precious' ||
              account.account_type === 'stocks' || account.account_type === 'crypto' || account.account_type === 'precious') && (
              <button
                onClick={() => setShowAddHoldingsFromScreenshotModal(true)}
                className="px-4 py-2 btn-outline-green rounded-lg transition-colors flex items-center gap-2"
                title="Add holdings from screenshot to this account"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Additional Holdings
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 -m-1 rounded-md text-dim hover:text-strong transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Account Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="card-inner rounded-xl p-4">
            <div className="text-sm text-mid mb-1">Current Value</div>
            <div className="text-2xl font-bold text-[var(--accent)]">
              {formatCurrency(effectiveBalance)}
            </div>
            {isStockOrCrypto && (
              <p className="text-xs text-dim mt-1">Live total from your holdings (converted to EUR for display).</p>
            )}
          </div>
          <div className="card-inner rounded-xl p-4">
            <div className="text-sm text-mid mb-1">Category</div>
            <div className="text-lg font-semibold text-strong">
              {getAccountTypeLabel(account.accountType || account.account_type)}
            </div>
          </div>
          <div className="card-inner rounded-xl p-4">
            <div className="text-sm text-mid mb-1">Tag</div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onBlur={async () => {
                const trimmed = tagInput.trim();
                const prev = (account.tag != null ? String(account.tag) : '').trim();
                if (trimmed === prev) return;
                setTagSaving(true);
                try {
                  await updateAccountTag(account.id, trimmed);
                  if (onUpdate) await onUpdate();
                } catch (e) {
                  console.error(e);
                  setTagInput(prev);
                } finally {
                  setTagSaving(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              placeholder="e.g. Tag 1, Family"
              disabled={tagSaving}
              className="w-full text-lg font-semibold text-strong field-dark border border-app rounded px-2 py-1.5 placeholder:text-dim disabled:opacity-60"
            />
            <p className="text-xs text-dim mt-1">Optional label to group this account on the Dashboard (allocation by Tag).</p>
          </div>
          {(account.interestRate || account.interest_rate) && (
            <div className="card-inner rounded-xl p-4">
              <div className="text-sm text-mid mb-1">Interest Rate</div>
              <div className="text-2xl font-bold text-green-400">{account.interestRate || account.interest_rate}% APY</div>
            </div>
          )}
          {isContributionGrowthType && (
            <div className="card-inner rounded-xl p-4">
              <div className="text-sm text-mid mb-1">Growth vs original amount added</div>
              <div className={`text-2xl font-bold ${
                contributionGrowthPercent == null
                  ? 'text-dim'
                  : contributionGrowthPercent >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
              }`}>
                {contributionGrowthPercent == null ? '-' : formatPercent(contributionGrowthPercent)}
              </div>
              <p className="text-xs text-dim mt-1">
                Original amount added: {contributedAmount != null ? formatCurrency(contributedAmount) : 'Not set'}
              </p>
            </div>
          )}
        </div>

        {/* Holdings (for stock/crypto accounts) */}
        {(account.accountType === 'stocks' || account.accountType === 'crypto' || account.accountType === 'precious' ||
          account.account_type === 'stocks' || account.account_type === 'crypto' || account.account_type === 'precious') && (
          <div className="card-inner rounded-xl p-6 mb-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-strong mb-3">Holdings</h3>
              <p className="text-xs text-dim mb-2">
                Live prices are from market data (Yahoo) and may differ slightly from your broker (e.g. Revolut) due to timing or feed.
              </p>
              {holdings.length > 0 && (() => {
                const getHoldingType = (h) => ((h.asset_type || h.assetType || 'stock') || '').toLowerCase();
                const HOLDINGS_TABS = [
                  { value: 'all', label: 'All' },
                  { value: 'stock', label: 'Shares', match: (t) => ['stock', 'etf'].includes(t) },
                  { value: 'crypto', label: 'Crypto', match: (t) => t === 'crypto' },
                  { value: 'precious', label: 'Gold & Silver', match: (t) => t === 'precious' },
                  { value: 'bond', label: 'Bonds', match: (t) => t === 'bond' }
                ];
                const tabsWithData = HOLDINGS_TABS.filter((tab) => {
                  if (tab.value === 'all') return true;
                  return holdings.some((h) => tab.match && tab.match(getHoldingType(h)));
                });
                if (tabsWithData.length <= 1) return null;
                return (
                  <div className="flex gap-1 border-b border-app mb-3">
                    {tabsWithData.map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setHoldingsTab(tab.value)}
                        className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                          holdingsTab === tab.value
                            ? 'border-[var(--accent)] text-[var(--accent)]'
                            : 'border-transparent text-dim hover:text-mid'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            {holdingsLoading ? (
              <div className="text-center py-8 text-dim">Loading holdings...</div>
            ) : holdings.length === 0 ? (
              <div className="text-center py-8 text-dim">
                <p className="mb-4">No holdings found. Add one manually or upload a screenshot to extract.</p>
                <button
                  type="button"
                  onClick={() => setShowAddHoldingModal(true)}
                  className="text-sm text-dim hover:text-mid border border-app hover:border-app rounded px-3 py-1.5 transition-colors inline-flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add holding (manual)
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {(() => {
                  const getHoldingType = (h) => ((h.asset_type || h.assetType || 'stock') || '').toLowerCase();
                  const filteredHoldings = holdingsTab === 'all'
                    ? holdings
                    : holdings.filter((h) => {
                        const t = getHoldingType(h);
                        if (holdingsTab === 'stock') return ['stock', 'etf'].includes(t);
                        return t === holdingsTab;
                      });
                  const filteredTotal = holdingsTab === 'all'
                    ? (fromHoldings > 0 ? fromHoldings : accountBalance)
                    : filteredHoldings.reduce((s, h) => s + (Number(h.totalValueEur) ?? Number(h.totalValue) ?? 0), 0);
                  return (
                <>
                {/* Phones: broker-style rows — everything visible without horizontal scrolling.
                    Tap a value to edit it in place (same editors as the desktop table). */}
                <div className="sm:hidden">
                  {filteredHoldings.map((holding) => {
                    const isStaticPrice = holding.priceFetchFailed === true;
                    const purchasePrice = holding.purchase_price != null ? Number(holding.purchase_price) : null;
                    const currentUnitPrice = holding.currentPrice != null
                      ? Number(holding.currentPrice)
                      : ((Number(holding.quantity) || 0) > 0 && (holding.totalValue != null || holding.totalValueEur != null)
                          ? Number(holding.totalValue ?? holding.totalValueEur) / (Number(holding.quantity) || 1)
                          : null);
                    const growthPercent = purchasePrice && purchasePrice > 0 && currentUnitPrice != null
                      ? ((currentUnitPrice - purchasePrice) / purchasePrice) * 100
                      : null;
                    const chipClass = holding.price_source === 'manual' ? 'chip-neutral' : isStaticPrice ? 'chip-warn' : 'chip-live';
                    const chipLabel = holding.price_source === 'manual' ? 'Manual'
                      : isStaticPrice ? (holding.price_source === 'screenshot' ? 'Screenshot' : 'No live price') : 'Live';
                    const miniInput = 'px-2 py-1 text-sm border border-[var(--accent)] rounded field-dark focus:outline-none';
                    const saveBtn = (onSave) => (
                      <button onClick={onSave} className="text-green-400 p-1" title="Save">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </button>
                    );
                    const cancelBtn = (onCancel) => (
                      <button onClick={onCancel} className="text-red-400 p-1" title="Cancel">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    );
                    return (
                      <div key={holding.id} className="py-3 border-b border-app last:border-b-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {editingSymbolId === holding.id ? (
                              <span className="flex items-center gap-1">
                                <input type="text" value={editingSymbolValue} autoFocus
                                  onChange={(e) => setEditingSymbolValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSymbolSave(holding.id); else if (e.key === 'Escape') handleSymbolCancel(); }}
                                  className={`w-24 ${miniInput}`} />
                                {saveBtn(() => handleSymbolSave(holding.id))}{cancelBtn(handleSymbolCancel)}
                              </span>
                            ) : (
                              <button type="button" onClick={() => handleSymbolEdit(holding)} className="font-semibold text-strong text-sm truncate">
                                {holding.symbol}
                              </button>
                            )}
                            <button type="button" onClick={() => openVerifyModal(holding)}
                              className={`${chipClass} px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0`}>
                              {chipLabel}
                            </button>
                          </div>
                          <span className="font-semibold text-strong text-sm shrink-0">
                            {formatCurrency(holding.totalValueEur ?? holding.totalValue ?? 0, 'EUR')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1.5 gap-2">
                          {editingQuantityId === holding.id ? (
                            <span className="flex items-center gap-1">
                              <input type="number" step="0.0001" value={editingQuantityValue} autoFocus
                                onChange={(e) => setEditingQuantityValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleQuantitySave(holding.id); else if (e.key === 'Escape') handleQuantityCancel(); }}
                                className={`w-24 text-right ${miniInput}`} />
                              {saveBtn(() => handleQuantitySave(holding.id))}{cancelBtn(handleQuantityCancel)}
                            </span>
                          ) : editingPriceId === holding.id ? (
                            <span className="flex items-center gap-1 flex-wrap">
                              <input type="text" inputMode="decimal" value={editingPriceValue} autoFocus
                                onChange={(e) => setEditingPriceValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handlePriceSave(holding.id); else if (e.key === 'Escape') handlePriceCancel(); }}
                                className={`w-20 text-right ${miniInput}`} />
                              <select value={editingPriceCurrency} onChange={(e) => setEditingPriceCurrency(e.target.value)}
                                className="px-1 py-1 text-xs border border-app rounded field-dark">
                                <option value="EUR">€</option><option value="USD">$</option><option value="HKD">HK$</option>
                              </select>
                              {saveBtn(() => handlePriceSave(holding.id))}{cancelBtn(handlePriceCancel)}
                            </span>
                          ) : (
                            <button type="button" onClick={() => handleQuantityEdit(holding)}
                              className="text-xs text-dim text-left underline decoration-dotted underline-offset-2 decoration-[var(--border)]">
                              {(Number(holding.quantity) || 0).toFixed(4)}
                              {currentUnitPrice != null && <> × {formatCurrency(currentUnitPrice, holding.priceCurrency)}</>}
                            </button>
                          )}
                          <span className={`text-xs font-medium shrink-0 ${growthPercent == null ? 'text-dim' : growthPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {growthPercent == null ? '' : formatPercent(growthPercent)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 gap-2">
                          {editingPurchasePriceId === holding.id ? (
                            <span className="flex items-center gap-1">
                              <input type="text" inputMode="decimal" placeholder="blank = clear" value={editingPurchasePriceValue} autoFocus
                                onChange={(e) => setEditingPurchasePriceValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handlePurchasePriceSave(holding.id); else if (e.key === 'Escape') handlePurchasePriceCancel(); }}
                                className={`w-24 text-right ${miniInput}`} />
                              {saveBtn(() => handlePurchasePriceSave(holding.id))}{cancelBtn(handlePurchasePriceCancel)}
                            </span>
                          ) : (
                            <button type="button" onClick={() => handlePurchasePriceEdit(holding)}
                              className="text-[11px] text-dim underline decoration-dotted underline-offset-2 decoration-[var(--border)]">
                              Cost: {purchasePrice != null ? formatCurrency(purchasePrice, holding.priceCurrency || holding.currency) : 'not set'}
                            </button>
                          )}
                          {confirmRemoveHoldingId === holding.id ? (
                            <span className="flex items-center gap-2 text-[11px] shrink-0">
                              <button type="button" onClick={() => handleConfirmRemoveHolding(holding.id)} disabled={removingHoldingId === holding.id}
                                className="text-red-400 font-medium disabled:opacity-50">Remove</button>
                              <button type="button" onClick={() => setConfirmRemoveHoldingId(null)} className="text-dim">Cancel</button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => handleRemoveHolding(holding.id)}
                              className="text-dim hover:text-red-400 p-1 -m-1 shrink-0" title="Remove this holding">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-3 mt-1 border-t-2 border-app text-sm font-semibold">
                    <span className="text-mid">Total</span>
                    <span className="text-strong">{formatCurrency(filteredTotal, 'EUR')}</span>
                  </div>
                </div>
                <table className="w-full hidden sm:table">
                  <thead>
                    <tr className="border-b border-app">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-mid">Symbol</th>
                      <th className="text-left py-3 px-3 text-sm font-semibold text-mid w-28">Price source</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-mid">Quantity</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-mid">Purchase Price</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-mid">Growth %</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-mid">Price per Share</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-mid">Total Value</th>
                      <th className="text-center py-3 px-2 text-sm font-semibold text-mid w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHoldings.map((holding) => {
                      const isEditing = editingSymbolId === holding.id;
                      const isStaticPrice = holding.priceFetchFailed === true;
                      const purchasePrice = holding.purchase_price != null ? Number(holding.purchase_price) : null;
                      const currentUnitPrice = holding.currentPrice != null
                        ? Number(holding.currentPrice)
                        : ((Number(holding.quantity) || 0) > 0 && (holding.totalValue != null || holding.totalValueEur != null)
                            ? Number(holding.totalValue ?? holding.totalValueEur) / (Number(holding.quantity) || 1)
                            : null);
                      const growthPercent = purchasePrice && purchasePrice > 0 && currentUnitPrice != null
                        ? ((currentUnitPrice - purchasePrice) / purchasePrice) * 100
                        : null;
                      return (
                        <tr key={holding.id} className="border-b border-app hover-dim">
                          <td className="py-3 px-4 text-sm font-medium text-strong">
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
                                  className="px-2 py-1 border border-[var(--accent)] rounded field-dark placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSymbolSave(holding.id)}
                                  className="text-green-400 hover:text-green-300"
                                  title="Save"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={handleSymbolCancel}
                                  className="text-red-400 hover:text-red-300"
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
                                  className="text-dim hover:text-[var(--accent)] transition-colors"
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
                            {holding.price_source === 'manual' ? (
                              <button
                                type="button"
                                onClick={() => openVerifyModal(holding)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium chip-neutral transition-colors cursor-pointer"
                                title="Price entered manually. Click to change symbol or switch to live price."
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Manual
                              </button>
                            ) : isStaticPrice ? (
                              <button
                                type="button"
                                onClick={() => openVerifyModal(holding)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium chip-warn transition-colors cursor-pointer"
                                title="Click to enter stock ID and switch to live price"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {/* Only claim "Screenshot" when the price actually came from one */}
                                {holding.price_source === 'screenshot' ? 'Screenshot' : 'No live price'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openVerifyModal(holding)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium chip-live transition-colors cursor-pointer"
                                title={holding.priceLastUpdated
                                  ? `Price from market API, updated ${formatPriceLastUpdated(holding.priceLastUpdated)}. Click to change symbol or switch to manual.`
                                  : 'Live price. Click to change symbol or switch to manual.'}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8v8M3 21h18M3 10h18M3 7l9-4 9 4M3 10l9 4 9-4" /></svg>
                                Live
                                {holding.priceLastUpdated && (
                                  <span className="font-normal opacity-80">({formatPriceLastUpdated(holding.priceLastUpdated)})</span>
                                )}
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-mid text-right">
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
                                  className="w-24 px-2 py-1 border border-[var(--accent)] rounded field-dark placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-right"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleQuantitySave(holding.id)}
                                  className="text-green-400 hover:text-green-300"
                                  title="Save"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={handleQuantityCancel}
                                  className="text-red-400 hover:text-red-300"
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
                                  className="text-dim hover:text-[var(--accent)] transition-colors"
                                  title="Edit quantity"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-mid text-right">
                            {editingPurchasePriceId === holding.id ? (
                              <div className="flex items-center gap-2 justify-end">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="blank = clear"
                                  value={editingPurchasePriceValue}
                                  onChange={(e) => setEditingPurchasePriceValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handlePurchasePriceSave(holding.id);
                                    } else if (e.key === 'Escape') {
                                      handlePurchasePriceCancel();
                                    }
                                  }}
                                  className="w-28 px-2 py-1 border border-[var(--accent)] rounded field-dark placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-right"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handlePurchasePriceSave(holding.id)}
                                  className="text-green-400 hover:text-green-300"
                                  title="Save purchase price"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={handlePurchasePriceCancel}
                                  className="text-red-400 hover:text-red-300"
                                  title="Cancel"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 justify-end">
                                <span className={holding.purchase_price != null ? 'text-mid' : 'text-dim'}>
                                  {holding.purchase_price != null ? formatCurrency(holding.purchase_price, holding.priceCurrency || holding.currency) : 'Not set'}
                                </span>
                                <button
                                  onClick={() => handlePurchasePriceEdit(holding)}
                                  className="text-dim hover:text-[var(--accent)] transition-colors"
                                  title="Edit purchase price per unit"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className={`py-3 px-4 text-sm font-medium text-right ${
                            growthPercent == null
                              ? 'text-dim'
                              : growthPercent >= 0
                                ? 'text-green-400'
                                : 'text-red-400'
                          }`}>
                            {growthPercent == null ? '-' : formatPercent(growthPercent)}
                          </td>
                          <td className="py-3 px-4 text-sm text-mid text-right">
                            {editingPriceId === holding.id ? (
                              <div className="flex items-center gap-2 justify-end flex-wrap">
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
                                  className="w-24 px-2 py-1 border border-[var(--accent)] rounded field-dark placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-right"
                                  autoFocus
                                />
                                <select
                                  value={editingPriceCurrency}
                                  onChange={(e) => setEditingPriceCurrency(e.target.value)}
                                  className="px-2 py-1 border border-app rounded field-dark focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                                  title="Price currency"
                                >
                                  <option value="EUR">€ EUR</option>
                                  <option value="USD">$ USD</option>
                                  <option value="HKD">HK$ HKD</option>
                                </select>
                                <button
                                  onClick={() => handlePriceSave(holding.id)}
                                  className="text-green-400 hover:text-green-300"
                                  title="Save"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={handlePriceCancel}
                                  className="text-red-400 hover:text-red-300"
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
                                {isStaticPrice && !holding.currentPrice && holding.symbol && (
                                  <div className="flex items-center gap-1 justify-end mt-1">
                                    <span className="text-xs text-[var(--accent)]" title="Price from screenshot or manual. Click edit to change.">
                                      (manual)
                                    </span>
                                    <button
                                      onClick={() => handlePriceEdit(holding)}
                                      className="text-dim hover:text-[var(--accent)] transition-colors"
                                      title="Edit price (e.g. set as cash 543.42)"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                                {/* Boolean guard: `totalValue && totalValue > 0` short-circuits to the number 0, which React renders */}
                                {isStaticPrice && !!(holding.currentPrice || holding.purchase_price || holding.totalValue > 0) && (
                                  <button
                                    onClick={() => handlePriceEdit(holding)}
                                    className="ml-1 text-dim hover:text-[var(--accent)] transition-colors"
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
                          <td className="py-3 px-4 text-sm font-medium text-strong text-right">
                            {formatCurrency(holding.totalValueEur ?? holding.totalValue ?? 0, 'EUR')}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {confirmRemoveHoldingId === holding.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmRemoveHolding(holding.id)}
                                  disabled={removingHoldingId === holding.id}
                                  className="text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
                                  title="Remove this holding"
                                >
                                  Remove
                                </button>
                                <span className="text-dim">|</span>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemoveHoldingId(null)}
                                  className="text-mid hover:text-mid text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveHolding(holding.id)}
                                className="text-dim hover:text-red-400 transition-colors p-1 rounded"
                                title="Remove this holding"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-app font-semibold">
                      <td colSpan="6" className="py-3 px-4 text-sm text-mid">Total</td>
                      <td className="py-3 px-4 text-sm text-strong text-right">
                        {formatCurrency(
                          holdingsTab === 'all'
                            ? (fromHoldings > 0 ? fromHoldings : accountBalance)
                            : filteredHoldings.reduce((s, h) => s + (Number(h.totalValueEur) ?? Number(h.totalValue) ?? 0), 0),
                          'EUR'
                        )}
                      </td>
                      <td className="py-3 px-2" />
                    </tr>
                  </tfoot>
                </table>
                </>
                  );
                })()}
              </div>
            )}
            {!holdingsLoading && (
              <div className="mt-4 pt-3 border-t border-app">
                <button
                  type="button"
                  onClick={() => setShowAddHoldingModal(true)}
                  className="text-sm text-dim hover:text-strong transition-colors inline-flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add holding (manual)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        {!loading && chartData.length > 0 && (
          <div className="card-inner rounded-xl p-6 mb-6">
            <h3 className="text-xl font-semibold text-strong mb-4">Value Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={combinedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26262b" />
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
                  labelStyle={{ color: '#374151' }} contentStyle={{ background: '#131316', border: '1px solid #26262b', color: '#e7e7ea' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#c8923e" 
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
              <p className="text-xs text-dim mt-2 text-center">
                {projectionSource === 'p2p'
                  ? `Projection based on ${account.interestRate || account.interest_rate}% APY interest rate`
                  : projectionSource === 'trend_crypto'
                    ? '3‑month projection based on 2‑year history with recent-trend weighting. Not guaranteed.'
                    : '3‑month projection based on 6‑month historical trend. Not guaranteed.'}
              </p>
            )}
          </div>
        )}

        {/* History Table */}
        <div className="card-inner rounded-xl p-6">
          <h3 className="text-xl font-semibold text-strong mb-1">Value History</h3>
          <p className="text-xs text-dim mb-4">Each row is the account total when you saved an update (e.g. screenshot upload). The timing differs from the live prices above.</p>
          {loading ? (
            <div className="text-center py-8 text-dim">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-dim">No history available yet. Upload more screenshots to track changes.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-app">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-mid">Date</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-mid">Value</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-mid">Change</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-mid">Change %</th>
                    {(account.interestRate || account.interest_rate) && (
                      <th className="text-right py-3 px-4 text-sm font-semibold text-mid">Interest Rate</th>
                    )}
                    <th className="text-center py-3 px-4 text-sm font-semibold text-mid">Actions</th>
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
                        className={`border-b border-app hover-dim ${
                          isRecordToday ? 'bg-[rgba(200,146,62,0.08)]' : ''
                        }`}
                      >
                        <td className={`py-3 px-4 text-sm ${
                          isRecordToday ? 'font-semibold text-[var(--accent)]' : 'text-mid'
                        }`}>
                          {formatDate(record.recorded_at)}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-strong text-right">
                          {formatCurrency(record.balance)}
                        </td>
                        <td className={`py-3 px-4 text-sm font-medium text-right ${
                          isPositive ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {index < history.length - 1 ? formatChange(change) : '-'}
                        </td>
                        <td className={`py-3 px-4 text-sm font-medium text-right ${
                          isPositive ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {index < history.length - 1 ? `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%` : '-'}
                        </td>
                        {(account.interestRate || account.interest_rate) && (
                          <td className="py-3 px-4 text-sm text-mid text-right">
                            {record.interest_rate ? `${record.interest_rate}%` : '-'}
                          </td>
                        )}
                        <td className="py-3 px-4 text-center">
                          {confirmDeleteId === record.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleDeleteHistory(record.id)}
                                disabled={deletingHistoryId === record.id}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500 transition-colors disabled:opacity-50"
                                title="Confirm delete"
                              >
                                {deletingHistoryId === record.id ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={deletingHistoryId === record.id}
                                className="px-2 py-1 border border-app text-mid text-xs rounded hover-dim transition-colors disabled:opacity-50"
                                title="Cancel"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDeleteHistory(record.id)}
                              disabled={deletingHistoryId === record.id}
                              className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
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
          <div className="surface-card border border-app rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-strong">Link to live stock</h3>
              <button type="button" onClick={closeVerifyModal} className="text-dim hover:text-mid" disabled={verifyUpdating}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-sm text-mid mb-3">Enter the stock/ETF ticker (e.g. 2B76, TSLA) to fetch live price and switch this holding to &quot;Live&quot;.</p>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-mid">Stock / ETF symbol</label>
              <input
                type="text"
                value={verifySymbolInput}
                onChange={(e) => setVerifySymbolInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifySymbol()}
                placeholder="e.g. 2B76 or TSLA"
                className="w-full px-3 py-2 border border-app rounded-md field-dark placeholder:text-dim focus:ring-2 focus:ring-[var(--accent)]"
                disabled={verifyUpdating}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleVerifySymbol}
                  disabled={verifyLoading || !verifySymbolInput.trim() || verifyUpdating}
                  className="px-4 py-2 border border-app text-mid rounded-md hover-dim disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {verifyLoading ? 'Checking…' : 'Verify'}
                </button>
                {verifyResult && (
                  <button
                    type="button"
                    onClick={handleUpdateSymbolFromVerify}
                    disabled={verifyUpdating || !verifyResult.found}
                    className="px-4 py-2 btn-gold text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {verifyUpdating ? 'Updating…' : 'Update'}
                  </button>
                )}
              </div>
              {verifyResult && (
                <div className={`text-sm p-3 rounded-md ${verifyResult.found ? 'success-box' : 'error-box'}`}>
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
          onAddNewAccount={onAddNewAccount}
          onSuccess={async () => {
            setShowUpdateModal(false);
            // Reload history and refresh account data
            await loadHistory();
            // Reload holdings and projection for stocks/crypto/precious (backend may have updated holdings from screenshot)
            const at = account.account_type || account.accountType;
            if (at === 'stocks' || at === 'crypto' || at === 'precious') {
              await loadHoldings();
            }
            if (onUpdate) {
              onUpdate();
            }
          }}
        />
      )}

      {showAccountDetailsModal && (
        <AccountDetailsModal
          account={account}
          currency={currency}
          onClose={() => setShowAccountDetailsModal(false)}
          onUpdate={async () => {
            await loadHistory();
            if (onUpdate) await onUpdate();
          }}
        />
      )}

      {showAddHoldingsFromScreenshotModal && (
        <AddHoldingsFromScreenshotModal
          account={account}
          onClose={() => setShowAddHoldingsFromScreenshotModal(false)}
          onSuccess={async () => {
            setShowAddHoldingsFromScreenshotModal(false);
            await loadHoldings();
            if (onUpdate) await onUpdate();
          }}
        />
      )}

      {showAddHoldingModal && (
        <AddHoldingModal
          accountId={account.id}
          accountType={account.account_type || account.accountType || 'stocks'}
          onClose={() => setShowAddHoldingModal(false)}
          onSuccess={async () => {
            setShowAddHoldingModal(false);
            await loadHoldings();
            if (onUpdate) await onUpdate();
          }}
        />
      )}
    </div>
  );
}
