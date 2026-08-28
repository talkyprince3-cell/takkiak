"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Page } from "@/components/Shell";
import { useSession } from "@/lib/store";
import { formatMoney } from "@/lib/countries";

interface MeResponse {
  user: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    currency: string;
    balance: number;
    total_deposited: number;
    total_withdrawn: number;
    verification_step: number;
    qualifying_deposits: number;
    withdrawal_approved: boolean;
  };
  country: { name: string; currency: string; payoutRail: string };
  withdrawal: { unlocked: boolean; failed?: string; progress: { have: number; need: number; label: string } };
}

function AccountView() {
  const router = useRouter();
  const player = useSession((s) => s.player);
  const hydrated = useSession((s) => s.hydrated);
  const signOut = useSession((s) => s.signOut);
  const setBalance = useSession((s) => s.setBalance);

  const [data, setData] = useState<MeResponse | null>(null);
  const [swept, setSwept] = useState<number | null>(null);

  useEffect(() => {
    if (hydrated && !player) router.replace("/login");
  }, [hydrated, player, router]);

  useEffect(() => {
    if (!player) return;
    let alive = true;

    const run = async () => {
      // Sweep up anything that settled while the player was away — a closed tab
      // before the redirect fired is the one way hosted checkouts go wrong.
      // Credits are idempotent, so calling this on every load is safe.
      try {
        const res = await fetch("/api/deposits/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: player.id }),
        });
        const json = await res.json();
        if (alive && json.credited > 0) setSwept(json.credited);
      } catch {
        /* reconciliation is best-effort */
      }

      try {
        const res = await fetch(`/api/me?userId=${player.id}`);
        if (!res.ok) return;
        const json: MeResponse = await res.json();
        if (!alive) return;
        setData(json);
        setBalance(Number(json.user.balance));
      } catch {
        /* the page renders from the session until this lands */
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [player, setBalance]);

  if (!player) return null;

  const u = data?.user;
  const gate = data?.withdrawal;

  return (
    <Page>
      <div className="space-y-3 px-2 pt-2 md:mx-auto md:max-w-3xl md:px-5 md:pt-4">
        <section className="rounded bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] p-4">
          <p className="text-[12px] text-[var(--text-muted)]">{player.name}</p>
          <p className="mt-1 text-[30px] font-black leading-none text-[var(--accent)]">
            {formatMoney(Number(u?.balance ?? player.balance), player.currency)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-faint)]">
            {player.phone} · {data?.country.name ?? ""}
          </p>

          <div className="mt-4 flex gap-2">
            <Link
              href="/deposit"
              className="flex-1 rounded bg-[var(--accent)] py-2.5 text-center text-[13px] font-black text-[var(--accent-ink)]"
            >
              Deposit
            </Link>
            <Link
              href="/withdraw"
              className="flex-1 rounded py-2.5 text-center text-[13px] font-bold ring-1 ring-[var(--line)]"
            >
              Withdraw
            </Link>
          </div>
        </section>

        {swept !== null && (
          <p className="rounded bg-[var(--win)]/15 px-3 py-2.5 text-[12px] text-[var(--win)]">
            We found {swept} completed deposit{swept === 1 ? "" : "s"} and credited your wallet.
          </p>
        )}

        {gate && (
          <section className="rounded bg-[var(--bg-elevated)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-bold">Withdrawals</h2>
              <span
                className="rounded px-2 py-0.5 text-[10px] font-black uppercase"
                style={
                  gate.unlocked
                    ? { background: "var(--win)", color: "#052e16" }
                    : { background: "var(--surface-2)", color: "var(--text-muted)" }
                }
              >
                {gate.unlocked ? "Unlocked" : "Locked"}
              </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${Math.min(100, (gate.progress.have / gate.progress.need) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">{gate.progress.label}</p>
          </section>
        )}

        <section className="grid grid-cols-2 gap-2">
          <Stat label="Deposited" value={formatMoney(Number(u?.total_deposited ?? 0), player.currency)} />
          <Stat label="Withdrawn" value={formatMoney(Number(u?.total_withdrawn ?? 0), player.currency)} />
        </section>

        <nav className="overflow-hidden rounded bg-[var(--bg-elevated)]">
          {[
            { href: "/my-bets", label: "My bets" },
            { href: "/load-code", label: "Load a booking code" },
            { href: "/partner", label: "Become a partner" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5 text-[13px] font-medium last:border-0"
            >
              {item.label}
              <span className="text-[var(--text-faint)]">›</span>
            </Link>
          ))}
        </nav>

        <button
          onClick={() => {
            signOut();
            router.push("/");
          }}
          className="w-full rounded py-3 text-[13px] font-bold text-[var(--lose)] ring-1 ring-[var(--line)]"
        >
          Log out
        </button>
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-[var(--bg-elevated)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
      <p className="mt-0.5 text-[15px] font-bold">{value}</p>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountView />
    </Suspense>
  );
}
