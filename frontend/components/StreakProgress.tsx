'use client';

type StreakProgressProps = {
  streak: number;
  weekCompletedDays: number;
  weekTotalDays: number;
  badgeEarned: boolean;
  badgeName?: string | null;
  className?: string;
};

const SEGMENT_COLORS = {
  active: 'bg-emerald-400',
  future: 'bg-emerald-900/30',
  badge: 'bg-amber-400',
};

export function StreakProgress({
  streak,
  weekCompletedDays,
  weekTotalDays,
  badgeEarned,
  badgeName,
  className,
}: StreakProgressProps) {
  const segments = Array.from({ length: weekTotalDays }, (_, index) => {
    const filled = index < weekCompletedDays;
    const color =
      badgeEarned && filled && index === weekTotalDays - 1
        ? SEGMENT_COLORS.badge
        : filled
        ? SEGMENT_COLORS.active
        : SEGMENT_COLORS.future;
    return (
      <span
        key={`week-day-${index}`}
        className={`h-2 flex-1 rounded-full transition-colors ${color}`}
      />
    );
  });

  return (
    <div
      className={`w-full rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 p-6 text-emerald-100 shadow-lg ${className ?? ''}`.trim()}
    >
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
        <span>Streak</span>
        <span>{streak} days</span>
      </div>
      <p className="mt-3 text-lg font-semibold text-emerald-50">
        Keep the green glow alive.
      </p>
      <div className="mt-5 flex gap-2">{segments}</div>
      <p className="mt-4 text-xs text-emerald-200/90">
        {badgeEarned
          ? `Badge unlocked: ${badgeName ?? 'Week accomplished!'}` 
          : `Week progress: ${weekCompletedDays}/${weekTotalDays}. Finish the circuit to claim the gold.`}
      </p>
    </div>
  );
}
