'use client';

type XpMeterProps = {
  totalXp: number;
  xpGain?: number;
  baseGain?: number;
  bonusGain?: number;
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  levelProgressPercent: number;
  className?: string;
};

export function XpMeter({
  totalXp,
  xpGain = 0,
  baseGain = 0,
  bonusGain = 0,
  level,
  xpIntoLevel,
  xpToNextLevel,
  levelProgressPercent,
  className,
}: XpMeterProps) {
  const levelSpan = Math.max(xpIntoLevel + xpToNextLevel, 1);
  const nearNextLevel = xpToNextLevel <= Math.ceil(levelSpan * 0.25);
  const progressWidth = Math.min(Math.max(levelProgressPercent, 0), 100);
  const bonusActive = bonusGain > 0;

  return (
    <div
      className={`w-full rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 p-6 text-emerald-100 shadow-xl ${className ?? ''}`.trim()}
    >
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300">
        <span>Level {level}</span>
        <span>{progressWidth}%</span>
      </div>
      <div className="mt-4 h-3 w-full rounded-full bg-emerald-900/60">
        <div
          className="h-3 rounded-full bg-emerald-400 transition-[width] duration-700 ease-out"
          style={{ width: `${progressWidth}%` }}
        />
      </div>
      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="text-3xl font-semibold text-emerald-100">
            {totalXp}
            <span className="ml-2 text-sm text-emerald-300">XP</span>
          </p>
          <p className="mt-1 text-xs text-emerald-300/80">
            {xpToNextLevel > 0 ? `${xpToNextLevel} XP to Level ${level + 1}` : 'New tier unlocked - keep stacking.'}
          </p>
        </div>
        {xpGain > 0 ? (
          <div className="flex flex-col items-end text-right">
            <span className="rounded-full bg-amber-400/20 px-3 py-1 text-sm font-semibold text-amber-200">
              +{xpGain} XP
            </span>
            <span className="mt-1 text-[11px] text-amber-200/80">
              Base +{baseGain}
              {bonusActive ? ` | Bonus +${bonusGain}` : ''}
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs leading-relaxed text-emerald-100/90">
        <p className="text-sm font-semibold text-emerald-200">
          {nearNextLevel ? 'Almost there' : 'Keep the momentum'}
        </p>
        <p className="mt-1 text-emerald-100/80">
          {nearNextLevel
            ? `One more deep dive could unlock Level ${level + 1}.`
            : 'Every reflection compounds your insight bank.'}
        </p>
      </div>
    </div>
  );
}
