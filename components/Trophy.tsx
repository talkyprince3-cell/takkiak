/**
 * The win trophy.
 *
 * Drawn rather than sourced. The brief was the cup the big operators put on a
 * winning slip, so this is that shape — gold bowl, handles that return to the
 * body, flared foot, plinth — drawn from scratch rather than traced off anyone
 * else's artwork. The lime stays where the brand lives: the burst behind it and
 * the glow it throws.
 *
 * Transparent ground, so it sits over any backdrop.
 */
export function Trophy({
  size = 220,
  className,
  animated = false,
}: {
  size?: number;
  className?: string;
  /** Turns on the moving parts: the turning burst, the twinkle, the gleam. */
  animated?: boolean;
}) {
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
        <linearGradient id="gold" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FFF6D0" />
          <stop offset="0.22" stopColor="#FFDE7A" />
          <stop offset="0.55" stopColor="#F7B927" />
          <stop offset="0.82" stopColor="#D98A08" />
          <stop offset="1" stopColor="#A96504" />
        </linearGradient>

        <linearGradient id="goldRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF8DC" />
          <stop offset="0.55" stopColor="#FFD98A" />
          <stop offset="1" stopColor="#E0930C" />
        </linearGradient>

        {/* Light down one side, the turn of the metal down the other. */}
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".55" />
          <stop offset="0.34" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#7A4A02" stopOpacity=".35" />
        </linearGradient>

        <linearGradient id="plinth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B3470" />
          <stop offset="1" stopColor="#1A1830" />
        </linearGradient>

        <clipPath id="bowlClip">
          <path d="M62 58C62 110 76 146 120 156C164 146 178 110 178 58Z" />
        </clipPath>

        <radialGradient id="halo" cx="0.5" cy="0.42" r="0.52">
          <stop offset="0" stopColor="#FFD24A" stopOpacity=".45" />
          <stop offset="0.5" stopColor="#9FF611" stopOpacity=".14" />
          <stop offset="1" stopColor="#9FF611" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow behind the cup */}
      <circle cx="120" cy="102" r="106" fill="url(#halo)" />

      {/* Burst. Nothing crosses the handle openings. */}
      <g
        className={animated ? "cup-rays" : undefined}
        stroke="#9FF611"
        strokeOpacity=".6"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M120 10v16" />
        <path d="M50 34l12 12M190 34l-12 12M46 158l12-10M194 158l-12-10" />
      </g>

      {/* Handles, both ends landing on the bowl */}
      <path
        d="M63 70C34 70 20 82 20 100c0 20 17 33 55 30"
        stroke="url(#gold)"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M177 70c29 0 43 12 43 30 0 20-17 33-55 30"
        stroke="url(#gold)"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />

      {/* Bowl */}
      <path d="M62 58C62 110 76 146 120 156C164 146 178 110 178 58Z" fill="url(#gold)" />
      <path d="M62 58C62 110 76 146 120 156C164 146 178 110 178 58Z" fill="url(#sheen)" />

      {/* A sweep of light across the bowl */}
      {animated && (
        <g clipPath="url(#bowlClip)">
          <rect className="cup-gleam" x="44" y="44" width="24" height="128" fill="#FFFFFF" opacity=".6" />
        </g>
      )}

      {/* Rim */}
      <rect x="54" y="42" width="132" height="18" rx="9" fill="url(#goldRim)" />
      <rect x="58" y="45" width="124" height="6" rx="3" fill="#FFFFFF" fillOpacity=".5" />

      {/* The mark, struck into the face */}
      <text
        x="120"
        y="122"
        textAnchor="middle"
        fontFamily="ui-sans-serif,system-ui,Segoe UI,Roboto,Arial,sans-serif"
        fontSize="64"
        fontWeight="800"
        fill="#7A4A02"
        fillOpacity=".38"
      >
        S
      </text>

      {/* Stem and foot */}
      <path d="M111 154h18v18h-18z" fill="#C97D06" />
      <path d="M99 172h42l10 16H89z" fill="url(#gold)" />
      <rect x="84" y="186" width="72" height="9" rx="4.5" fill="#E9A417" />

      {/* Plinth */}
      <rect x="70" y="194" width="100" height="26" rx="8" fill="url(#plinth)" />
      <rect x="70" y="194" width="100" height="6" rx="3" fill="url(#gold)" />

      {/* Sparkles */}
      <g fill="#FFFFFF" className={animated ? "cup-sparks" : undefined}>
        <path className={animated ? "cup-spark" : undefined} d="M198 46l3.4 7.6 7.6 3.4-7.6 3.4-3.4 7.6-3.4-7.6-7.6-3.4 7.6-3.4z" opacity=".9" />
        <path className={animated ? "cup-spark" : undefined} d="M42 170l2.4 5.4 5.4 2.4-5.4 2.4-2.4 5.4-2.4-5.4-5.4-2.4 5.4-2.4z" opacity=".7" />
        <path className={animated ? "cup-spark" : undefined} d="M168 22l1.8 4 4 1.8-4 1.8-1.8 4-1.8-4-4-1.8 4-1.8z" opacity=".6" />
      </g>
    </svg>
  );
}
