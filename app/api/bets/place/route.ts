import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { ticketCode } from "@/lib/codes";
import { getMatchDetail } from "@/lib/fixtures";

interface IncomingLeg {
  matchId: string;
  market: string;
  outcome: string;
}

const MAX_LEGS = 30;
const MAX_ODDS = 10_000;

/**
 * Place a ticket.
 *
 * The stake is debited atomically before anything is written, and the ticket is
 * only created after the money has left the wallet. If the write then fails,
 * the stake is credited straight back.
 *
 * Odds are re-read from the live feed rather than trusted from the client, so a
 * tampered slip cannot buy a better price than the board is showing.
 */
export async function POST(req: Request) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: { userId?: string; stake?: number; selections?: IncomingLeg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { userId } = body;
  const stake = Number(body.stake);
  const selections = body.selections ?? [];

  if (!userId) return NextResponse.json({ error: "Sign in to place a bet" }, { status: 401 });
  if (!selections.length) return NextResponse.json({ error: "Your slip is empty" }, { status: 400 });
  if (selections.length > MAX_LEGS) {
    return NextResponse.json({ error: `A ticket can hold at most ${MAX_LEGS} legs` }, { status: 400 });
  }
  if (!Number.isFinite(stake) || stake <= 0) {
    return NextResponse.json({ error: "Enter a stake" }, { status: 400 });
  }

  // One leg per match: the same fixture cannot appear twice on a ticket.
  const matchIds = new Set(selections.map((s) => s.matchId));
  if (matchIds.size !== selections.length) {
    return NextResponse.json({ error: "You have two picks on the same match" }, { status: 400 });
  }

  // --- Price the slip from the board, not from the client -----------------
  // Resolved through the same function the details page uses, so every market
  // a player can see is a market this endpoint will honour.
  const resolved = await Promise.all([...matchIds].map((id) => getMatchDetail(id)));
  const byId = new Map(resolved.filter((m) => m !== null).map((m) => [m.id, m]));

  const priced: {
    matchId: string;
    home: string;
    away: string;
    league: string;
    sport: string;
    kickoff: string;
    market: string;
    outcome: string;
    odds: number;
  }[] = [];

  let totalOdds = 1;

  for (const leg of selections) {
    const match = byId.get(leg.matchId);
    if (!match) {
      return NextResponse.json({ error: "A match on your slip is no longer available" }, { status: 409 });
    }
    if (match.isLocked || match.postponed) {
      return NextResponse.json(
        { error: `Betting is closed on ${match.homeTeam} v ${match.awayTeam}` },
        { status: 409 },
      );
    }

    const market = match.markets.find((m) => m.key === leg.market);
    const price = market?.prices.find((p) => p.outcome === leg.outcome);
    if (!market || !price) {
      return NextResponse.json({ error: "A selection on your slip is no longer offered" }, { status: 409 });
    }

    totalOdds *= price.odds;
    priced.push({
      matchId: match.id,
      home: match.homeTeam,
      away: match.awayTeam,
      league: match.league,
      sport: match.sport,
      kickoff: match.kickoff,
      market: market.key,
      outcome: price.outcome,
      odds: price.odds,
    });
  }

  totalOdds = Math.min(MAX_ODDS, Math.round(totalOdds * 1000) / 1000);
  const potentialWin = Math.round(stake * totalOdds * 100) / 100;

  // --- Debit the stake, then write the ticket -----------------------------
  const { data: user } = await supabase
    .from("users")
    .select("id, balance, currency")
    .eq("id", userId)
    .maybeSingle();

  if (!user) return NextResponse.json({ error: "Sign in to place a bet" }, { status: 401 });

  const balance = Number(user.balance);
  if (balance < stake) {
    return NextResponse.json({ error: "Not enough balance. Top up to place this bet." }, { status: 402 });
  }

  // Guarded on the balance we read, so two slips submitted at once cannot both
  // spend the same money.
  const { data: debited } = await supabase
    .from("users")
    .update({ balance: balance - stake })
    .eq("id", userId)
    .eq("balance", balance)
    .select("id")
    .maybeSingle();

  if (!debited) {
    return NextResponse.json({ error: "Your balance changed. Try again." }, { status: 409 });
  }

  const refund = async () => {
    const { data: current } = await supabase.from("users").select("balance").eq("id", userId).single();
    if (current) {
      await supabase
        .from("users")
        .update({ balance: Number(current.balance) + stake })
        .eq("id", userId);
    }
  };

  const code = ticketCode();

  const { data: ticket, error: ticketErr } = await supabase
    .from("bets")
    .insert({
      code,
      user_id: userId,
      stake,
      total_odds: totalOdds,
      potential_win: potentialWin,
      currency: user.currency,
      status: "pending",
    })
    .select("id, code, stake, total_odds, potential_win, currency, created_at")
    .single();

  if (ticketErr || !ticket) {
    console.error("[bet] ticket write failed, refunding stake", userId, ticketErr);
    await refund();
    return NextResponse.json({ error: "Could not place your bet. Your stake was returned." }, { status: 500 });
  }

  const { error: legErr } = await supabase.from("bet_selections").insert(
    priced.map((p) => ({
      bet_id: ticket.id,
      match_id: p.matchId,
      home_team: p.home,
      away_team: p.away,
      league: p.league,
      sport: p.sport,
      kickoff: p.kickoff,
      market: p.market,
      outcome: p.outcome,
      odds: p.odds,
      result: "pending",
    })),
  );

  if (legErr) {
    console.error("[bet] legs write failed, rolling back", ticket.id, legErr);
    await supabase.from("bets").delete().eq("id", ticket.id);
    await refund();
    return NextResponse.json({ error: "Could not place your bet. Your stake was returned." }, { status: 500 });
  }

  return NextResponse.json({
    ticket: { ...ticket, selections: priced },
    balance: balance - stake,
  });
}
