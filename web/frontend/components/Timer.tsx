'use client';

import { useEffect } from 'react';

type TimerProps = {
  remainingSeconds: number;
  totalSeconds: number;
  onExpire?: () => void;
};

export function Timer({ remainingSeconds, totalSeconds, onExpire }: TimerProps) {
  const boundedRemaining = Math.max(0, remainingSeconds);
  const progress = Math.max(
    0,
    Math.min(100, (boundedRemaining / totalSeconds) * 100),
  );
  const minutes = Math.floor(boundedRemaining / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(boundedRemaining % 60)
    .toString()
    .padStart(2, '0');

  useEffect(() => {
    if (boundedRemaining === 0 && onExpire) {
      onExpire();
    }
  }, [boundedRemaining, onExpire]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm font-medium text-zinc-500">
        <span>Time Remaining</span>
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          {minutes}:{seconds}
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-2 rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${progress}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}
