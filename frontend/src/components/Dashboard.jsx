import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import AccountCard from './AccountCard';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

const INSTRUMENT_LABELS = {
  stocks: 'ETF & Stocks',
  crypto: 'Cryptocurrency',
  p2p: 'P2P Lending',
  precious: 'Gold & Silver',
  savings: 'Savings & Deposits',
  bank: 'Fixed Income & Bonds',
  unknown: 'Other'
};

export default function Dashboard({ portfolioData, onUploadClick, onRefresh, onViewAccountDetails, onViewPlatformDetails }) {
  const [viewMode, setViewMode] = useState('platform'); // 'platform' | 'instrument'
  const platforms = portfolioData?.platforms || [];
  const accounts = portfolioData?.accounts || [];
  const platformPieData = portfolioData?.pieData || [];

  // Group by instrument (account type)
  const instrumentMap = accounts.reduce((acc, a) => {
    const type = (a.accountType || a.account_type || 'unknown').toLowerCase();
    const label = INSTRUMENT_LABELS[type] || type;
    if (!acc[label]) acc[label] = { name: label, value: 0, accounts: [], type };
    acc[label].value += a.currentValue ?? a.balance ?? 0;
    acc[label].accounts.push(a);
    return acc;
  }, {});
  const instrumentPieData = Object.values(instrumentMap).sort((a, b) => b.value - a.value);

  const pieData = viewMode === 'platform' ? platformPieData : instrumentPieData;
  const hasData = platformPieData.length > 0;

  if (!portfolioData || !hasData) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-8 text-center">
        <div className="mb-6">
          <svg className="mx-auto h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">No Portfolio Data Yet</h2>
        <p className="text-gray-500 mb-6">Upload screenshots from your trading platforms to get started</p>
        <button
          onClick={onUploadClick}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Add First
        </button>
      </div>
    );
  }

  const totalValue = portfolioData.totalValue;
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: portfolioData.currency || 'EUR',
    minimumFractionDigits: 2
  }).format(totalValue);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Total Portfolio Value</h2>
            <p className="text-sm text-gray-500">Last updated: {new Date(portfolioData.lastUpdated).toLocaleString()}</p>
          </div>
          <button
            onClick={onUploadClick}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Add New
          </button>
        </div>
        <div className="text-4xl font-bold text-blue-600">{formattedTotal}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white rounded-lg shadow-xl p-6 overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">
              {viewMode === 'platform' ? 'Platform' : 'Instrument'}
            </h3>
            <div className="flex rounded-lg border border-gray-200 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('platform')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'platform' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                By Platform
              </button>
              <button
                type="button"
                onClick={() => setViewMode('instrument')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'instrument' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                By Instrument
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                labelLine={true}
                label={({ name }) => {
                  const displayName = name.length > 20 ? name.substring(0, 17) + '...' : name;
                  return displayName;
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                onClick={(data) => {
                  if (!onViewPlatformDetails) return;
                  if (viewMode === 'platform') {
                    onViewPlatformDetails(
                      platforms.find((p) => p.name === data.platform) || { name: data.platform, value: data.value, accounts: data.accounts || [], categories: {} }
                    );
                  } else {
                    const entry = instrumentPieData.find((e) => e.name === data.name);
                    onViewPlatformDetails(entry ? { name: entry.name, value: entry.value, accounts: entry.accounts, categories: { [entry.type]: entry.accounts } } : { name: data.name, value: data.value, accounts: [], categories: {} });
                  }
                }}
                style={{ cursor: onViewPlatformDetails ? 'pointer' : 'default' }}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: portfolioData.currency || 'EUR'
                }).format(value)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 max-h-24 overflow-y-auto">
            {pieData.map((entry, index) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => {
                  if (!onViewPlatformDetails) return;
                  if (viewMode === 'platform') {
                    onViewPlatformDetails(platforms.find((p) => p.name === entry.name) || { name: entry.name, value: entry.value, accounts: entry.accounts || [], categories: {} });
                  } else {
                    onViewPlatformDetails({ name: entry.name, value: entry.value, accounts: entry.accounts || [], categories: entry.type ? { [entry.type]: entry.accounts } : {} });
                  }
                }}
                className="flex items-center gap-1.5 text-sm hover:text-blue-600 transition-colors text-left"
              >
                <span 
                  className="inline-block w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="truncate max-w-[140px]" title={entry.name}>
                  {entry.name.length > 18 ? entry.name.substring(0, 15) + '...' : entry.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* List: Platforms or Instruments */}
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            {viewMode === 'platform' ? 'Platforms' : 'Instruments'}
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(viewMode === 'platform' ? platforms : instrumentPieData).map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => onViewPlatformDetails && onViewPlatformDetails(
                  viewMode === 'platform'
                    ? item
                    : { name: item.name, value: item.value, accounts: item.accounts || [], categories: item.type ? { [item.type]: item.accounts } : {} }
                )}
                className="w-full text-left border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-200 transition-all"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800">{item.name}</span>
                  <span className="text-lg font-bold text-blue-600">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: portfolioData.currency || 'EUR',
                      minimumFractionDigits: 2
                    }).format(item.value)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {item.accounts?.length || 0} account{(item.accounts?.length || 0) !== 1 ? 's' : ''} · Click to view
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
