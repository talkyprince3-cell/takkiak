/**
 * The win trophy.
 *
 * Drawn rather than sourced: the reference is another operator's branded
 * artwork, so this is an original cup in the Betlixx palette — lime through
 * gold on the bowl, the brand mark on the face, an indigo plinth — on a
 * transparent ground so it sits over any backdrop.
 */
export function Trophy({ size = 220, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      className={className}
      role="img"
      aria-label="Trophy"
    >
      <defs>
        <linearGradient id="cup" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EFFFC2" />
          <stop offset="0.28" stopColor="#C9F94A" />
          <stop offset="0.62" stopColor="#9FF611" />
          <stop offset="1" stopColor="#6FA80A" />
        </linearGradient>

        <linearGradient id="cupEdge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".85" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#3F5C05" stopOpacity=".5" />
        </linearGradient>

        <linearGradient id="plinth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B3470" />
          <stop offset="1" stopColor="#1C1A31" />
        </linearGradient>

        <radialGradient id="halo" cx="0.5" cy="0.44" r="0.5">
          <stop offset="0" stopColor="#9FF611" stopOpacity=".55" />
          <stop offset="0.55" stopColor="#9FF611" stopOpacity=".12" />
          <stop offset="1" stopColor="#9FF611" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow behind the cup */}
      <circle cx="120" cy="106" r="104" fill="url(#halo)" />

      {/* Rays */}
      <g stroke="#9FF611" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round">
        <path d="M120 8v18M120 186v16M22 106h18M200 106h18" />
        <path d="M50 36l13 13M177 163l13 13M190 36l-13 13M63 163l-13 13" />
      </g>

      {/* Handles */}
      <path
        d="M62 62H40c-12 0-18 10-18 22 0 22 16 38 40 42"
        stroke="url(#cup)"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M178 62h22c12 0 18 10 18 22 0 22-16 38-40 42"
        stroke="url(#cup)"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />

      {/* Bowl */}
      <path d="M60 48h120v46c0 36-27 62-60 62s-60-26-60-62V48z" fill="url(#cup)" />
      <path d="M60 48h120v46c0 36-27 62-60 62s-60-26-60-62V48z" fill="url(#cupEdge)" />

      {/* Rim */}
      <rect x="54" y="40" width="132" height="14" rx="7" fill="#E6FFB0" />
      <rect x="54" y="40" width="132" height="7" rx="3.5" fill="#FFFFFF" fillOpacity=".55" />

      {/* Brand mark on the face */}
      <path
        d="M100 74h22c8.4 0 13.6 4.2 13.6 10.9 0 4.7-2.5 7.9-6.7 9.4 5.2 1.2 8.4 4.9 8.4 10.4 0 7.7-5.7 12.1-15.1 12.1H100V74zm10.9 16.6h8.4c3.2 0 5.2-1.5 5.2-4.2s-2-4-5.2-4h-8.4v8.2zm0 17.1h9.2c3.7 0 5.7-1.5 5.7-4.5s-2-4.2-5.7-4.2h-9.2v8.7z"
        fill="#1C1A31"
        fillOpacity=".55"
      />

      {/* Stem and foot */}
      <path d="M112 156h16v18h-16z" fill="#7FC50E" />
      <path d="M96 174h48l-6 14H102z" fill="#9FF611" />

      {/* Plinth */}
      <rect x="72" y="188" width="96" height="26" rx="6" fill="url(#plinth)" />
      <rect x="72" y="188" width="96" height="6" rx="3" fill="#4A4184" />

      {/* Sparkles */}
      <g fill="#FFFFFF">
        <path d="M196 52l3.4 7.6 7.6 3.4-7.6 3.4-3.4 7.6-3.4-7.6-7.6-3.4 7.6-3.4z" opacity=".9" />
        <path d="M44 128l2.4 5.4 5.4 2.4-5.4 2.4-2.4 5.4-2.4-5.4-5.4-2.4 5.4-2.4z" opacity=".7" />
        <path d="M168 26l1.8 4 4 1.8-4 1.8-1.8 4-1.8-4-4-1.8 4-1.8z" opacity=".6" />
      </g>
    </svg>
  );
}
