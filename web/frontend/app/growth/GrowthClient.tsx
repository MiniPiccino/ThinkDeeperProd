'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { StreakReplay } from "@/components/StreakTree";
import { FloatingAction } from "@/components/FloatingAction";
import { createCheckoutSession, fetchDailyQuestion, fetchReflectionHistory, fetchReflectionOverview } from "@/lib/api";
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

type LevelBadgeSpec = {
  level: number;
  name: string;
  icon: string;
  description: string;
  gradient: string;
};

type ThemeBadgeSpec = {
  name: string;
  icon: string;
  description: string;
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

const LEVEL_BADGES: LevelBadgeSpec[] = [
  { level: 1, name: "Seeker", icon: "🌱", description: "Starting to notice your mind’s patterns.", gradient: "from-emerald-600/80 to-emerald-400/50" },
  { level: 5, name: "Reflector", icon: "💧", description: "Reflection is becoming a daily rhythm.", gradient: "from-sky-600/80 to-cyan-400/60" },
  { level: 10, name: "Thinker", icon: "🌿", description: "Your thoughts are branching into nuance.", gradient: "from-emerald-600/80 to-lime-400/60" },
  { level: 15, name: "Observer", icon: "👁️", description: "Calm awareness anchors your sessions.", gradient: "from-indigo-600/80 to-sky-400/60" },
  { level: 20, name: "Mind Gardener", icon: "🌳", description: "You tend ideas patiently, letting them bloom.", gradient: "from-emerald-700/80 to-amber-400/60" },
  { level: 25, name: "Insight Bearer", icon: "✨", description: "Insight shows up reliably; you hold space for it.", gradient: "from-amber-500/80 to-yellow-300/60" },
  { level: 30, name: "Inner Explorer", icon: "🌀", description: "You venture into the edges of your thinking.", gradient: "from-purple-600/80 to-cyan-400/60" },
  { level: 40, name: "Awakened Mind", icon: "🌙", description: "Presence is steady—even under pressure.", gradient: "from-slate-700/80 to-amber-300/60" },
  { level: 50, name: "Deep Master", icon: "🔷", description: "Mastery unlocked. Your practice is elemental.", gradient: "from-emerald-800/80 to-emerald-400/60" },
];

const THEME_BADGES: Record<string, ThemeBadgeSpec> = {
  "stoic mind": { name: "Stoic Leaf", icon: "🌿", description: "Calm resilience under thought." },
  consciousness: { name: "Awareness Orb", icon: "👁️‍🗨️", description: "You kept attention wide and present." },
  "time & mortality": { name: "Hourglass Bloom", icon: "⏳", description: "You honored impermanence with focus." },
  curiosity: { name: "Curiosity Spark", icon: "💡", description: "You kept asking past the first answer." },
  "truth and lies": { name: "Truth Gem", icon: "🔷", description: "You separated signal from noise all week." },
  "technology & humanity": { name: "Circuit Heart", icon: "💛", description: "You balanced code and care." },
  empathy: { name: "Heart Wave", icon: "💗", description: "You stayed soft while thinking hard." },
  creativity: { name: "Muse Brush", icon: "🎨", description: "You painted with ideas in motion." },
  society: { name: "Balance Scales", icon: "⚖️", description: "You held tension between self and system." },
  "power & corruption": { name: "Broken Crown", icon: "👑", description: "You saw power clearly and stayed honest." },
  death: { name: "Lantern of Souls", icon: "🏮", description: "You sat with endings and found light." },
  "new year": { name: "Renewal Flame", icon: "✨", description: "You tended the spark for the next chapter." },
};

function mondayAlignedWeekIndex(target: Date): number {
  const year = target.getFullYear();
  const firstDay = new Date(year, 0, 1);
  const offsetToMonday = (firstDay.getDay() + 6) % 7; // Monday => 0
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() - offsetToMonday);
  firstMonday.setHours(0, 0, 0, 0);

  const targetMidnight = new Date(target);
  targetMidnight.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((targetMidnight.getTime() - firstMonday.getTime()) / MS_IN_DAY);
  const weekIndex = Math.floor(diffDays / 7);
  const normalized = ((weekIndex % 52) + 52) % 52;
  return normalized;
}

function mondayAlignedDayIndex(target: Date): number {
  const localDay = target.getDay(); // Sunday 0 … Saturday 6
  return (localDay + 6) % 7; // Monday 0
}

function computeStreakFromDates(dates: string[], today: Date): number {
  if (!dates || dates.length === 0) {
    return 0;
  }
  const parsed = dates
    .map((iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      return d;
    })
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => b.getTime() - a.getTime());
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  let streak = 0;
  let cursor = todayMidnight.getTime();
  for (const date of parsed) {
    const diffDays = Math.round((cursor - date.getTime()) / MS_IN_DAY);
    if (diffDays === 0 || diffDays === 1) {
      streak += 1;
      cursor = date.getTime();
    } else if (diffDays > 1) {
      break;
    }
  }
  return streak;
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

function resolveLevelBadge(level: number) {
  let current = LEVEL_BADGES[0];
  let next: LevelBadgeSpec | null = null;
  for (const badge of LEVEL_BADGES) {
    if (level >= badge.level) {
      current = badge;
      continue;
    }
    next = badge;
    break;
  }
  return { current, next };
}

function normalizeThemeKey(theme: string): string {
  const parts = theme.split("—").map((part) => part.trim()).filter(Boolean);
  const base = parts[parts.length - 1] ?? theme;
  return base.toLowerCase();
}

function resolveThemeBadge(theme: string | undefined | null): ThemeBadgeSpec {
  if (!theme) {
    return { name: "Insight Badge", icon: "✨", description: "Finish this week to claim the chapter badge." };
  }
  const normalized = normalizeThemeKey(theme);
  return THEME_BADGES[normalized] ?? {
    name: `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} Insight`,
    icon: "✨",
    description: "Finish this chapter to lock in the badge.",
  };
}

type BadgePillProps = {
  title: string;
  icon: string;
  description: string;
  tone: "active" | "muted";
};

function BadgePill({ title, icon, description, tone }: BadgePillProps) {
  const border = tone === "active" ? "border-emerald-300/40" : "border-white/10";
  const bg =
    tone === "active"
      ? "bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-emerald-700/20"
      : "bg-slate-900/50";
  return (
    <div className={`flex flex-col gap-1.5 rounded-xl border ${border} ${bg} p-3 sm:p-4`}>
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-emerald-200 sm:text-xs">
        <span>{icon}</span>
        <span className="whitespace-normal leading-snug">{title}</span>
      </div>
      <p className="text-xs leading-relaxed text-emerald-50 sm:text-sm">{description}</p>
    </div>
  );
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

  const {
    data: reflectionData,
    isLoading: reflectionsLoading,
    isError: reflectionsError,
  } = useQuery({
    queryKey: ["reflections", userId],
    queryFn: () => fetchReflectionOverview(userId ?? "", new Date().getTimezoneOffset()),
    enabled: Boolean(userId),
    staleTime: 0,
    retry: false,
  });
  const {
    data: reflectionHistory,
    isLoading: historyLoading,
    isError: historyError,
  } = useQuery({
    queryKey: ["reflection-history", userId],
    queryFn: () => fetchReflectionHistory(userId ?? "", 50),
    enabled: Boolean(userId && reflectionData?.timelineUnlocked),
    staleTime: 0,
    retry: false,
  });
  const xpTotal = data?.xpTotal ?? 0;
  const levelStats = useMemo(() => computeGrowthLevelStats(xpTotal), [xpTotal]);
  const wantsTreeAnimation = searchParams?.get("treeAnimation") === "celebration";
  const planStatus = searchParams?.get("plan");
  const animationConsumedRef = useRef(false);
  const [treeAnimationActive, setTreeAnimationActive] = useState(false);
  const [activeFrameIndex, setActiveFrameIndex] = useState(-1);
  const [timelineFilter, setTimelineFilter] = useState("");
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const weeklyCatalogRef = useRef<HTMLDivElement | null>(null);
  const [weeklyCatalogHeight, setWeeklyCatalogHeight] = useState(0);
  const [weeklyCatalogOpen, setWeeklyCatalogOpen] = useState(false);
  const handleScrollToReplay = useCallback(() => {
    if (typeof window === "undefined") return;
    const target = document.getElementById("growth-streak-replay");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);
  const availableOnDate = useMemo(() => {
    const base = data?.availableOn ? new Date(data.availableOn) : new Date();
    if (Number.isNaN(base.getTime())) {
      return new Date();
    }
    return base;
  }, [data]);
  const answeredDates =
    reflectionData?.answeredDates ??
    reflectionData?.week?.filter((day) => day.hasEntry).map((day) => day.date) ??
    [];
  const streakCount = useMemo(() => {
    return computeStreakFromDates(
      answeredDates,
      availableOnDate,
    );
  }, [answeredDates, availableOnDate]);
  const hasAnsweredToday = Boolean(data?.hasAnsweredToday);
  const animationUnlocked = streakCount >= TREE_ANIMATION_UNLOCK_STREAK;

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
    return () => {
      window.clearTimeout(timer);
    };
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
  const hasValidDate = !Number.isNaN(availableOnDate.getTime());
  const mondayWeekIndex = hasValidDate ? mondayAlignedWeekIndex(availableOnDate) : 0;
  const mondayDayIndex = hasValidDate ? mondayAlignedDayIndex(availableOnDate) : null;
  const reflectionPlan = reflectionData?.plan ?? "free";
  const timelineUnlocked = reflectionData?.timelineUnlocked ?? reflectionPlan === "premium";
  const isPremiumUser = timelineUnlocked;
  const todayReflectionEntry = reflectionData?.today ?? null;
  const todayLocked = reflectionData?.todayLocked ?? !todayReflectionEntry;
  const todayTeasers = reflectionData?.teasers ?? [];
  const weeklyBadgeCatalog = useMemo(
    () =>
      Array.from({ length: 52 }, (_, index) => ({
        id: `week-${index + 1}`,
        label: `Week ${index + 1}`,
        description: `Complete every reflection in week ${index + 1} to earn this badge.`,
        weekIndex: index,
      })),
    [],
  );
  const todayLocalDate = useMemo(() => {
    if (todayReflectionEntry?.answeredAt) {
      const parsed = new Date(todayReflectionEntry.answeredAt);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return availableOnDate;
  }, [todayReflectionEntry, availableOnDate]);
  const todayDateLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(todayLocalDate);
  }, [todayLocalDate]);
  const todayPromptText = todayReflectionEntry?.prompt ?? data?.prompt ?? "Today’s reflection unlocks when the session starts.";
  const todayAnswerText = todayReflectionEntry?.answer?.trim();
  const todayExcerpt = todayReflectionEntry?.excerpt?.trim();
  const todayDisplayText = todayAnswerText || todayExcerpt || "Reflection saved.";
  const todayDurationLabel = todayReflectionEntry
    ? todayReflectionEntry.durationSeconds >= 60
      ? `${(todayReflectionEntry.durationSeconds / 60).toFixed(1)} min`
      : `${todayReflectionEntry.durationSeconds}s`
    : "";
  const todayDateKey = todayLocalDate.toDateString();
  const showReflectionLoading = Boolean(userId && reflectionsLoading && !reflectionData);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const upgradeDisabled = !userId || upgradeLoading;
  const upgradeNotice = useMemo(() => {
    if (planStatus === "premium") {
      return { tone: "success", text: "Upgrade complete. Premium unlocked." };
    }
    if (planStatus === "free") {
      return { tone: "muted", text: "Checkout cancelled. You’re still on free." };
    }
    return null;
  }, [planStatus]);
  const fallbackWeeklySummary = useMemo(() => {
    const total = data?.weekProgress?.totalDays ?? 7;
    const startOfWeek = new Date(todayLocalDate);
    const dayIndex = (startOfWeek.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - dayIndex);
    return Array.from({ length: total }, (_, index) => {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + index);
      return {
        date: dayDate.toISOString(),
        weekday: dayDate.toLocaleDateString(undefined, { weekday: "long" }),
        hasEntry: false,
        entry: null,
      };
    });
  }, [todayLocalDate, data]);
  const weeklyReflectionSummary = reflectionData?.week ?? fallbackWeeklySummary;
  const premiumHighlights = [
    { title: "Timeline view", detail: "Scroll every answer you’ve written, grouped by week and month." },
    { title: "Search + tags", detail: "Filter by emotion, theme, or keyword to find exactly what you wrote." },
    { title: "Insights", detail: "See how your voice evolves (“Your thinking is more analytical this month”)." },
    { title: "Exports & yearly recap", detail: "Download PDFs/CSV or replay your Deep Tree for any year." },
  ];
  const timelineEntries = useMemo(() => {
    const base =
      reflectionHistory && reflectionHistory.length > 0
        ? reflectionHistory
        : weeklyReflectionSummary
            .filter((day) => day.hasEntry && day.entry)
            .map((day) => ({
              answeredAt: day.entry!.answeredAt,
              prompt: day.entry!.prompt,
              theme: day.entry!.theme,
              questionId: day.entry!.questionId,
              excerpt: day.entry!.excerpt ?? "Reflection saved.",
              xpAwarded: day.entry!.xpAwarded ?? 0,
              durationSeconds: day.entry!.durationSeconds ?? 0,
            }));
    const sorted = [...base].sort((a, b) => {
      const xpDelta = (b.xpAwarded ?? 0) - (a.xpAwarded ?? 0);
      const timeDelta = new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime();
      return xpDelta !== 0 ? xpDelta : timeDelta;
    });
    return sorted;
  }, [reflectionHistory, weeklyReflectionSummary]);
  const filteredTimeline = useMemo(() => {
    const term = timelineFilter.trim().toLowerCase();
    let list = timelineEntries;
    if (term.length > 0) {
      list = list.filter(
        (entry) =>
          entry.prompt.toLowerCase().includes(term) ||
          entry.theme.toLowerCase().includes(term) ||
          (entry.excerpt ?? "").toLowerCase().includes(term),
      );
    }
    if (!showAllTimeline) {
      return list.slice(0, 3);
    }
    return list;
  }, [timelineEntries, timelineFilter, showAllTimeline]);
  const reflectionAnsweredIndices = useMemo(() => {
    const fromAnsweredDates =
      timelineUnlocked && reflectionData?.answeredDates?.length
        ? reflectionData.answeredDates
            .map((iso) => {
              const parsed = new Date(iso);
              if (Number.isNaN(parsed.getTime())) return null;
              const weekIdx = mondayAlignedWeekIndex(parsed);
              const dayIdx = mondayAlignedDayIndex(parsed);
              return weekIdx * DAYS_PER_WEEK_TOTAL + dayIdx;
            })
            .filter((value): value is number => value !== null)
        : [];
    if (fromAnsweredDates.length > 0) {
      return fromAnsweredDates;
    }

    const indicesFromWeek =
      reflectionData?.week && reflectionData.week.length > 0
        ? reflectionData.week
            .map((day) => {
              if (!day.hasEntry) {
                return null;
              }
              const parsed = new Date(day.date);
              if (Number.isNaN(parsed.getTime())) {
                return null;
              }
              const weekIdx = mondayAlignedWeekIndex(parsed);
              const dayIdx = mondayAlignedDayIndex(parsed);
              return weekIdx * DAYS_PER_WEEK_TOTAL + dayIdx;
            })
            .filter((value): value is number => value !== null)
        : [];
    if (indicesFromWeek.length > 0) {
      return indicesFromWeek;
    }

    if (!hasValidDate || streakCount <= 0) {
      return [];
    }
    const baseDate = new Date(availableOnDate);
    if (!hasAnsweredToday) {
      baseDate.setDate(baseDate.getDate() - 1);
    }
    const indices = Array.from({ length: streakCount }, (_, index) => {
      const day = new Date(baseDate);
      day.setDate(baseDate.getDate() - index);
      const weekIdx = mondayAlignedWeekIndex(day);
      const dayIdx = mondayAlignedDayIndex(day);
      return weekIdx * DAYS_PER_WEEK_TOTAL + dayIdx;
    });
    return indices;
  }, [
    timelineUnlocked,
    reflectionData?.answeredDates,
    reflectionData?.week,
    hasValidDate,
    streakCount,
    availableOnDate,
    hasAnsweredToday,
  ]);
  const { current: levelBadge, next: nextLevelBadge } = resolveLevelBadge(levelStats.level);
  const weeklyBadge = resolveThemeBadge(data?.theme);
  const nextThemeBadge = resolveThemeBadge(data?.nextTheme);
  const remainingWeekDays = Math.max((data?.weekProgress?.totalDays ?? 7) - (data?.weekProgress?.completedDays ?? 0), 0);
  const weekBadgeEarned = Boolean(data?.weekProgress?.badgeEarned);
  const weeklyBadgeStates = useMemo(() => {
    const answeredDaysByWeek = new Map<number, Set<number>>();
    (reflectionData?.answeredDates ?? []).forEach((iso) => {
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) return;
      const weekIdx = mondayAlignedWeekIndex(parsed);
      const dayIdx = mondayAlignedDayIndex(parsed);
      if (!answeredDaysByWeek.has(weekIdx)) {
        answeredDaysByWeek.set(weekIdx, new Set());
      }
      answeredDaysByWeek.get(weekIdx)?.add(dayIdx);
    });
    const earnedWeeks = new Set<number>();
    answeredDaysByWeek.forEach((days, weekIdx) => {
      if (days.size >= DAYS_PER_WEEK_TOTAL) {
        earnedWeeks.add(weekIdx);
      }
    });
    if (weekBadgeEarned) {
      earnedWeeks.add(mondayWeekIndex);
    }
    const completed = Math.min(data?.weekProgress?.completedDays ?? 0, data?.weekProgress?.totalDays ?? 7);
    const totalDays = data?.weekProgress?.totalDays ?? 7;
    const progressPercent = Math.round((completed / Math.max(totalDays, 1)) * 100);
    const catalog = weeklyBadgeCatalog.map((badge) => {
      const status = earnedWeeks.has(badge.weekIndex)
        ? "earned"
        : badge.weekIndex === mondayWeekIndex
          ? "active"
          : "locked";
      const supportingText =
        status === "earned"
          ? "Unlocked—saved to your Deep Tree."
          : status === "active"
            ? remainingWeekDays === 0
              ? "Submitting…"
              : `${remainingWeekDays} day${remainingWeekDays === 1 ? "" : "s"} left this week.`
            : "Opens when you reach this week.";
      const title = status === "locked" ? `${badge.label} — Locked` : `${badge.label} Badge`;
      return { ...badge, status, supportingText, title };
    });
    return { catalog, earnedCount: earnedWeeks.size, progressPercent, completed, totalDays };
  }, [
    reflectionData?.answeredDates,
    weekBadgeEarned,
    mondayWeekIndex,
    weeklyBadgeCatalog,
    data?.weekProgress?.completedDays,
    data?.weekProgress?.totalDays,
    remainingWeekDays,
  ]);
  useEffect(() => {
    if (!weeklyCatalogRef.current) {
      return;
    }
    const measure = () => {
      if (!weeklyCatalogRef.current) return;
      setWeeklyCatalogHeight(weeklyCatalogRef.current.scrollHeight);
    };
    measure();
    if (!weeklyCatalogOpen) {
      return;
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [weeklyBadgeStates.catalog, weeklyCatalogOpen]);
  const themeLabel = useMemo(() => {
    if (!data?.theme) return "this chapter";
    const parts = data.theme.split("—").map((part) => part.trim()).filter(Boolean);
    return parts[parts.length - 1] || data.theme;
  }, [data?.theme]);

  const coachTips = useMemo(() => {
    const streakLine =
      streakCount >= 3
        ? `You’re on a ${streakCount}-day streak—write one line about how today felt different.`
        : "Name how you feel before you start; use that emotion as your first sentence.";
    const themeLine = `Link every point back to “${themeLabel}” so the chapter feels cohesive.`;
    const exampleLine = "Anchor each claim with a personal example (who/what/when) before moving on.";
    const closeLine = `Close with a one-line takeaway for tomorrow. Level ${levelStats.level} climbs faster when you keep it sharp.`;
    return [streakLine, themeLine, exampleLine, closeLine];
  }, [streakCount, themeLabel, levelStats.level]);

  const handleUpgrade = useCallback(async () => {
    if (!userId || !reflectionData) {
      setUpgradeError(null);
      setShowAuthPrompt(true);
      return;
    }
    setUpgradeError(null);
    setUpgradeLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const successUrl = origin ? `${origin}/growth?plan=premium` : undefined;
      const cancelUrl = origin ? `${origin}/growth?plan=free` : undefined;
      const response = await createCheckoutSession(userId, successUrl, cancelUrl);
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      } else {
        setUpgradeError("Could not start checkout. Try again.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start checkout.";
      setUpgradeError(message);
    } finally {
      setUpgradeLoading(false);
    }
  }, [userId]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 px-4 py-12 text-slate-100 lg:py-10">
      {showAuthPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-400/40 bg-slate-950/90 p-5 text-sm shadow-2xl">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Sign in required</p>
            <h4 className="mt-2 text-lg font-semibold text-white">Log in to upgrade</h4>
            <p className="mt-2 text-slate-200">
              You’ll need to sign in so we can attach premium to your account before checkout.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500"
                onClick={() => setShowAuthPrompt(false)}
              >
                Go sign in
              </Link>
              <button
                type="button"
                onClick={() => setShowAuthPrompt(false)}
                className="inline-flex items-center justify-center rounded-full border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-16">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Growth</p>
          <h1 className="text-3xl font-semibold">Watch your streak replay</h1>
          <p className="text-sm text-slate-300">
            Every streak day lights up this grid. Each week becomes a new band of color. Come here after writing to watch the
            timeline you’re building.
          </p>
          {upgradeNotice ? (
            <div
              className={`mx-auto mt-3 max-w-md rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                upgradeNotice.tone === "success"
                  ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/50"
                  : "bg-slate-800/60 text-slate-200 border border-slate-600/60"
              }`}
            >
              {upgradeNotice.text}
            </div>
          ) : null}
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
            <section
              id="growth-streak-replay"
              className="rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 p-6 shadow-2xl"
            >
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
                    answeredIndices={reflectionAnsweredIndices}
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

            <section className="overflow-hidden rounded-3xl border border-emerald-400/40 bg-slate-900/60 p-4 text-sm text-slate-100 shadow-2xl sm:p-6">
              <div className="space-y-2 text-center px-1 sm:px-2">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">Badges</p>
                <h3 className="text-lg font-semibold text-white sm:text-2xl">Calm milestones</h3>
                <p className="text-sm text-slate-300">
                  The dropdown is a slow reveal—badges fade in, earned weeks glow, and the whole year shows up at once without the
                  cheap fireworks.
                </p>
              </div>
              <div className="mt-6 grid gap-4 sm:gap-5 lg:grid-cols-[1.08fr,1fr]">
                <div className="space-y-4">
                  <div className="relative mx-auto w-full max-w-[22rem] overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-black/60 to-emerald-950/60 p-4 shadow-inner sm:p-5 lg:mx-0 lg:max-w-none">
                    <div className="absolute left-4 top-4 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-100">
                      Card 1 · Level badge + XP
                    </div>
                    <div
                      className={`absolute inset-x-3 top-12 h-20 rounded-full bg-gradient-to-r ${levelBadge.gradient} blur-3xl opacity-25 sm:inset-x-8 sm:h-32`}
                      aria-hidden
                      style={{ animation: "pulse 3s ease-in-out infinite" }}
                    />
                    <div className="relative mt-10 flex flex-col items-center gap-3 rounded-xl border border-emerald-400/30 bg-white/5 px-3 py-4 text-center backdrop-blur sm:px-4 sm:py-5">
                      <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] uppercase tracking-[0.3em] text-emerald-200 sm:text-[11px]">
                        <span>{levelBadge.icon}</span>
                        <span>Level Badge</span>
                      </div>
                      <p className="text-lg font-semibold text-white sm:text-xl">{levelBadge.name}</p>
                      <p className="text-xs text-emerald-100/80 sm:max-w-md sm:text-sm leading-relaxed text-center">{levelBadge.description}</p>
                      <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-100 sm:text-[11px]">
                        <span>Level {levelStats.level}</span>
                        <span className="text-emerald-200/80">·</span>
                        <span>{levelStats.xpIntoLevel}/{GROWTH_XP_PER_LEVEL} XP in</span>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-emerald-950/70">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                          style={{ width: `${Math.min(levelStats.progressPercent, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-emerald-100/80">
                        Next badge{nextLevelBadge ? ` (${nextLevelBadge.name})` : ""} in {Math.max(levelStats.xpToNextLevel, 0)} XP.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-emerald-200/25 bg-white/5 p-4 shadow-inner sm:p-5">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-emerald-200">
                      <span>Card 4 · Yearly recap</span>
                      <button
                        type="button"
                        onClick={handleScrollToReplay}
                        className="rounded-full border border-emerald-300/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:border-emerald-200 hover:text-white"
                      >
                        Replay
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">
                      Preview the calm yearly rewind concept. Tap replay to jump to the streak animation card above.
                    </p>
                  </div>
                </div>

                <div className="mx-auto w-full max-w-[22rem] rounded-2xl border border-white/5 bg-slate-950/60 p-4 shadow-inner sm:max-w-[24rem] sm:p-5 lg:mx-0 lg:max-w-none">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-200 sm:text-xs">Card 3 · Weekly badges</p>
                      <h4 className="text-lg font-semibold text-white sm:text-xl">Dropdown moment</h4>
                      <p className="text-sm text-slate-300">
                        Full 52-week catalog lives here. Locked badges stay outlined; earned ones glow softly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWeeklyCatalogOpen((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-50 transition hover:border-emerald-200 hover:text-white"
                      aria-expanded={weeklyCatalogOpen}
                    >
                      {weeklyCatalogOpen ? "Hide dropdown" : "Open dropdown"}
                      <span className={`transition-transform ${weeklyCatalogOpen ? "rotate-180" : ""}`} aria-hidden>
                        ˅
                      </span>
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <BadgePill
                      title={`This week · ${weeklyBadge.name}`}
                      icon={weeklyBadge.icon}
                      description={
                        weekBadgeEarned
                          ? "Badge unlocked and saved."
                          : remainingWeekDays === 0
                            ? "Claiming…"
                            : `${remainingWeekDays} day${remainingWeekDays === 1 ? "" : "s"} left to unlock.`
                      }
                      tone="active"
                    />
                    <BadgePill
                      title={`Next chapter · ${nextThemeBadge.name}`}
                      icon={nextThemeBadge.icon}
                      description="Preview of the badge arriving with the next theme."
                      tone="muted"
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-950/70">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-emerald-200 to-cyan-300 transition-all duration-500"
                        style={{ width: `${Math.min(weeklyBadgeStates.progressPercent, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-emerald-100/80">
                      {weeklyBadgeStates.completed}/{weeklyBadgeStates.totalDays} days
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-emerald-200/80">
                    Tap the dropdown to watch badges fade in—locked outlines, earned glow, progress front and center.
                  </p>
                  <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 shadow-inner">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">Full catalog (52)</div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-100">
                        <span>{weeklyBadgeStates.earnedCount} earned</span>
                        <span className="text-emerald-100/70">·</span>
                        <span>{weeklyBadgeStates.progressPercent}% this week</span>
                      </div>
                    </div>
                    <div
                      className="transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{
                        maxHeight: weeklyCatalogOpen
                          ? Math.max(weeklyCatalogHeight, weeklyBadgeStates.catalog.length * 38) + 24
                          : 0,
                        opacity: weeklyCatalogOpen ? 1 : 0,
                        transform: weeklyCatalogOpen ? "translateY(0px)" : "translateY(-8px)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        ref={weeklyCatalogRef}
                        className="mt-3 grid grid-cols-2 gap-2 pr-1 sm:grid-cols-3"
                      >
                        {weeklyBadgeStates.catalog.map((badge, index) => {
                          const isEarned = badge.status === "earned";
                          const isActive = badge.status === "active";
                          const tone =
                            isEarned
                              ? "border-emerald-300/60 bg-gradient-to-br from-emerald-600/15 via-emerald-500/10 to-cyan-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_16px_40px_-28px_rgba(16,185,129,0.7)]"
                              : isActive
                                ? "border-emerald-300/40 bg-emerald-500/10"
                                : "border-dashed border-emerald-100/20 bg-white/5 opacity-70";
                          const labelTone = isEarned ? "text-emerald-50" : isActive ? "text-emerald-100/80" : "text-emerald-100/70";
                          const supportingTone = isEarned ? "text-emerald-100/80" : "text-emerald-100/60";
                          return (
                            <div
                              key={badge.id}
                              className={`rounded-lg border px-3 py-2 transition duration-700 ${tone}`}
                              style={{ transitionDelay: weeklyCatalogOpen ? `${index * 8}ms` : "0ms" }}
                            >
                              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em]">
                                <span className={labelTone}>{badge.label}</span>
                                <span className={supportingTone}>
                                  {isEarned ? "Earned" : isActive ? "In progress" : "Locked"}
                                </span>
                              </div>
                              <p className={`mt-1 text-sm font-semibold ${isEarned ? "text-white" : "text-emerald-50/80"}`}>
                                {badge.title}
                              </p>
                              {isEarned ? (
                                <p className="text-[11px] text-emerald-100/80">{badge.description}</p>
                              ) : (
                                <p className="text-[11px] text-emerald-100/60">{badge.supportingText}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {!weeklyCatalogOpen ? (
                      <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-emerald-200">
                        Tap to reveal the whole year
                      </p>
                    ) : null}
                  </div>
                </div>
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
                    Return to today’s words, scan this week’s chapter, and unlock your full timeline when you upgrade.
                  </p>
                  {reflectionsError ? (
                    <p className="mt-2 text-xs text-red-300">Couldn’t load your reflections. Showing placeholders.</p>
                  ) : null}
                </div>
                {!isPremiumUser ? (
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={upgradeLoading}
                    className="inline-flex items-center justify-center rounded-full border border-emerald-400/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {upgradeLoading ? "Connecting…" : "Upgrade for unlimited"}
                  </button>
                ) : null}
              </div>
              {upgradeError ? <p className="mt-2 text-xs text-red-300">{upgradeError}</p> : null}

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4 shadow-inner sm:p-5">
                    <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.28em] text-emerald-200 sm:text-xs">
                      <span>Today</span>
                      <span className="text-right text-emerald-50">{todayDateLabel}</span>
                    </div>
                    <p className="mt-3 text-sm text-emerald-100/80 leading-relaxed">{todayPromptText}</p>
                    {showReflectionLoading ? (
                      <p className="mt-4 text-sm text-emerald-200/70">Linking today’s reflection…</p>
                    ) : todayLocked ? (
                      <p className="mt-4 text-base italic text-white">
                        “Your reflection lands here once you finish writing.”
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3 text-sm text-white">
                        <p className="whitespace-pre-line leading-relaxed">{todayDisplayText}</p>
                        {todayReflectionEntry ? (
                          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
                            +{todayReflectionEntry.xpAwarded} XP · {todayDurationLabel} focused
                          </p>
                        ) : null}
                      </div>
                    )}
                    <p className="mt-4 text-xs text-emerald-200/70">Auto-saves when you submit.</p>
                  </div>

                  <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-300">
                      <span>This week</span>
                      <span>
                        {weeklyReflectionSummary.filter((day) => day.hasEntry).length}/{weeklyReflectionSummary.length} captured
                      </span>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {weeklyReflectionSummary.map((day, idx) => {
                        const hasEntry = day.hasEntry;
                        const summaryDate = new Date(day.date);
                        const label = day.weekday || `Day ${idx + 1}`;
                        const isToday = summaryDate.toDateString() === todayDateKey;
                        const canShowEntry = isPremiumUser || isToday;
                        const description = hasEntry
                          ? canShowEntry && day.entry?.excerpt
                            ? day.entry.excerpt
                            : "Reflection saved."
                          : "Write that day to unlock the entry.";
                        const statusLabel = hasEntry ? (canShowEntry ? "Saved" : "Locked") : "Locked";
                        return (
                          <li
                            key={`${day.date}-${idx}`}
                            className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/5 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">{label}</p>
                              <p className="text-xs text-slate-400">
                                {summaryDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </p>
                            <p className="text-xs text-slate-300">{description}</p>
                          </div>
                          <span
                            className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                              hasEntry
                                ? "bg-emerald-500/20 text-emerald-200"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </li>
                        );
                      })}
                    </ul>
                  </div>

                  {isPremiumUser ? (
                    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4 shadow-inner sm:p-5">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-emerald-200 sm:text-xs">
                        <span>AI coach</span>
                        <span className="text-emerald-100/80">Premium</span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-white">How to write stronger reflections</p>
                      <p className="mt-1 text-sm text-emerald-100/80">
                        Use these micro-prompts to deepen answers and earn richer feedback.
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-emerald-50">
                        {coachTips.map((tip) => (
                          <li key={tip} className="rounded-xl border border-emerald-400/20 bg-white/5 px-3 py-2 text-left text-emerald-50">
                            {tip}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs text-emerald-200/80">
                        Tip: Pick one prompt per session—don’t overstuff. Depth beats length.
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-700/60 bg-slate-950/30 p-5">
                  {isPremiumUser ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Premium timeline</p>
                        <p className="mt-2 text-lg font-semibold text-white">Every reflection, searchable.</p>
                        <p className="text-sm text-slate-300">
                          Scroll your entire archive, filter by tags, pin insights, and replay your Deep Tree.
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] uppercase tracking-[0.25em] text-emerald-200">
                          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
                            <p className="text-emerald-100/70">Reflections saved</p>
                            <p className="text-base font-semibold text-white">{timelineEntries.length}</p>
                          </div>
                          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
                            <p className="text-emerald-100/70">Active streak</p>
                            <p className="text-base font-semibold text-white">{streakCount} days</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {premiumHighlights.map((item) => (
                          <div key={item.title} className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                            <p className="text-sm font-semibold text-white">{item.title}</p>
                            <p className="text-xs text-emerald-100/80">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-emerald-200">
                          <span>Latest reflections</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="search"
                              value={timelineFilter}
                              onChange={(event) => setTimelineFilter(event.target.value)}
                              placeholder="Filter by keyword"
                              className="w-40 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-emerald-50 placeholder:text-emerald-200/60 focus:border-emerald-300 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAllTimeline((prev) => !prev)}
                              className="rounded-full border border-emerald-400/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-50 transition hover:border-emerald-200 hover:text-white"
                            >
                              {showAllTimeline ? "Top highlights" : "Show more"}
                            </button>
                            {historyLoading ? <span className="text-emerald-100/70">Loading…</span> : null}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {filteredTimeline.map((entry) => (
                            <div key={entry.questionId + entry.answeredAt} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-emerald-200">
                                <span>{new Date(entry.answeredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                                <span className="text-emerald-100/80">+{entry.xpAwarded} XP</span>
                              </div>
                              <p className="mt-1 text-sm font-semibold text-white">{entry.prompt}</p>
                              <p className="text-xs text-emerald-100/80">{entry.theme}</p>
                              <p className="mt-1 text-xs text-slate-200 leading-relaxed">{entry.excerpt}</p>
                            </div>
                          ))}
                          {historyLoading || filteredTimeline.length === 0 ? (
                            <p className="text-xs text-slate-400">
                              {historyError ? "Timeline is warming up—try again soon." : "Write more to populate your timeline."}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Earlier glimpses</p>
                        <div className="mt-3 space-y-3">
                          {todayTeasers.length === 0 ? (
                            <p className="text-xs text-slate-400">Unlock premium to browse your earlier reflections.</p>
                          ) : null}
                          {todayTeasers.map((teaser) => (
                            <div key={teaser.questionId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <p className="text-sm font-semibold text-white">{teaser.prompt}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {new Date(teaser.answeredAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                              <p className="mt-1 text-xs text-slate-300">{teaser.snippet}</p>
                              <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                                Locked
                              </p>
                            </div>
                          ))}
                          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">What premium adds</p>
                            <div className="mt-2 space-y-2">
                              {premiumHighlights.map((item) => (
                                <div key={item.title} className="rounded-xl border border-emerald-400/15 bg-white/5 px-3 py-2">
                                  <p className="text-sm font-semibold text-white">{item.title}</p>
                                  <p className="text-xs text-emerald-100/80">{item.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>
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
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 md:gap-3 lg:hidden">
        <FloatingAction href="/" label="Back to reflection" />
        <FloatingAction href="/focus-tools" label="Focus tools" />
        <FloatingAction href="/why" label="Why Deep" variant="ghost" />
      </div>
    </main>
  );
}
