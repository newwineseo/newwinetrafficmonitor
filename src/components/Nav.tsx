"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/alerts", label: "Alerts" },
  { href: "/sites", label: "Sites" },
  { href: "/settings", label: "Settings" },
  { href: "/runs", label: "Run history" },
];

export function Nav({ openAlerts }: { openAlerts: number }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-3 md:pb-3">
        <Link href="/" className="whitespace-nowrap text-base font-semibold">NewWine Traffic Monitor</Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => <NavLink key={l.href} {...l} active={isActive(l.href)} badge={l.href === "/alerts" ? openAlerts : 0} />)}
        </nav>
        <button onClick={logout} className="rounded px-2 py-1 text-sm text-gray-300 hover:bg-white/10 hover:text-white">Log out</button>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 py-2 md:hidden" aria-label="Main">
        {LINKS.map((l) => <NavLink key={l.href} {...l} active={isActive(l.href)} badge={l.href === "/alerts" ? openAlerts : 0} />)}
      </nav>
    </header>
  );
}

function NavLink({ href, label, active, badge }: { href: string; label: string; active: boolean; badge: number }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-sm ${active ? "bg-white/15 font-semibold" : "text-gray-300 hover:bg-white/10 hover:text-white"}`}>
      {label}
      {badge > 0 && <span className="rounded-full bg-critical px-1.5 text-xs font-semibold text-white" aria-label={`${badge} open`}>{badge}</span>}
    </Link>
  );
}
