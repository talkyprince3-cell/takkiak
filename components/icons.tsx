/**
 * Icons the set does not carry.
 *
 * Everything else comes from lucide-react; these are drawn to the same
 * conventions — a 24-unit box, currentColor, stroke-driven — so they sit
 * beside Lucide icons without looking bolted on.
 */

export interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/** A football. Lucide's generic ball reads as basketball at small sizes. */
export function BallIcon({ size = 24, strokeWidth = 1.7, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 6.6l3.9 2.8-1.5 4.6H9.6L8.1 9.4z" />
      <path d="M12 2.5v4.1M3.1 9.1l5 .3M5.6 19.3l4-5.3M18.4 19.3l-4-5.3M20.9 9.1l-5 .3" />
    </svg>
  );
}

/** Betlixx mark, for the home tab in the bottom navigation. */
export function BrandIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="currentColor" />
      <path
        d="M12 11h9.2c3.4 0 5.5 1.7 5.5 4.4 0 1.9-1 3.2-2.7 3.8 2.1.5 3.4 2 3.4 4.2 0 3.1-2.3 4.9-6.1 4.9H12V11zm4.4 6.7h3.4c1.3 0 2.1-.6 2.1-1.7s-.8-1.6-2.1-1.6h-3.4v3.3zm0 6.9h3.7c1.5 0 2.3-.6 2.3-1.8s-.8-1.7-2.3-1.7h-3.7v3.5z"
        fill="var(--bg)"
      />
    </svg>
  );
}
