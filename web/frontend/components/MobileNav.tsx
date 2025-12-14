"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: "📅" },
  { href: "/focus-tools", label: "Focus", icon: "🎯" },
  { href: "/growth", label: "Growth", icon: "🌿" },
  { href: "/pricing", label: "Pricing", icon: "💎" },
  { href: "/why", label: "Why", icon: "🤔" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800/70 bg-zinc-950/95 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-3xl items-stretch justify-between px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-semibold transition ${
                active
                  ? "text-emerald-200"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              aria-label={item.label}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-base ${
                  active
                    ? "border-emerald-400/60 bg-emerald-500/10"
                    : "border-white/5 bg-white/5"
                }`}
                aria-hidden
              >
                {item.icon}
              </span>
              <span className="tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
