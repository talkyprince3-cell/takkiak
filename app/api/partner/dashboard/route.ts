import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/supabase";
import { PARTNER_COOKIE, partnerIdFromCookie, verifyPartner } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Resolve the partner from their signed cookie. The signature covers the
 * current password hash, so rotating the password invalidates the session.
 */
async function currentPartner() {
  const supabase = db();
  if (!supabase) return null;

  const jar = await cookies();
  const cookieValue = jar.get(PARTNER_COOKIE)?.value;
  const id = partnerIdFromCookie(cookieValue);
  if (!id) return null;

  const { data: partner } = await supabase
    .from("sub_admins")
    .select("id, name, email, phone, referral_code, approved, balances, lifetime, payout_name, payout_network, payout_number, password_hash")
    .eq("id", id)
    .maybeSingle();

  if (!partner) return null;
  if (!verifyPartner(cookieValue, partner.password_hash)) return null;

  return partner;
}

/** Referred players, their deposits and the partner's earnings. */
export async function GET() {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const partner = await currentPartner();
  if (!partner) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: players } = await supabase
    .from("users")
    .select("id, name, phone, country_code, currency, total_deposited, created_at")
    .eq("referred_by", partner.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: commissions } = await supabase
    .from("commissions")
    .select("id, user_id, deposit_amount, currency, rate, amount, created_at")
    .eq("sub_admin_id", partner.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const { password_hash: _hash, ...safe } = partner;
  void _hash;

  return NextResponse.json({
    partner: safe,
    players: players ?? [],
    commissions: commissions ?? [],
  });
}

/**
 * Where the partner wants to be paid. These fields are free text, because
 * partners span many markets and a fixed list would block a legitimate payout
 * method the day a new market opens.
 */
export async function PATCH(req: Request) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const partner = await currentPartner();
  if (!partner) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await supabase
    .from("sub_admins")
    .update({
      payout_name: String(body.payout_name ?? "").trim() || null,
      payout_network: String(body.payout_network ?? "").trim() || null,
      payout_number: String(body.payout_number ?? "").trim() || null,
    })
    .eq("id", partner.id);

  return NextResponse.json({ ok: true });
}
