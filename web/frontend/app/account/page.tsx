"use client";

import { useState } from "react";

import { formatEntitlementDate } from "@/components/SubscriptionStatus";
import { useBillingStatus } from "@/hooks/useBillingStatus";
import { createSubscriptionManagementSession } from "@/lib/api";

export default function AccountPage() {
  const { user, authLoading, data, isLoading, isError } = useBillingStatus();
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = formatEntitlementDate(data?.expiresAt ?? null);

  const manage = async () => {
    setManaging(true);
    setError(null);
    try {
      const { portalUrl } = await createSubscriptionManagementSession();
      window.location.assign(portalUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Subscription management is unavailable.");
      setManaging(false);
    }
  };

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <section className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Account</p>
        <h1 className="mt-3 text-3xl font-semibold">Subscription</h1>
        {authLoading || (user && isLoading) ? <p className="mt-6 text-slate-300">Checking subscription…</p> : null}
        {!authLoading && !user ? <p className="mt-6 text-slate-300">Sign in to view your subscription.</p> : null}
        {isError ? <p className="mt-6 text-amber-200">Subscription status is temporarily unavailable.</p> : null}
        {data ? (
          <div className="mt-6 space-y-4">
            <p className="text-xl font-semibold text-emerald-200">
              {data.cancelAtPeriodEnd && date ? `Premium active until ${date}` : data.premiumActive ? "Premium Active" : "Free plan"}
            </p>
            {data.managementAvailable ? (
              <button type="button" onClick={() => void manage()} disabled={managing} className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold disabled:opacity-60">
                {managing ? "Opening…" : "Manage Subscription"}
              </button>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </section>
    </main>
  );
}
