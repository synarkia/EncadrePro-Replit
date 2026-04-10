export function EncadreProLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="EncadrePro"
    >
      <defs>
        <linearGradient id="ep-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9B8EFF" />
          <stop offset="100%" stopColor="#5849E0" />
        </linearGradient>
      </defs>

      {/* Rounded square background */}
      <rect width="40" height="40" rx="10" fill="url(#ep-bg)" />

      {/* Two vertical lines */}
      <line x1="14" y1="8"  x2="14" y2="32" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="26" y1="8"  x2="26" y2="32" stroke="white" strokeWidth="2.5" strokeLinecap="round" />

      {/* Two horizontal lines */}
      <line x1="8"  y1="14" x2="32" y2="14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="8"  y1="26" x2="32" y2="26" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
