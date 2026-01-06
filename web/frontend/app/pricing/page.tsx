'use client';

import Link from "next/link";
import Script from "next/script";
import { useCallback, useState } from "react";

import { confirmPaddleTransaction, createPaddleClientToken } from "@/lib/api";
import { useUserIdentifier } from "@/hooks/useUserIdentifier";

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: string) => void };
      Initialize: (options: { token: string; eventCallback?: (data: unknown) => void }) => void;
      Checkout: { open: (options: { items: Array<{ priceId: string; quantity: number }>; customData?: Record<string, string> }) => void };
    };
  }
}

const FEATURES = [
  "Daily guided reflections with feedback",
  "Export your yearly tree and streak timeline",
  "Weekly chapter badges and insight tracking",
  "Focus tools tailored to your growth themes",
];

export default function PricingPage() {
  const userId = useUserIdentifier();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startCheckout = useCallback(async (priceId: string) => {
    setError(null);
    if (!userId) {
      setError("Sign in first so we can attach premium to your account.");
      return;
    }
    setLoading(true);
    try {
      if (!priceId) {
        throw new Error("Missing Paddle price ID.");
      }
      const { token } = await createPaddleClientToken();
      if (!token || !window.Paddle) {
        throw new Error("Paddle checkout not available yet.");
      }
      const paddleEnv = process.env.NEXT_PUBLIC_PADDLE_ENV ?? "sandbox";
      window.Paddle.Environment.set(paddleEnv);
      window.Paddle.Initialize({
        token,
        eventCallback: async (data: any) => {
          console.log("Paddle event", data);
          const eventName = data?.name ?? data?.eventName ?? "";
          if (eventName === "checkout.completed" || eventName === "checkout.success") {
            const transactionId =
              data?.data?.transaction_id ??
              data?.data?.transactionId ??
              data?.transaction_id ??
              data?.transactionId;
            if (transactionId) {
              try {
                await confirmPaddleTransaction(String(transactionId));
                window.location.href = "/growth?plan=premium";
              } catch (confirmError) {
                console.error("Failed to confirm transaction", confirmError);
                setLoading(false);
              }
            }
            return;
          }
          const lowered = String(eventName).toLowerCase();
          if (
            lowered.includes("cancel") ||
            lowered.includes("close") ||
            lowered.includes("error") ||
            lowered.includes("fail") ||
            lowered.includes("opened") ||
            lowered.includes("loaded")
          ) {
            setLoading(false);
          }
        },
      });
      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: { userId },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start checkout.";
      setError(message);
      setLoading(false);
    }
  }, [userId]);

  return (
    <div className="bg-black text-white">
      <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="afterInteractive" />
      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-12 md:py-16">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Pricing</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">One plan. Think deeper.</h1>
          <p className="text-base text-slate-300">
            Pick monthly or yearly. Your reflections, streaks, and exports are unlocked on premium.
          </p>
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <PricingCard
            title="Premium — Monthly"
            price="€5"
            cadence="per month"
            ctaLabel={loading ? "Connecting…" : "Start monthly"}
            highlight="Flexibility to pause anytime."
            priceId={process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY ?? ""}
            onStartCheckout={startCheckout}
            disabled={loading}
          />
          <PricingCard
            title="Premium — Yearly"
            price="€50"
            cadence="per year"
            ctaLabel={loading ? "Connecting…" : "Start yearly"}
            highlight="Save 17% vs monthly. One receipt for the year."
            priceId={process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY ?? ""}
            onStartCheckout={startCheckout}
            disabled={loading}
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
            rene@3rz.eu and we’ll issue a refund for your most recent payment. Yearly plans can be
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
};

function PricingCard({ title, price, cadence, ctaLabel, highlight, priceId, onStartCheckout, disabled }: PricingCardProps) {
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
      <button
        type="button"
        onClick={() => onStartCheckout(priceId)}
        disabled={disabled || !priceId}
        className="mt-6 inline-flex justify-center rounded-full bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {ctaLabel}
      </button>
    </div>
  );
}
