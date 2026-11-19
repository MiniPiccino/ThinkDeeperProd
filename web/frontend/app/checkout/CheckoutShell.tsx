import Link from "next/link";

export function CheckoutShell({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-emerald-400/20 bg-white/5 p-8 text-center shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Thinkle Premium</p>
        <h1 className="mt-3 text-3xl font-semibold">Sandbox checkout</h1>
        <p className="mt-4 text-sm text-slate-300">{message}</p>
        <Link
          href="/growth?plan=free"
          className="mt-6 inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-emerald-300 hover:text-emerald-200"
        >
          Return to Growth
        </Link>
      </section>
    </main>
  );
}
