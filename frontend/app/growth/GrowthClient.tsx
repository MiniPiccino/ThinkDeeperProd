'use client';

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { StreakTree } from "@/components/StreakTree";
import { FloatingAction } from "@/components/FloatingAction";
import { fetchDailyQuestion } from "@/lib/api";
import { useUserIdentifier } from "@/hooks/useUserIdentifier";

type GrowthLevelStats = {
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  nextLevelThreshold: number;
  progressPercent: number;
};

const GROWTH_XP_PER_LEVEL = 120;

function computeGrowthLevelStats(totalXp: number): GrowthLevelStats {
  if (totalXp < 0) {
    totalXp = 0;
  }
  const level = Math.floor(totalXp / GROWTH_XP_PER_LEVEL) + 1;
  const previousThreshold = (level - 1) * GROWTH_XP_PER_LEVEL;
  const nextThreshold = level * GROWTH_XP_PER_LEVEL;
  const xpIntoLevel = totalXp - previousThreshold;
  const xpToNextLevel = Math.max(0, nextThreshold - totalXp);
  const progressPercent = Math.round((xpIntoLevel / GROWTH_XP_PER_LEVEL) * 100);
  return {
    level,
    xpIntoLevel,
    xpToNextLevel,
    nextLevelThreshold: nextThreshold,
    progressPercent: Math.max(0, Math.min(progressPercent, 100)),
  };
}

export function GrowthClient() {
  const userId = useUserIdentifier();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["growth", userId],
    queryFn: () => fetchDailyQuestion(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 0,
  });

  const xpTotal = data?.xpTotal ?? 0;
  const levelStats = useMemo(() => computeGrowthLevelStats(xpTotal), [xpTotal]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 px-4 py-16 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Growth</p>
          <h1 className="text-3xl font-semibold">Watch your reflection tree grow</h1>
          <p className="text-sm text-slate-300">
            Every streak day becomes a leaf. Each week is a new branch. Come here after writing to see the forest you’re
            building.
          </p>
        </header>

        {!userId ? (
          <div className="rounded-3xl border border-dashed border-slate-700/70 px-6 py-8 text-center text-sm text-slate-300">
            Linking your growth data…
          </div>
        ) : null}

        {userId && isLoading ? (
          <div className="rounded-3xl border border-dashed border-slate-700/70 px-6 py-8 text-center text-sm text-slate-300">
            Loading your tree…
          </div>
        ) : null}

        {userId && isError ? (
          <div className="rounded-3xl border border-red-500/40 bg-red-500/10 px-6 py-8 text-center text-sm text-red-200">
            Couldn’t load your growth tree. Refresh the main page to sync again.
          </div>
        ) : null}

        {userId && !isLoading && !isError && data ? (
          <>
            <section className="rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 p-6 shadow-2xl">
              <StreakTree
                streak={data?.streak ?? 0}
                weekCompletedDays={data?.weekProgress?.completedDays ?? 0}
                weekTotalDays={data?.weekProgress?.totalDays ?? 7}
                currentWeekIndex={data?.weekIndex ?? 0}
              />
              <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-300">
                <Link
                  href="/why"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-emerald-200 hover:border-emerald-300 hover:text-emerald-100"
                >
                  Why this ritual works
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-emerald-200 hover:border-emerald-300 hover:text-emerald-100"
                >
                  Back to today&apos;s prompt
                </Link>
              </div>
            </section>

            <section className="space-y-4 rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-sm leading-relaxed text-slate-100 shadow-lg">
              <h2 className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">Why we built the tree</h2>
              <p>
                After you write, you need a reward that feels earned—not more noise. The Tree is that reward: a soft animation
                that celebrates progress, gives your brain a dopamine win, and reminds you your effort compounds.
              </p>
              <p>
                New leaves glow when the limbic system gets its “well done,” while the weekly branches and quotes engage the
                prefrontal cortex with anticipation of what’s next. That emotional + rational pairing is what keeps habits sticky.
              </p>
            </section>

            <section className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-6 text-sm text-slate-100 shadow-lg">
              <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">Your level progress</h3>
              <p className="mt-3 text-xl font-semibold text-white">Level {levelStats.level}</p>
              <p className="text-sm text-emerald-200/80">
                {levelStats.progressPercent}% toward the next tier — {levelStats.xpIntoLevel}/{GROWTH_XP_PER_LEVEL} XP into this level.
              </p>
              <div className="mt-4 h-2 w-full rounded-full bg-emerald-900/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                  style={{ width: `${Math.min(levelStats.progressPercent, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-emerald-200/70">Keep writing daily to push the bar forward.</p>
            </section>
          </>
        ) : null}
      </div>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 md:gap-3">
        <FloatingAction href="/" label="Back to prompt" />
        <FloatingAction href="/focus-tools" label="Focus tools" />
        <FloatingAction href="/why" label="Why Deep" variant="ghost" />
      </div>
    </main>
  );
}
