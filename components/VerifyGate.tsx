"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/countries";

/**
 * The verification prompt a player meets when they try to withdraw before the
 * deposit gate is met.
 *
 * It states the rule the endpoint actually enforces — `checkWithdrawalGate` is
 * the single source of it — and counts real progress against it. The line about
 * where the money goes is not decoration: a deposit lands in the player's own
 * betting wallet and is theirs to bet with, and a screen that asks for money
 * has to say what that money becomes.
 */
export function VerifyGate({
  amount,
  currency,
  have,
  need,
  onRecheck,
  checking = false,
}: {
  /** The qualifying deposit size, from the country config. */
  amount: number;
  currency: string;
  have: number;
  need: number;
  onRecheck: () => void;
  checking?: boolean;
}) {
  const done = Math.min(have, need);
  const pct = need > 0 ? Math.min(100, Math.round((done / need) * 100)) : 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Verification required"
    >
      <div className="absolute inset-0 bg-black/85" />

      <div className="relative w-full max-w-sm rounded-[10px] bg-[var(--bg-elevated)] p-5">
        <p className="text-right text-[13px] font-bold text-[var(--text-faint)]">
          {done}/{need}
        </p>

        <p className="mt-1 text-[17px] leading-relaxed text-[var(--text-bright)]">
          Complete your verification with a{" "}
          <span className="font-black">{formatMoney(amount, currency)}</span> deposit to unlock
          withdrawals on your Stakeza account.
        </p>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <Link
          href="/deposit"
          className="mt-5 block rounded-[6px] bg-[var(--accent)] py-3.5 text-center text-[16px] font-black text-[var(--accent-ink)]"
        >
          Deposit {formatMoney(amount, currency)} to verify
        </Link>

        <button
          onClick={onRecheck}
          disabled={checking}
          className="mt-3 w-full text-center text-[14px] font-medium text-[var(--text-muted)]"
        >
          {checking ? "Checking…" : "I've completed a deposit"}
        </button>

        <p className="mt-4 text-[12px] leading-relaxed text-[var(--text-faint)]">
          Deposits go to your own betting wallet. The money stays yours to bet with — it is not a
          fee, and nothing is taken from your balance to release a withdrawal.
        </p>
      </div>
    </div>
  );
}
