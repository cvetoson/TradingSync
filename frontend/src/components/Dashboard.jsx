import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const INSTRUMENT_LABELS = {
  stocks: 'ETF & Stocks', crypto: 'Cryptocurrency', p2p: 'P2P Lending',
  precious: 'Gold & Silver', savings: 'Savings & Deposits', bank: 'Fixed Income & Bonds', unknown: 'Other'
};

const fmt = (value, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);

export default function Dashboard({ portfolioData, onUploadClick, onViewAccountDetails, onViewPlatformDetails }) {
  const [viewMode, setViewMode] = useState('platform');
  const [hoverIndex, setHoverIndex] = useState(null);
  const platforms = portfolioData?.platforms || [];
  const accounts = portfolioData?.accounts || [];
  const platformPieData = portfolioData?.pieData || [];
  const currency = portfolioData?.currency || 'EUR';

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
      <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'var(--bg-inner)' }}>
          <svg className="w-8 h-8" style={{ color: 'var(--text-3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-1)' }}>No Portfolio Data Yet</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Upload screenshots from your trading platforms to get started</p>
        <button onClick={onUploadClick} className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-5 rounded-lg text-sm transition">
          Add First Account
        </button>
      </div>
    );
  }

  const totalValue = portfolioData.totalValue;
  const formattedTotal = fmt(totalValue, currency);
  const listItems = viewMode === 'platform' ? platforms : instrumentPieData;

  return (
    <div className="space-y-5">
      {/* Portfolio header */}
      <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-3)' }}>Total Portfolio Value</p>
            <div className="text-4xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>{formattedTotal}</div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-4)' }}>
              Last updated: {new Date(portfolioData.lastUpdated).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onUploadClick}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-md text-sm transition shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Donut chart */}
      <div className="rounded-lg border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
              {viewMode === 'platform' ? 'By Platform' : 'By Instrument'}
            </h3>
            <div className="flex rounded-md p-0.5 border" style={{ background: 'var(--bg-inner)', borderColor: 'var(--border)' }}>
              {['platform', 'instrument'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition capitalize ${
                    viewMode === mode ? 'bg-blue-600 text-white' : ''
                  }`}
                  style={viewMode !== mode ? { color: 'var(--text-3)' } : {}}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={72} outerRadius={105} paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={(_, idx) => setHoverIndex(idx)}
                  onMouseLeave={() => setHoverIndex(null)}
                  onClick={(data) => {
                    if (!onViewPlatformDetails) return;
                    if (viewMode === 'platform') {
                      onViewPlatformDetails(platforms.find(p => p.name === data.platform) || { name: data.platform, value: data.value, accounts: data.accounts || [], categories: {} });
                    } else {
                      const entry = instrumentPieData.find(e => e.name === data.name);
                      onViewPlatformDetails(entry ? { name: entry.name, value: entry.value, accounts: entry.accounts, categories: { [entry.type]: entry.accounts } } : { name: data.name, value: data.value, accounts: [], categories: {} });
                    }
                  }}
                  style={{ cursor: onViewPlatformDetails ? 'pointer' : 'default' }}
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke={hoverIndex === index ? 'rgba(255,255,255,0.55)' : 'transparent'}
                      strokeWidth={hoverIndex === index ? 3 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--tooltip-bg)',
                    border: '1px solid var(--tooltip-border)',
                    borderRadius: '8px',
                    color: 'var(--tooltip-text)',
                    fontSize: '12px',
                    padding: '6px 8px',
                  }}
                  labelStyle={{
                    color: 'var(--tooltip-text)',
                    fontSize: '11px',
                    fontWeight: 500,
                  }}
                  itemStyle={{
                    color: 'var(--tooltip-text)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                  separator=""
                  formatter={(value) => [fmt(value, currency), '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Total</div>
                <div className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-1)' }}>{formattedTotal}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
            {pieData.map((entry, index) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => {
                  if (!onViewPlatformDetails) return;
                  if (viewMode === 'platform') {
                    onViewPlatformDetails(platforms.find(p => p.name === entry.name) || { name: entry.name, value: entry.value, accounts: entry.accounts || [], categories: {} });
                  } else {
                    onViewPlatformDetails({ name: entry.name, value: entry.value, accounts: entry.accounts || [], categories: entry.type ? { [entry.type]: entry.accounts } : {} });
                  }
                }}
                className="flex items-center gap-1.5 text-xs transition"
                style={{ color: 'var(--text-3)' }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="truncate max-w-[120px]" title={entry.name}>
                  {entry.name.length > 16 ? entry.name.substring(0, 14) + '…' : entry.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Allocation list */}
        <div className="rounded-lg border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
            {viewMode === 'platform' ? 'Platforms' : 'Instruments'}
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {listItems.map((item, index) => {
              const pct = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0.0';
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onViewPlatformDetails && onViewPlatformDetails(
                    viewMode === 'platform' ? item
                      : { name: item.name, value: item.value, accounts: item.accounts || [], categories: item.type ? { [item.type]: item.accounts } : {} }
                  )}
                  className="w-full text-left p-3 rounded-md border transition-all group"
                  style={{ background: 'var(--bg-inner)', borderColor: 'var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{item.name}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{fmt(item.value, currency)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[index % COLORS.length] }} />
                    </div>
                    <span className="text-xs w-10 text-right" style={{ color: 'var(--text-3)' }}>{pct}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
