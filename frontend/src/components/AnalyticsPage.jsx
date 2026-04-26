import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { getAccountHistory } from '../services/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const INSTRUMENT_LABELS = {
  stocks: 'ETF & Stocks',
  crypto: 'Cryptocurrency',
  p2p: 'P2P Lending',
  precious: 'Gold & Silver',
  savings: 'Savings & Deposits',
  bank: 'Fixed Income & Bonds',
  unknown: 'Other'
};

const TIME_RANGES = [
  { key: '1W', days: 7 },
  { key: '1M', days: 30 },
  { key: '3M', days: 90 },
  { key: '6M', days: 180 },
  { key: '1Y', days: 365 },
  { key: 'ALL', days: Infinity }
];

const fmt = (value, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);

export default function AnalyticsPage({ portfolioData, currency }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allHistories, setAllHistories] = useState([]);
  const [timeRange, setTimeRange] = useState('1Y');
  const [sortCol, setSortCol] = useState('balance');
  const [sortDir, setSortDir] = useState('desc');

  const cur = currency || portfolioData?.currency || 'EUR';
  const accounts = portfolioData?.accounts || [];
  const totalValue = portfolioData?.totalValue || 0;

  useEffect(() => {
    if (accounts.length === 0) { setLoading(false); return; }
    let cancelled = false;
    async function fetchHistories() {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          accounts.map(a =>
            getAccountHistory(a.id)
              .then(d => (d.history || []).map(h => ({ ...h, accountId: a.id })))
              .catch(() => [])
          )
        );
        if (!cancelled) setAllHistories(results.flat());
      } catch (e) {
        console.error('Failed to load account histories:', e);
        if (!cancelled) setError('Failed to load history data. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchHistories();
    return () => { cancelled = true; };
  }, [accounts.length]);

  const portfolioTimeline = useMemo(() => {
    if (allHistories.length === 0) return [];

    const cutoff = timeRange === 'ALL'
      ? 0
      : Date.now() - TIME_RANGES.find(r => r.key === timeRange).days * 86400000;
    const byDay = {};
    for (const h of allHistories) {
      const ts = new Date(h.recorded_at).getTime();
      if (ts < cutoff) continue;
      const day = new Date(h.recorded_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = {};
      byDay[day][h.accountId] = h.balance;
    }

    const days = Object.keys(byDay).sort();
    if (days.length === 0) return [];

    const accountIds = [...new Set(allHistories.map(h => h.accountId))];
    const lastKnown = {};
    return days.map(day => {
      for (const id of accountIds) {
        if (byDay[day][id] != null) lastKnown[id] = byDay[day][id];
      }
      const total = accountIds.reduce((s, id) => s + (lastKnown[id] || 0), 0);
      const d = new Date(day + 'T00:00:00');
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rawDate: day,
        value: total
      };
    });
  }, [allHistories, timeRange]);

  const allocationData = useMemo(() => {
    const map = {};
    for (const a of accounts) {
      const type = (a.accountType || a.account_type || 'unknown').toLowerCase();
      const label = INSTRUMENT_LABELS[type] || INSTRUMENT_LABELS.unknown;
      if (!map[label]) map[label] = { name: label, value: 0, count: 0, type };
      map[label].value += a.currentValue ?? a.balance ?? 0;
      map[label].count += 1;
    }
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [accounts]);

  const topPerformers = useMemo(() => {
    return [...accounts]
      .sort((a, b) => ((b.currentValue ?? b.balance ?? 0) - (a.currentValue ?? a.balance ?? 0)))
      .slice(0, 5);
  }, [accounts]);

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'name':
          va = (a.accountName || '').toLowerCase();
          vb = (b.accountName || '').toLowerCase();
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'platform':
          va = (a.platform || '').toLowerCase();
          vb = (b.platform || '').toLowerCase();
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'type':
          va = (a.accountType || a.account_type || '').toLowerCase();
          vb = (b.accountType || b.account_type || '').toLowerCase();
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'pct': {
          const pa = totalValue > 0 ? ((a.currentValue ?? a.balance ?? 0) / totalValue) : 0;
          const pb = totalValue > 0 ? ((b.currentValue ?? b.balance ?? 0) / totalValue) : 0;
          return sortDir === 'asc' ? pa - pb : pb - pa;
        }
        default: {
          va = a.currentValue ?? a.balance ?? 0;
          vb = b.currentValue ?? b.balance ?? 0;
          return sortDir === 'asc' ? va - vb : vb - va;
        }
      }
    });
  }, [accounts, sortCol, sortDir, totalValue]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ color: 'var(--text-3)', opacity: 0.4 }}> ↕</span>;
    return <span style={{ color: 'var(--text-2)' }}> {sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const yDomain = useMemo(() => {
    if (portfolioTimeline.length === 0) return ['auto', 'auto'];
    const vals = portfolioTimeline.map(d => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min;
    const pad = Math.max(range * 0.1, max * 0.05);
    return [Math.max(0, min - pad), max + pad];
  }, [portfolioTimeline]);

  const tooltipStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-1)',
    fontSize: '12px',
    padding: '8px 10px'
  };

  if (loading) {
    return (
      <div className="space-y-5">
        {/* Skeleton: chart card */}
        <div className="rounded-xl border p-6 animate-pulse" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="space-y-2">
              <div className="h-4 w-52 rounded" style={{ background: 'var(--bg-inner)' }} />
              <div className="h-3 w-80 rounded" style={{ background: 'var(--bg-inner)' }} />
            </div>
            <div className="h-8 w-40 rounded-md" style={{ background: 'var(--bg-inner)' }} />
          </div>
          <div className="h-72 rounded-lg" style={{ background: 'var(--bg-inner)' }} />
        </div>
        {/* Skeleton: two side-by-side cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[0, 1].map(i => (
            <div key={i} className="rounded-xl border p-6 animate-pulse" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="h-4 w-32 rounded mb-5" style={{ background: 'var(--bg-inner)' }} />
              <div className="h-48 rounded-lg" style={{ background: 'var(--bg-inner)' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg-inner)' }}>
          <svg className="w-6 h-6" style={{ color: 'var(--text-3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg text-sm transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Recorded portfolio value from history (uploads / manual updates)—not continuous market performance */}
      <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Recorded portfolio value over time</h3>
            <p className="text-xs mt-1 max-w-md" style={{ color: 'var(--text-3)' }}>
              From your uploads and account updates—when data was saved—not a live measure of how holdings moved in the market.
            </p>
          </div>
          <div className="flex rounded-md p-0.5 border" style={{ background: 'var(--bg-inner)', borderColor: 'var(--border)' }}>
            {TIME_RANGES.map(r => (
              <button
                key={r.key}
                type="button"
                onClick={() => setTimeRange(r.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                  timeRange === r.key ? 'bg-blue-600 text-white' : ''
                }`}
                style={timeRange !== r.key ? { color: 'var(--text-3)' } : {}}
              >
                {r.key}
              </button>
            ))}
          </div>
        </div>

        {portfolioTimeline.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={portfolioTimeline} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                tickFormatter={v => fmt(v, cur)}
                tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                domain={yDomain}
                width={90}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 500 }}
                formatter={(value) => [fmt(value, cur), 'Recorded value']}
              />
              <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-2)' }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#3b82f6' }}
                name="Recorded value"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>No historical data available for this time range.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Asset Allocation Donut */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>Asset Allocation</h3>

          {allocationData.length > 0 ? (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={95}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {allocationData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [fmt(value, cur), '']}
                      separator=""
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Total</div>
                    <div className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-1)' }}>{fmt(totalValue, cur)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-2)' }}>Type</th>
                      <th className="text-right py-2 font-medium" style={{ color: 'var(--text-2)' }}>Value</th>
                      <th className="text-right py-2 font-medium" style={{ color: 'var(--text-2)' }}>%</th>
                      <th className="text-right py-2 font-medium" style={{ color: 'var(--text-2)' }}># Accounts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocationData.map((item, i) => {
                      const pct = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={item.name} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span style={{ color: 'var(--text-1)' }}>{item.name}</span>
                            </div>
                          </td>
                          <td className="text-right py-2" style={{ color: 'var(--text-1)' }}>{fmt(item.value, cur)}</td>
                          <td className="text-right py-2" style={{ color: 'var(--text-2)' }}>{pct}%</td>
                          <td className="text-right py-2" style={{ color: 'var(--text-2)' }}>{item.count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-3)' }}>No allocation data available.</p>
          )}
        </div>

        {/* Top Performers */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>Top Performers</h3>

          {topPerformers.length > 0 ? (
            <div className="space-y-3">
              {topPerformers.map((a, i) => {
                const val = a.currentValue ?? a.balance ?? 0;
                const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : '0.0';
                return (
                  <div key={a.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold w-5 text-center" style={{ color: COLORS[i % COLORS.length] }}>
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>
                          {a.accountName || a.platform}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{fmt(val, cur)}</span>
                        <span className="text-xs w-12 text-right" style={{ color: 'var(--text-3)' }}>{pct}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-3)' }}>No accounts to display.</p>
          )}
        </div>
      </div>

      {/* Account Summary Table */}
      <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>Account Summary</h3>

        {sortedAccounts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[
                    { col: 'name', label: 'Name' },
                    { col: 'platform', label: 'Platform' },
                    { col: 'type', label: 'Type' },
                    { col: 'balance', label: 'Balance', align: 'right' },
                    { col: 'pct', label: '% of Portfolio', align: 'right' }
                  ].map(h => (
                    <th
                      key={h.col}
                      className={`py-2.5 font-medium cursor-pointer select-none transition hover:opacity-80 ${
                        h.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                      style={{ color: 'var(--text-2)' }}
                      onClick={() => handleSort(h.col)}
                    >
                      {h.label}<SortIcon col={h.col} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedAccounts.map(a => {
                  const val = a.currentValue ?? a.balance ?? 0;
                  const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : '0.0';
                  const type = (a.accountType || a.account_type || 'unknown').toLowerCase();
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2.5" style={{ color: 'var(--text-1)' }}>{a.accountName || '-'}</td>
                      <td className="py-2.5" style={{ color: 'var(--text-2)' }}>{a.platform || '-'}</td>
                      <td className="py-2.5" style={{ color: 'var(--text-2)' }}>{INSTRUMENT_LABELS[type] || type}</td>
                      <td className="py-2.5 text-right font-medium" style={{ color: 'var(--text-1)' }}>{fmt(val, cur)}</td>
                      <td className="py-2.5 text-right" style={{ color: 'var(--text-2)' }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--text-3)' }}>No accounts available.</p>
        )}
      </div>
    </div>
  );
}
