import { useState, useMemo, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const INSTRUMENT_LABELS = {
  stocks: 'ETF & Stocks', crypto: 'Cryptocurrency', p2p: 'P2P Lending',
  precious: 'Gold & Silver', savings: 'Savings & Deposits', bank: 'Fixed Income & Bonds', unknown: 'Other'
};

const fmt = (value, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);

const UNTAGGED_LABEL = 'Untagged';

/** Group accounts by custom tag for pie + drill-down (categories = account types for PlatformDetailView tabs). */
function buildTagPieData(accountList) {
  const map = {};
  for (const a of accountList) {
    const raw = (a.tag || '').trim();
    const label = raw.length > 0 ? raw : UNTAGGED_LABEL;
    if (!map[label]) {
      map[label] = { name: label, value: 0, accounts: [], categories: {} };
    }
    map[label].value += a.currentValue ?? a.balance ?? 0;
    map[label].accounts.push(a);
    const typ = (a.accountType || a.account_type || 'unknown').toLowerCase();
    if (!map[label].categories[typ]) map[label].categories[typ] = [];
    map[label].categories[typ].push(a);
  }
  return Object.values(map).sort((x, y) => y.value - x.value);
}

const VIEW_MODES = [
  { id: 'platform', label: 'Platform' },
  { id: 'instrument', label: 'Instrument' },
  { id: 'tag', label: 'Tag' }
];

export default function Dashboard({ portfolioData, onUploadClick, onViewAccountDetails, onViewPlatformDetails }) {
  const [viewMode, setViewMode] = useState('platform');
  const [hoverIndex, setHoverIndex] = useState(null);
  const [activeSegment, setActiveSegment] = useState(null);
  /** Sort order for the right-hand allocation list only (pie chart order unchanged). */
  const [allocationSort, setAllocationSort] = useState('value');
  const listRef = useRef(null);
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
  const tagPieData = buildTagPieData(accounts);
  const pieData =
    viewMode === 'platform' ? platformPieData : viewMode === 'instrument' ? instrumentPieData : tagPieData;
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
  const portfolioGrowthPercent = portfolioData.portfolioGrowthPercent;
  const hasPortfolioGrowth = portfolioGrowthPercent != null && Number.isFinite(Number(portfolioGrowthPercent));
  const portfolioGrowthLabel = hasPortfolioGrowth
    ? `${Number(portfolioGrowthPercent) >= 0 ? '+' : ''}${Number(portfolioGrowthPercent).toFixed(2)}%`
    : null;
  const portfolioGrowthColor = !hasPortfolioGrowth
    ? 'var(--text-3)'
    : Number(portfolioGrowthPercent) >= 0
      ? '#10b981'
      : '#ef4444';
  const listItems =
    viewMode === 'platform' ? platforms : viewMode === 'instrument' ? instrumentPieData : tagPieData;

  const sortedListItems = useMemo(() => {
    const arr = [...listItems];
    if (allocationSort === 'value') {
      arr.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    } else if (allocationSort === 'name') {
      arr.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
    } else {
      arr.sort((a, b) => String(b.name).localeCompare(String(a.name), undefined, { sensitivity: 'base' }));
    }
    return arr;
  }, [listItems, allocationSort]);

  const topPlatform = useMemo(() =>
    [...platforms].sort((a, b) => (b.value || 0) - (a.value || 0))[0] || null
  , [platforms]);

  const pieColorIndex = (item) => {
    const i = pieData.findIndex((e) => e.name === item.name);
    return i >= 0 ? i : 0;
  };

  const lastUpdatedMs = portfolioData.lastUpdated ? new Date(portfolioData.lastUpdated).getTime() : null;
  const minsAgo = lastUpdatedMs ? Math.floor((Date.now() - lastUpdatedMs) / 60000) : null;
  const freshnessColor = minsAgo === null ? 'var(--text-3)' : minsAgo < 60 ? '#10b981' : minsAgo < 1440 ? '#f59e0b' : '#ef4444';
  const freshnessLabel = minsAgo === null ? '' : minsAgo < 1 ? 'Just now' : minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.floor(minsAgo / 60)}h ago` : `${Math.floor(minsAgo / 1440)}d ago`;

  return (
    <div className="space-y-5">
      {/* Portfolio header */}
      <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>Total Portfolio Value</p>
            <div className="text-4xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>{formattedTotal}</div>
            {hasPortfolioGrowth && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-semibold" style={{ color: portfolioGrowthColor }}>
                  {portfolioGrowthLabel}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                  cost-basis growth
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: freshnessColor }} />
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Updated <span style={{ color: freshnessColor, fontWeight: 500 }}>{freshnessLabel}</span>
              </p>
            </div>
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

      {/* Hero stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-xs uppercase tracking-wider font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>Accounts</p>
          <div className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{accounts.length}</div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{platforms.length} platforms</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-xs uppercase tracking-wider font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>Largest Platform</p>
          <div className="text-lg font-bold truncate" style={{ color: 'var(--text-1)' }}>{topPlatform?.name || '—'}</div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{topPlatform ? fmt(topPlatform.value, currency) : '—'}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-xs uppercase tracking-wider font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>Top Asset Type</p>
          <div className="text-base font-bold truncate leading-tight" style={{ color: 'var(--text-1)' }}>{instrumentPieData[0]?.name || '—'}</div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            {instrumentPieData[0] ? `${((instrumentPieData[0].value / totalValue) * 100).toFixed(1)}% of portfolio` : '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Donut chart */}
      <div className="rounded-lg border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
              {viewMode === 'platform' ? 'By Platform' : viewMode === 'instrument' ? 'By Instrument' : 'By Tag'}
            </h3>
            <div className="flex rounded-md p-0.5 border flex-wrap gap-0.5 justify-end" style={{ background: 'var(--bg-inner)', borderColor: 'var(--border)' }}>
              {VIEW_MODES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setViewMode(id); setActiveSegment(null); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    viewMode === id ? 'bg-blue-600 text-white' : ''
                  }`}
                  style={viewMode !== id ? { color: 'var(--text-3)' } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
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
                    } else if (viewMode === 'instrument') {
                      const entry = instrumentPieData.find(e => e.name === data.name);
                      onViewPlatformDetails(entry ? { name: entry.name, value: entry.value, accounts: entry.accounts, categories: { [entry.type]: entry.accounts } } : { name: data.name, value: data.value, accounts: [], categories: {} });
                    } else {
                      const entry = tagPieData.find(e => e.name === data.name);
                      onViewPlatformDetails(entry ? { name: entry.name, value: entry.value, accounts: entry.accounts, categories: entry.categories || {} } : { name: data.name, value: data.value, accounts: [], categories: {} });
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
            {pieData.map((entry, index) => {
              const isActive = activeSegment === entry.name;
              return (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => {
                    setActiveSegment(prev => prev === entry.name ? null : entry.name);
                    listRef.current?.querySelector(`[data-name="${entry.name}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }}
                  className="flex items-center gap-1.5 text-xs transition rounded px-1.5 py-0.5"
                  style={{
                    color: isActive ? 'var(--text-1)' : 'var(--text-3)',
                    background: isActive ? `${COLORS[index % COLORS.length]}22` : 'transparent',
                    outline: isActive ? `1px solid ${COLORS[index % COLORS.length]}55` : 'none',
                    opacity: activeSegment && !isActive ? 0.45 : 1,
                  }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate max-w-[120px]" title={entry.name}>
                    {entry.name.length > 16 ? entry.name.substring(0, 14) + '…' : entry.name}
                  </span>
                </button>
              );
            })}
            {activeSegment && (
              <button
                type="button"
                onClick={() => setActiveSegment(null)}
                className="flex items-center gap-1 text-xs transition"
                style={{ color: 'var(--text-3)' }}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Allocation list */}
        <div className="rounded-lg border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <h3 className="text-sm font-semibold shrink-0" style={{ color: 'var(--text-1)' }}>
              {viewMode === 'platform' ? 'Platforms' : viewMode === 'instrument' ? 'Instruments' : 'Tags'}
            </h3>
            <label className="flex items-center gap-2 text-xs shrink-0" style={{ color: 'var(--text-3)' }}>
              <span className="whitespace-nowrap">Sort</span>
              <select
                value={allocationSort}
                onChange={(e) => setAllocationSort(e.target.value)}
                className="min-w-0 max-w-full rounded-md border px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: 'var(--bg-inner)', color: 'var(--text-1)', borderColor: 'var(--border)' }}
                aria-label="Sort allocation list"
              >
                <option value="value">By value (high → low)</option>
                <option value="name">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
              </select>
            </label>
          </div>
          <div className="space-y-2" ref={listRef}>
            {sortedListItems.map((item) => {
              const pct = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0.0';
              const ci = pieColorIndex(item);
              const sliceColor = COLORS[ci % COLORS.length];
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onViewPlatformDetails && onViewPlatformDetails(
                    viewMode === 'platform'
                      ? item
                      : viewMode === 'instrument'
                        ? { name: item.name, value: item.value, accounts: item.accounts || [], categories: item.type ? { [item.type]: item.accounts } : {} }
                        : { name: item.name, value: item.value, accounts: item.accounts || [], categories: item.categories || {} }
                  )}
                  className="w-full text-left p-3 rounded-md border transition-all group"
                  data-name={item.name}
                  style={{
                    background: 'var(--bg-inner)',
                    borderColor: activeSegment === item.name ? sliceColor : 'var(--border)',
                    opacity: activeSegment && activeSegment !== item.name ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { if (!activeSegment || activeSegment === item.name) e.currentTarget.style.borderColor = sliceColor; }}
                  onMouseLeave={e => e.currentTarget.style.borderColor = activeSegment === item.name ? sliceColor : 'var(--border)'}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sliceColor }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{item.name}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{fmt(item.value, currency)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: sliceColor }} />
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
