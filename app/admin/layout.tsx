import Link from "next/link";
import Image from "next/image";
import { AdminNav } from "./AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="flex h-14 w-full items-center gap-3 px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/logo-mark.svg" alt="" width={24} height={24} />
            <span className="text-[13px] font-black">Admin</span>
          </Link>
          <AdminNav />
        </div>
      </header>
      <main className="w-full px-4 py-4">{children}</main>
    </div>
  );
}
