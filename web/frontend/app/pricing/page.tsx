import Link from "next/link";

const FEATURES = [
  "Daily guided reflections with feedback",
  "Export your yearly tree and streak timeline",
  "Weekly chapter badges and insight tracking",
  "Focus tools tailored to your growth themes",
];

export default function PricingPage() {
  return (
    <div className="bg-black text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-12 md:py-16">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Pricing</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">One plan. Think deeper.</h1>
          <p className="text-base text-slate-300">
            Pick monthly or yearly. Your reflections, streaks, and exports are unlocked on premium.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <PricingCard
            title="Premium — Monthly"
            price="€5"
            cadence="per month"
            ctaLabel="Start monthly"
            href="/growth?plan=premium"
            highlight="Flexibility to pause anytime."
          />
          <PricingCard
            title="Premium — Yearly"
            price="€50"
            cadence="per year"
            ctaLabel="Start yearly"
            href="/growth?plan=premium"
            highlight="Save 17% vs monthly. One receipt for the year."
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
  href: string;
  highlight: string;
};

function PricingCard({ title, price, cadence, ctaLabel, href, highlight }: PricingCardProps) {
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
      <Link
        href={href}
        className="mt-6 inline-flex justify-center rounded-full bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
