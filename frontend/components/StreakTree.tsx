'use client';

import { useMemo } from 'react';

type StreakTreeProps = {
  streak: number;
  weekCompletedDays: number;
  weekTotalDays: number;
  currentWeekIndex: number;
};

const SEASON_COLORS = [
  { trunk: 'from-slate-500 to-slate-200', leaves: '#e0f2fe', bare: 'rgba(255,255,255,0.2)' }, // winter
  { trunk: 'from-emerald-700 to-emerald-400', leaves: '#86efac', bare: 'rgba(255,255,255,0.2)' }, // spring
  { trunk: 'from-amber-700 to-amber-400', leaves: '#fcd34d', bare: 'rgba(255,255,255,0.2)' }, // summer
  { trunk: 'from-orange-800 to-red-400', leaves: '#fb923c', bare: 'rgba(255,255,255,0.2)' }, // autumn
];

export function StreakTree({ streak, weekCompletedDays, weekTotalDays, currentWeekIndex }: StreakTreeProps) {
  const branches = useMemo(() => {
    return Array.from({ length: weekTotalDays }, (_, day) => ({
      filled: day < weekCompletedDays,
      missed: day >= weekCompletedDays,
    }));
  }, [weekCompletedDays, weekTotalDays]);

  const season = SEASON_COLORS[Math.floor((currentWeekIndex % 52) / 13)];

  return (
    <div className="rounded-3xl border border-emerald-300/40 bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 p-6 text-sm text-emerald-100 shadow-lg">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
        <span>Streak tree</span>
        <span>{streak} days</span>
      </div>
      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="relative h-48 w-full max-w-sm">
          <div className={`absolute inset-x-1/2 bottom-0 h-36 w-1 -translate-x-1/2 rounded-full bg-gradient-to-t ${season.trunk}`} />
          {branches.map((branch, index) => (
            <Branch key={index} index={index} filled={branch.filled} weekTotalDays={weekTotalDays} season={season} />
          ))}
        </div>
        <p className="text-xs text-emerald-200/80">
          Each branch is a day this week. Missed days stay bare until you loop around.
        </p>
      </div>
    </div>
  );
}

function Branch({
  index,
  filled,
  weekTotalDays,
  season,
}: {
  index: number;
  filled: boolean;
  weekTotalDays: number;
  season: { trunk: string; leaves: string; bare: string };
}) {
  const angle = ((index / Math.max(weekTotalDays - 1, 1)) - 0.5) * 60;
  return (
    <div
      className="absolute bottom-12 left-1/2 origin-bottom rounded-full"
      style={{
        transform: `rotate(${angle}deg) translateX(-50%)`,
        height: '80px',
        width: '4px',
        background: filled ? 'linear-gradient(180deg, #34d399, #059669)' : season.bare,
      }}
    >
      <span
        className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full"
        style={{ background: filled ? season.leaves : season.bare }}
      />
    </div>
  );
}
