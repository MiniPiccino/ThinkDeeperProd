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
const DAYS_PER_WEEK_TOTAL = 7;

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
  const availableOnDate = useMemo(() => {
    const base = data?.availableOn ? new Date(data.availableOn) : new Date();
    if (Number.isNaN(base.getTime())) {
      return new Date();
    }
    return base;
  }, [data]);
  const hasValidDate = !Number.isNaN(availableOnDate.getTime());
  const mondayWeekIndex = hasValidDate ? mondayAlignedWeekIndex(availableOnDate) : 0;
  const mondayDayIndex = hasValidDate ? mondayAlignedDayIndex(availableOnDate) : null;
  const isPremiumUser = Boolean(
    data?.dopamine?.rewardHighlights?.some((highlight) =>
      highlight.title?.toLowerCase().includes("premium"),
    ),
  );
  const todayReflection = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const dateLabel = formatter.format(availableOnDate);
    const snippet = data?.previousFeedback
      ? data.previousFeedback.feedback.split(/Improve:/i)[0].trim()
      : "Your full reflection will appear here once you submit today’s answer.";
    return {
      dateLabel,
      prompt: data?.prompt ?? "Today’s reflection unlocks when the session starts.",
      snippet,
      locked: !data?.previousFeedback,
    };
  }, [availableOnDate, data]);
  const weeklyReflectionSummary = useMemo(() => {
    const total = data?.weekProgress?.totalDays ?? 7;
    const completed = data?.weekProgress?.completedDays ?? 0;
    return Array.from({ length: total }, (_, index) => {
      const captured = index < completed;
      return {
        dayLabel: `Day ${index + 1}`,
        status: captured ? "saved" : "locked",
        description: captured
          ? "Reflection saved. Tap soon to revisit."
          : "Write that day to unlock the entry.",
      };
    });
  }, [data]);
  const teaserReflections = useMemo(
    () => [
      {
        title: "Week 18 · Pattern Interrupts",
        snippet: "A locked glimpse from May. Upgrade to reopen it anytime.",
      },
      {
        title: "Week 09 · Stillness Drill",
        snippet: "Premium unlock shows how your tone shifted mid-March.",
      },
    ],
    [],
  );
  const premiumHighlights = [
    { title: "Timeline view", detail: "Scroll every answer you’ve written, grouped by week and month." },
    { title: "Search + tags", detail: "Filter by emotion, theme, or keyword to find exactly what you wrote." },
    { title: "Insights", detail: "See how your voice evolves (“Your thinking is more analytical this month”)." },
    { title: "Exports & yearly recap", detail: "Download PDFs/CSV or replay your Deep Tree for any year." },
  ];
  const answeredDayIndices = useMemo(() => {
    if (!hasValidDate) {
      return [];
    }
    const clamped = Math.max(Math.min(completedDays, totalWeekDays), 0);
    const startIndex = mondayWeekIndex * DAYS_PER_WEEK_TOTAL;
    return Array.from({ length: clamped }, (_, index) => startIndex + index);
  }, [completedDays, totalWeekDays, mondayWeekIndex, hasValidDate]);

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
                    answeredIndices={answeredDayIndices}
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
                  Back to today&apos;s reflection
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

            <section className="rounded-3xl border border-emerald-400/40 bg-slate-900/40 p-6 text-sm text-slate-100 shadow-2xl">
              <div className="flex flex-col gap-2 border-b border-white/5 pb-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Reflections</p>
                  <h3 className="mt-1 text-2xl font-semibold text-white">Replay what you wrote</h3>
                  <p className="text-sm text-slate-300">
                    Return to today’s words, scan this week’s arc, and unlock your full timeline when you upgrade.
                  </p>
                </div>
                {!isPremiumUser ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-emerald-400/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-50"
                  >
                    Upgrade for unlimited
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-5 shadow-inner">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-emerald-200">
                      <span>Today</span>
                      <span>{todayReflection.dateLabel}</span>
                    </div>
                    <p className="mt-3 text-sm text-emerald-100/80">{todayReflection.prompt}</p>
                    <p className="mt-4 text-base italic text-white">
                      {todayReflection.locked ? "“Your reflection lands here once you finish writing.”" : `“${todayReflection.snippet}”`}
                    </p>
                    <p className="mt-4 text-xs text-emerald-200/70">Auto-saves when you submit.</p>
                  </div>

                  <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-300">
                      <span>This week</span>
                      <span>{data.weekProgress?.completedDays ?? 0}/{data.weekProgress?.totalDays ?? 7} captured</span>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {weeklyReflectionSummary.map((day) => (
                        <li
                          key={day.dayLabel}
                          className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/5 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">{day.dayLabel}</p>
                            <p className="text-xs text-slate-300">{day.description}</p>
                          </div>
                          <span
                            className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                              day.status === "saved"
                                ? "bg-emerald-500/20 text-emerald-200"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {day.status === "saved" ? "Saved" : "Locked"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700/60 bg-slate-950/30 p-5">
                  {isPremiumUser ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Timeline</p>
                        <p className="mt-2 text-lg font-semibold text-white">Every reflection, searchable.</p>
                        <p className="text-sm text-slate-300">
                          Scroll your entire archive, filter by tags, and pin insights as you grow.
                        </p>
                      </div>
                      <div className="space-y-3">
                        {premiumHighlights.map((item) => (
                          <div key={item.title} className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                            <p className="text-sm font-semibold text-white">{item.title}</p>
                            <p className="text-xs text-emerald-100/80">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Earlier glimpses</p>
                        <div className="mt-3 space-y-3">
                          {teaserReflections.map((teaser) => (
                            <div key={teaser.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <p className="text-sm font-semibold text-white">{teaser.title}</p>
                              <p className="mt-1 text-xs text-slate-300">{teaser.snippet}</p>
                              <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                                Locked
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                        <p className="text-sm font-semibold text-white">Premium unlocks</p>
                        <ul className="text-xs text-emerald-100/80">
                          {premiumHighlights.map((item) => (
                            <li key={item.title} className="mt-1">
                              <span className="font-semibold">{item.title}:</span> {item.detail}
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className="mt-3 w-full rounded-full bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
                        >
                          Unlock reflections
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 md:gap-3">
        <FloatingAction href="/" label="Back to reflection" />
        <FloatingAction href="/focus-tools" label="Focus tools" />
        <FloatingAction href="/why" label="Why Deep" variant="ghost" />
      </div>
    </main>
  );
}
