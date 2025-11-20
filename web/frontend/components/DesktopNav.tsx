"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Today" },
  { href: "/focus-tools", label: "Focus tools" },
  { href: "/growth", label: "Growth" },
  { href: "/why", label: "Why Deep" },
];

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 hidden border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur-md lg:block">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-emerald-200">
          Thinkle
        </Link>
        <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em]">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 transition ${
                  active
                    ? "bg-emerald-500/20 text-emerald-100 border border-emerald-400/50"
                    : "text-zinc-400 border border-transparent hover:text-zinc-200"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
