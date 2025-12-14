"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: CalendarIcon },
  { href: "/focus-tools", label: "Focus", icon: TargetIcon },
  { href: "/growth", label: "Growth", icon: LeafIcon },
  { href: "/pricing", label: "Pricing", icon: DiamondIcon },
  { href: "/why", label: "Why Deep", icon: QuestionIcon },
];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="pointer-events-none fixed bottom-5 right-4 z-50 lg:hidden">
      <div className="flex flex-col items-end gap-3">
        <div
          className={`flex flex-col items-end gap-2 transition-all duration-200 ${
            open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`pointer-events-auto flex items-center justify-center rounded-full border p-3 shadow-lg transition ${
                  active
                    ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100 shadow-[0_18px_38px_-24px_rgba(16,185,129,0.9)]"
                    : "border-white/10 bg-zinc-900/90 text-zinc-200 hover:border-white/20 hover:bg-zinc-900"
                }`}
                aria-label={item.label}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/15 text-emerald-100 shadow-[0_18px_38px_-24px_rgba(16,185,129,0.9)] transition hover:border-emerald-300/80 hover:bg-emerald-500/20"
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
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

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="m6 6 12 12M18 6 6 18" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
