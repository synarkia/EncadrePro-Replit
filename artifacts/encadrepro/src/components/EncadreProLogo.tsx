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
          <stop offset="0%" stopColor="#9F93FF" />
          <stop offset="100%" stopColor="#5C4EE5" />
        </linearGradient>
        <linearGradient id="ep-bg-inner" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B7CFF" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#4A3FCC" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Rounded square background */}
      <rect width="40" height="40" rx="10" fill="url(#ep-bg)" />

      {/* Inner highlight overlay */}
      <rect width="40" height="40" rx="10" fill="url(#ep-bg-inner)" />

      {/* Frame / crop-corner icon — 4 L-shaped corner marks */}

      {/* Top-left */}
      <path
        d="M10 17 L10 10 L17 10"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Top-right */}
      <path
        d="M23 10 L30 10 L30 17"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Bottom-right */}
      <path
        d="M30 23 L30 30 L23 30"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Bottom-left */}
      <path
        d="M17 30 L10 30 L10 23"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
