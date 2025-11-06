'use client';

type PrimingCardProps = {
  emotionalHook: string;
  teaserQuestion: string;
  somaticCue: string;
  cognitiveCue: string;
};

export function PrimingCard({
  emotionalHook,
  teaserQuestion,
  somaticCue,
  cognitiveCue,
}: PrimingCardProps) {
  return (
    <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-950 shadow-sm dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-100">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-500">Emotional hook</p>
        <h2 className="text-2xl font-semibold">Prime feeling before thinking</h2>
      </header>
      <div className="mt-4 space-y-4 text-sm leading-relaxed">
        <p>{emotionalHook}</p>
        <div className="rounded-2xl border border-rose-200/70 bg-white/70 px-4 py-3 shadow-sm dark:border-rose-700/40 dark:bg-rose-900/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Teaser</p>
          <p className="mt-1 text-rose-900 dark:text-rose-50">{teaserQuestion}</p>
        </div>
        <ul className="space-y-3">
          <li>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Somatic cue</p>
            <p>{somaticCue}</p>
          </li>
          <li>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Cognitive bridge</p>
            <p>{cognitiveCue}</p>
          </li>
        </ul>
      </div>
    </section>
  );
}

