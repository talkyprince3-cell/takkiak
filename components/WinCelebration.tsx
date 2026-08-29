"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Share2, Check } from "lucide-react";
import { Trophy } from "@/components/Trophy";
import { formatMoney } from "@/lib/countries";

/**
 * The winning-ticket celebration.
 *
 * Shown once per ticket. Which tickets have already been celebrated is kept in
 * browser storage, so a settled win is announced when the player next opens the
 * app and never again after that — a modal that reappears on every visit stops
 * being a celebration and becomes an obstacle.
 */

const SEEN_KEY = "betlixx-celebrated";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Records a ticket as celebrated. Returns true if this is the first time. */
export function markCelebrated(code: string): boolean {
  try {
    const seen = readSeen();
    if (seen.includes(code)) return false;
    // Keep the list bounded; nobody needs a celebration history.
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, code].slice(-200)));
    return true;
  } catch {
    return false;
  }
}

export function hasCelebrated(code: string): boolean {
  return readSeen().includes(code);
}

export function WinCelebration({
  code,
  amount,
  currency,
  onClose,
}: {
  code: string;
  amount: number;
  currency: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const share = async () => {
    const text = `I just won ${formatMoney(amount, currency)} on Betlixx. Ticket ${code}.`;
    const url = typeof window !== "undefined" ? window.location.origin : "";

    if (navigator.share) {
      try {
        await navigator.share({ title: "Betlixx win", text, url });
        return;
      } catch {
        /* dismissed */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-label={`You won ${formatMoney(amount, currency)}`}
    >
      <button className="absolute inset-0 bg-black/85" onClick={onClose} aria-label="Close" />

      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 text-white/80"
      >
        <X size={26} strokeWidth={2} />
      </button>

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <p className="text-[40px] font-black leading-none tracking-tight text-white">YOU WON</p>
        <p className="mt-2 text-[30px] font-black leading-none text-[var(--accent)]">
          {formatMoney(amount, currency)}
        </p>

        <Trophy size={230} className="mt-2 drop-shadow-[0_0_28px_rgba(159,246,17,0.35)]" />

        <p className="-mt-2 text-[13px] text-white/70">
          Ticket:{" "}
          <span className="font-bold tracking-wider text-[var(--accent)]">{code}</span>
        </p>

        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          <Link
            href={`/my-bets/${code}`}
            onClick={onClose}
            className="rounded-[4px] py-3 text-center text-[15px] font-bold text-[var(--accent)] ring-1 ring-[var(--accent)]"
          >
            Details
          </Link>
          <button
            onClick={share}
            className="flex items-center justify-center gap-2 rounded-[4px] bg-[var(--accent)] py-3 text-[15px] font-black text-[var(--accent-ink)]"
          >
            {copied ? <Check size={16} strokeWidth={2.6} /> : <Share2 size={16} strokeWidth={2.2} />}
            {copied ? "Copied" : "Show Off"}
          </button>
        </div>
      </div>
    </div>
  );
}
