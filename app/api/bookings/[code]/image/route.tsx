import { ImageResponse } from "next/og";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Leg {
  homeTeam: string;
  awayTeam: string;
  marketLabel: string;
  outcomeLabel: string;
  odds: number;
}

/**
 * The shareable ticket image.
 *
 * A booking code on its own is a string someone has to type correctly. The
 * image carries the code and the selections together, so a screenshot posted
 * to WhatsApp is readable on its own and still says where it came from.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const supabase = db();

  let legs: Leg[] = [];
  let expires: string | null = null;

  if (supabase) {
    const { data } = await supabase
      .from("bookings")
      .select("selections, expires_at")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    legs = ((data?.selections ?? []) as Leg[]).slice(0, 8);
    expires = data?.expires_at ?? null;
  }

  const totalOdds = legs.reduce((acc, l) => acc * Number(l.odds || 1), 1);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0f0f12",
          padding: 48,
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: "#f5b51b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000000",
              fontSize: 30,
              fontWeight: 900,
            }}
          >
            B
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: "#f7f7f8" }}>
            Bet<span style={{ color: "#f5b51b" }}>lixx</span>
          </div>
        </div>

        {/* The code */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
          <div style={{ fontSize: 20, color: "#9ca0a8" }}>Booking Code</div>
          <div style={{ fontSize: 82, fontWeight: 900, color: "#f5b51b", letterSpacing: 8 }}>
            {code.toUpperCase()}
          </div>
        </div>

        {/* Selections */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 26, gap: 10 }}>
          {legs.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                background: "#16161d",
                borderRadius: 8,
                padding: "12px 16px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ fontSize: 21, color: "#f4f4f5" }}>
                  {l.homeTeam} v {l.awayTeam}
                </div>
                <div style={{ fontSize: 17, color: "#9ca0a8" }}>
                  {l.marketLabel} · {l.outcomeLabel}
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f5b51b" }}>
                {Number(l.odds).toFixed(2)}
              </div>
            </div>
          ))}

          {!legs.length && (
            <div style={{ fontSize: 21, color: "#9ca0a8" }}>This code has no selections.</div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: "auto",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, color: "#9ca0a8" }}>Total odds</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: "#f7f7f8" }}>
              {totalOdds.toFixed(2)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 17, color: "#5b5e66" }}>
              {expires ? `Expires ${new Date(expires).toLocaleString("en-GB")}` : "No expiry"}
            </div>
            <div style={{ fontSize: 19, color: "#9ca0a8" }}>Load this code to bet the same slip</div>
          </div>
        </div>
      </div>
    ),
    { width: 900, height: 1200 },
  );
}
