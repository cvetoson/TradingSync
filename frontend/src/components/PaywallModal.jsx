import { useEffect, useState } from 'react';
import { getEntitlement } from '../services/api';
import useModalBehavior from '../hooks/useModalBehavior';

// S13: the upgrade sheet. Opened by the global 402 upgrade_required interceptor
// (see api.js / App.jsx) or from Settings. Purchase buttons become live with the
// RevenueCat integration (S15) — until then they are honest about availability.

const REASON_COPY = {
  account_limit: 'You’ve reached the 2 accounts of the free plan.',
  ai_import_limit: 'You’ve used your 3 free AI imports for this month.',
};

const BENEFITS = [
  ['AI portfolio assistant', 'Ask questions about your own portfolio — explained with your real numbers'],
  ['Unlimited accounts', 'Track every broker, bank, P2P platform and wallet you have'],
  ['Unlimited AI screenshot imports', 'Add and refresh accounts from a screenshot, any time'],
  ['Live prices every 20 minutes', 'Stocks, ETFs and crypto stay current in the background'],
  ['Full history & reports', 'Consolidated value curve, analytics and exports'],
];

function Meter({ label, used, limit }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--text-3)' }}>{label}</span>
        <span className="tabular-nums" style={{ color: used >= limit ? '#f59e0b' : 'var(--text-2)' }}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-inner)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: used >= limit ? '#f59e0b' : 'var(--accent)' }} />
      </div>
    </div>
  );
}

export default function PaywallModal({ reason, onClose }) {
  useModalBehavior(onClose);
  const [ent, setEnt] = useState(null);
  const [plan, setPlan] = useState('yearly');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    getEntitlement().then((d) => { if (!cancelled) setEnt(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleContinue = () => {
    // Replaced by the RevenueCat purchase flow in S15.
    setNotice('Subscriptions arrive with the App Store launch — everything you have stays free until then.');
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60] p-2 sm:p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-xl border shadow-2xl max-w-md w-full p-5 sm:p-6 max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

        <div className="flex items-start justify-between mb-1">
          <div className="btn-gold w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <button onClick={onClose} className="p-2 -m-1 rounded-md text-dim hover:text-strong" title="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h2 className="text-xl font-bold mt-3" style={{ color: 'var(--text-1)' }}>Trading Sync Premium</h2>
        <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-3)' }}>
          {REASON_COPY[reason] || 'Everything your portfolio needs, without limits.'}
        </p>

        {ent && !ent.premium && ent.limits.accounts != null && (
          <div className="flex gap-4 mb-5 p-3 rounded-lg border border-app" style={{ background: 'var(--bg-inner)' }}>
            <Meter label="Accounts" used={ent.usage.accounts} limit={ent.limits.accounts} />
            <Meter label="AI imports this month" used={ent.usage.aiImports} limit={ent.limits.aiImportsPerMonth} />
          </div>
        )}

        <ul className="space-y-3 mb-5">
          {BENEFITS.map(([title, sub]) => (
            <li key={title} className="flex gap-3">
              <svg className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{title}</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{sub}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { id: 'monthly', title: 'Monthly', price: '€3.99', per: '/month', badge: null },
            { id: 'yearly', title: 'Yearly', price: '€29.99', per: '/year', badge: 'Save 37%' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlan(p.id)}
              className="relative text-left p-3 rounded-lg border transition"
              style={plan === p.id
                ? { borderColor: 'var(--accent)', background: 'rgba(200,146,62,0.08)' }
                : { borderColor: 'var(--border)', background: 'var(--bg-inner)' }}
            >
              {p.badge && (
                <span className="absolute -top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full btn-gold text-white">{p.badge}</span>
              )}
              <p className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{p.title}</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>
                {p.price}<span className="text-xs font-normal" style={{ color: 'var(--text-3)' }}>{p.per}</span>
              </p>
            </button>
          ))}
        </div>

        <button type="button" onClick={handleContinue} className="btn-gold w-full py-3 rounded-lg text-white font-semibold text-sm">
          Continue with {plan === 'yearly' ? 'Yearly' : 'Monthly'}
        </button>
        {notice && <p className="text-xs mt-3 text-center" style={{ color: 'var(--accent)' }}>{notice}</p>}
        <p className="text-[11px] mt-3 text-center" style={{ color: 'var(--text-4)' }}>
          Nothing you already track is ever removed on the free plan.
        </p>
      </div>
    </div>
  );
}
