"use client";

import Link from "next/link";

import { useBillingStatus } from "@/hooks/useBillingStatus";

export function formatEntitlementDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

export function SubscriptionStatus({ compact = false }: { compact?: boolean }) {
  const { user, authLoading, data, isLoading, isError } = useBillingStatus();
  if (authLoading || (user && isLoading)) {
    return <p className="text-sm text-slate-400">Checking subscription…</p>;
  }
  if (!user) return null;
  if (isError || !data) {
    return <p className="text-sm text-amber-200">Subscription status is temporarily unavailable.</p>;
  }
  const date = formatEntitlementDate(data.expiresAt);
  const label = data.cancelAtPeriodEnd && date
    ? `Premium active until ${date}`
    : data.premiumActive
      ? "Premium Active"
      : "Free plan";
  return (
    <div className={compact ? "text-sm text-emerald-200" : "rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4"}>
      <p className="font-semibold">{label}</p>
      {!compact ? <Link href="/account" className="mt-1 inline-block text-xs text-slate-300 underline">View account</Link> : null}
    </div>
  );
}
