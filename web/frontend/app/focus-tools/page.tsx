'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { DopamineDrivers } from '@/components/DopamineDrivers';
import { fetchDailyQuestion, type DailyQuestionResponse } from '@/lib/api';
import { FloatingAction } from '@/components/FloatingAction';
import { XpMeter } from '@/components/XpMeter';
import { StreakProgress } from '@/components/StreakProgress';
import { useUserIdentifier } from '@/hooks/useUserIdentifier';

export default function FocusToolsPage() {
  const userId = useUserIdentifier();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['focus-tools', userId],
    queryFn: () => fetchDailyQuestion(userId ?? undefined),
    staleTime: 0,
    enabled: Boolean(userId),
  });

  const dopamine = data?.dopamine;
  const nextWeekTheme = data?.theme ? `Up next: ${data.theme}` : 'Next theme arrives soon';
  const xpTotal = data?.xpTotal ?? 0;
  const levelStats = computeLevelStats(xpTotal);
  const streakCount = data?.streak ?? 0;
  const weekProgress = data?.weekProgress ?? { completedDays: 0, totalDays: 7, badgeEarned: false };
  const badgeName = data?.theme
    ? (() => {
        const badgeLabelParts = data.theme.split('—').map((part) => part.trim()).filter(Boolean);
        const badgeBase = badgeLabelParts[badgeLabelParts.length - 1] ?? data.theme;
        return `${badgeBase} Insight Badge`;
      })()
    : undefined;
  const remainingDays = Math.max(0, weekProgress.totalDays - weekProgress.completedDays);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 py-12 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Deep focus tools</p>
          <h1 className="text-3xl font-semibold">Prime today&apos;s flow when you need it</h1>
          <p className="text-sm text-slate-300">
            Step out of the main session, recalibrate, then drop back in without cluttering your writing surface.
          </p>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-emerald-50 shadow-lg shadow-emerald-900/60 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
          >
            Refresh focus tools
          </button>
          <Link
            href="/"
            className="inline-flex gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-emerald-50 shadow-lg shadow-emerald-900/60 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
          >
            Back to session
          </Link>
          <div className="flex-1 rounded-2xl border border-slate-800/50 bg-slate-950/40 px-4 py-3 text-left text-[11px] text-slate-200">
            <p className="font-semibold uppercase tracking-[0.35em] text-slate-500">Next week</p>
            <p className="mt-1 text-base text-white">{nextWeekTheme}</p>
            <p className="mt-1 text-xs text-slate-400">Invite someone to start this arc with you.</p>
          </div>
        </div>

        {!userId ? (
          <div className="rounded-3xl border border-dashed border-slate-600 px-5 py-6 text-center text-slate-400">
            Connecting to your streak...
          </div>
        ) : null}

        {!isLoading && !isError && userId ? (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              <XpMeter
                totalXp={xpTotal}
                xpGain={0}
                baseGain={0}
                bonusGain={0}
                level={levelStats.level}
                xpIntoLevel={levelStats.xpIntoLevel}
                xpToNextLevel={levelStats.xpToNextLevel}
                levelProgressPercent={levelStats.progressPercent}
              />
              <StreakProgress
                streak={streakCount}
                weekCompletedDays={weekProgress.completedDays}
                weekTotalDays={weekProgress.totalDays}
                badgeEarned={weekProgress.badgeEarned}
                badgeName={badgeName}
              />
            </section>

            <section className="rounded-3xl border border-emerald-500/25 bg-emerald-500/5 p-6 text-sm text-emerald-50 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">Streak intel</p>
              <p className="mt-3 text-base text-white">Level {levelStats.level} | {streakCount} day streak</p>
              <ul className="mt-4 space-y-2 text-sm text-emerald-100/80">
                <li>Completed days leaf out. {remainingDays === 0 ? 'This loop is in full bloom.' : `${remainingDays} day${remainingDays === 1 ? '' : 's'} left to close the loop.`}</li>
                <li>Badge unlock: {weekProgress.badgeEarned ? 'claimed for this arc.' : `${badgeName ?? 'Weekly Insight'} once you finish the week.`}</li>
                <li>XP pacing: {levelStats.xpToNextLevel > 0 ? `${levelStats.xpToNextLevel} XP until the next tier.` : 'Next tier unlocked—keep stacking.'}</li>
              </ul>
              <p className="mt-4 text-xs text-emerald-200/70">Visit the Growth page after writing to replay your streak.</p>
            </section>
          </>
        ) : null}

        {isLoading ? (
          <div className="rounded-3xl border border-dashed border-slate-600 px-5 py-6 text-center text-slate-400">
            Loading focus tools...
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-3xl border border-red-500/40 bg-red-500/10 px-5 py-6 text-sm text-red-200">
            <p className="font-semibold">Couldn&apos;t load today&apos;s focus tools.</p>
            <p className="mt-1">Check your connection or try again.</p>
          </div>
        ) : null}

        {dopamine ? (
          <>
            <DopamineDrivers
              curiosity={dopamineCuriosity(dopamine)}
              challenge={dopamineChallenge(dopamine)}
              reward={dopamineReward(dopamine)}
              anticipation={dopamineAnticipation(dopamine)}
            />
          </>
        ) : (
          !isLoading &&
          !isError && (
            <div className="rounded-3xl border border-slate-500/40 bg-slate-900/80 px-5 py-6 text-sm text-slate-300">
              Focus tools are not available yet. Finish loading the main session and try again.
            </div>
          )
        )}
      </div>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 md:gap-3">
        <FloatingAction href="/" label="Back to reflection" />
        <FloatingAction href="/growth" label="Growth check-in" />
        <FloatingAction href="/why" label="Why Deep" variant="ghost" />
      </div>
    </main>
  );
}

type DopaminePayload = NonNullable<DailyQuestionResponse['dopamine']>;

type LevelStats = {
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
};

const XP_PER_LEVEL = 120;

function computeLevelStats(totalXp: number): LevelStats {
  if (totalXp < 0) {
    totalXp = 0;
  }
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const previousThreshold = (level - 1) * XP_PER_LEVEL;
  const xpIntoLevel = totalXp - previousThreshold;
  const xpToNextLevel = Math.max(0, level * XP_PER_LEVEL - totalXp);
  const progressPercent = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);
  return {
    level,
    xpIntoLevel,
    xpToNextLevel,
    progressPercent: Math.max(0, Math.min(progressPercent, 100)),
  };
}

function dopamineCuriosity(dopamine: DopaminePayload) {
  return {
    title: dopamine.curiosityHook ? 'Curiosity spark' : 'Curiosity spark',
    description:
      dopamine.curiosityHook ??
      'Prime your mind for today’s theme. Use the reflections that resonate most.',
    points: dopamine.curiosityPrompts?.filter(Boolean) ?? [
      'Notice the bias that keeps resurfacing.',
      'Name one assumption you can test today.',
    ],
  };
}

function dopamineChallenge(dopamine: DopaminePayload) {
  return {
    title: 'Challenge fuel',
    description: 'Pick the stretch tier that fits your energy.',
    modes:
      dopamine.challengeModes?.map((mode) => ({
        label: mode.label,
        description: mode.description,
        emphasis: mode.multiplier ? `x${mode.multiplier.toFixed(2)} XP` : undefined,
        unlocked: mode.unlocked ?? true,
      })) ?? [],
    activeLabel: dopamine.activeDifficulty,
  };
}

function dopamineReward(dopamine: DopaminePayload) {
  const highlights =
    dopamine.rewardHighlights?.filter((item): item is { title: string; description: string; earned?: boolean } => Boolean(item?.title)) ??
    [];
  return {
    title: 'Reward signal',
    description: highlights.length > 0 ? 'Snapshots tuned to your streak.' : 'See your wins stack up.',
    stats:
      highlights.slice(0, 3).map((highlight) => ({
        label: highlight.title,
        value: highlight.earned ? 'Unlocked' : 'In progress',
        hint: highlight.description,
      })) ??
      [],
  };
}

function dopamineAnticipation(dopamine: DopaminePayload) {
  return {
    title: 'Anticipation cue',
    description:
      dopamine.anticipationTeaser ?? 'Set tomorrow up before you close today.',
    actions: [
      ...(dopamine.curiosityPrompts?.slice(0, 1) ?? []),
      'Block out five minutes for tomorrow now.',
      'Capture one insight to revisit next session.',
    ],
    nextPrompt: dopamine.nextPromptAvailableAt
      ? new Date(dopamine.nextPromptAvailableAt).toLocaleString(undefined, {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null,
  };
}
