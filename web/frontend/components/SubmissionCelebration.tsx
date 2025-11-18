'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type SubmissionCelebrationProps = {
  feedback?: string;
  xpGain: number;
  baseXp: number;
  bonusXp: number;
  xpTotal: number;
  streak: number;
  durationSeconds: number;
  difficultyLevel: string;
  difficultyMultiplier: number;
  level: number;
  xpToNextLevel: number;
  xpIntoLevel: number;
  levelProgressPercent: number;
  weekCompletedDays: number;
  weekTotalDays: number;
  weekBadgeEarned: boolean;
  badgeName?: string | null;
  onClose: () => void;
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

export function SubmissionCelebration({
  feedback,
  xpGain,
  baseXp,
  bonusXp,
  xpTotal,
  streak,
  durationSeconds,
  difficultyLevel,
  difficultyMultiplier,
  level,
  xpToNextLevel,
  xpIntoLevel,
  levelProgressPercent,
  weekCompletedDays,
  weekTotalDays,
  weekBadgeEarned,
  badgeName,
  onClose,
}: SubmissionCelebrationProps) {
  const baselineTotal = Math.max(xpTotal - xpGain, 0);
  const targetStreak = Math.max(0, streak);
  const [animatedXp, setAnimatedXp] = useState(0);
  const [animatedTotal, setAnimatedTotal] = useState(baselineTotal);
  const [animatedStreak, setAnimatedStreak] = useState(targetStreak === 0 ? 0 : Math.max(1, targetStreak));
  const [shareState, setShareState] = useState<'idle' | 'success' | 'copied' | 'error'>('idle');
  const levelCapacity = Math.max(xpIntoLevel + xpToNextLevel, 1);
  const targetLevelPercent = Math.min(Math.max(levelProgressPercent, 0), 100);
  const estimatedGainPercent = Math.min(Math.round((xpGain / levelCapacity) * 100), 100);
  const startingLevelPercent = Math.max(targetLevelPercent - estimatedGainPercent, 0);
  const [animatedLevelPercent, setAnimatedLevelPercent] = useState(startingLevelPercent);

  const parsedFeedback = useMemo(() => {
    if (!feedback) {
      return null;
    }
    const trimmed = feedback.trim();
    if (!trimmed) {
      return null;
    }
    const [celebrate, improve] = trimmed.split(/Improve:/i);
    return {
      celebrate: celebrate?.trim() ?? trimmed,
      improve: improve?.trim() ?? null,
    };
  }, [feedback]);

  useEffect(() => {
    let frame: number | null = null;
    let timeout: number | null = null;
    const start = performance.now();
    const duration = 900;

    const finalize = () => {
      setAnimatedXp(xpGain);
      setAnimatedTotal(xpTotal);
      setAnimatedStreak(targetStreak === 0 ? 0 : Math.max(1, targetStreak));
      setAnimatedLevelPercent(targetLevelPercent);
    };

    const animate = (now: number) => {
      const elapsedRaw = (now - start) / duration;
      const clamped = Math.min(Math.max(elapsedRaw, 0), 1);
      const eased = 1 - Math.pow(1 - clamped, 3);
      setAnimatedXp(Math.round(xpGain * eased));
      setAnimatedTotal(Math.round(baselineTotal + (xpTotal - baselineTotal) * eased));
      setAnimatedLevelPercent(Math.round(startingLevelPercent + (targetLevelPercent - startingLevelPercent) * eased));
      if (targetStreak === 0) {
        setAnimatedStreak(0);
      } else {
        setAnimatedStreak(Math.max(1, Math.round(targetStreak * eased)));
      }
      if (clamped < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        finalize();
      }
    };

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame === 'undefined') {
      finalize();
      return;
    }

    frame = requestAnimationFrame(animate);
    timeout = window.setTimeout(finalize, duration + 200);

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
    };
  }, [baselineTotal, startingLevelPercent, targetLevelPercent, targetStreak, xpGain, xpTotal]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const heroFeedback = useMemo(() => {
    if (parsedFeedback?.celebrate) {
      return parsedFeedback.celebrate;
    }
    if (xpGain <= 2) {
      return 'We couldn’t read much. Give the reflection a real attempt.';
    }
    if (xpGain <= 5) {
      return 'Keep it honest—try slowing down and actually answering.';
    }
    if (xpGain >= 18) {
      return 'Legendary insight!';
    }
    if (xpGain >= 12) {
      return 'Strong and thoughtful!';
    }
    if (xpGain >= 8) {
      return 'Solid reflections!';
    }
    return "You're building momentum!";
  }, [parsedFeedback, xpGain]);

  const focusLine = useMemo(() => {
    if (durationSeconds >= 240) {
      return 'Deep focus unlocked — patience is a superpower.';
    }
    if (durationSeconds >= 150) {
      return 'Great pacing. You made space for nuance.';
    }
    if (durationSeconds >= 60) {
      return 'Sharp thinking under pressure!';
    }
    return 'A lightning strike of insight. Stretch it longer tomorrow.';
  }, [durationSeconds]);

  const confettiSeed = useMemo(
    () => level * 997 + xpGain * 37 + streak * 101 + Math.max(weekCompletedDays, 1),
    [level, xpGain, streak, weekCompletedDays],
  );

  const confettiPieces = useMemo(() => {
    const rand = createSeededRandom(confettiSeed);
    return Array.from({ length: 24 }, (_, index) => ({
      key: `confetti-${index}`,
      left: `${Math.round(rand() * 1000) / 10}%`,
      animationDelay: `${(rand() * 0.4).toFixed(2)}s`,
      color: ['bg-emerald-500', 'bg-emerald-300', 'bg-sky-400', 'bg-amber-300', 'bg-violet-400'][index % 5],
    }));
  }, [confettiSeed]);

  const difficultyTag = useMemo(() => {
    const capitalized = difficultyLevel.charAt(0).toUpperCase() + difficultyLevel.slice(1);
    return `${capitalized} | x${difficultyMultiplier.toFixed(2)}`;
  }, [difficultyLevel, difficultyMultiplier]);

  const bonusLine = useMemo(() => {
    if (bonusXp > 0) {
      return `+${bonusXp} bonus XP for a flawless week.`;
    }
    if (xpGain > baseXp) {
      const extra = xpGain - baseXp;
      return `Includes +${extra} insight boost.`;
    }
    return 'Keep stacking those insights.';
  }, [bonusXp, xpGain, baseXp]);

  const levelMessage = useMemo(() => {
    if (xpToNextLevel <= 0) {
      return `Level ${level} mastered - next tier unlocked!`;
    }
    if (levelProgressPercent >= 80) {
      return `Only ${xpToNextLevel} XP until Level ${level + 1}.`;
    }
    return `Level ${level} | ${levelProgressPercent}% toward the next peak.`;
  }, [level, levelProgressPercent, xpToNextLevel]);

  const streakGrid = useMemo(() => {
    const filled = '🟩';
    const empty = '⬜';
    const rows = [];
    const totalWeeks = 52;
    for (let week = 0; week < totalWeeks; week++) {
      const row =
        week === weekTotalDays ? filled.repeat(weekCompletedDays) + empty.repeat(Math.max(weekTotalDays - weekCompletedDays, 0)) : empty.repeat(weekTotalDays);
      rows.push(`Week ${week + 1}: ${row}`);
    }
    return rows.slice(0, 3).join('\n');
  }, [weekCompletedDays, weekTotalDays]);

  const sharePayload = useMemo(() => {
    const shareTitle = 'Think Deeper reflection';
    const summaryParts = [
      `I just completed today's Think Deeper session in ${formatDuration(durationSeconds)}.`,
      `Scored +${xpGain} XP (total ${xpTotal})`,
      targetStreak > 0 ? `and kept my streak at ${targetStreak} days.` : 'and kicked off a new streak.',
      `Current level: ${level} (${levelProgressPercent}% to next).`,
      bonusXp > 0 ? `Week badge unlocked: ${badgeName ?? 'New badge'}.` : `Difficulty: ${difficultyTag}.`,
    ];
    const summary = summaryParts.join(' ');
    const highlight = feedback && feedback.trim().length > 0 ? `Note to self: ${feedback.trim()}` : heroFeedback;
    const url =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://thinkdeeper.app';

    return {
      title: shareTitle,
      text: `${summary}\n${highlight}\n\n${streakGrid}`,
      url,
    };
  }, [
    badgeName,
    bonusXp,
    difficultyTag,
    durationSeconds,
    feedback,
    heroFeedback,
    level,
    levelProgressPercent,
    streakGrid,
    targetStreak,
    xpGain,
    xpTotal,
  ]);

  const shareSupported = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return false;
    }
    return typeof navigator.share === 'function' || typeof navigator.clipboard?.writeText === 'function';
  }, []);
  const handleShare = useCallback(async () => {
    if (typeof navigator === 'undefined') {
      setShareState('error');
      return;
    }

    setShareState('idle');
    const { title, text, url } = sharePayload;
    const combined = `${text}\n${url}`;

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, text, url });
        setShareState('success');
        return;
      }
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(combined);
        setShareState('copied');
        return;
      }
      setShareState('error');
    } catch {
      setShareState('error');
    }
  }, [sharePayload]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        data-testid="celebration-overlay"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-xl">
        <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/40 blur-2xl" />
        <div className="pointer-events-none absolute -right-12 -bottom-12 h-36 w-36 rounded-full bg-sky-400/30 blur-3xl" />
        <div className="relative max-h-[calc(100vh-4rem)] overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-400 to-sky-500 p-[1px] shadow-2xl shadow-emerald-500/30">
          <div className="absolute inset-0 pointer-events-none">
            {confettiPieces.map((piece) => (
              <span
                key={piece.key}
                className={`absolute top-0 h-2 w-2 ${piece.color} opacity-0 rounded-[2px]`}
                style={{
                  left: piece.left,
                  animation: 'pop-fall 1.4s ease-out forwards',
                  animationDelay: piece.animationDelay,
                }}
              />
            ))}
          </div>

          <div
            className="relative flex h-full max-h-[calc(100vh-4.5rem)] w-full flex-col overflow-y-auto rounded-[calc(theme(borderRadius.3xl)-1px)] bg-white/85 p-8 text-center backdrop-blur-lg dark:bg-zinc-950/80"
            style={{ animation: 'rise-card 0.9s ease forwards' }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.55em] text-emerald-600 dark:text-emerald-200">
              Submission Complete
            </div>
            <h3 className="mt-3 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              {heroFeedback}
            </h3>

            <div className="mt-6 grid grid-cols-3 gap-4 text-sm font-medium">
              <div className="rounded-2xl bg-amber-100/80 p-3 text-amber-900 shadow-inner dark:bg-amber-400/15 dark:text-amber-100">
                <div className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-200">
                  XP gained
                </div>
                <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-100">
                  +{animatedXp}
                </div>
                <div className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/70">
                  {bonusXp > 0 ? `Includes +${bonusXp} badge bonus` : `Base insight +${baseXp}`}
                </div>
              </div>
              <div className="rounded-2xl bg-white/80 p-3 text-emerald-900 shadow-inner dark:bg-white/10 dark:text-emerald-200">
                <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                  Total XP
                </div>
                <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-200">
                  {animatedTotal}
                </div>
                <div className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-200/70">
                  {levelMessage}
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-600/15 p-3 text-emerald-900 shadow-inner dark:bg-emerald-500/10 dark:text-emerald-200">
                <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                  Streak
                </div>
                <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-200">
                  {animatedStreak} 🍃
                </div>
                <div className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-200/70">
                  {weekBadgeEarned
                    ? `Week complete | ${weekTotalDays}/${weekTotalDays}`
                    : `Week progress | ${weekCompletedDays}/${weekTotalDays}`}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-emerald-200/70 bg-emerald-50/70 p-5 text-left shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                    Level trajectory
                  </p>
                  <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                    {targetLevelPercent >= 100
                      ? `Level ${level} complete!`
                      : `Level ${level} is ${targetLevelPercent}% charged`}
                  </p>
                </div>
                <p className="text-sm text-emerald-700 dark:text-emerald-200">
                  {xpIntoLevel}/{levelCapacity} XP stored
                </p>
              </div>
              <div className="mt-3 h-3 w-full rounded-full bg-emerald-200/60 dark:bg-emerald-500/20">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-300 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(Math.max(animatedLevelPercent, 0), 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                {levelMessage}
              </p>
            </div>

            {parsedFeedback ? (
              <div className="mt-5 rounded-3xl border border-zinc-200 bg-white/90 p-5 text-left shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  Coach response
                </p>
                <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {parsedFeedback.celebrate}
                </p>
                {parsedFeedback.improve ? (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-200">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300">Improve:</span>{' '}
                    {parsedFeedback.improve}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 text-left text-sm md:grid-cols-2">
              <div className="rounded-2xl border border-sky-400/40 bg-sky-900/20 p-4 text-sky-100 shadow">
                <p className="text-xs uppercase tracking-wide text-sky-300">Today&apos;s challenge</p>
                <p className="mt-2 text-lg font-semibold capitalize text-sky-100">{difficultyLevel}</p>
                <p className="mt-1 text-xs text-sky-200">Multiplier x{difficultyMultiplier.toFixed(2)}</p>
                <p className="mt-3 text-xs text-sky-200/80">{bonusLine}</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-900/20 p-4 text-emerald-100 shadow">
                <p className="text-xs uppercase tracking-wide text-emerald-300">Level momentum</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-lg font-semibold text-emerald-50">Level {level}</span>
                  <span className="text-xs text-emerald-200">{levelProgressPercent}%</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-emerald-800/40">
                  <div
                    className="h-2 rounded-full bg-emerald-400 transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.min(levelProgressPercent, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-emerald-200/80">
                  {xpToNextLevel > 0 ? `${xpIntoLevel} XP in | ${xpToNextLevel} XP to go` : 'Level up achieved!'}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
              <div className="rounded-2xl bg-white/75 p-4 text-zinc-700 shadow dark:bg-white/10 dark:text-zinc-200">
                <span className="font-semibold text-sky-700 dark:text-sky-200">
                  Focus time:
                </span>{' '}
                {formatDuration(durationSeconds)} of crafted thinking.
                <div className="mt-2 text-xs uppercase tracking-wide text-sky-600 dark:text-sky-200">
                  {focusLine}
                </div>
                <div className="mt-3 text-xs uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-300">
                  Next reflection unlocks tomorrow.
                </div>
              </div>
              <div className="rounded-2xl bg-amber-100/80 p-4 text-amber-900 shadow dark:bg-amber-400/15 dark:text-amber-100">
                <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-200">
                  Week reward
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {weekBadgeEarned ? 'Badge unlocked!' : 'Almost golden.'}
                </p>
                <p className="mt-2 text-xs text-amber-700/80 dark:text-amber-200/70">
                  {weekBadgeEarned
                    ? `You claimed the ${badgeName ?? 'Insight Badge'} and locked a +${bonusXp} bonus streak.`
                    : `Only ${Math.max(weekTotalDays - weekCompletedDays, 0)} day(s) until the ${badgeName ?? 'Insight Badge'}.`}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleShare}
                disabled={!shareSupported}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
              >
                {shareSupported ? 'Share your streak' : 'Share (copy unavailable)'}
              </button>
              <Link
                href="/growth?treeAnimation=celebration"
                prefetch={false}
                className="inline-flex items-center justify-center rounded-full border border-emerald-400/50 px-5 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 hover:text-emerald-50"
              >
                Go to growth check-in →
              </Link>
              {shareState === 'success' ? (
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                  Shared! Spread the momentum.
                </p>
              ) : null}
              {shareState === 'copied' ? (
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                  Link copied. Drop it to invite someone in.
                </p>
              ) : null}
              {shareState === 'error' ? (
                <p className="text-xs font-medium uppercase tracking-wide text-red-500 dark:text-red-300">
                  Couldn&apos;t share just now. Try again later.
                </p>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-emerald-500/40 px-5 py-2 text-sm font-semibold text-emerald-600 transition hover:border-emerald-500 hover:text-emerald-500 dark:border-emerald-300/40 dark:text-emerald-200 dark:hover:border-emerald-200"
              >
                Back to dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes pop-fall {
            0% {
              transform: translateY(-40%) rotate(0deg) scale(0.8);
              opacity: 0;
            }
            20% {
              opacity: 1;
            }
            100% {
              transform: translateY(160%) rotate(260deg) scale(1);
              opacity: 0;
            }
          }

          @keyframes rise-card {
            0% {
              transform: translateY(32px) scale(0.92);
              opacity: 0;
            }
            55% {
              transform: translateY(-8px) scale(1.04);
              opacity: 1;
            }
            100% {
              transform: translateY(0) scale(1);
            }
          }`,
        }}
      />
    </div>
  );
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
