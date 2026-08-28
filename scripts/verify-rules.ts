/**
 * Checks the pure business rules — clock, odds, and the withdrawal gate —
 * without needing a database. Run with: npm run verify
 */
import { matchClock, scoreFromTimeline } from "../lib/clock";
import { deriveMarkets, driftOdds } from "../lib/odds";
import { checkWithdrawalGate } from "../lib/withdrawals";
import { buildMarkets } from "../lib/markets";
import { correctScoreMarket, goalCountMarkets, ratesFromOdds } from "../lib/scoreline";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

const minsAgo = (n: number) => new Date(Date.now() - n * 60_000);

console.log("\nMatch clock");
{
  const pre = matchClock(new Date(Date.now() + 3_600_000));
  check("upcoming match is not live", pre.phase === "pre" && !pre.isLive && !pre.isOver);

  const first = matchClock(minsAgo(20));
  check("20 minutes in is the first half", first.phase === "first" && first.minute === 20);

  const ht = matchClock(minsAgo(50));
  check("50 minutes in is half time", ht.phase === "ht" && ht.label === "HT");

  const second = matchClock(minsAgo(70));
  check("70 minutes in is the second half at 55", second.phase === "second" && second.minute === 55);

  const ft = matchClock(minsAgo(120));
  check("past full time is over", ft.isOver && ft.label === "FT" && !ft.isLive);
}

console.log("\nScripted goal timeline");
{
  const timeline = [
    { minute: 12, team: "home" as const },
    { minute: 58, team: "away" as const },
    { minute: 80, team: "home" as const },
  ];

  const at30 = scoreFromTimeline(timeline, matchClock(minsAgo(30)));
  check("only goals up to the current minute count", at30.home === 1 && at30.away === 0,
    JSON.stringify(at30));

  const atFt = scoreFromTimeline(timeline, matchClock(minsAgo(120)));
  check("a finished match counts every goal", atFt.home === 2 && atFt.away === 1,
    JSON.stringify(atFt));
}

console.log("\nDerived markets");
{
  const markets = deriveMarkets(2.0, 3.4, 3.8);
  check("every market is priced", markets.length === 6);
  check("1X2 passes through unchanged",
    markets[0].prices.map((p) => p.odds).join(",") === "2,3.4,3.8");

  const dc = markets.find((m) => m.key === "dc")!;
  const oneX = dc.prices.find((p) => p.outcome === "1X")!.odds;
  check("double chance is shorter than the single it covers", oneX < 2.0, `1X=${oneX}`);
  check("every derived price is a real price",
    markets.every((m) => m.prices.every((p) => p.odds > 1 && Number.isFinite(p.odds))));
}

console.log("\nLive odds drift");
{
  const base = { home: 2.0, draw: 3.4, away: 3.8 };

  const early = driftOdds(base, { home: 1, away: 0 }, 10);
  const late = driftOdds(base, { home: 1, away: 0 }, 85);
  check("the leader shortens", early.home < base.home, `${early.home}`);
  check("the swing grows as the match runs on", late.home < early.home, `${late.home} < ${early.home}`);
  check("the trailer drifts out", late.away > base.away, `${late.away}`);

  const levelLate = driftOdds(base, { home: 0, away: 0 }, 85);
  check("a level game late shortens the draw", levelLate.draw < base.draw, `${levelLate.draw}`);
}

console.log("\nWithdrawal gate (Ghana: 3 deposits of GHS 300)");
{
  const player = {
    country_code: "GH",
    currency: "GHS",
    balance: 500,
    total_deposited: 900,
    qualifying_deposits: 0,
    withdrawal_approved: false,
    payout_number: "0244123456",
    payout_bank: null,
  };

  const noDetails = checkWithdrawalGate({ ...player, payout_number: "12" }, 100);
  check("gate 1 rejects a bad payout number", noDetails.failed === "details");

  // 900 deposited in one go is still zero qualifying deposits.
  const notEnough = checkWithdrawalGate(player, 100);
  check("gate 2 counts deposits rather than summing them", notEnough.failed === "deposits",
    JSON.stringify(notEnough.failed));

  const qualified = { ...player, qualifying_deposits: 3 };
  const needsApproval = checkWithdrawalGate(qualified, 100);
  check("gate 3 asks for operator approval", needsApproval.failed === "approval");

  const approved = { ...qualified, withdrawal_approved: true };
  check("a fully qualified player passes", checkWithdrawalGate(approved, 100).ok);

  const overBalance = checkWithdrawalGate(approved, 5000);
  check("cannot withdraw more than the balance", !overBalance.ok);

  check("progress is reported for the meter",
    needsApproval.progress.have === 3 && needsApproval.progress.need === 3);
}

console.log("\nMarket grouping and 1X2 outcome labels");
{
  const markets = buildMarkets([
    {
      id: 1,
      name: "Test Book",
      bets: [
        {
          id: 1,
          name: "Match Winner",
          values: [
            { value: "Home", odd: "2.10" },
            { value: "Draw", odd: "3.30" },
            { value: "Away", odd: "3.40" },
          ],
        },
        {
          id: 45,
          name: "Corners Over Under",
          values: [
            { value: "Over 9.5", odd: "1.85" },
            { value: "Under 9.5", odd: "1.95" },
          ],
        },
        {
          id: 6,
          name: "Goals Over/Under First Half",
          values: [
            { value: "Over 1.5", odd: "3.80" },
            { value: "Under 1.5", odd: "1.22" },
          ],
        },
        {
          id: 4,
          name: "Asian Handicap",
          values: [
            { value: "Home -0.5", odd: "2.05" },
            { value: "Away +0.5", odd: "1.80" },
          ],
        },
        {
          id: 27,
          name: "Clean Sheet - Home",
          values: [
            { value: "Yes", odd: "2.40" },
            { value: "No", odd: "1.55" },
          ],
        },
        // Kept, and flagged dense so the card lays it out as a grid.
        {
          id: 10,
          name: "Exact Score",
          values: [
            { value: "1:0", odd: "6.00" },
            { value: "2:0", odd: "12.00" },
          ],
        },
      ],
    },
  ]);

  const byLabel = Object.fromEntries(markets.map((m) => [m.label, m.group]));

  check("1X2 is ordered first", markets[0]?.key === "af1", markets[0]?.key);
  check("Match Winner is relabelled 1X2", markets[0]?.label === "1X2", markets[0]?.label);
  check("corners group as corners", byLabel["Corners Over / Under"] === "corners");
  check("a first-half goals market groups as half", byLabel["Goals Over / Under First Half"] === "half");
  check("asian handicap groups as handicap", byLabel["Asian Handicap"] === "handicap");
  check("clean sheet groups as teams", byLabel["Clean Sheet - Home"] === "teams");
  const exact = markets.find((m) => m.label === "Exact Score");
  check("exact score is offered", Boolean(exact));
  check("exact score renders dense", exact?.dense === true);
  check("exact score is grouped as a special", exact?.group === "specials");
  check("every market keeps at least two prices", markets.every((m) => m.prices.length >= 2));
}

console.log("\nDerived scoreline markets (operator fixtures)");
{
  const [h, d, a] = [2.5, 3.3, 2.8];
  const cs = correctScoreMarket(h, d, a);
  const rates = ratesFromOdds(h, d, a);

  check("a correct-score market is produced", cs.key === "cs" && cs.prices.length > 10);
  check("it renders dense", cs.dense === true);
  check("goal rates are plausible", rates.home > 0.5 && rates.home < 3 && rates.away > 0.5 && rates.away < 3,
    JSON.stringify(rates));
  check("the catch-all outcome exists", cs.prices.some((p) => p.outcome === "Any Other"));
  check("every scoreline is a real price", cs.prices.every((p) => p.odds > 1 && Number.isFinite(p.odds)));

  // The scoreline grid must reproduce the 1X2 it was fitted to, otherwise a
  // player could back the same outcome twice at two different prices.
  let ph = 0;
  let pd = 0;
  let pa = 0;
  for (const p of cs.prices) {
    if (p.outcome === "Any Other") continue;
    const [i2, j2] = p.outcome.split(":").map(Number);
    const impl = 1 / p.odds;
    if (i2 > j2) ph += impl;
    else if (i2 === j2) pd += impl;
    else pa += impl;
  }
  const tot = ph + pd + pa;
  const raw = 1 / h + 1 / d + 1 / a;

  check("the grid agrees with the 1X2 on home", Math.abs(ph / tot - 1 / h / raw) < 0.02,
    `${(ph / tot).toFixed(3)} vs ${(1 / h / raw).toFixed(3)}`);
  check("the grid agrees with the 1X2 on the draw", Math.abs(pd / tot - 1 / d / raw) < 0.02);
  check("the grid agrees with the 1X2 on away", Math.abs(pa / tot - 1 / a / raw) < 0.02);

  // A favourite must shorten its own scorelines.
  const fav = correctScoreMarket(1.35, 5.0, 9.0);
  const twoNil = fav.prices.find((p) => p.outcome === "2:0")!;
  const nilTwo = fav.prices.find((p) => p.outcome === "0:2")!;
  check("a home favourite prices 2-0 shorter than 0-2", twoNil.odds < nilTwo.odds,
    `${twoNil.odds} vs ${nilTwo.odds}`);

  const [oe, eg] = goalCountMarkets(h, d, a);
  check("odd/even is produced", oe.key === "oe" && oe.prices.length === 2);
  check("exact goals is produced", eg.key === "eg" && eg.prices.length > 3);
  check("exact goals carries a 6+ bucket", eg.prices.some((p) => p.outcome === "6+"));
}

console.log(failures === 0 ? "\nAll rule checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
