"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/deposits", label: "Deposits" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/custom-matches", label: "Custom" },
  { href: "/admin/bets", label: "Bets" },
  { href: "/admin/sub-admins", label: "Partners" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") return null;

  return (
    <>
      <nav className="scroll-x flex flex-1 gap-1">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded px-2.5 py-1.5 text-[12px] font-semibold"
            style={
              pathname === l.href
                ? { background: "var(--accent)", color: "var(--accent-ink)" }
                : { color: "var(--text-muted)" }
            }
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <button
        onClick={async () => {
          await fetch("/api/admin/logout", { method: "POST" });
          router.push("/admin/login");
        }}
        className="shrink-0 text-[12px] font-semibold text-[var(--text-faint)]"
      >
        Log out
      </button>
    </>
  );
}
