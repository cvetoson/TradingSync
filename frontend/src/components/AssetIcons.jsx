/**
 * Inline SVG icons for asset categories. Vector-based so they scale to any size.
 * Colors are baked in (theme-agnostic) — saturated enough to read on light and dark backgrounds.
 */

const wrap = (size, viewBox, children) => (
  <svg
    width={size}
    height={size * (parseFloat(viewBox.split(' ')[3]) / parseFloat(viewBox.split(' ')[2]))}
    viewBox={viewBox}
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export function GoldIcon({ size = 28 }) {
  return wrap(size, '0 0 56 40', (
    <g>
      <polygon points="10,12 42,12 50,18 18,18" fill="#FAC775" stroke="#633806" strokeWidth="0.5" />
      <polygon points="10,12 18,18 18,34 10,28" fill="#BA7517" stroke="#633806" strokeWidth="0.5" />
      <polygon points="18,18 50,18 50,34 18,34" fill="#EF9F27" stroke="#633806" strokeWidth="0.5" />
      <text x="34" y="29" textAnchor="middle" fontSize="9" fill="#412402" fontWeight="500">Au</text>
    </g>
  ));
}

export function SilverIcon({ size = 28 }) {
  return wrap(size, '0 0 56 40', (
    <g>
      <ellipse cx="28" cy="32" rx="20" ry="5" fill="#888780" stroke="#444441" strokeWidth="0.5" />
      <rect x="8" y="22" width="40" height="10" fill="#B4B2A9" stroke="#444441" strokeWidth="0.5" />
      <ellipse cx="28" cy="22" rx="20" ry="5" fill="#D3D1C7" stroke="#444441" strokeWidth="0.5" />
      <text x="28" y="25" textAnchor="middle" fontSize="6" fill="#444441" fontWeight="500">Ag</text>
    </g>
  ));
}

export function P2PIcon({ size = 28 }) {
  return wrap(size, '0 0 56 40', (
    <g>
      <circle cx="18" cy="20" r="11" fill="#5DCAA5" stroke="#085041" strokeWidth="0.6" />
      <text x="18" y="25" textAnchor="middle" fontSize="13" fill="#04342C" fontWeight="500">€</text>
      <circle cx="38" cy="20" r="11" fill="#9FE1CB" stroke="#085041" strokeWidth="0.6" />
      <text x="38" y="25" textAnchor="middle" fontSize="11" fill="#04342C" fontWeight="500">%</text>
      <path d="M 26 14 L 32 14 M 30 12 L 32 14 L 30 16" stroke="#0F6E56" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </g>
  ));
}

export function StocksIcon({ size = 28 }) {
  return wrap(size, '0 0 56 40', (
    <g>
      <rect x="8" y="24" width="6" height="10" fill="#AFA9EC" />
      <rect x="18" y="18" width="6" height="16" fill="#7F77DD" />
      <rect x="28" y="12" width="6" height="22" fill="#534AB7" />
      <rect x="38" y="6" width="6" height="28" fill="#3C3489" />
      <path d="M 11 22 L 21 16 L 31 10 L 44 4" stroke="#26215C" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M 41 4 L 44 4 L 44 7" stroke="#26215C" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </g>
  ));
}

export function CashIcon({ size = 28 }) {
  return wrap(size, '0 0 56 40', (
    <g>
      <rect x="14" y="14" width="34" height="18" fill="#5DCAA5" stroke="#0F6E56" strokeWidth="0.5" rx="2" transform="rotate(-3 31 23)" />
      <rect x="10" y="11" width="34" height="18" fill="#1D9E75" stroke="#0F6E56" strokeWidth="0.5" rx="2" />
      <circle cx="27" cy="20" r="4" fill="#9FE1CB" />
      <text x="27" y="23" textAnchor="middle" fontSize="9" fill="#04342C" fontWeight="500">€</text>
    </g>
  ));
}

export function CryptoIcon({ size = 28 }) {
  return wrap(size, '0 0 56 40', (
    <g>
      <circle cx="28" cy="20" r="14" fill="#F7931A" stroke="#7A4A0D" strokeWidth="0.6" />
      <text x="28" y="26" textAnchor="middle" fontSize="18" fill="#FFFFFF" fontWeight="500" fontFamily="Georgia, serif">₿</text>
    </g>
  ));
}

export function BondIcon({ size = 28 }) {
  return wrap(size, '0 0 56 40', (
    <g>
      <rect x="6" y="8" width="44" height="24" rx="2" fill="#85B7EB" stroke="#0C447C" strokeWidth="0.6" />
      <rect x="9" y="11" width="38" height="3" fill="#185FA5" />
      <text x="28" y="25" textAnchor="middle" fontSize="9" fill="#042C53" fontWeight="500">BOND</text>
    </g>
  ));
}

const TYPE_ICON = {
  stocks: StocksIcon,
  stock: StocksIcon,
  etf: StocksIcon,
  crypto: CryptoIcon,
  p2p: P2PIcon,
  precious: GoldIcon,
  savings: CashIcon,
  bank: BondIcon,
  bond: BondIcon,
  cash: CashIcon,
  unknown: null,
};

/**
 * Resolve the right icon for an account/holding type. Symbol allows splitting
 * XAU (gold) vs XAG (silver) under the shared "precious" type.
 */
export default function AssetIcon({ type, symbol, size = 28 }) {
  const t = (type || '').toLowerCase();
  if (t === 'precious') {
    const sym = (symbol || '').toUpperCase();
    if (sym === 'XAG') return <SilverIcon size={size} />;
    return <GoldIcon size={size} />;
  }
  const Icon = TYPE_ICON[t];
  return Icon ? <Icon size={size} /> : null;
}
