import './AuthCard.css';

// Illustrative allocation for the logged-out hero (not user data)
const ALLOCATION = [
  { label: 'Equities', pct: 30, color: '#4a7fb8' },
  { label: 'Crypto', pct: 20, color: '#4ade80' },
  { label: 'Bonds', pct: 15, color: '#e8a33d' },
  { label: 'Cash', pct: 15, color: '#8b6dab' },
  { label: 'Real estate', pct: 10, color: '#06b6d4' },
  { label: 'Alternatives', pct: 10, color: '#c1614a' },
];

const CHIP_POSITIONS = ['auth-orbit-1', 'auth-orbit-2', 'auth-orbit-3', 'auth-orbit-4', 'auth-orbit-5'];

function DonutHero() {
  const r = 78;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="auth-donut-stage">
      <svg className="auth-donut-hero" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" />
        {ALLOCATION.map((seg) => {
          const dash = (seg.pct / 100) * c - 4; // small gap between segments
          const el = (
            <circle
              key={seg.label}
              className="auth-donut-seg"
              cx="100"
              cy="100"
              r={r}
              stroke={seg.color}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
            >
              <title>{`${seg.label} ${seg.pct}%`}</title>
            </circle>
          );
          offset += (seg.pct / 100) * c;
          return el;
        })}
      </svg>
      <div className="auth-donut-center">
        <div>
          <div className="auth-donut-center-label">Total Portfolio</div>
          <div className="auth-donut-center-value">124.560&thinsp;€</div>
          <span className="auth-donut-center-badge">▲ +12,4% YTD</span>
        </div>
      </div>
      {ALLOCATION.slice(0, CHIP_POSITIONS.length).map((seg, i) => (
        <div key={seg.label} className={`auth-orbit-chip ${CHIP_POSITIONS[i]}`}>
          <span className="auth-orbit-dot" style={{ background: seg.color }} />
          {seg.label}
          <span className="auth-orbit-pct">{seg.pct}%</span>
        </div>
      ))}
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

      {/* Hero panel — the allocation ring is the landing visual */}
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <p className="auth-eyebrow">Portfolio intelligence</p>
          <h2 className="auth-headline">
            See your whole wealth<br />
            <span className="auth-headline-accent">in one ring.</span>
          </h2>
          <p className="auth-tagline">
            Brokers, banks, crypto wallets and P2P platforms — synced into a single live allocation with AI screenshot import.
          </p>

          <DonutHero />

          <div className="auth-trust">
            <div><div className="auth-trust-n">9+</div><div className="auth-trust-t">platforms</div></div>
            <div className="auth-trust-sep" />
            <div><div className="auth-trust-n">AI</div><div className="auth-trust-t">screenshot import</div></div>
            <div className="auth-trust-sep" />
            <div><div className="auth-trust-n">Live</div><div className="auth-trust-t">market prices</div></div>
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
