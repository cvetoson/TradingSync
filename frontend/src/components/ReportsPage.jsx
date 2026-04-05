import { useState } from 'react';
import { getAccountHistory, getAccountHoldings } from '../services/api';

const INSTRUMENT_LABELS = {
  stocks: 'ETF & Stocks', crypto: 'Cryptocurrency', p2p: 'P2P Lending',
  precious: 'Gold & Silver', savings: 'Savings & Deposits', bank: 'Fixed Income & Bonds', unknown: 'Other'
};

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields) {
  return fields.map(escapeCsv).join(',');
}

function ReportCard({ title, description, icon, buttonLabel, loading, progress, onClick }) {
  return (
    <div
      className="rounded-xl border p-6 flex flex-col"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--bg-inner)' }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{title}</h3>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-3)' }}>{description}</p>
        </div>
      </div>

      {loading && progress != null && (
        <div className="mb-3">
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-inner)' }}>
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>
            {Math.round(progress * 100)}% complete
          </p>
        </div>
      )}

      <div className="mt-auto pt-2">
        <button
          onClick={onClick}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {buttonLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function ReportsPage({ portfolioData, currency }) {
  const [loadingState, setLoadingState] = useState({});
  const [progress, setProgress] = useState({});

  const accounts = portfolioData?.accounts || [];
  const cur = currency || portfolioData?.currency || 'EUR';

  const setLoading = (key, val) => setLoadingState(prev => ({ ...prev, [key]: val }));
  const setProgressVal = (key, val) => setProgress(prev => ({ ...prev, [key]: val }));

  const handlePortfolioSummary = () => {
    setLoading('summary', true);
    try {
      const header = csvRow(['Name', 'Platform', 'Type', 'Tag', 'Balance', 'Currency', 'Last Updated']);
      const rows = accounts.map(a => {
        const type = (a.accountType || a.account_type || 'unknown').toLowerCase();
        const label = INSTRUMENT_LABELS[type] || type;
        return csvRow([
          a.accountName || a.platform || 'Unknown',
          a.platform || '',
          label,
          a.tag || '',
          a.balance ?? a.currentValue ?? 0,
          cur,
          a.lastUpdated || a.updated_at || new Date().toISOString()
        ]);
      });
      const csv = [header, ...rows].join('\n');
      downloadFile(csv, `portfolio-summary-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    } finally {
      setLoading('summary', false);
    }
  };

  const handleHoldingsReport = async () => {
    setLoading('holdings', true);
    setProgressVal('holdings', 0);
    try {
      const allHoldings = [];
      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        try {
          const { holdings } = await getAccountHoldings(acc.id);
          if (holdings) {
            holdings.forEach(h => allHoldings.push({ ...h, accountName: acc.accountName || acc.platform || 'Unknown' }));
          }
        } catch { /* skip accounts that fail */ }
        setProgressVal('holdings', (i + 1) / accounts.length);
      }

      const header = csvRow(['Account', 'Symbol', 'Quantity', 'Purchase Price', 'Current Price', 'Currency', 'Asset Type']);
      const rows = allHoldings.map(h => csvRow([
        h.accountName,
        h.symbol || '',
        h.quantity ?? '',
        h.purchase_price ?? h.purchasePrice ?? '',
        h.current_price ?? h.currentPrice ?? '',
        h.currency || cur,
        h.asset_type || h.assetType || ''
      ]));
      const csv = [header, ...rows].join('\n');
      downloadFile(csv, `holdings-report-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    } finally {
      setLoading('holdings', false);
      setProgressVal('holdings', null);
    }
  };

  const handleHistoryReport = async () => {
    setLoading('history', true);
    setProgressVal('history', 0);
    try {
      const allHistory = [];
      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        try {
          const { history } = await getAccountHistory(acc.id);
          if (history) {
            history.forEach(h => allHistory.push({ ...h, accountName: acc.accountName || acc.platform || 'Unknown' }));
          }
        } catch { /* skip accounts that fail */ }
        setProgressVal('history', (i + 1) / accounts.length);
      }

      const header = csvRow(['Account', 'Date', 'Balance', 'Interest Rate', 'Currency']);
      const rows = allHistory.map(h => csvRow([
        h.accountName,
        h.recorded_at || h.recordedAt || '',
        h.balance ?? '',
        h.interest_rate ?? h.interestRate ?? '',
        h.currency || cur
      ]));
      const csv = [header, ...rows].join('\n');
      downloadFile(csv, `history-report-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    } finally {
      setLoading('history', false);
      setProgressVal('history', null);
    }
  };

  const handlePortfolioSnapshot = () => {
    setLoading('snapshot', true);
    try {
      const snapshot = {
        exportDate: new Date().toISOString(),
        currency: cur,
        totalValue: portfolioData?.totalValue ?? 0,
        accountCount: accounts.length,
        accounts: accounts.map(a => ({
          id: a.id,
          name: a.accountName || a.platform || 'Unknown',
          platform: a.platform || '',
          type: (a.accountType || a.account_type || 'unknown').toLowerCase(),
          typeLabel: INSTRUMENT_LABELS[(a.accountType || a.account_type || 'unknown').toLowerCase()] || 'Other',
          balance: a.balance ?? 0,
          currentValue: a.currentValue ?? a.balance ?? 0,
          interestRate: a.interest_rate ?? a.interestRate ?? null,
          currency: cur
        })),
        platforms: (portfolioData?.platforms || []).map(p => ({
          name: p.name,
          totalValue: p.totalValue,
          accountCount: p.accounts?.length ?? 0
        }))
      };
      const json = JSON.stringify(snapshot, null, 2);
      downloadFile(json, `portfolio-snapshot-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    } finally {
      setLoading('snapshot', false);
    }
  };

  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border p-6"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
          Reports &amp; Export
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
          Download your portfolio data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ReportCard
          title="Portfolio Summary"
          description="Export all your accounts with name, platform, type, balance, and currency as a CSV file."
          icon={
            <svg className="w-5 h-5" style={{ color: 'var(--text-2)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12c-.621 0-1.125.504-1.125 1.125M12 10.875c-.621 0-1.125.504-1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125" />
            </svg>
          }
          buttonLabel="Download CSV"
          loading={loadingState.summary}
          onClick={handlePortfolioSummary}
        />

        <ReportCard
          title="Holdings Report"
          description="Export all holdings across every account including symbol, quantity, purchase price, and current price."
          icon={
            <svg className="w-5 h-5" style={{ color: 'var(--text-2)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          }
          buttonLabel="Download CSV"
          loading={loadingState.holdings}
          progress={progress.holdings}
          onClick={handleHoldingsReport}
        />

        <ReportCard
          title="History Report"
          description="Export the full balance history for all accounts, including date, balance, and interest rate."
          icon={
            <svg className="w-5 h-5" style={{ color: 'var(--text-2)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          buttonLabel="Download CSV"
          loading={loadingState.history}
          progress={progress.history}
          onClick={handleHistoryReport}
        />

        <ReportCard
          title="Portfolio Snapshot"
          description="Download a complete JSON snapshot of your portfolio data, including all accounts, balances, and metadata."
          icon={
            <svg className="w-5 h-5" style={{ color: 'var(--text-2)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
          }
          buttonLabel="Download JSON"
          loading={loadingState.snapshot}
          onClick={handlePortfolioSnapshot}
        />
      </div>
    </div>
  );
}
