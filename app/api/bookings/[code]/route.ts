import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

/** Load a booked slip by its code. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { code } = await ctx.params;

  const { data: booking } = await supabase
    .from("bookings")
    .select("code, selections, expires_at")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: "That booking code was not found" }, { status: 404 });

  if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
    return NextResponse.json({ error: "That booking code has expired" }, { status: 410 });
  }

  return NextResponse.json({ booking });
}
