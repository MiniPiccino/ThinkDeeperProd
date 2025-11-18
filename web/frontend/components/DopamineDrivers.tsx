type DopaminePoint = {
  label: string;
  description: string;
  badge?: string;
  emphasis?: string;
  unlocked?: boolean;
};

type RewardStat = {
  label: string;
  value: string;
  hint?: string;
};

type DopamineDriversProps = {
  curiosity: {
    title: string;
    description: string;
    points: string[];
  };
  challenge: {
    title: string;
    description: string;
    modes: DopaminePoint[];
    activeLabel?: string;
  };
  reward: {
    title: string;
    description: string;
    stats: RewardStat[];
    celebration?: string;
  };
  anticipation: {
    title: string;
    description: string;
    actions: string[];
    nextPrompt?: string | null;
  };
};

export function DopamineDrivers({
  curiosity,
  challenge,
  reward,
  anticipation,
}: DopamineDriversProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <article className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-100">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">
            {curiosity.title}
          </p>
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-50">
            {curiosity.description}
          </h2>
        </header>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          {curiosity.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </article>

      <article className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6 text-indigo-950 shadow-sm dark:border-indigo-700/40 dark:bg-indigo-900/30 dark:text-indigo-100">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
            {challenge.title}
          </p>
          <h2 className="text-lg font-semibold text-indigo-900 dark:text-indigo-50">
            {challenge.description}
          </h2>
          {challenge.activeLabel ? (
            <p className="text-xs text-indigo-600 dark:text-indigo-200">
              Active mode: {challenge.activeLabel}
            </p>
          ) : null}
        </header>
        <div className="mt-4 space-y-3">
          {challenge.modes.map((mode) => (
            <div
              key={mode.label}
              className="rounded-2xl border border-indigo-200/70 bg-white/60 px-4 py-3 text-sm shadow-sm dark:border-indigo-700/40 dark:bg-indigo-900/50"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-indigo-800 dark:text-indigo-50">{mode.label}</p>
                <div className="flex items-center gap-2">
                  {mode.emphasis ? (
                    <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                      {mode.emphasis}
                    </span>
                  ) : null}
                  {mode.unlocked === false ? (
                    <span className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
                      Locked
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-indigo-700 dark:text-indigo-100/80">
                {mode.description}
              </p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 shadow-sm dark:border-emerald-600/40 dark:bg-emerald-900/40 dark:text-emerald-100">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            {reward.title}
          </p>
          <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-50">
            {reward.description}
          </h2>
          {reward.celebration ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-200/80">{reward.celebration}</p>
          ) : null}
        </header>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          {reward.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-emerald-200/70 bg-white/70 px-4 py-3 shadow-sm dark:border-emerald-700/40 dark:bg-emerald-900/50"
            >
              <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                {stat.label}
              </dt>
              <dd className="mt-1 text-base font-bold text-emerald-900 dark:text-emerald-50">
                {stat.value}
              </dd>
              {stat.hint ? (
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-200/70">{stat.hint}</p>
              ) : null}
            </div>
          ))}
        </dl>
      </article>

      <article className="rounded-3xl border border-sky-200 bg-sky-50 p-6 text-sky-950 shadow-sm dark:border-sky-700/40 dark:bg-sky-900/30 dark:text-sky-100">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">
            {anticipation.title}
          </p>
          <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-50">
            {anticipation.description}
          </h2>
          {anticipation.nextPrompt ? (
            <p className="text-xs text-sky-600 dark:text-sky-200/80">
              Next reflection unlocks {anticipation.nextPrompt}
            </p>
          ) : null}
        </header>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          {anticipation.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
