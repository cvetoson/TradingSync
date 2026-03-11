export default function AuthCard({ subtitle, children }) {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-page)' }}>
      {/* Left hero panel — always dark regardless of theme */}
      <div className="hidden lg:flex lg:w-[52%] bg-[#08080c] relative overflow-hidden flex-col items-center justify-center px-16">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: 'linear-gradient(#fff 1.5px, transparent 1.5px), linear-gradient(90deg, #fff 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />
        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-md">
          {/* Hero glow only (no image) */}
          <div className="mb-10 relative flex items-center justify-center">
            <div className="absolute w-72 h-72 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            All your investments.<br />One dashboard.
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Sync balances from any trading platform in seconds — powered by AI screenshot analysis.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {['AI-powered', 'Live prices', 'P2P & Crypto', 'Stocks & ETFs'].map(f => (
              <span key={f} className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-slate-400">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>Trading Sync</h1>
            {subtitle && <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>{subtitle}</p>}
          </div>

          {/* Card */}
          <div className="rounded-xl border p-6 shadow-sm"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {children}
          </div>

        </div>
      </div>
    </div>
  );
}
