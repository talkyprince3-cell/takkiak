"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Check, ChevronsDown, IdCard } from "lucide-react";
import { useSlip, useSession, type SlipLeg } from "@/lib/store";
import { formatMoney } from "@/lib/countries";

/**
 * One ticket in full.
 *
 * The status rail down the side of each leg is the point of the layout: a
 * ten-leg ticket is scannable at a glance because every leg says where it
 * stands without the reader having to compare numbers.
 */

interface Leg {
  id: string;
  match_id: string;
  home_team: string;
  away_team: string;
  league: string | null;
  sport: string;
  kickoff: string | null;
  market: string;
  outcome: string;
  odds: number;
  result: string;
  final_home: number | null;
  final_away: number | null;
  currentOdds?: number | null;
  isLive?: boolean;
}

interface Bet {
  code: string;
  stake: number;
  total_odds: number;
  potential_win: number;
  bonus: number;
  currency: string;
  status: string;
  payout: number | null;
  mode: string;
  cashout_amount: number | null;
  created_at: string;
}

interface Payload {
  bet: Bet;
  selections: Leg[];
  cashout: { available: boolean; amount: number; potential: number; reason?: string };
}

const STATUS: Record<string, { label: string; colour: string }> = {
  pending: { label: "NOT STARTED", colour: "var(--text-muted)" },
  won: { label: "WON", colour: "var(--win)" },
  lost: { label: "LOST", colour: "var(--lose)" },
  cashed_out: { label: "CASHED OUT", colour: "var(--pending)" },
  void: { label: "VOID", colour: "var(--text-muted)" },
};

export function TicketDetail({ code }: { code: string }) {
  const router = useRouter();
  const player = useSession((s) => s.player);
  const hydrated = useSession((s) => s.hydrated);
  const setBalance = useSession((s) => s.setBalance);
  const load = useSlip((s) => s.load);

  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (hydrated && !player) router.replace("/login");
  }, [hydrated, player, router]);

  useEffect(() => {
    if (!player) return;
    let alive = true;

    (async () => {
      try {
        const res = await fetch(`/api/bets/${code}?userId=${player.id}`, { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setError(json.error ?? "Could not load this ticket");
          return;
        }
        setData(json);
        setError(null);
      } catch {
        if (alive) setError("Could not load this ticket");
      }
    })();

    return () => {
      alive = false;
    };
  }, [player, code, nonce]);

  const cashout = async () => {
    if (!player || !data?.cashout.available) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/bets/${code}/cashout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: player.id, expected: data.cashout.amount }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNote(json.error ?? "Could not cash out");
        if (json.moved) reload();
        return;
      }
      setNote(`Cashed out for ${formatMoney(json.amount, data.bet.currency)}.`);
      if (typeof json.balance === "number") setBalance(json.balance);
      reload();
    } catch {
      setNote("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  };

  /** Put the same selections back on the slip. */
  const rebet = () => {
    if (!data) return;
    const legs: SlipLeg[] = data.selections.map((l) => ({
      matchId: l.match_id,
      homeTeam: l.home_team,
      awayTeam: l.away_team,
      league: l.league ?? "",
      kickoff: l.kickoff ?? "",
      market: l.market,
      marketLabel: l.market.toUpperCase(),
      outcome: l.outcome,
      outcomeLabel: l.outcome,
      odds: Number(l.odds),
    }));
    load(legs);
    router.push("/");
  };

  const book = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: player?.id ?? null,
          expiresInHours: 48,
          selections: data.selections.map((l) => ({
            matchId: l.match_id,
            homeTeam: l.home_team,
            awayTeam: l.away_team,
            league: l.league ?? "",
            kickoff: l.kickoff ?? "",
            market: l.market,
            marketLabel: l.market.toUpperCase(),
            outcome: l.outcome,
            outcomeLabel: l.outcome,
            odds: Number(l.odds),
          })),
        }),
      });
      const json = await res.json();
      setNote(res.ok ? `Booking code ${json.code}` : (json.error ?? "Could not book"));
    } catch {
      setNote("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!player) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header onBack={() => router.back()} />
        <div className="p-10 text-center">
          <p className="text-[14px] text-[var(--text-muted)]">{error}</p>
          <Link
            href="/my-bets"
            className="mt-4 inline-block rounded bg-[var(--accent)] px-5 py-2.5 text-[13px] font-black text-[var(--accent-ink)]"
          >
            Back to my bets
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header onBack={() => router.back()} />
        <div className="animate-pulse space-y-3 p-4">
          <div className="h-40 rounded bg-[var(--bg-elevated)]" />
          <div className="h-32 rounded bg-[var(--bg-elevated)]" />
        </div>
      </div>
    );
  }

  const { bet, selections, cashout: offer } = data;
  const status = STATUS[bet.status] ?? STATUS.pending;
  const settled = bet.status !== "pending";

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <Header onBack={() => router.back()} />

      {/* Summary */}
      <section className="bg-[var(--surface)] px-4 pb-5 pt-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2 text-[12px] text-[var(--text-muted)]">
          <span>
            {new Date(bet.created_at).toLocaleString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="capitalize text-[var(--text)]">{bet.mode}</span>
          <span className="ml-auto">Ticket ID: {bet.code}</span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(bet.code).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                },
                () => setCopied(false),
              );
            }}
            className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text)]"
          >
            {copied ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <p
          className="mx-auto mt-4 max-w-2xl text-center text-[26px] font-black tracking-wide"
          style={{ color: status.colour }}
        >
          {status.label}
        </p>

        <dl className="mx-auto mt-3 max-w-2xl space-y-1.5 text-[14px]">
          <Line label="Total Stake" value={Number(bet.stake).toFixed(2)} />
          <Line label="Total Odds" value={Number(bet.total_odds).toFixed(2)} />
          <Line label="To Return" value={Number(bet.potential_win).toFixed(2)} />
          <Line
            label="Total Return"
            value={settled ? Number(bet.payout ?? 0).toFixed(2) : "- -"}
            accent={settled && Number(bet.payout ?? 0) > 0}
          />
          {Number(bet.bonus) > 0 && (
            <Line label="Bonus included" value={Number(bet.bonus).toFixed(2)} accent />
          )}
        </dl>

        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-6 py-2.5 text-[14px] font-bold text-[var(--accent-ink)]"
          >
            {expanded ? "Hide Details" : "Check Details"}
            <ChevronsDown
              size={16}
              strokeWidth={2.4}
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
          </button>
        </div>
      </section>

      <div className="mx-auto max-w-2xl border-t border-dashed border-[var(--line)]" />

      {/* Legs */}
      {expanded && (
        <div className="mx-auto max-w-2xl space-y-3 p-3">
          {selections.map((leg) => (
            <LegCard key={leg.id} leg={leg} />
          ))}
        </div>
      )}

      {note && (
        <p className="mx-auto max-w-2xl px-4 text-center text-[12px] text-[var(--text-muted)]">{note}</p>
      )}

      {!offer.available && offer.reason && bet.status === "pending" && (
        <p className="mx-auto max-w-2xl px-4 pt-2 text-center text-[11px] text-[var(--text-faint)]">
          {reasonText(offer.reason)}
        </p>
      )}

      {/* Actions */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl gap-2">
          <button
            onClick={book}
            disabled={busy}
            className="flex-1 rounded-full py-2.5 text-[13px] font-bold text-[var(--accent)] ring-1 ring-[var(--accent)] disabled:opacity-40"
          >
            Booking Code
          </button>
          <button
            onClick={rebet}
            className="flex-1 rounded-full py-2.5 text-[13px] font-bold text-[var(--accent)] ring-1 ring-[var(--accent)]"
          >
            Rebet
          </button>
          <button
            onClick={cashout}
            disabled={busy || !offer.available}
            className="flex-1 rounded-full py-2.5 text-[13px] font-black text-[var(--accent-ink)] disabled:opacity-30"
            style={{ background: "var(--accent)" }}
          >
            {offer.available
              ? `Cash Out ${formatMoney(offer.amount, bet.currency)}`
              : "Cash Out"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="sticky top-0 z-40 bg-[var(--surface)]">
      <div className="mx-auto flex h-[48px] max-w-2xl items-center gap-3 px-4">
        <button onClick={onBack} aria-label="Back" className="text-[var(--text-bright)]">
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <h1 className="flex-1 text-[17px] font-bold text-[var(--text-bright)]">Bet details</h1>
      </div>
    </header>
  );
}

function Line({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="font-bold" style={accent ? { color: "var(--accent)" } : undefined}>
        {value}
      </dd>
    </div>
  );
}

function LegCard({ leg }: { leg: Leg }) {
  const state =
    leg.result === "won"
      ? { label: "WON", colour: "var(--win)" }
      : leg.result === "lost"
        ? { label: "LOST", colour: "var(--lose)" }
        : leg.isLive
          ? { label: "LIVE", colour: "var(--live)" }
          : { label: "NOT STARTED", colour: "var(--text-faint)" };

  const drift =
    leg.currentOdds && Math.abs(leg.currentOdds - Number(leg.odds)) > 0.005
      ? leg.currentOdds < Number(leg.odds)
        ? "shortened"
        : "drifted"
      : null;

  return (
    <article className="flex overflow-hidden rounded-[6px] bg-[var(--bg-elevated)]">
      {/* Status rail */}
      <div
        className="flex w-7 shrink-0 items-center justify-center"
        style={{ background: "var(--surface)", color: state.colour }}
      >
        <span
          className="whitespace-nowrap text-[9px] font-bold tracking-wider"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {state.label}
        </span>
      </div>

      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <span>
            {leg.kickoff
              ? new Date(leg.kickoff).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
          <span className="capitalize underline decoration-[var(--text-faint)]">{leg.sport}</span>
          <span
            className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-black"
            style={{ color: state.colour, boxShadow: `inset 0 0 0 1px ${state.colour}` }}
          >
            {leg.isLive ? "LIVE" : leg.result === "pending" ? "PRE" : state.label}
          </span>
        </div>

        <div className="mt-2 rounded bg-[var(--surface)] px-3 py-2">
          <Team name={leg.home_team} score={leg.final_home} />
          <Team name={leg.away_team} score={leg.final_away} />
        </div>

        <dl className="mt-2 space-y-1 text-[12px]">
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">Market</dt>
            <dd className="font-medium">{leg.market.toUpperCase()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">Pick</dt>
            <dd className="font-medium">
              {leg.outcome} @ {Number(leg.odds).toFixed(2)}
              {drift && (
                <span
                  className="ml-1.5 text-[10px]"
                  style={{ color: drift === "shortened" ? "var(--win)" : "var(--lose)" }}
                >
                  now {leg.currentOdds!.toFixed(2)}
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-2 flex justify-end">
          <Link
            href={`/match/${leg.match_id}`}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-[var(--text)] ring-1 ring-[var(--line)]"
          >
            <IdCard size={13} strokeWidth={1.9} />
            Match Details
          </Link>
        </div>
      </div>
    </article>
  );
}

function Team({ name, score }: { name: string; score: number | null }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="truncate text-[13px] text-[var(--text)]">{name}</span>
      <span className="pl-3 text-[13px] font-bold text-[var(--text-muted)]">{score ?? "-"}</span>
    </div>
  );
}

function reasonText(reason: string): string {
  switch (reason) {
    case "leg-lost":
      return "No cashout: a leg on this ticket has lost.";
    case "in-play":
      return "Cashout is closed while a match on this ticket is being played.";
    case "no-live-price":
      return "Cashout unavailable: one of these markets is no longer priced.";
    case "too-small":
      return "The cashout value is too small to offer.";
    default:
      return "Cashout is not available on this ticket.";
  }
}
