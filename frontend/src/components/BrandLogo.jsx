// The 8Sync mark: dark tile, gold ring and 8, green gains-arrow.
// Self-contained (own background) so it sits on any surface.
export default function BrandLogo({ size = 36, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bl-gold" x1="15%" y1="0%" x2="85%" y2="120%">
          <stop offset="0%" stopColor="#d9a355" /><stop offset="55%" stopColor="#c8923e" /><stop offset="100%" stopColor="#8a6230" />
        </linearGradient>
        <linearGradient id="bl-green" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
        <linearGradient id="bl-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1a1a20" /><stop offset="100%" stopColor="#0a0a0c" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="224" fill="url(#bl-bg)" />
      <rect x="34" y="34" width="956" height="956" rx="200" fill="none" stroke="url(#bl-gold)" strokeWidth="22" />
      <text x="472" y="778" fontFamily="Helvetica Neue, Arial, sans-serif" fontSize="680" fontWeight="800" fill="url(#bl-gold)" textAnchor="middle">8</text>
      <path d="M 210 800 C 420 890, 640 815, 735 585" fill="none" stroke="url(#bl-green)" strokeWidth="92" strokeLinecap="round" />
      <path d="M 818 357 L 838 577 L 658 510 Z" fill="url(#bl-green)" />
    </svg>
  );
}
