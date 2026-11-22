'use client';

import Link from "next/link";
import { useCallback, useState } from "react";

import { createCheckoutSession } from "@/lib/api";
import { formatEntitlementDate } from "@/components/SubscriptionStatus";
import { useBillingStatus } from "@/hooks/useBillingStatus";

const FEATURES = [
  "Daily guided reflections with feedback",
  "Export your yearly tree and streak timeline",
  "Weekly chapter badges and insight tracking",
  "Focus tools tailored to your growth themes",
];

export default function PricingPage() {
  const { user, authLoading, data: billing, isLoading: billingLoading, isError: billingError, refetch } = useBillingStatus();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startCheckout = useCallback(async (priceId: string) => {
    setError(null);
    if (!user) {
      setError("Sign in first so we can attach premium to your account.");
      return;
    }
    setLoading(true);
    try {
      if (!priceId) {
        throw new Error("Missing Paddle price ID.");
      }
      const { checkoutUrl } = await createCheckoutSession(priceId);
      if (!checkoutUrl) throw new Error("Paddle checkout not available yet.");
      window.location.href = checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start checkout.";
      setError(message);
      setLoading(false);
    }
  }, [user]);

  const checking = authLoading || Boolean(user && billingLoading);
  const canSubscribe = !checking && !billingError && (!user || billing?.premiumActive === false);
  const entitlementDate = formatEntitlementDate(billing?.expiresAt ?? null);
  const currentPlanLabel = billing?.cancelAtPeriodEnd && entitlementDate
    ? `Premium active until ${entitlementDate}`
    : "Premium Active";

  return (
    <div className="bg-black text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-12 md:py-16">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Pricing</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">One plan. Think deeper.</h1>
          <p className="text-base text-slate-300">
            Your reflections, streaks, and exports are unlocked on premium.
          </p>
          {checking ? <p className="text-sm text-slate-300">Checking your current plan…</p> : null}
          {billingError ? (
            <div className="space-y-2 text-sm text-amber-200">
              <p>We couldn&apos;t verify your plan. Checkout is paused to protect against duplicate subscriptions.</p>
              <button type="button" className="underline" onClick={() => void refetch()}>Try again</button>
            </div>
          ) : null}
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </header>

        <section className="mx-auto grid w-full max-w-xl gap-6">
          <PricingCard
            title={billing?.premiumActive ? "Your Current Plan" : "Premium — Monthly"}
            price="€5"
            cadence="per month"
            ctaLabel={billing?.premiumActive ? currentPlanLabel : loading ? "Connecting…" : user ? "Start monthly" : "Sign in to subscribe"}
            highlight={billing?.premiumActive ? currentPlanLabel : "Flexibility to cancel anytime."}
            priceId={process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY ?? ""}
            onStartCheckout={startCheckout}
            disabled={loading || !canSubscribe}
            hideAction={Boolean(billing?.premiumActive)}
          />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">What’s included</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            {FEATURES.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-6">
          <h2 className="text-lg font-semibold text-white">Refund policy</h2>
          <p className="mt-2 text-sm text-emerald-100/90">
            We want Thinkle to feel valuable. If you’re not happy within 14 days of starting a plan, email us at
            support@deepenyourmind.com and we’ll issue a refund for your most recent payment. Yearly plans can be
            refunded in full within 14 days; after that, cancel anytime to stop future renewals.
          </p>
          <Link
            href="/refund-policy"
            className="mt-3 inline-flex items-center text-sm font-semibold text-emerald-200 underline-offset-4 hover:underline"
          >
            Read the full refund policy
          </Link>
        </section>
      </div>
    </div>
  );
}

type PricingCardProps = {
  title: string;
  price: string;
  cadence: string;
  ctaLabel: string;
  highlight: string;
  priceId: string;
  onStartCheckout: (priceId: string) => void;
  disabled?: boolean;
  hideAction?: boolean;
};

function PricingCard({ title, price, cadence, ctaLabel, highlight, priceId, onStartCheckout, disabled, hideAction }: PricingCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-emerald-500/5">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Premium</p>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-300">{highlight}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-white">{price}</span>
          <span className="text-sm text-slate-400">{cadence}</span>
        </div>
      </div>
      {hideAction ? (
        <div className="mt-6 rounded-full border border-emerald-400/40 px-4 py-2 text-center text-sm font-semibold text-emerald-200">
          {ctaLabel}
        </div>
      ) : <button
        type="button"
        onClick={() => onStartCheckout(priceId)}
        disabled={disabled || !priceId}
        className="mt-6 inline-flex justify-center rounded-full bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {ctaLabel}
      </button>}
    </div>
  );
}
