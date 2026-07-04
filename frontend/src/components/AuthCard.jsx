import './AuthCard.css';

const ALLOCATION = [
  { label: 'Equities', pct: 30, color: '#4a7fb8' },
  { label: 'Crypto', pct: 20, color: '#c8923e' },
  { label: 'Bonds', pct: 15, color: '#8d9748' },
  { label: 'Cash', pct: 15, color: '#8b6dab' },
  { label: 'Real estate', pct: 10, color: '#c1614a' },
  { label: 'Alternatives', pct: 10, color: '#7a7a8c' },
];

const SPARK_POINTS = '0,46 14,42 28,44 42,36 56,38 70,30 84,33 98,24 112,27 126,18 140,21 154,12 168,15 182,8 196,10 210,4';

function PortfolioDonut() {
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg viewBox="0 0 120 120" className="auth-donut" aria-hidden="true">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
      {ALLOCATION.map((seg) => {
        const dash = (seg.pct / 100) * c;
        const gap = c - dash;
        const el = (
          <circle
            key={seg.label}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            className="auth-donut-segment"
          />
        );
        offset += dash;
        return el;
      })}
      <circle cx="60" cy="60" r="28" fill="rgba(8, 8, 12, 0.9)" />
      <text x="60" y="57" textAnchor="middle" className="auth-donut-value">+12.4%</text>
      <text x="60" y="70" textAnchor="middle" className="auth-donut-caption">YTD</text>
    </svg>
  );
}

function Sparkline() {
  return (
    <div className="auth-spark-card">
      <div className="auth-spark-head">
        <div>
          <p className="auth-spark-label">Total portfolio</p>
          <p className="auth-spark-value">€ 85 986,49</p>
        </div>
        <span className="auth-spark-badge">▲ 1.36%</span>
      </div>
      <svg viewBox="0 0 210 52" className="auth-spark" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="authSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(200, 146, 62, 0.35)" />
            <stop offset="100%" stopColor="rgba(200, 146, 62, 0)" />
          </linearGradient>
        </defs>
        <polygon points={`${SPARK_POINTS} 210,52 0,52`} fill="url(#authSparkFill)" />
        <polyline
          points={SPARK_POINTS}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="auth-spark-line"
        />
        <circle cx="210" cy="4" r="3" fill="var(--accent)" className="auth-spark-dot" />
      </svg>
    </div>
  );
}

export default function AuthCard({ subtitle, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-bg-glow auth-bg-glow-a" />
        <div className="auth-bg-glow auth-bg-glow-b" />
        <div className="auth-bg-glow auth-bg-glow-c" />
        <div className="auth-bg-grid" />
      </div>

      {/* Hero panel */}
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <Sparkline />

          <div className="auth-visual">
            <PortfolioDonut />
            <div className="auth-allocation">
              {ALLOCATION.map((seg) => (
                <div key={seg.label} className="auth-allocation-row">
                  <span className="auth-allocation-dot" style={{ background: seg.color }} />
                  <span className="auth-allocation-label">{seg.label}</span>
                  <span className="auth-allocation-pct">{seg.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-hero-copy">
            <p className="auth-eyebrow">Portfolio intelligence</p>
            <h2 className="auth-headline">
              Every asset,<br />
              <span className="auth-headline-accent">one place.</span>
            </h2>
            <p className="auth-tagline">
              Sync brokers, wallets, and banks into a single live dashboard — powered by AI screenshot import.
            </p>
            <div className="auth-pills">
              {['Live prices', 'AI import', 'Multi-platform'].map((f) => (
                <span key={f} className="auth-pill">{f}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-brand">
            <div className="auth-brand-icon">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h1 className="auth-brand-title">Trading Sync</h1>
            {subtitle && <p className="auth-brand-sub">{subtitle}</p>}
          </div>

          <div className="auth-card">
            {children}
          </div>

          <p className="auth-footnote">Private by design — your data stays in your account.</p>
        </div>
      </div>
    </div>
  );
}
