// The 8Sync mark (user-approved): dark tile, white 8, gold gains-arrow.
// Master SVGs live in branding/; this serves the dark variant from public/.
export default function BrandLogo({ size = 36, className = '' }) {
  return (
    <img
      src="/favicon.svg"
      width={size}
      height={size}
      className={className}
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  );
}
