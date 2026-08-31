import type { Gateway } from "./countries";

/**
 * Payment gateway adapters.
 *
 * Each rail has its own start / status shape, but they all end at the same
 * place: a confirmed status hands the reference to applyDepositCredit, which is
 * the only function allowed to move money into a wallet.
 *
 * Every adapter degrades to a clear error rather than throwing, so a missing
 * key shows the player a message instead of a stack trace.
 */

export type ChargeStatus = "pending" | "confirmed" | "failed";

/**
 * What the rail says became of a charge.
 *
 * The settled amount matters as much as the status. A player can start a
 * GH₵500 deposit and approve GH₵5 on the handset, and the rail will call that
 * successful — it is, it just is not the deposit that was asked for. Every
 * adapter that can report what actually arrived does, and the credit path uses
 * that figure rather than the one the player typed in.
 */
export interface ChargeOutcome {
  status: ChargeStatus;
  /** What the rail says actually settled. Absent when the rail does not say. */
  paidAmount?: number;
  paidCurrency?: string;
}

export interface StartResult {
  ok: boolean;
  /** Hosted checkout URL, when the rail redirects. */
  redirectUrl?: string;
  /** True when the player must approve a prompt on their handset. */
  awaitingPrompt?: boolean;
  /** True when the rail additionally wants an OTP typed in. */
  awaitingOtp?: boolean;
  error?: string;
}

export interface GatewayAdapter {
  id: Gateway;
  label: string;
  start(opts: StartOpts): Promise<StartResult>;
  status(reference: string): Promise<ChargeOutcome>;
}

export interface StartOpts {
  reference: string;
  amount: number;
  currency: string;
  phone: string;
  email: string;
  name: string;
  redirectUrl: string;
}

function env(name: string): string | null {
  return process.env[name] || null;
}

// ------------------------------------------------------------ Flutterwave

const FLW_BASE = "https://api.flutterwave.com/v3";

async function flwFetch(path: string, init?: RequestInit) {
  const key = env("FLUTTERWAVE_SECRET_KEY");
  if (!key) return null;
  try {
    const res = await fetch(`${FLW_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    return (await res.json()) as { status?: string; message?: string; data?: Record<string, unknown>; meta?: Record<string, unknown> };
  } catch (err) {
    console.error("[flutterwave]", path, err);
    return null;
  }
}

/**
 * Flutterwave wants the network named on a Ghana mobile-money charge, and the
 * number's prefix is the only thing we have to name it from.
 *
 * Unknown prefixes fall to MTN, which carries most of the country. Getting it
 * wrong costs a rejected charge and a clear message, not a lost payment.
 */
export function ghanaNetwork(phone: string): "MTN" | "VODAFONE" | "AIRTELTIGO" {
  const digits = String(phone || "").replace(/\D/g, "");
  // Reduce to the local significant number, however it was typed.
  const local = digits.startsWith("233") ? digits.slice(3) : digits.replace(/^0+/, "");
  const prefix = local.slice(0, 2);
  if (prefix === "20" || prefix === "50") return "VODAFONE";
  if (prefix === "26" || prefix === "27" || prefix === "56" || prefix === "57") return "AIRTELTIGO";
  return "MTN";
}

/**
 * Read what a Flutterwave charge actually settled at.
 *
 * `amount` is what the customer approved; `charged_amount` includes the fee
 * they were charged on top. The deposit is worth the former.
 */
function flwOutcome(data: Record<string, unknown> | undefined): ChargeOutcome {
  const s = String(data?.status ?? "").toLowerCase();
  const status: ChargeStatus =
    s === "successful" ? "confirmed" : s === "failed" || s === "cancelled" ? "failed" : "pending";

  const paid = Number(data?.amount);
  return {
    status,
    paidAmount: Number.isFinite(paid) && paid > 0 ? paid : undefined,
    paidCurrency: typeof data?.currency === "string" ? data.currency : undefined,
  };
}

/** Ghana: direct mobile-money charge with an on-handset prompt. */
const flutterwaveMomo: GatewayAdapter = {
  id: "flutterwave_momo",
  label: "Mobile money",
  async start({ reference, amount, currency, phone, email, name }) {
    if (!env("FLUTTERWAVE_SECRET_KEY")) return { ok: false, error: "Mobile money is not available right now" };

    const json = await flwFetch("/charges?type=mobile_money_ghana", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: reference,
        amount,
        currency,
        network: ghanaNetwork(phone),
        phone_number: phone,
        email: email || `${phone}@betlixx.com`,
        fullname: name,
      }),
    });

    if (!json || json.status !== "success") {
      return { ok: false, error: json?.message ?? "Could not start the charge" };
    }

    const redirect = (json.meta?.authorization as { redirect?: string } | undefined)?.redirect;
    return {
      ok: true,
      redirectUrl: redirect,
      awaitingPrompt: !redirect,
      // Some networks add an OTP step after the prompt is approved.
      awaitingOtp: (json.meta?.authorization as { mode?: string } | undefined)?.mode === "otp",
    };
  },
  async status(reference) {
    const json = await flwFetch(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`);
    // A charge nobody has approved yet is simply not there. That is pending,
    // not failed — failing it would strand a player still holding the prompt.
    if (!json || json.status !== "success") return { status: "pending" };
    return flwOutcome(json.data);
  },
};

/** Verify a Flutterwave charge from the outside, for the webhook. */
export function flutterwaveVerify(reference: string): Promise<ChargeOutcome> {
  return flutterwaveMomo.status(reference);
}

/** Nigeria: hosted checkout, player returns with a status in the URL. */
const flutterwaveCheckout: GatewayAdapter = {
  id: "flutterwave_checkout",
  label: "Card or bank",
  async start({ reference, amount, currency, phone, email, name, redirectUrl }) {
    if (!env("FLUTTERWAVE_SECRET_KEY")) return { ok: false, error: "Checkout is not available right now" };

    const json = await flwFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: reference,
        amount,
        currency,
        redirect_url: redirectUrl,
        customer: { email: email || `${phone}@betlixx.com`, phonenumber: phone, name },
        customizations: { title: "Betlixx", description: "Wallet top-up" },
      }),
    });

    if (!json || json.status !== "success") {
      return { ok: false, error: json?.message ?? "Could not start checkout" };
    }
    return { ok: true, redirectUrl: String(json.data?.link ?? "") };
  },
  status: flutterwaveMomo.status,
};

// ---------------------------------------------------------------- Korapay

const korapay: GatewayAdapter = {
  id: "korapay",
  label: "Korapay",
  async start({ reference, amount, currency, email, name, redirectUrl }) {
    const key = env("KORAPAY_SECRET_KEY");
    if (!key) return { ok: false, error: "Korapay is not available right now" };
    try {
      const res = await fetch("https://api.korapay.com/merchant/api/v1/charges/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          amount,
          currency,
          redirect_url: redirectUrl,
          customer: { email: email || "player@betlixx.com", name },
          notification_url: `${redirectUrl.split("/account")[0]}/api/deposits/korapay/webhook`,
        }),
      });
      const json = await res.json();
      if (!json?.status) return { ok: false, error: json?.message ?? "Could not start checkout" };
      return { ok: true, redirectUrl: json.data?.checkout_url };
    } catch (err) {
      console.error("[korapay] start", err);
      return { ok: false, error: "Could not start checkout" };
    }
  },
  async status(reference) {
    const key = env("KORAPAY_SECRET_KEY");
    if (!key) return { status: "pending" };
    try {
      const res = await fetch(`https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const json = await res.json();
      const s = String(json?.data?.status ?? "").toLowerCase();
      const status: ChargeStatus =
        s === "success" ? "confirmed" : s === "failed" || s === "expired" ? "failed" : "pending";
      const paid = Number(json?.data?.amount);
      return {
        status,
        paidAmount: Number.isFinite(paid) && paid > 0 ? paid : undefined,
        paidCurrency: json?.data?.currency,
      };
    } catch {
      return { status: "pending" };
    }
  },
};

// ----------------------------------------------------------------- Moolre

const moolre: GatewayAdapter = {
  id: "moolre",
  label: "Moolre",
  async start({ reference, amount, currency, phone }) {
    const key = env("MOOLRE_API_KEY");
    const user = env("MOOLRE_API_USER");
    const account = env("MOOLRE_ACCOUNT_NUMBER");
    if (!key || !user || !account) return { ok: false, error: "Moolre is not available right now" };
    try {
      const res = await fetch("https://api.moolre.com/open/transact/receive", {
        method: "POST",
        headers: { "X-API-USER": user, "X-API-PUBKEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: 1,
          channel: 13,
          currency,
          payer: phone,
          amount,
          accountnumber: account,
          reference,
          externalref: reference,
        }),
      });
      const json = await res.json();
      if (json?.status !== 1) return { ok: false, error: json?.message ?? "Could not start the charge" };
      return { ok: true, awaitingPrompt: true };
    } catch (err) {
      console.error("[moolre] start", err);
      return { ok: false, error: "Could not start the charge" };
    }
  },
  async status(reference) {
    const key = env("MOOLRE_API_KEY");
    const user = env("MOOLRE_API_USER");
    const account = env("MOOLRE_ACCOUNT_NUMBER");
    if (!key || !user || !account) return { status: "pending" };
    try {
      const res = await fetch("https://api.moolre.com/open/transact/status", {
        method: "POST",
        headers: { "X-API-USER": user, "X-API-PUBKEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ type: 1, accountnumber: account, externalref: reference }),
      });
      const json = await res.json();
      const code = Number(json?.data?.txstatus ?? json?.status);
      const status: ChargeStatus = code === 1 ? "confirmed" : code === 2 || code === 3 ? "failed" : "pending";
      const paid = Number(json?.data?.amount);
      return {
        status,
        paidAmount: Number.isFinite(paid) && paid > 0 ? paid : undefined,
        paidCurrency: json?.data?.currency,
      };
    } catch {
      return { status: "pending" };
    }
  },
};

// ---------------------------------------------------------------- Paystack

const paystack: GatewayAdapter = {
  id: "paystack",
  label: "Paystack",
  async start({ reference, amount, currency, email, phone, redirectUrl }) {
    const key = env("PAYSTACK_SECRET_KEY");
    if (!key) return { ok: false, error: "Paystack is not available right now" };
    try {
      const res = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          // Paystack takes the minor unit.
          amount: Math.round(amount * 100),
          currency,
          email: email || `${phone}@betlixx.com`,
          callback_url: redirectUrl,
        }),
      });
      const json = await res.json();
      if (!json?.status) return { ok: false, error: json?.message ?? "Could not start checkout" };
      return { ok: true, redirectUrl: json.data?.authorization_url };
    } catch (err) {
      console.error("[paystack] start", err);
      return { ok: false, error: "Could not start checkout" };
    }
  },
  async status(reference) {
    const key = env("PAYSTACK_SECRET_KEY");
    if (!key) return { status: "pending" };
    try {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const json = await res.json();
      const s = String(json?.data?.status ?? "").toLowerCase();
      const status: ChargeStatus =
        s === "success" ? "confirmed" : s === "failed" || s === "abandoned" ? "failed" : "pending";
      // Paystack reports in the minor unit.
      const paid = Number(json?.data?.amount) / 100;
      return {
        status,
        paidAmount: Number.isFinite(paid) && paid > 0 ? paid : undefined,
        paidCurrency: json?.data?.currency,
      };
    } catch {
      return { status: "pending" };
    }
  },
};

/**
 * The manual rail: the player sends money to the displayed agent number and
 * uploads a screenshot. Nothing is automatic, so the status stays pending until
 * the operator confirms it in the console.
 */
const manual: GatewayAdapter = {
  id: "manual",
  label: "Mobile money transfer",
  async start() {
    return { ok: true };
  },
  async status(): Promise<ChargeOutcome> {
    return { status: "pending" };
  },
};

const ADAPTERS: Record<Gateway, GatewayAdapter> = {
  flutterwave_momo: flutterwaveMomo,
  flutterwave_checkout: flutterwaveCheckout,
  korapay,
  moolre,
  paystack,
  manual,
};

/**
 * What a confirmed charge is actually worth.
 *
 * The rail's own figure wins whenever it gives one in the currency the deposit
 * was opened in. Everything else — a rail that reports nothing, a figure that
 * arrives in another currency — falls back to what the player asked for, which
 * is the best guess available and the behaviour that stood before.
 */
export function settledAmount(outcome: ChargeOutcome, requested: number, currency: string): number {
  const paid = outcome.paidAmount;
  if (!paid || !Number.isFinite(paid) || paid <= 0) return requested;
  if (outcome.paidCurrency && outcome.paidCurrency.toUpperCase() !== String(currency).toUpperCase()) {
    return requested;
  }
  return paid;
}

export function adapterFor(gateway: Gateway): GatewayAdapter {
  return ADAPTERS[gateway] ?? manual;
}

export function allAdapters(): GatewayAdapter[] {
  return Object.values(ADAPTERS);
}
