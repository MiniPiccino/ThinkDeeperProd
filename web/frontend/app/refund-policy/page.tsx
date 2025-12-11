export default function RefundPolicyPage() {
  return (
    <div className="bg-black text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12 md:py-16">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Policies</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Refund Policy</h1>
          <p className="text-base text-slate-300">How we handle cancellations and refunds for Thinkle Premium.</p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-slate-200">
          <h2 className="text-lg font-semibold text-white">14-day satisfaction window</h2>
          <p className="mt-2">
            If you are not satisfied within 14 days of starting a paid plan, email support@deepenyourmind.com and we
            will refund your most recent payment. No questions asked beyond basic account verification.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-slate-200">
          <h2 className="text-lg font-semibold text-white">Monthly subscriptions</h2>
          <p className="mt-2">
            You can cancel anytime. Cancelling stops future renewals; access continues through the current paid month.
            Payments made more than 14 days ago are not eligible for a refund unless required by local law.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-slate-200">
          <h2 className="text-lg font-semibold text-white">Yearly subscriptions</h2>
          <p className="mt-2">
            Yearly plans can be refunded in full within 14 days of purchase. After 14 days, you can cancel anytime to
            stop future renewals; access remains active for the remainder of the prepaid year.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-slate-200">
          <h2 className="text-lg font-semibold text-white">How to request a refund</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Email support@deepenyourmind.com from the address linked to your Thinkle account.</li>
            <li>Include your name and (if available) your checkout email or receipt.</li>
            <li>We will confirm eligibility and issue the refund to the original payment method.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-slate-200">
          <h2 className="text-lg font-semibold text-white">Questions</h2>
          <p className="mt-2">
            Reach us at support@deepenyourmind.com. We aim to reply within 1 business day.
          </p>
        </section>
      </div>
    </div>
  );
}
