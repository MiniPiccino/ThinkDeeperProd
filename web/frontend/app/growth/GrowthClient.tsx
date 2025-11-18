'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { StreakReplay } from "@/components/StreakTree";
import { FloatingAction } from "@/components/FloatingAction";
import { fetchDailyQuestion } from "@/lib/api";
import { useUserIdentifier } from "@/hooks/useUserIdentifier";
import { TREE_ANIMATION_UNLOCK_STREAK } from "@/constants/experience";

const MS_IN_DAY = 86_400_000;

type GrowthLevelStats = {
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  nextLevelThreshold: number;
  progressPercent: number;
};

const GROWTH_XP_PER_LEVEL = 120;

type TreeAnimationFrame = {
  key: string;
  duration: number;
  label: string;
  description: string;
  transform: string;
  focusMode: "none" | "focus" | "bloom";
};

const TREE_ANIMATION_FRAMES: TreeAnimationFrame[] = [
  {
    key: "wide",
    duration: 1400,
    label: "Frame 1 · Year view",
    description: "Take in the full streak timeline you’ve built.",
    transform: "scale(1) translate3d(0,0,0)",
    focusMode: "none",
  },
  {
    key: "branch",
    duration: 1200,
    label: "Frame 2 · Zoom toward week",
    description: "Dialing into this week’s circuit.",
    transform: "scale(1.12) translate3d(0,-14px,0)",
    focusMode: "focus",
  },
  {
    key: "leaf",
    duration: 1100,
    label: "Frame 3 · Focus on day",
    description: "Landing on the day you just brought to bloom.",
    transform: "scale(1.2) translate3d(0,-20px,0)",
    focusMode: "focus",
  },
  {
    key: "bloom",
    duration: 1200,
    label: "Frame 4 · Day pulse + XP",
    description: "Square pulses as XP locks in.",
    transform: "scale(1.25) translate3d(0,-16px,0)",
    focusMode: "bloom",
  },
  {
    key: "return",
    duration: 1400,
    label: "Frame 5 · Zoom out",
    description: "Zooming back out so you see the full record.",
    transform: "scale(1) translate3d(0,0,0)",
    focusMode: "none",
  },
];

function mondayAlignedWeekIndex(target: Date): number {
  const year = target.getUTCFullYear();
  const firstDay = new Date(Date.UTC(year, 0, 1));
  const offsetToMonday = (firstDay.getUTCDay() + 6) % 7; // Monday => 0
  const firstMondayTime = firstDay.getTime() - offsetToMonday * MS_IN_DAY;
  const targetMidnight = Date.UTC(year, target.getUTCMonth(), target.getUTCDate());
  const diffDays = Math.floor((targetMidnight - firstMondayTime) / MS_IN_DAY);
  const weekIndex = Math.floor(diffDays / 7);
  const normalized = ((weekIndex % 52) + 52) % 52;
  return normalized;
}

function mondayAlignedDayIndex(target: Date): number {
  const utcDay = target.getUTCDay(); // Sunday 0 … Saturday 6
  return (utcDay + 6) % 7; // Monday 0
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["growth", userId],
    queryFn: () => fetchDailyQuestion(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 0,
  });

  const xpTotal = data?.xpTotal ?? 0;
  const levelStats = useMemo(() => computeGrowthLevelStats(xpTotal), [xpTotal]);
  const streakCount = data?.streak ?? 0;
  const wantsTreeAnimation = searchParams?.get("treeAnimation") === "celebration";
  const animationConsumedRef = useRef(false);
  const animationUnlocked = streakCount >= TREE_ANIMATION_UNLOCK_STREAK;
  const [treeAnimationActive, setTreeAnimationActive] = useState(false);
  const [activeFrameIndex, setActiveFrameIndex] = useState(-1);

  const startTreeAnimation = useCallback(() => {
    setTreeAnimationActive(true);
    setActiveFrameIndex(0);
  }, []);

  useEffect(() => {
    if (!data || !wantsTreeAnimation || animationConsumedRef.current || typeof window === "undefined") {
      return;
    }
    if (!animationUnlocked) {
      router.replace("/growth", { scroll: false });
      return;
    }
    animationConsumedRef.current = true;
    const timer = window.setTimeout(() => {
      startTreeAnimation();
    }, 0);
    router.replace("/growth", { scroll: false });
    return () => window.clearTimeout(timer);
  }, [data, wantsTreeAnimation, router, startTreeAnimation, animationUnlocked]);

  useEffect(() => {
    if (!treeAnimationActive || activeFrameIndex < 0 || typeof window === "undefined") {
      return;
    }
    let cancelled = false;
    const frame = TREE_ANIMATION_FRAMES[activeFrameIndex];
    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      if (activeFrameIndex >= TREE_ANIMATION_FRAMES.length - 1) {
        setTreeAnimationActive(false);
        setActiveFrameIndex(-1);
      } else {
        setActiveFrameIndex((prev) => prev + 1);
      }
    }, frame.duration);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [treeAnimationActive, activeFrameIndex]);

  const handleSkipAnimation = useCallback(() => {
    setTreeAnimationActive(false);
    setActiveFrameIndex(-1);
    animationConsumedRef.current = true;
  }, []);

  const activeFrame =
    treeAnimationActive && activeFrameIndex >= 0 ? TREE_ANIMATION_FRAMES[activeFrameIndex] : null;
  const treeTransform =
    animationUnlocked && activeFrame ? activeFrame.transform : "scale(1) translate3d(0,0,0)";
  const treeFocusMode = animationUnlocked && activeFrame ? activeFrame.focusMode : "none";
  const completedDays = data?.weekProgress?.completedDays ?? 0;
  const totalWeekDays = data?.weekProgress?.totalDays ?? 7;
  const focusableDay = Math.min(
    Math.max((completedDays === 0 ? 1 : completedDays) - 1, 0),
    Math.max(totalWeekDays - 1, 0),
  );
  const focusDayIndex = treeFocusMode === "none" ? null : focusableDay;
  const treeTransformDuration = animationUnlocked && activeFrame ? activeFrame.duration : 1000;
  const availableOnDate = data?.availableOn ? new Date(data.availableOn) : new Date();
  const hasValidDate = !Number.isNaN(availableOnDate.getTime());
  const mondayWeekIndex = hasValidDate ? mondayAlignedWeekIndex(availableOnDate) : 0;
  const mondayDayIndex = hasValidDate ? mondayAlignedDayIndex(availableOnDate) : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 px-4 py-16 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Growth</p>
          <h1 className="text-3xl font-semibold">Watch your streak replay</h1>
          <p className="text-sm text-slate-300">
            Every streak day lights up this grid. Each week becomes a new band of color. Come here after writing to watch the
            timeline you’re building.
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
              <div className="relative">
                <div
                  className={`transition-transform ease-[cubic-bezier(0.19,1,0.22,1)] ${
                    treeAnimationActive ? "will-change-transform" : ""
                  }`}
                  style={{
                    transform: treeTransform,
                    transformOrigin: "50% 85%",
                    transitionDuration: `${treeTransformDuration}ms`,
                  }}
                >
                  <StreakReplay
                    streak={streakCount}
                    weekCompletedDays={data?.weekProgress?.completedDays ?? 0}
                    weekTotalDays={data?.weekProgress?.totalDays ?? 7}
                    currentWeekIndex={mondayWeekIndex}
                    dayOfWeekIndex={mondayDayIndex}
                    focusDayIndex={focusDayIndex}
                    focusMode={treeFocusMode}
                  />
                </div>
                {treeAnimationActive && activeFrame ? (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-start gap-3 pt-4">
                    <div className="rounded-full bg-emerald-950/70 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-lg shadow-emerald-900/60">
                      {activeFrame.label}
                    </div>
                    <p className="rounded-2xl bg-black/60 px-4 py-2 text-center text-sm text-emerald-50 shadow-lg shadow-black/40">
                      {activeFrame.description}
                    </p>
                  </div>
                ) : null}
                {treeAnimationActive ? (
                  <button
                    type="button"
                    onClick={handleSkipAnimation}
                    className="pointer-events-auto absolute right-4 top-4 rounded-full border border-emerald-400/40 bg-black/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100 shadow-lg transition hover:bg-black/70"
                  >
                    Skip
                  </button>
                ) : null}
              </div>
              {/* replay handled inside StreakForest */}
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
