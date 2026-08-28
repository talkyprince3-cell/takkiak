"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Page } from "@/components/Shell";
import { useSession } from "@/lib/store";
import { getCountry, formatMoney } from "@/lib/countries";

/**
 * The deposit screen. Which rail the player sees depends on their country's
 * configured gateway; the manual rail is always available as a fallback.
 */

const QUICK = [20, 50, 100, 200, 500];

export default function DepositPage() {
  const router = useRouter();
  const player = useSession((s) => s.player);
  const hydrated = useSession((s) => s.hydrated);
  const setBalance = useSession((s) => s.setBalance);

  const [amount, setAmount] = useState(50);
  // null means "not edited yet", so the field falls back to the player's own
  // number without an effect writing it into state.
  const [phoneEdit, setPhoneEdit] = useState<string | null>(null);
  const [mode, setMode] = useState<"gateway" | "manual">("gateway");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [done, setDone] = useState<{ balance?: number; bonus?: number } | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const country = player ? getCountry(player.country_code) : getCountry("GH");
  const whatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const phone = phoneEdit ?? player?.phone ?? "";

  useEffect(() => {
    if (hydrated && !player) router.replace("/login");
  }, [hydrated, player, router]);

  useEffect(() => {
    // The displayed agent number is operator-editable.
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.settings && setSettings(j.settings))
      .catch(() => {});
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (!player) return null;

  const startGateway = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/deposits/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: player.id, amount, phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not start your deposit");
        return;
      }

      if (json.redirectUrl) {
        window.location.href = json.redirectUrl;
        return;
      }

      setStatus(
        json.awaitingOtp
          ? "Approve the prompt on your phone, then enter the OTP your network sends."
          : "Check your phone and approve the payment prompt.",
      );

      // Poll while the player is on the screen watching for it.
      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/deposits/status?reference=${json.reference}`);
          const sj = await s.json();
          if (sj.status === "confirmed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus(null);
            setDone({ balance: sj.balance, bonus: sj.bonusPaid });
            if (typeof sj.balance === "number") setBalance(sj.balance);
          } else if (sj.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus(null);
            setError("That payment did not go through. Try again.");
          }
        } catch {
          /* keep polling */
        }
      }, 4000);
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      form.set("userId", player.id);
      form.set("amount", String(amount));

      const res = await fetch("/api/deposits/manual", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not record your deposit");
        return;
      }
      setStatus(json.message);
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Page>
        <div className="mx-auto max-w-sm space-y-4 py-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]">
            <Check size={34} strokeWidth={3} />
          </div>
          <h1 className="text-[20px] font-black">Deposit received</h1>
          {done.bonus ? (
            <p className="text-[13px] text-[var(--accent)]">
              Plus a {formatMoney(done.bonus, player.currency)} welcome bonus.
            </p>
          ) : null}
          {typeof done.balance === "number" && (
            <p className="text-[15px] font-bold">
              New balance {formatMoney(done.balance, player.currency)}
            </p>
          )}
          <button
            onClick={() => router.push("/")}
            className="w-full rounded bg-[var(--accent)] py-3 text-[14px] font-black text-[var(--accent-ink)]"
          >
            Start betting
          </button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="text-[18px] font-black">Deposit</h1>

        <div className="rounded bg-[var(--bg-elevated)] p-4">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            Amount ({country.currency})
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={country.minFirstDeposit}
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded bg-[var(--surface-2)] px-3 py-3 text-[22px] font-black outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK.map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className="rounded bg-[var(--surface-2)] px-3 py-1.5 text-[12px] font-bold"
              >
                {country.currencySymbol}
                {v}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-faint)]">
            Minimum first deposit {formatMoney(country.minFirstDeposit, country.currency)}
          </p>
        </div>

        <div className="flex gap-1.5">
          {(["gateway", "manual"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setStatus(null); }}
              className="flex-1 rounded py-2 text-[12px] font-bold"
              style={
                mode === m
                  ? { background: "var(--accent)", color: "var(--accent-ink)" }
                  : { background: "var(--surface)", color: "var(--text-muted)" }
              }
            >
              {m === "gateway" ? "Instant" : "Send manually"}
            </button>
          ))}
        </div>

        {mode === "gateway" ? (
          <div className="space-y-3 rounded bg-[var(--bg-elevated)] p-4">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                {country.payoutRail === "mobile" ? "Mobile money number" : "Phone number"}
              </span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhoneEdit(e.target.value)}
                className="w-full rounded bg-[var(--surface-2)] px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>

            <button
              onClick={startGateway}
              disabled={busy || amount <= 0}
              className="w-full rounded bg-[var(--accent)] py-3 text-[14px] font-black text-[var(--accent-ink)] disabled:opacity-50"
            >
              {busy ? "Starting…" : `Deposit ${formatMoney(amount, country.currency)}`}
            </button>
          </div>
        ) : (
          <form onSubmit={submitManual} className="space-y-3 rounded bg-[var(--bg-elevated)] p-4">
            <div className="rounded bg-[var(--surface-2)] p-3">
              <p className="text-[11px] text-[var(--text-muted)]">Send to</p>
              <p className="text-[17px] font-black tracking-wide text-[var(--accent)]">
                {settings.deposit_account_number ?? "—"}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {settings.deposit_account_name ?? "Betlixx"} ·{" "}
                {settings.deposit_account_network ?? "Mobile Money"}
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                Number you sent from
              </span>
              <input
                name="senderNumber"
                type="tel"
                defaultValue={player.phone}
                className="w-full rounded bg-[var(--surface-2)] px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                Screenshot of the transfer
              </span>
              <input
                name="screenshot"
                type="file"
                accept="image/*"
                className="w-full text-[12px] text-[var(--text-muted)] file:mr-3 file:rounded file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-2 file:text-[12px] file:font-bold file:text-[var(--text)]"
              />
            </label>

            <button
              type="submit"
              disabled={busy || amount <= 0}
              className="w-full rounded bg-[var(--accent)] py-3 text-[14px] font-black text-[var(--accent-ink)] disabled:opacity-50"
            >
              {busy ? "Sending…" : "I have sent the money"}
            </button>
          </form>
        )}

        {status && (
          <p className="rounded bg-[var(--pending)]/15 px-3 py-2.5 text-[12px] text-[var(--pending)]">
            {status}
          </p>
        )}
        {error && (
          <p className="rounded bg-[var(--lose)]/15 px-3 py-2.5 text-[12px] text-[var(--lose)]">{error}</p>
        )}

        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded py-3 text-center text-[12px] font-bold text-[var(--accent)] ring-1 ring-[var(--line)]"
          >
            Payment problem? Chat on WhatsApp
          </a>
        )}
      </div>
    </Page>
  );
}
