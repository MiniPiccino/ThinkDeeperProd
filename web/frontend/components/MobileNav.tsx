"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: CalendarIcon },
  { href: "/focus-tools", label: "Focus", icon: TargetIcon },
  { href: "/growth", label: "Growth", icon: LeafIcon },
  { href: "/pricing", label: "Pricing", icon: DiamondIcon },
  { href: "/why", label: "Why Deep", icon: QuestionIcon },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800/70 bg-zinc-950/95 backdrop-blur-md shadow-[0_-10px_30px_-20px_rgba(0,0,0,0.8)] lg:hidden">
      <div className="mx-auto flex max-w-3xl items-stretch justify-between px-3 py-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                active
                  ? "text-emerald-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              aria-label={item.label}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                  active
                    ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.9)]"
                    : "border-white/5 bg-white/5"
                }`}
                aria-hidden
              >
                <Icon className={active ? "h-5 w-5 text-emerald-200" : "h-5 w-5 text-zinc-300"} />
              </span>
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <rect x="4" y="5" width="16" height="15" rx="3" ry="3" strokeWidth="1.4" />
      <path d="M4 9h16" strokeWidth="1.4" />
      <path d="M9 4v2M15 4v2" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="14" r="1.4" fill="currentColor" />
      <circle cx="16" cy="14" r="1.4" fill="currentColor" />
      <circle cx="8" cy="14" r="1.4" fill="currentColor" />
    </svg>
  );
}

function TargetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <circle cx="12" cy="12" r="8" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="3" strokeWidth="1.4" />
      <path d="M12 4V2M20 12h2M12 20v2M2 12h2" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LeafIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="M5 15c0-5.5 4.5-10 10-10h4v4c0 5.5-4.5 10-10 10H5z"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M9 17c2.5-2.5 7-6 10-6" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DiamondIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="M12 4 5 9l7 11 7-11-7-5Z"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M5 9h14" strokeWidth="1.2" />
    </svg>
  );
}

function QuestionIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <circle cx="12" cy="12" r="9" strokeWidth="1.4" />
      <path
        d="M9.75 9.5c0-1.4 1.1-2.5 2.45-2.5 1.2 0 2.3.85 2.3 2 0 1.05-.55 1.6-1.4 2.1-.85.5-1.35 1.15-1.35 2.15"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  );
}
