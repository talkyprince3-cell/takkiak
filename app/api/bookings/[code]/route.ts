import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

/** Load a booked slip by its code. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { code } = await ctx.params;

  const { data: booking } = await supabase
    .from("bookings")
    .select("code, selections, expires_at, shared, created_by")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: "That booking code was not found" }, { status: 404 });

  if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
    return NextResponse.json({ error: "That booking code has expired" }, { status: 410 });
  }

  return NextResponse.json({ booking });
}


/** Toggle whether this code is listed on the owner's personal page. */
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { code } = await ctx.params;
  const body = await req.json().catch(() => null);
  const userId = body?.userId;

  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Only the player who booked it can change how it is shared.
  const { data: booking } = await supabase
    .from("bookings")
    .select("code, created_by")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.created_by !== userId) {
    return NextResponse.json({ error: "That is not your booking" }, { status: 403 });
  }

  const { error } = await supabase
    .from("bookings")
    .update({ shared: Boolean(body.shared) })
    .eq("code", booking.code);

  if (error) return NextResponse.json({ error: "Could not update sharing" }, { status: 500 });

  return NextResponse.json({ ok: true, shared: Boolean(body.shared) });
}
