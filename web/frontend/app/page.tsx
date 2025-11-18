'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { AnswerForm } from '@/components/AnswerForm';
import { QuestionCard } from '@/components/QuestionCard';
import { SubmissionCelebration } from '@/components/SubmissionCelebration';
import { PrimingModal } from '@/components/PrimingModal';
import { AuthPanel } from '@/components/AuthPanel';
import { Timer } from '@/components/Timer';
import { EvaluatingInsight } from '@/components/EvaluatingInsight';
import { FloatingAction } from '@/components/FloatingAction';
import {
  AnswerResponse,
  DailyQuestionResponse,
  SubmitAnswerPayload,
  fetchDailyQuestion,
  submitAnswer,
} from '@/lib/api';
import { useUserIdentifier } from '@/hooks/useUserIdentifier';
const XP_PER_LEVEL = 120;
const PRIMING_MODAL_KEY = 'thinkdeeper.priming-seen';
const ALREADY_ANSWERED_MESSAGE = "You've already completed today's reflection. Come back tomorrow for a fresh one.";

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

type WeekProgressState = {
  completedDays: number;
  totalDays: number;
  badgeEarned: boolean;
};

type SessionState = {
  hasStarted: boolean;
  isSubmitted: boolean;
  isEvaluating: boolean;
  startTime: number | null;
  secondsRemaining: number;
  answer: string;
  feedback?: string;
  lastGain: number;
  lastDuration: number;
  xpTotal: number;
  streak: number;
  baseGain: number;
  bonusGain: number;
  levelStats: LevelStats;
  weekProgress: WeekProgressState;
  weekBadgeName: string | null;
  activeDifficulty: { label: string; multiplier: number };
  showCelebration: boolean;
  showPrimingModal: boolean;
  primingMode: 'intro' | 'reminder';
  locked: boolean;
  submissionError: string | null;
};

const initialSessionState: SessionState = {
  hasStarted: false,
  isSubmitted: false,
  isEvaluating: false,
  startTime: null,
  secondsRemaining: 0,
  answer: '',
  feedback: undefined,
  lastGain: 0,
  lastDuration: 0,
  xpTotal: 0,
  streak: 0,
  baseGain: 0,
  bonusGain: 0,
  levelStats: computeLevelStats(0),
  weekProgress: { completedDays: 0, totalDays: 7, badgeEarned: false },
  weekBadgeName: null,
  activeDifficulty: { label: 'primer', multiplier: 1 },
  showCelebration: false,
  showPrimingModal: false,
  primingMode: 'intro',
  locked: false,
  submissionError: null,
};

type LoadPayload = {
  question: DailyQuestionResponse;
  primingMode: 'intro' | 'reminder';
  showPrimingModal: boolean;
  locked: boolean;
};

type SessionAction =
  | { type: 'LOAD_FROM_QUESTION'; payload: LoadPayload }
  | { type: 'SET_ANSWER'; payload: string }
  | { type: 'START_SESSION'; payload: { timestamp: number; timerSeconds: number } }
  | { type: 'SET_SECONDS'; payload: number }
  | { type: 'SUBMISSION_PENDING'; payload: { durationSeconds: number; timerSeconds: number } }
  | { type: 'SUBMISSION_SUCCESS'; payload: AnswerResponse }
  | { type: 'SUBMISSION_ERROR'; payload?: { message?: string } }
  | { type: 'DISMISS_CELEBRATION' }
  | { type: 'DISMISS_PRIMING' };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'LOAD_FROM_QUESTION': {
      const { question, primingMode, showPrimingModal, locked } = action.payload;
      const weekProgress = normalizeWeekProgress(question.weekProgress);
      const badgeName = computeBadgeName(question.theme, weekProgress.badgeEarned, state.weekBadgeName);
      return {
        ...state,
        hasStarted: false,
        isSubmitted: false,
        isEvaluating: false,
        startTime: null,
        secondsRemaining: question.timerSeconds,
        answer: '',
        feedback: undefined,
        lastGain: 0,
        lastDuration: 0,
        xpTotal: question.xpTotal,
        streak: question.streak,
        baseGain: 0,
        bonusGain: 0,
        levelStats: computeLevelStats(question.xpTotal),
        weekProgress,
        weekBadgeName: badgeName,
        activeDifficulty: question.difficulty ?? state.activeDifficulty,
        showCelebration: false,
        showPrimingModal: showPrimingModal && !locked,
        primingMode,
        locked,
        submissionError: null,
      };
    }
    case 'SET_ANSWER':
      return { ...state, answer: action.payload };
    case 'START_SESSION':
      return {
        ...state,
        hasStarted: true,
        isSubmitted: false,
        isEvaluating: false,
        startTime: action.payload.timestamp,
        secondsRemaining: action.payload.timerSeconds,
        feedback: undefined,
        lastGain: 0,
        lastDuration: 0,
        baseGain: 0,
        bonusGain: 0,
        showCelebration: false,
        showPrimingModal: false,
        submissionError: null,
      };
    case 'SET_SECONDS':
      return { ...state, secondsRemaining: action.payload };
    case 'SUBMISSION_PENDING':
      return {
        ...state,
        isSubmitted: true,
        isEvaluating: true,
        lastDuration: action.payload.durationSeconds,
        secondsRemaining: Math.max(0, action.payload.timerSeconds - action.payload.durationSeconds),
        baseGain: 0,
        bonusGain: 0,
        submissionError: null,
      };
    case 'SUBMISSION_SUCCESS': {
      const nextWeekProgress: WeekProgressState = {
        completedDays: action.payload.weekCompletedDays,
        totalDays: action.payload.weekTotalDays,
        badgeEarned: action.payload.weekBadgeEarned,
      };
      const nextBadgeName = action.payload.badgeName ?? state.weekBadgeName;
      return {
        ...state,
        feedback: action.payload.feedback,
        xpTotal: action.payload.xpTotal,
        streak: action.payload.streak,
        baseGain: action.payload.baseXp,
        bonusGain: action.payload.bonusXp,
        lastGain: action.payload.xpAwarded,
        levelStats: {
          level: action.payload.level,
          xpIntoLevel: action.payload.xpIntoLevel,
          xpToNextLevel: action.payload.xpToNextLevel,
          progressPercent: action.payload.levelProgressPercent,
        },
        weekProgress: nextWeekProgress,
        weekBadgeName: nextBadgeName,
        activeDifficulty: {
          label: action.payload.difficultyLevel,
          multiplier: action.payload.difficultyMultiplier,
        },
        answer: '',
        isEvaluating: false,
        showCelebration: true,
        locked: true,
        submissionError: null,
      };
    }
    case 'SUBMISSION_ERROR':
      return {
        ...state,
        isSubmitted: false,
        isEvaluating: false,
        baseGain: 0,
        bonusGain: 0,
        showCelebration: false,
        submissionError: action.payload?.message ?? 'We could not submit your answer. Please try again.',
      };
    case 'DISMISS_CELEBRATION':
      return { ...state, showCelebration: false };
    case 'DISMISS_PRIMING':
      return { ...state, showPrimingModal: false };
    default:
      return state;
  }
}

function normalizeWeekProgress(progress?: WeekProgressState | null): WeekProgressState {
  if (!progress) {
    return { completedDays: 0, totalDays: 7, badgeEarned: false };
  }
  return progress;
}

function computeBadgeName(theme: string, badgeEarned: boolean, current: string | null): string {
  const parts = theme
    .split('—')
    .map((part) => part.trim())
    .filter(Boolean);
  const badgeBase = parts[parts.length - 1] ?? theme ?? 'Weekly Insight';
  const defaultName = `${badgeBase} Insight Badge`;
  if (badgeEarned) {
    return current ?? defaultName;
  }
  return defaultName;
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
  const [session, dispatchSession] = useReducer(sessionReducer, initialSessionState);
  const {
    hasStarted,
    isSubmitted,
    isEvaluating,
    startTime,
    secondsRemaining,
    answer,
    feedback,
    lastGain,
    lastDuration,
    xpTotal,
    streak,
    baseGain,
    bonusGain,
    levelStats,
    weekProgress,
    weekBadgeName,
    activeDifficulty,
    showCelebration,
    showPrimingModal,
    primingMode,
    locked,
    submissionError,
  } = session;
  const { level, xpIntoLevel, xpToNextLevel, progressPercent: levelProgressPercent } = levelStats;
  const celebrationTriggerRef = useRef<HTMLDivElement | null>(null);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);
  const questionSectionRef = useRef<HTMLDivElement | null>(null);
  const writingSectionRef = useRef<HTMLDivElement | null>(null);
  const previousQuestionIdRef = useRef<string | null>(null);

  const markPrimingSeen = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(PRIMING_MODAL_KEY, 'seen');
  }, []);

  const handleDismissPrimingModal = useCallback(() => {
    markPrimingSeen();
    dispatchSession({ type: 'DISMISS_PRIMING' });
  }, [dispatchSession, markPrimingSeen]);

  const resolvedUserId = useUserIdentifier();


  const {
    data: dailyQuestion,
    isLoading,
    isError,
    refetch,
  } = useQuery<DailyQuestionResponse>({
    queryKey: ['daily-question', resolvedUserId],
    queryFn: () => fetchDailyQuestion(resolvedUserId ?? undefined),
    enabled: Boolean(resolvedUserId),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!dailyQuestion) {
      return;
    }
    if (previousQuestionIdRef.current === dailyQuestion.id) {
      return;
    }
    previousQuestionIdRef.current = dailyQuestion.id;
    const hasPriming = Boolean(dailyQuestion.priming);
    const locked = Boolean(dailyQuestion.hasAnsweredToday);
    let primingModeValue: 'intro' | 'reminder' = 'intro';
    if (hasPriming && typeof window !== 'undefined') {
      const seen = window.localStorage.getItem(PRIMING_MODAL_KEY);
      primingModeValue = seen ? 'reminder' : 'intro';
    }
    dispatchSession({
      type: 'LOAD_FROM_QUESTION',
      payload: {
        question: dailyQuestion,
        primingMode: primingModeValue,
        showPrimingModal: hasPriming,
        locked,
      },
    });
  }, [dailyQuestion, dispatchSession]);

  useEffect(() => {
    previousQuestionIdRef.current = null;
  }, [resolvedUserId]);

  useEffect(() => {
    if (!hasStarted || !startTime || !dailyQuestion || isSubmitted) {
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, Math.round(dailyQuestion.timerSeconds - elapsed));
      dispatchSession({ type: 'SET_SECONDS', payload: remaining });
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [hasStarted, startTime, dailyQuestion, isSubmitted, dispatchSession]);

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
    } catch {
      // ignore audio errors (e.g., autoplay restrictions)
    }
  }, []);

  const mutation = useMutation<AnswerResponse, Error, SubmitAnswerPayload>({
    mutationFn: submitAnswer,
    onSuccess: (result) => {
      dispatchSession({ type: 'SUBMISSION_SUCCESS', payload: result });
      playRewardSound();
    },
    onError: (error) => {
      let friendly = 'We could not submit your answer. Please try again.';
      const raw = error?.message;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.detail === 'string') {
            friendly = parsed.detail;
          } else if (typeof raw === 'string' && raw.trim().length > 0) {
            friendly = raw;
          }
        } catch {
          friendly = raw;
        }
      }
      dispatchSession({ type: 'SUBMISSION_ERROR', payload: { message: friendly } });
    },
  });

  const startSession = useCallback(() => {
    if (!dailyQuestion) {
      return;
    }
    if (locked || dailyQuestion.hasAnsweredToday) {
      dispatchSession({
        type: 'SUBMISSION_ERROR',
        payload: { message: ALREADY_ANSWERED_MESSAGE },
      });
      return;
    }
    markPrimingSeen();
    dispatchSession({
      type: 'START_SESSION',
      payload: { timestamp: Date.now(), timerSeconds: dailyQuestion.timerSeconds },
    });
    if (questionSectionRef.current) {
      questionSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    requestAnimationFrame(() => {
      if (answerRef.current) {
        answerRef.current.focus({ preventScroll: true });
      }
    });
  }, [dailyQuestion, dispatchSession, locked, markPrimingSeen]);

  const handleStart = () => {
    startSession();
  };

  const handleAnswerChange = useCallback(
    (value: string) => {
      dispatchSession({ type: 'SET_ANSWER', payload: value });
    },
    [dispatchSession],
  );

  const handleSubmit = () => {
    if (!dailyQuestion || answer.trim().length === 0) {
      return;
    }
    if (locked || dailyQuestion.hasAnsweredToday) {
      dispatchSession({
        type: 'SUBMISSION_ERROR',
        payload: { message: ALREADY_ANSWERED_MESSAGE },
      });
      return;
    }
    const elapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    const durationSeconds = Math.max(0, Math.min(dailyQuestion.timerSeconds, elapsed));
    dispatchSession({
      type: 'SUBMISSION_PENDING',
      payload: { durationSeconds, timerSeconds: dailyQuestion.timerSeconds },
    });
    mutation.mutate({
      questionId: dailyQuestion.id,
      answer,
      userId: resolvedUserId ?? undefined,
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
  const alreadyAnsweredToday = locked || Boolean(dailyQuestion?.hasAnsweredToday);
  const lockedMessage = alreadyAnsweredToday ? ALREADY_ANSWERED_MESSAGE : null;

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
  }, [previousFeedback]);

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
  }, [previousFeedback]);

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
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Think deeper. Feel sharper.
          </h1>
          <p className="text-sm uppercase tracking-[0.4em] text-zinc-600 dark:text-zinc-400">Breathe. Begin.</p>
        </header>
        <div className="flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/60 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
            {streak > 0 ? (
              <>
                <span>{streak} days in bloom</span>
                <span>·</span>
                <span>
                  {weekProgress.completedDays}/{weekProgress.totalDays}
                </span>
              </>
            ) : (
              <span>Day one mindset</span>
            )}
          </div>
          <div className="w-full max-w-md">
            <AuthPanel />
          </div>
        </div>

        {status === 'loading' ? (
          <div className="flex h-64 w-full items-center justify-center rounded-3xl border border-dashed border-zinc-300 text-zinc-500">
            Quietly loading today&apos;s reflection...
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">
            <p className="font-semibold">Signal dropped.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center rounded-full border border-red-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
            >
              Retry
            </button>
          </div>
        ) : null}

        {dailyQuestion && status === 'ready' ? (
          <>
            {/* Stoic minimal mode: skip priming copy */}

            <div ref={questionSectionRef}>
              <QuestionCard
                theme={dailyQuestion.theme}
                prompt={dailyQuestion.prompt}
                hasStarted={hasStarted}
                onStart={handleStart}
                previousFocus={previousFocus}
                sessionTips={sessionTips}
                lockedMessage={lockedMessage}
              />
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.7fr,1fr]">
              <div className="flex flex-col gap-6" ref={writingSectionRef}>
                <div ref={celebrationTriggerRef} />
                <Timer remainingSeconds={secondsRemaining} totalSeconds={dailyQuestion.timerSeconds} />

                {submissionError ? (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-600/40 dark:bg-amber-500/10 dark:text-amber-100">
                    {submissionError}
                  </div>
                ) : null}

                {hasStarted && !isSubmitted && !locked ? (
                  <AnswerForm
                    answer={answer}
                    onChange={handleAnswerChange}
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
                    onClose={() => dispatchSession({ type: 'DISMISS_CELEBRATION' })}
                  />
                )}
              </div>

            </div>
          </>
        ) : null}
      </div>
    </main>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 md:gap-3">
        <FloatingAction href="/focus-tools" label="Focus tools" />
        <FloatingAction href="/growth" label="Growth check-in" />
        <FloatingAction href="/why" label="Why you’ll love Deep" variant="ghost" />
      </div>
    </>
  );
}
