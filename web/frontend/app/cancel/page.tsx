export default function CancelSubscriptionPage() {
  return (
    <div className="bg-black text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12 md:py-16">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Account</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Cancel your plan</h1>
          <p className="text-base text-slate-300">Use the link from your Paddle receipt, or email us for help.</p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-slate-200">
          <h2 className="text-lg font-semibold text-white">Fastest option</h2>
          <p className="mt-2">
            Open your Paddle receipt email and click the “Manage subscription” link. You can cancel or update your plan there.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-slate-200">
          <h2 className="text-lg font-semibold text-white">Need help?</h2>
          <p className="mt-2">
            Email rene@3rz.eu and include your account email and (if available) the receipt or transaction ID.
            We’ll cancel it for you within 1 business day.
          </p>
          <a
            className="mt-4 inline-flex items-center justify-center rounded-full bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
            href="mailto:rene@3rz.eu?subject=Cancel%20my%20plan"
          >
            Email support
          </a>
        </section>
      </div>
    </div>
  );
}
