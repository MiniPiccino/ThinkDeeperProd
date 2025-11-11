'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { DopamineDrivers } from '@/components/DopamineDrivers';
import { fetchDailyQuestion, type DailyQuestionResponse } from '@/lib/api';
import { StreakTree } from '@/components/StreakTree';

export default function FocusToolsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['focus-tools'],
    queryFn: () => fetchDailyQuestion(),
    staleTime: 0,
  });

  const dopamine = data?.dopamine;
  const nextWeekTheme = data?.theme ? `Up next: ${data.theme}` : 'Next theme arrives soon';

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
            className="inline-flex gap-2 rounded-full border border-emerald-400/50 bg-transparent px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
          >
            Refresh focus tools
          </button>
          <Link
            href="/"
            className="inline-flex gap-2 rounded-full border border-emerald-400/50 bg-transparent px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
          >
            Back to session
          </Link>
          <div className="flex-1 rounded-2xl border border-slate-800/50 bg-slate-950/40 px-4 py-3 text-left text-[11px] text-slate-200">
            <p className="font-semibold uppercase tracking-[0.35em] text-slate-500">Next week</p>
            <p className="mt-1 text-base text-white">{nextWeekTheme}</p>
            <p className="mt-1 text-xs text-slate-400">Invite someone to start this arc with you.</p>
          </div>
        </div>

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
            <StreakTree
              streak={data?.streak ?? 0}
              weekCompletedDays={data?.weekProgress?.completedDays ?? 0}
              weekTotalDays={data?.weekProgress?.totalDays ?? 7}
              currentWeekIndex={data?.weekIndex ?? 0}
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
    </main>
  );
}

type DopaminePayload = NonNullable<DailyQuestionResponse['dopamine']>;

function dopamineCuriosity(dopamine: DopaminePayload) {
  return {
    title: dopamine.curiosityHook ? 'Curiosity spark' : 'Curiosity spark',
    description:
      dopamine.curiosityHook ??
      'Prime your mind for today’s theme. Use the prompts that resonate most.',
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
          <Link
            href="/why"
            className="inline-flex gap-2 rounded-full border border-emerald-400/50 bg-transparent px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
          >
            Read why Deep works
          </Link>
