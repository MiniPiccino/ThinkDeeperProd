import type { Metadata } from "next";
import { FloatingAction } from "@/components/FloatingAction";

export const metadata: Metadata = {
  title: "Why Use Deep",
  description: "The psychological case for a five-minute daily thinking ritual.",
};

export default function WhyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 py-16 text-slate-100">
      <article className="mx-auto flex max-w-3xl flex-col gap-10 leading-relaxed">
        <header className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.5em] text-emerald-300">Why Use Deep</p>
          <h1 className="text-4xl font-semibold">Five minutes to train your brain to think, not scroll.</h1>
          <p className="text-base text-slate-200">
            Modern life rewards reaction over reflection. Deep gives you a daily pause that keeps your mind sharp, curious, and human.
          </p>
        </header>

        <section className="space-y-5 text-base text-slate-100">
          <p>
            We’re surrounded by endless content loops that spike dopamine with every swipe. Deep was built as a small rebellion:
            one thoughtful question every day—a five-minute pause that engages the same mental muscles used for journaling,
            reading, or having a real conversation. Just like stretching keeps your body flexible, five minutes of deliberate
            thinking keeps your brain alive.
          </p>
        </section>

        <section className="space-y-4 text-base text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-200">
            What happens when you think deeply
          </h2>
          <ul className="space-y-3 text-base">
            <li>
              <strong>Neural activation.</strong> Reflecting on abstract or moral questions engages the prefrontal cortex—the
              region responsible for reasoning, empathy, and long-term planning.
            </li>
            <li>
              <strong>Attention training.</strong> Sustained focus for five minutes counteracts the dopamine spikes from fast,
              shallow feeds.
            </li>
            <li>
              <strong>Emotional regulation.</strong> Writing slows the limbic system and builds meta-awareness, which research
              links to lower anxiety and steadier mood.
            </li>
            <li>
              <strong>Memory integration.</strong> Connecting ideas and experiences helps the brain form meaningful memories
              instead of fragmented impressions.
            </li>
          </ul>
        </section>

        <section className="space-y-4 text-base text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-200">
            Why five minutes is enough
          </h2>
          <p>
            Psychologists call it micro-practice: brief, consistent habits that build lasting change. Five focused minutes of
            reflection stimulate deeper cognitive networks than hours of passive consumption. The more often you return, the
            easier it becomes to notice your own thoughts before the world fills them for you.
          </p>
        </section>

        <section className="space-y-4 text-base text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-200">
            Deep is not another feed
          </h2>
          <p>
            It doesn’t try to entertain you. It asks you to stop, feel, and reason. Each question is a mental weight—light
            enough to lift daily, heavy enough to make you stronger.
          </p>
          <p>
            “In a world that profits from your distraction, focus is an act of resistance.” Deep is your daily resistance: a
            five-minute gym for the mind, a quiet space to stay human in a flat, fast world.
          </p>
        </section>
      </article>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 md:gap-3 lg:hidden">
        <FloatingAction href="/" label="Back to reflection" />
        <FloatingAction href="/focus-tools" label="Focus tools" />
        <FloatingAction href="/growth" label="Growth check-in" />
      </div>
    </main>
  );
}
