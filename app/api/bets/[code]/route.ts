import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getMatchDetail } from "@/lib/fixtures";
import { resolveSelection } from "@/lib/resolve";
import { cashoutOffer, type CashoutLeg } from "@/lib/cashout";
import { settleBets } from "@/lib/settle";

export const dynamic = "force-dynamic";

/**
 * One ticket, with its legs and the live cashout offer.
 *
 * Settlement runs first for this player, so the detail view never shows a leg
 * as pending that the platform has already judged.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { code } = await ctx.params;
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await settleBets({ userId }).catch(() => {});

  const { data: bet } = await supabase
    .from("bets")
    .select("id, code, user_id, stake, total_odds, potential_win, bonus, currency, status, payout, mode, group_code, cashout_amount, settled_at, created_at")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!bet) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (bet.user_id !== userId) {
    return NextResponse.json({ error: "That is not your ticket" }, { status: 403 });
  }

  const { data: legs } = await supabase
    .from("bet_selections")
    .select("id, match_id, home_team, away_team, league, sport, kickoff, market, outcome, odds, result, final_home, final_away")
    .eq("bet_id", bet.id);

  const selections = legs ?? [];

  // Price the open legs so the ticket can be valued.
  const cashLegs: CashoutLeg[] = [];
  const live: Record<string, { currentOdds: number | null; isLive: boolean }> = {};

  if (bet.status === "pending") {
    const matches = await Promise.all(
      [...new Set(selections.map((l) => l.match_id))].map((id) => getMatchDetail(id)),
    );
    const byId = new Map(matches.filter((m) => m !== null).map((m) => [m.id, m]));

    for (const leg of selections) {
      const match = byId.get(leg.match_id);
      const resolved = match ? resolveSelection(match.markets, leg.market, leg.outcome) : null;

      live[leg.id] = {
        currentOdds: resolved?.price.odds ?? null,
        isLive: Boolean(match?.isLive),
      };

      cashLegs.push({
        state: leg.result === "won" ? "won" : leg.result === "lost" ? "lost" : "pending",
        odds: Number(leg.odds),
        currentOdds: resolved?.price.odds ?? null,
        live: Boolean(match?.isLive),
      });
    }
  }

  const offer =
    bet.status === "pending"
      ? cashoutOffer(Number(bet.stake), Number(bet.potential_win), cashLegs)
      : { available: false, amount: 0, potential: Number(bet.potential_win), reason: "already-decided" as const };

  return NextResponse.json({
    bet,
    selections: selections.map((l) => ({ ...l, ...(live[l.id] ?? {}) })),
    cashout: offer,
  });
}
