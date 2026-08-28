"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Check, Copy, Trash2 } from "lucide-react";
import { useSlip, useSession } from "@/lib/store";
import { formatMoney } from "@/lib/countries";

/**
 * The bet slip. Places a ticket, or books it under a shareable code.
 *
 * The odds shown here are what the client last saw; the server re-prices every
 * leg from the live board on submit, so a stale slip is rejected rather than
 * struck at the wrong price.
 */

type Placed = {
  code: string;
  stake: number;
  total_odds: number;
  potential_win: number;
  currency: string;
};

export function BetSlip() {
  const { legs, stake, open, setOpen, setStake, remove, clear, totalOdds, potentialWin } = useSlip();
  const player = useSession((s) => s.player);
  const setBalance = useSession((s) => s.setBalance);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  const currency = player?.currency ?? "GHS";

  const place = async () => {
    if (!player) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bets/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: player.id,
          stake,
          selections: legs.map((l) => ({ matchId: l.matchId, market: l.market, outcome: l.outcome })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not place your bet");
        return;
      }
      setPlaced(json.ticket);
      if (typeof json.balance === "number") setBalance(json.balance);
      clear();
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const book = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: player?.id ?? null, selections: legs, expiresInHours: 48 }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not book your slip");
        return;
      }
      setBooked(json.code);
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-label="Bet slip">
      <button
        className="absolute inset-0 bg-black/60"
        onClick={() => setOpen(false)}
        aria-label="Close bet slip"
      />

      <div className="relative w-full rounded-t-xl bg-[var(--bg-elevated)] pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-[15px] font-bold">
            {placed ? "Bet placed" : booked ? "Slip booked" : `Bet slip (${legs.length})`}
          </h2>
          <button onClick={() => setOpen(false)} className="text-[var(--text-muted)]" aria-label="Close">
            <X size={19} strokeWidth={2} />
          </button>
        </div>

        {placed ? (
          <Receipt placed={placed} onDone={() => { setPlaced(null); setOpen(false); }} />
        ) : booked ? (
          <BookedCode code={booked} onDone={() => { setBooked(null); setOpen(false); }} />
        ) : legs.length === 0 ? (
          <p className="p-10 text-center text-[var(--text-muted)]">
            Tap any odds to add a selection.
          </p>
        ) : (
          <>
            <ul className="max-h-[38vh] divide-y divide-[var(--line)] overflow-y-auto">
              {legs.map((l) => (
                <li key={l.matchId} className="flex items-start gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {l.homeTeam} v {l.awayTeam}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {l.marketLabel} · <span className="text-[var(--accent)]">{l.outcomeLabel}</span>
                    </p>
                  </div>
                  <span className="text-[13px] font-bold">{l.odds.toFixed(2)}</span>
                  <button
                    onClick={() => remove(l.matchId)}
                    className="pl-1 text-[var(--text-faint)]"
                    aria-label={`Remove ${l.homeTeam} v ${l.awayTeam}`}
                  >
                    <X size={15} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t border-[var(--line)] p-4">
              <div className="flex items-center gap-2">
                <label htmlFor="stake" className="text-[12px] font-semibold text-[var(--text-muted)]">
                  Stake
                </label>
                <input
                  id="stake"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={stake || ""}
                  onChange={(e) => setStake(Number(e.target.value))}
                  className="w-24 rounded bg-[var(--surface-2)] px-2 py-1.5 text-right text-[14px] font-bold outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                <div className="ml-auto flex gap-1">
                  {[10, 20, 50, 100].map((v) => (
                    <button
                      key={v}
                      onClick={() => setStake(v)}
                      className="rounded bg-[var(--surface-2)] px-2 py-1 text-[11px] font-bold"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <dl className="space-y-1 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">Total odds</dt>
                  <dd className="font-bold">{totalOdds().toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">Potential win</dt>
                  <dd className="font-bold text-[var(--accent)]">
                    {formatMoney(potentialWin(), currency)}
                  </dd>
                </div>
              </dl>

              {error && (
                <p className="rounded bg-[var(--lose)]/15 px-3 py-2 text-[12px] text-[var(--lose)]">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={book}
                  disabled={busy}
                  className="rounded bg-[var(--accent-dim)] px-4 py-3 text-[13px] font-black text-[var(--accent-ink)] disabled:opacity-50"
                >
                  Book
                </button>

                {player ? (
                  <button
                    onClick={place}
                    disabled={busy || stake <= 0}
                    className="flex-1 rounded bg-[var(--accent)] py-3 text-[14px] font-black text-[var(--accent-ink)] disabled:opacity-50"
                  >
                    {busy ? "Placing…" : `Place bet · ${formatMoney(stake, currency)}`}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="flex-1 rounded bg-[var(--accent)] py-3 text-center text-[14px] font-black text-[var(--accent-ink)]"
                  >
                    Log in to bet
                  </Link>
                )}
              </div>

              <button
                onClick={clear}
                className="flex w-full items-center justify-center gap-1 text-[12px] text-[var(--text-faint)]"
              >
                <Trash2 size={12} strokeWidth={2} />
                Clear slip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Receipt({ placed, onDone }: { placed: Placed; onDone: () => void }) {
  return (
    <div className="space-y-4 p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]">
        <Check size={30} strokeWidth={3} />
      </div>
      <div>
        <p className="text-[12px] text-[var(--text-muted)]">Ticket code</p>
        <p className="text-2xl font-black tracking-widest text-[var(--accent)]">{placed.code}</p>
      </div>
      <dl className="mx-auto max-w-xs space-y-1 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-[var(--text-muted)]">Stake</dt>
          <dd className="font-bold">{formatMoney(Number(placed.stake), placed.currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--text-muted)]">To win</dt>
          <dd className="font-bold text-[var(--accent)]">
            {formatMoney(Number(placed.potential_win), placed.currency)}
          </dd>
        </div>
      </dl>
      <div className="flex gap-2">
        <Link
          href="/my-bets"
          className="flex-1 rounded py-3 text-[13px] font-bold ring-1 ring-[var(--line)]"
        >
          My bets
        </Link>
        <button
          onClick={onDone}
          className="flex-1 rounded bg-[var(--accent)] py-3 text-[13px] font-black text-[var(--accent-ink)]"
        >
          Keep betting
        </button>
      </div>
    </div>
  );
}

function BookedCode({ code, onDone }: { code: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4 p-6 text-center">
      <p className="text-[13px] text-[var(--text-muted)]">
        Share this code. Anyone can load the same selections.
      </p>
      <p className="text-3xl font-black tracking-[0.2em] text-[var(--accent)]">{code}</p>
      <div className="flex gap-2">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded py-3 text-[13px] font-bold ring-1 ring-[var(--line)]"
        >
          <Copy size={14} strokeWidth={2} />
          {copied ? "Copied" : "Copy code"}
        </button>
        <button
          onClick={onDone}
          className="flex-1 rounded bg-[var(--accent)] py-3 text-[13px] font-black text-[var(--accent-ink)]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
