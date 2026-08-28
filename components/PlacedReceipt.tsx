"use client";

import Link from "next/link";
import Image from "next/image";
import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "@/lib/countries";
import type { SlipLeg } from "@/lib/store";

/**
 * The slip shown the moment a bet is placed.
 *
 * It repeats the selections back rather than just confirming, because the
 * server may have priced a leg differently from the board — the player should
 * be able to see exactly what they were given without hunting for the ticket.
 */

export interface PlacedTicket {
  code: string;
  stake: number;
  total_odds: number;
  potential_win: number;
  bonus: number;
  currency: string;
  mode: string;
}

export function PlacedReceipt({
  ticket,
  legs,
  lines,
  totalCost,
  oddsChanged,
  onDone,
}: {
  ticket: PlacedTicket;
  legs: SlipLeg[];
  lines: number;
  totalCost: number;
  oddsChanged: { match: string; from: number; to: number }[];
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(ticket.code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => setCopied(false),
    );
  };

  return (
    <div className="overflow-y-auto">
      {/* Brand strip */}
      <div className="relative flex items-center justify-center border-b border-[var(--line)] px-4 py-4">
        <Image src="/logo.svg" alt="Betlixx" width={132} height={29} />
        <button
          onClick={onDone}
          aria-label="Close"
          className="absolute right-4 text-[var(--text-muted)]"
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      {/* Code */}
      <div className="px-4 pt-5 text-center">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {lines > 1 ? "First Ticket Code" : "Ticket Code"}
        </p>
        <button onClick={copy} className="mx-auto mt-1 flex items-center gap-2">
          <span className="text-[34px] font-black tracking-[0.1em] text-[var(--pending)]">
            {ticket.code}
          </span>
          {copied ? (
            <Check size={17} strokeWidth={2.6} className="text-[var(--accent)]" />
          ) : (
            <Copy size={17} strokeWidth={1.9} className="text-[var(--text-muted)]" />
          )}
        </button>
      </div>

      {/* Total odds panel */}
      <div className="mx-4 mt-4 rounded-[6px] px-4 py-3.5 text-center ring-1 ring-[var(--line)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Total Odds
        </p>
        <p className="mt-1 text-[26px] font-black leading-none text-[var(--text-bright)]">
          {Number(ticket.total_odds).toFixed(2)}
        </p>
      </div>

      {/* Bet */}
      <SectionLabel>Bet</SectionLabel>
      <dl className="space-y-2 px-4 py-3 text-[15px]">
        <Row label={lines > 1 ? `Stake · ${lines} lines` : "Stake"} value={formatMoney(totalCost, ticket.currency)} />
        {Number(ticket.bonus) > 0 && (
          <Row label="Bonus" value={formatMoney(Number(ticket.bonus), ticket.currency)} accent />
        )}
        <Row
          label="Payout"
          value={formatMoney(Number(ticket.potential_win), ticket.currency)}
          win
        />
      </dl>

      {/* Selections */}
      <SectionLabel>Selections</SectionLabel>
      <ul className="divide-y divide-[var(--line)]">
        {legs.map((l) => (
          <li key={`${l.matchId}-${l.outcome}`} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--live)]" />
              <span className="flex-1 text-[15px] font-bold text-[var(--text-bright)]">
                {l.outcomeLabel}
              </span>
              <span className="text-[15px] font-black text-[var(--pending)]">
                {l.odds.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 truncate text-[13px] text-[var(--text)]">
              {l.homeTeam} vs {l.awayTeam}
            </p>
            <p className="text-[12px] text-[var(--text-muted)]">{l.marketLabel}</p>
          </li>
        ))}
      </ul>

      {oddsChanged.length > 0 && (
        <p className="mx-4 mt-3 rounded bg-[var(--surface)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {oddsChanged.length === 1
            ? `The price on ${oddsChanged[0].match} was ${oddsChanged[0].to.toFixed(2)} at placement, not ${oddsChanged[0].from.toFixed(2)}. Your ticket shows what you were given.`
            : `${oddsChanged.length} prices differed from the board at placement. Your ticket shows what you were given.`}
        </p>
      )}

      <div className="flex gap-2 p-4">
        <Link
          href={`/my-bets/${ticket.code}`}
          className="flex-1 rounded py-3 text-center text-[13px] font-bold ring-1 ring-[var(--line)]"
        >
          View ticket
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 border-y border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
      {children}
    </p>
  );
}

function Row({
  label,
  value,
  accent,
  win,
}: {
  label: string;
  value: string;
  accent?: boolean;
  win?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd
        className="font-bold"
        style={{ color: win ? "var(--win)" : accent ? "var(--accent)" : "var(--text-bright)" }}
      >
        {value}
      </dd>
    </div>
  );
}
