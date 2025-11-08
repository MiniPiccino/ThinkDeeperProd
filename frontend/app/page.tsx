'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { AnswerForm } from '@/components/AnswerForm';
import { QuestionCard } from '@/components/QuestionCard';
import { SubmissionCelebration } from '@/components/SubmissionCelebration';
import { DopamineDrivers } from '@/components/DopamineDrivers';
import { PrimingCard } from '@/components/PrimingCard';
import { PrimingModal } from '@/components/PrimingModal';
import { Timer } from '@/components/Timer';
import { XpMeter } from '@/components/XpMeter';
import { EvaluatingInsight } from '@/components/EvaluatingInsight';
import { StreakProgress } from '@/components/StreakProgress';
import {
  AnswerResponse,
  DailyQuestionResponse,
  SubmitAnswerPayload,
  fetchDailyQuestion,
  submitAnswer,
} from '@/lib/api';

const USER_STORAGE_KEY = 'thinkdeeper.userId';
const XP_PER_LEVEL = 120;
const PRIMING_MODAL_KEY = 'thinkdeeper.priming-seen';

type LevelStats = {
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
};

function computeLevelStats(totalXp: number): LevelStats {
  if (totalXp < 0) {
    totalXp = 0;
  }
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const previousThreshold = (level - 1) * XP_PER_LEVEL;
  const nextThreshold = level * XP_PER_LEVEL;
  const xpIntoLevel = totalXp - previousThreshold;
  const xpToNextLevel = Math.max(0, nextThreshold - totalXp);
  const progressPercent = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);
  return {
    level,
    xpIntoLevel,
    xpToNextLevel,
    progressPercent: Math.max(0, Math.min(progressPercent, 100)),
  };
}

function casualizeFeedback(message: string): string {
  let text = message.trim();
  if (!text) {
    return '';
  }

  const replacements: Array<[RegExp, string]> = [
    [/\butilise\b/gi, 'use'],
    [/\butilize\b/gi, 'use'],
    [/\bensure\b/gi, 'make sure'],
    [/\bconsider\b/gi, 'try'],
    [/\bincorporate\b/gi, 'add'],
    [/\breference\b/gi, 'mention'],
    [/\belaborate\b/gi, 'unpack'],
    [/\bclarify\b/gi, 'make clearer'],
    [/\bfocus on\b/gi, 'lean into'],
    [/\bshould\b/gi, 'could'],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\bhowever\b/gi, 'but');
  text = text.replace(/\btherefore\b/gi, 'so');

  const core = text.replace(/[.!?]*$/, '');
  return `Give this a try today: ${core}.`;
}

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<string>();
  const [lastGain, setLastGain] = useState(0);
  const [lastDuration, setLastDuration] = useState(0);
  const [xpTotal, setXpTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [baseGain, setBaseGain] = useState(0);
  const [bonusGain, setBonusGain] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpIntoLevel, setXpIntoLevel] = useState(0);
  const [xpToNextLevel, setXpToNextLevel] = useState(XP_PER_LEVEL);
  const [levelProgressPercent, setLevelProgressPercent] = useState(0);
  const [weekProgressState, setWeekProgressState] = useState({
    completedDays: 0,
    totalDays: 7,
    badgeEarned: false,
  });
  const [weekBadgeName, setWeekBadgeName] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [activeDifficulty, setActiveDifficulty] = useState<{ label: string; multiplier: number }>({
    label: 'primer',
    multiplier: 1,
  });
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationTriggerRef = useRef<HTMLDivElement | null>(null);
  const [showDopamine, setShowDopamine] = useState(false);
  const [showPrimingModal, setShowPrimingModal] = useState(false);
  const [primingMode, setPrimingMode] = useState<'intro' | 'reminder'>('intro');
  const answerRef = useRef<HTMLTextAreaElement | null>(null);
  const questionSectionRef = useRef<HTMLDivElement | null>(null);

  const markPrimingSeen = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(PRIMING_MODAL_KEY, 'seen');
  }, []);

  const handleDismissPrimingModal = useCallback(() => {
    markPrimingSeen();
    setShowPrimingModal(false);
  }, [markPrimingSeen]);

  const generateUserId = () => {
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      if (typeof crypto.getRandomValues === 'function') {
        const buffer = new Uint8Array(16);
        crypto.getRandomValues(buffer);
        // RFC4122 version 4 compliant random UUID fallback
        buffer[6] = (buffer[6] & 0x0f) | 0x40;
        buffer[8] = (buffer[8] & 0x3f) | 0x80;
        const hex = [...buffer].map((b) => b.toString(16).padStart(2, '0'));
        return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
          .slice(6, 8)
          .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
      }
    }
    // Last-resort fallback; not cryptographically strong but avoids crashes.
    return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const existing = window.localStorage.getItem(USER_STORAGE_KEY);
    if (existing) {
      setUserId(existing);
      return;
    }
    const generated = generateUserId();
    window.localStorage.setItem(USER_STORAGE_KEY, generated);
    setUserId(generated);
  }, []);

  const {
    data: dailyQuestion,
    isLoading,
    isError,
    refetch,
  } = useQuery<DailyQuestionResponse>({
    queryKey: ['daily-question', userId],
    queryFn: () => fetchDailyQuestion(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!dailyQuestion) {
      return;
    }
    setSecondsRemaining(dailyQuestion.timerSeconds);
    setXpTotal(dailyQuestion.xpTotal);
    setStreak(dailyQuestion.streak);
    setFeedback(undefined);
    setLastGain(0);
    setLastDuration(0);
    setBaseGain(0);
    setBonusGain(0);
    setHasStarted(false);
    setIsSubmitted(false);
    setStartTime(null);
    setAnswer('');
    setIsEvaluating(false);
    if (dailyQuestion.difficulty) {
      setActiveDifficulty(dailyQuestion.difficulty);
    }
    if (dailyQuestion.weekProgress) {
      setWeekProgressState(dailyQuestion.weekProgress);
    } else {
      setWeekProgressState({ completedDays: 0, totalDays: 7, badgeEarned: false });
    }
    const badgeLabelParts = dailyQuestion.theme
      .split('—')
      .map((part) => part.trim())
      .filter(Boolean);
    const badgeBase = badgeLabelParts[badgeLabelParts.length - 1] ?? dailyQuestion.theme ?? 'Weekly Insight';
    const defaultBadgeName = `${badgeBase} Insight Badge`;
    setWeekBadgeName((current) =>
      dailyQuestion.weekProgress?.badgeEarned ? current ?? defaultBadgeName : defaultBadgeName,
    );
    const levelStats = computeLevelStats(dailyQuestion.xpTotal);
    setLevel(levelStats.level);
    setXpIntoLevel(levelStats.xpIntoLevel);
    setXpToNextLevel(levelStats.xpToNextLevel);
    setLevelProgressPercent(levelStats.progressPercent);
  }, [dailyQuestion?.id]);

  useEffect(() => {
    if (!dailyQuestion?.priming) {
      setShowPrimingModal(false);
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const seen = window.localStorage.getItem(PRIMING_MODAL_KEY);
    setPrimingMode(seen ? 'reminder' : 'intro');
    setShowPrimingModal(true);
  }, [dailyQuestion?.id, dailyQuestion?.priming]);

  useEffect(() => {
    if (!hasStarted || !startTime || !dailyQuestion || isSubmitted) {
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, Math.round(dailyQuestion.timerSeconds - elapsed));
      setSecondsRemaining(remaining);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [hasStarted, startTime, dailyQuestion, isSubmitted]);

  const playRewardSound = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const AudioContextClass: typeof AudioContext | undefined =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
      window.AudioContext;
    if (!AudioContextClass) {
      return;
    }
    try {
      const ctx = new AudioContextClass();
      const notes = [
        { frequency: 440, start: 0 },
        { frequency: 660, start: 0.12 },
        { frequency: 880, start: 0.22 },
      ];
      notes.forEach(({ frequency, start }, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + start + 0.35 + index * 0.03,
        );
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(ctx.currentTime + start);
        oscillator.stop(ctx.currentTime + start + 0.5);
      });
      setTimeout(() => {
        ctx.close().catch(() => {
          /* ignore */
        });
      }, 800);
    } catch (error) {
      // ignore audio errors (e.g., autoplay restrictions)
    }
  }, []);

  const mutation = useMutation<AnswerResponse, Error, SubmitAnswerPayload>({
    mutationFn: submitAnswer,
    onSuccess: (result) => {
      setFeedback(result.feedback);
      setXpTotal(result.xpTotal);
      setStreak(result.streak);
      setLastGain(result.xpAwarded);
      setBaseGain(result.baseXp);
      setBonusGain(result.bonusXp);
      setWeekProgressState({
        completedDays: result.weekCompletedDays,
        totalDays: result.weekTotalDays,
        badgeEarned: result.weekBadgeEarned,
      });
      if (result.badgeName) {
        setWeekBadgeName(result.badgeName);
      }
      setLevel(result.level);
      setXpIntoLevel(result.xpIntoLevel);
      setXpToNextLevel(result.xpToNextLevel);
      setLevelProgressPercent(result.levelProgressPercent);
      setActiveDifficulty({
        label: result.difficultyLevel,
        multiplier: result.difficultyMultiplier,
      });
      setAnswer('');
      setIsSubmitted(true);
      setIsEvaluating(false);
      setShowCelebration(true);
      playRewardSound();
    },
    onError: () => {
      setIsSubmitted(false);
      setShowCelebration(false);
      setIsEvaluating(false);
      setBaseGain(0);
      setBonusGain(0);
    },
  });

  const startSession = useCallback(() => {
    setShowPrimingModal(false);
    markPrimingSeen();
    setHasStarted(true);
    setIsSubmitted(false);
    setStartTime(Date.now());
    setFeedback(undefined);
    setLastGain(0);
    setLastDuration(0);
    if (dailyQuestion) {
      setSecondsRemaining(dailyQuestion.timerSeconds);
    }
    setShowDopamine(true);
    if (questionSectionRef.current) {
      questionSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    requestAnimationFrame(() => {
      if (answerRef.current) {
        answerRef.current.focus({ preventScroll: true });
      }
    });
  }, [dailyQuestion, markPrimingSeen]);

  const handleStart = () => {
    startSession();
  };

  const handleSubmit = () => {
    if (!dailyQuestion || answer.trim().length === 0) {
      return;
    }
    const elapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    const durationSeconds = Math.max(
      0,
      Math.min(dailyQuestion.timerSeconds, elapsed),
    );
    setIsSubmitted(true);
    setSecondsRemaining(
      Math.max(0, dailyQuestion.timerSeconds - durationSeconds),
    );
    setLastDuration(durationSeconds);
    setIsEvaluating(true);
    setBonusGain(0);
    setBaseGain(0);
    mutation.mutate({
      questionId: dailyQuestion.id,
      answer,
      userId: userId ?? undefined,
      durationSeconds,
    });
  };

  useEffect(() => {
    const el = celebrationTriggerRef.current;
    if (showCelebration && el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showCelebration]);

  const status = useMemo(() => {
    if (isError) {
      return 'error';
    }
    if (isLoading || !dailyQuestion) {
      return 'loading';
    }
    return 'ready';
  }, [isLoading, dailyQuestion, isError]);

  const previousFeedback = dailyQuestion?.previousFeedback ?? null;
  const sessionTips = [
    'Take the full five minutes before submitting.',
    'Use concrete examples and personal insights.',
    'Revisit your answer tomorrow to grow your streak.',
  ];
  const weekProgress = weekProgressState;
  const difficulty = activeDifficulty;

  const challengeNote = useMemo(() => {
    const multiplierText = `x${difficulty.multiplier.toFixed(2)} reward boost`;
    if (difficulty.label === 'primer') {
      return {
        title: 'Ease-in challenge',
        description: `Start the week with calm reflection. Stay grounded and collect a steady ${multiplierText}.`,
      };
    }
    if (difficulty.label === 'deepening') {
      return {
        title: 'Deepening challenge',
        description: `The questions are stretching now. Lean into nuance for an amplified ${multiplierText}.`,
      };
    }
    return {
      title: 'Mastery challenge',
      description: `This is a peak prompt. Take your time; mastery mode delivers a generous ${multiplierText}.`,
    };
  }, [difficulty]);

  const dopamineDrivers = useMemo(() => {
    if (!dailyQuestion) {
      return null;
    }

    const totalDays = weekProgress.totalDays || 7;
    const completedDays = Math.min(weekProgress.completedDays || 0, totalDays);
    const normalizedDay = Math.min(completedDays + 1, totalDays);
    const sessionsRemaining = Math.max(totalDays - completedDays, 0);

    let curiosityPoints =
      dailyQuestion.dopamine?.curiosityPrompts?.filter((point): point is string => Boolean(point)) ??
      [];
    if (curiosityPoints.length === 0) {
      curiosityPoints = [
        `Theme focus: ${dailyQuestion.theme}`,
        totalDays > 0
          ? `Day ${normalizedDay} of ${totalDays} in this reflection cycle`
          : 'Each session layers on your last insight.',
      ];
    }

    const curiosity = {
      title: 'Curiosity spark',
      description:
        dailyQuestion.dopamine?.curiosityHook ??
        `Prime your mind for today's focus on ${dailyQuestion.theme.toLowerCase()}. Explore the angles that surprise you.`,
      points: curiosityPoints,
    };

    const challengeModes =
      dailyQuestion.dopamine?.challengeModes?.map((mode) => ({
        label: mode.label,
        description: mode.description,
        emphasis: mode.multiplier ? `x${mode.multiplier.toFixed(2)} XP` : undefined,
        unlocked: mode.unlocked ?? true,
      })) ??
      [
        {
          label: 'Primer flow',
          description: 'Ease in with lighter prompts to cement the habit and keep your streak alive.',
          emphasis: 'x1.00 XP',
        },
        {
          label: 'Deepening',
          description: 'Layer nuance into your answer for a richer critique and a bigger XP multiplier.',
          emphasis: 'x1.25 XP',
        },
        {
          label: 'Mastery',
          description: 'Tackle the toughest variant to stress-test your reasoning muscles.',
          emphasis: 'x1.50 XP',
        },
      ];

    const challenge = {
      title: 'Challenge fuel',
      description: 'Choose the stretch that matches your energy today.',
      modes: challengeModes,
      activeLabel: (dailyQuestion.dopamine?.activeDifficulty as string | undefined) ?? difficulty.label,
    };

    let rewardStats = [
      {
        label: 'Total XP',
        value: `${xpTotal}`,
        hint: 'Accumulated across every Deep session.',
      },
      {
        label: 'Latest session',
        value:
          lastGain > 0
            ? `+${lastGain} XP`
            : hasStarted && !isSubmitted
            ? 'Session in progress'
            : "Complete today's prompt",
        hint:
          lastGain > 0
            ? `Base ${baseGain} + Bonus ${bonusGain}`
            : 'Higher challenge tiers boost your bonus XP.',
      },
      {
        label: 'Streak',
        value: `${streak} day${streak === 1 ? '' : 's'}`,
        hint:
          sessionsRemaining > 0
            ? `${sessionsRemaining} more day${sessionsRemaining === 1 ? '' : 's'} unlocks ${weekBadgeName ?? "this week's badge"}.`
            : weekProgress.badgeEarned
            ? weekBadgeName
              ? `${weekBadgeName} secured.`
              : 'Weekly badge secured.'
            : 'Keep your streak alive to earn the badge.',
      },
    ];

    const rewardHighlights =
      dailyQuestion.dopamine?.rewardHighlights?.filter(
        (highlight): highlight is { title: string; description: string; earned?: boolean } =>
          Boolean(highlight?.title) && Boolean(highlight?.description),
      ) ?? [];

    if (rewardHighlights.length > 0) {
      rewardStats = rewardHighlights.slice(0, 3).map((highlight) => ({
        label: highlight.title,
        value: highlight.earned ? 'Unlocked' : 'In progress',
        hint: highlight.description,
      }));
    }

    const reward = {
      title: 'Reward signal',
      description:
        rewardHighlights.length > 0
          ? 'Progress snapshots tuned to your current streak.'
          : 'See your wins stack up as you stay consistent.',
      stats: rewardStats,
      celebration: weekProgress.badgeEarned
        ? `Badge unlocked: ${weekBadgeName ?? 'Weekly insight badge'}`
        : undefined,
    };

    const anticipateTeaser =
      dailyQuestion.dopamine?.anticipationTeaser ??
      'Tomorrow continues this arc—set yourself up for another deep focus rep.';

    const parseDate = (value?: string) => {
      if (!value) return null;
      const candidate = new Date(value);
      return Number.isNaN(candidate.getTime()) ? null : candidate;
    };

    let nextPromptDate = parseDate(dailyQuestion.dopamine?.nextPromptAvailableAt);
    if (!nextPromptDate) {
      const currentAvailability = parseDate(dailyQuestion.availableOn);
      if (currentAvailability) {
        const next = new Date(currentAvailability);
        next.setDate(next.getDate() + 1);
        nextPromptDate = next;
      }
    }

    const nextPrompt =
      nextPromptDate?.toLocaleString(undefined, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }) ?? null;

    const anticipationActions = [
      weekProgress.badgeEarned
        ? 'Plan your next mastery sprint to stay ahead of the streak.'
        : sessionsRemaining > 0
        ? `Complete ${sessionsRemaining} more reflection${sessionsRemaining === 1 ? '' : 's'} to earn ${
            weekBadgeName ?? "this week's badge"
          }.`
        : 'Keep momentum by tackling a mastery-mode prompt tomorrow.',
      'Set a five-minute block tomorrow so momentum is ready to fire.',
      'Capture a curiosity spark now so you arrive primed for the next question.',
    ];

    const anticipation = {
      title: 'Anticipation cue',
      description: anticipateTeaser,
      actions: Array.from(new Set(anticipationActions)),
      nextPrompt,
    };

    return {
      curiosity,
      challenge,
      reward,
      anticipation,
    };
  }, [
    dailyQuestion,
    weekProgress.badgeEarned,
    weekProgress.completedDays,
    weekProgress.totalDays,
    difficulty.label,
    xpTotal,
    lastGain,
    hasStarted,
    isSubmitted,
    baseGain,
    bonusGain,
    streak,
    weekBadgeName,
  ]);

  const ethicalHeadline = 'The ethical motivation difference';
  const ethicalLines = useMemo(
    () => [
      'This loop trains anticipation for clarity, not endless scrolling.',
      'Each session ends with a next-step plan instead of a cliffhanger feed.',
      'You choose one deep hit per day, so your nervous system recovers between reps.',
      'That’s how motivation stays aligned with growth instead of compulsion.',
    ],
    [],
  );

  const previousFeedbackDate = useMemo(() => {
    if (!previousFeedback?.submittedAt) {
      return null;
    }
    const parsed = new Date(previousFeedback.submittedAt);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [previousFeedback?.submittedAt]);

  const friendlyFeedback = useMemo(() => {
    if (!previousFeedback?.feedback) {
      return null;
    }
    const [, improveRaw] = previousFeedback.feedback.split(/Improve:/i);
    const improve = improveRaw?.trim();
    if (improve && improve.length > 0) {
      return `Focus: ${improve}`;
    }
    const casual = casualizeFeedback(previousFeedback.feedback);
    return casual || previousFeedback.feedback;
  }, [previousFeedback?.feedback]);

  const previousFocus = previousFeedback
    ? {
        feedback: previousFeedback.feedback,
        friendlyFeedback,
        capturedOn: previousFeedbackDate,
      }
    : null;
  const priming = dailyQuestion?.priming;

  return (
    <>
      {priming && showPrimingModal ? (
        <PrimingModal
          mode={primingMode}
          emotionalHook={priming.emotionalHook}
          teaserQuestion={priming.teaserQuestion}
          somaticCue={priming.somaticCue}
          cognitiveCue={priming.cognitiveCue}
          onClose={handleDismissPrimingModal}
          onBegin={handleDismissPrimingModal}
        />
      ) : null}
      <main className="relative flex min-h-screen w-full justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-16 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
        <div className="flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-2 text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
            Deep
          </span>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Train your reasoning every day
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Reflect on today&apos;s question, write deeply, and earn XP toward mastery.
          </p>
        </header>

        {status === 'loading' ? (
          <div className="flex h-64 w-full items-center justify-center rounded-3xl border border-dashed border-zinc-300 text-zinc-500">
            Loading today&apos;s prompt...
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">
            <p className="font-semibold">We couldn&apos;t load today&apos;s prompt.</p>
            <p className="mt-2 text-sm">
              Please check your network connection or try again later.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 inline-flex items-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        {dailyQuestion && status === 'ready' ? (
          <>
            {priming ? (
              <PrimingCard
                emotionalHook={priming.emotionalHook}
                teaserQuestion={priming.teaserQuestion}
                somaticCue={priming.somaticCue}
                cognitiveCue={priming.cognitiveCue}
              />
            ) : null}

            <div ref={questionSectionRef}>
              <QuestionCard
                theme={dailyQuestion.theme}
                prompt={dailyQuestion.prompt}
                hasStarted={hasStarted}
                onStart={handleStart}
                previousFocus={previousFocus}
                sessionTips={sessionTips}
                challengeNote={challengeNote}
              />
            </div>

            {dopamineDrivers ? (
              <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60">
                <button
                  type="button"
                  onClick={() => setShowDopamine((prev) => !prev)}
                  className="inline-flex items-center justify-between rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  <span>
                    {showDopamine ? 'Hide the focus primer' : "Prime today's focus"}
                  </span>
                  <span className="ml-3 text-xs uppercase tracking-wide text-zinc-200">
                    {showDopamine ? 'Simplify' : 'Feel first'}
                  </span>
                </button>
                {showDopamine ? (
                  <DopamineDrivers
                    curiosity={dopamineDrivers.curiosity}
                    challenge={dopamineDrivers.challenge}
                    reward={dopamineDrivers.reward}
                    anticipation={dopamineDrivers.anticipation}
                  />
                ) : null}
              </section>
            ) : null}

            <div className="grid gap-8 lg:grid-cols-[1.7fr,1fr]">
              <div className="flex flex-col gap-6">
                <div ref={celebrationTriggerRef} />
                <Timer
                  remainingSeconds={secondsRemaining}
                  totalSeconds={dailyQuestion.timerSeconds}
                />

                {hasStarted && !isSubmitted ? (
                  <AnswerForm
                    answer={answer}
                    onChange={setAnswer}
                    onSubmit={handleSubmit}
                    isSubmitting={mutation.isPending}
                    disabled={isSubmitted}
                    ref={answerRef}
                  />
                ) : null}

                {isEvaluating ? (
                  <EvaluatingInsight className="shadow-lg" />
                ) : null}

                {isSubmitted && showCelebration && (
                  <SubmissionCelebration
                    feedback={feedback}
                    xpGain={lastGain}
                    baseXp={baseGain}
                    bonusXp={bonusGain}
                    xpTotal={xpTotal}
                    streak={streak}
                    durationSeconds={lastDuration}
                    difficultyLevel={activeDifficulty.label}
                    difficultyMultiplier={activeDifficulty.multiplier}
                    level={level}
                    xpToNextLevel={xpToNextLevel}
                    xpIntoLevel={xpIntoLevel}
                    levelProgressPercent={levelProgressPercent}
                    weekCompletedDays={weekProgress.completedDays}
                    weekTotalDays={weekProgress.totalDays}
                    weekBadgeEarned={weekProgress.badgeEarned}
                    badgeName={weekBadgeName}
                    onClose={() => setShowCelebration(false)}
                  />
                )}
              </div>

              <aside className="space-y-6 lg:sticky lg:top-8">
                <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-2">
                  <XpMeter
                    totalXp={xpTotal}
                    xpGain={lastGain}
                    baseGain={baseGain}
                    bonusGain={bonusGain}
                    level={level}
                    xpIntoLevel={xpIntoLevel}
                    xpToNextLevel={xpToNextLevel}
                    levelProgressPercent={levelProgressPercent}
                    className="h-full"
                  />
                  <StreakProgress
                    streak={streak}
                    weekCompletedDays={weekProgress.completedDays}
                    weekTotalDays={weekProgress.totalDays}
                    badgeEarned={weekProgress.badgeEarned}
                    badgeName={weekBadgeName}
                    className="h-full"
                  />
                </div>
                <div className="rounded-3xl border border-sky-500/50 bg-gradient-to-br from-sky-950/70 via-sky-900/60 to-emerald-900/50 p-6 text-sm text-sky-100 shadow-lg">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300">
                    {ethicalHeadline}
                  </p>
                  <ul className="mt-4 space-y-2 leading-relaxed">
                    {ethicalLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </main>
    </>
  );
}
