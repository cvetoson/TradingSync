import PortfolioGears3D from './PortfolioGears3D';
import './SplashScreen.css';

export default function SplashScreen({ onSignIn, onCreateAccount }) {
  return (
    <div className="splash-shell">
      <div className="splash-bg" />
      <div className="splash-sticky">
        <header className="splash-header">
          <div className="splash-logo">
            <span className="splash-logo-dot" />
            TradingSync
          </div>
          <nav className="splash-nav">
            <a>Intro</a><a>Features</a><a>Pricing</a>
          </nav>
        </header>

        <div className="splash-grid">
          <div className="splash-text">
            <h1>
              Every<br />
              position.<br />
              <span className="splash-accent">One</span> machine.
            </h1>
            <p className="splash-sub">
              Every brokerage, wallet, and bank turning together as one machine. Watch your portfolio actually move.
            </p>
            <div className="splash-cta">
              <button className="splash-btn splash-btn-primary" onClick={onSignIn}>Sign in</button>
              <button className="splash-btn" onClick={onCreateAccount}>Create account</button>
            </div>
          </div>

          <div className="splash-canvas-wrap">
            <PortfolioGears3D />
          </div>
        </div>

        <footer className="splash-footer">
          <div className="splash-legend">
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#4a7fb8' }} />Equities 30%</div>
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#c8923e' }} />Crypto 20%</div>
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#8d9748' }} />Bonds 15%</div>
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#8b6dab' }} />Cash 15%</div>
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#c1614a' }} />Real estate 10%</div>
            <div className="splash-legend-item"><span className="splash-dot" style={{ background: '#7a7a8c' }} />Alt 10%</div>
          </div>
          <div className="splash-scroll-hint">
            <span>Scroll to rotate</span>
            <span className="splash-scroll-bar" />
          </div>
        </footer>
      </div>
    </div>
  );
}
