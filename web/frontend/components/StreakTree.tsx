'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type StreakReplayProps = {
  streak: number;
  weekCompletedDays: number;
  weekTotalDays: number;
  currentWeekIndex: number;
  dayOfWeekIndex?: number | null;
  answeredIndices?: number[];
  focusDayIndex?: number | null;
  focusMode?: 'none' | 'focus' | 'bloom';
};

const TOTAL_WEEKS = 52;
const DAYS_PER_WEEK = 7;
const TILE_SIZE = 14;
const GRID_COLUMNS = 7;
const GRID_GAP = 4;
const GRID_MAX_HEIGHT = 320;
const OVERVIEW_DURATION_MS = 2700;

export function StreakReplay({
  streak,
  weekCompletedDays,
  weekTotalDays,
  currentWeekIndex,
  dayOfWeekIndex,
  answeredIndices = [],
  focusDayIndex,
  focusMode,
}: StreakReplayProps) {
  const normalizedWeekIndex = ((currentWeekIndex % TOTAL_WEEKS) + TOTAL_WEEKS) % TOTAL_WEEKS;
  const cappedWeekDays = Math.max(Math.min(weekCompletedDays, DAYS_PER_WEEK), 0);
  const baseDayPointer =
    dayOfWeekIndex == null
      ? cappedWeekDays > 0
        ? cappedWeekDays - 1
        : 0
      : Math.max(Math.min(dayOfWeekIndex, DAYS_PER_WEEK - 1), 0);
  const clampedFocusDay =
    focusDayIndex == null ? null : Math.max(Math.min(focusDayIndex, DAYS_PER_WEEK - 1), 0);
  const dayPointer = clampedFocusDay ?? baseDayPointer;

  const totalDays = TOTAL_WEEKS * DAYS_PER_WEEK;
  const streakClamped = Math.min(Math.max(streak, 0), totalDays);
  const rangeEnd = streakClamped > 0 ? Math.min(normalizedWeekIndex * DAYS_PER_WEEK + dayPointer, totalDays - 1) : -1;
  const rangeStart = streakClamped > 0 ? Math.max(rangeEnd - streakClamped + 1, 0) : -1;

  const [stage, setStage] = useState<'overview' | 'closeup'>('overview');
  const stageOverride =
    typeof focusMode === 'undefined' ? null : focusMode === 'none' ? 'overview' : 'closeup';
  const displayStage = stageOverride ?? stage;
  const [cycleKey, setCycleKey] = useState(0);

  const restartJourney = useCallback(() => {
    setStage('overview');
    setCycleKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const reset = window.setTimeout(() => restartJourney(), 0);
    return () => window.clearTimeout(reset);
  }, [restartJourney, normalizedWeekIndex, streakClamped]);

  useEffect(() => {
    if (stageOverride !== null) {
      return;
    }
    if (stage !== 'overview') {
      return;
    }
    const timer = window.setTimeout(() => setStage('closeup'), OVERVIEW_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [stage, cycleKey, stageOverride]);

  const answeredSet = useMemo(() => new Set(answeredIndices), [answeredIndices]);

  const tiles = useMemo<TileState[]>(() => {
    return Array.from({ length: totalDays }, (_, index) => {
      const defaultFilled = index >= rangeStart && index <= rangeEnd && streakClamped > 0;
      const filled = answeredSet.size > 0 ? answeredSet.has(index) : defaultFilled;
      const weekIndex = Math.floor(index / DAYS_PER_WEEK);
      const dayIndex = index % DAYS_PER_WEEK;
      const palette = paletteForWeek(weekIndex);
      const isCurrentWeek = weekIndex === normalizedWeekIndex;
      const isCurrentDay = isCurrentWeek && dayIndex === dayPointer;
      const answered = (isCurrentWeek && dayIndex < weekCompletedDays) || answeredSet.has(index);
      const answeredHistoric = !isCurrentWeek && answeredSet.has(index);
      return {
        ...palette,
        filled,
        isCurrentWeek,
        isCurrentDay,
        weekIndex,
        dayIndex,
        answered,
        answeredHistoric,
      };
    });
  }, [
    rangeStart,
    rangeEnd,
    streakClamped,
    normalizedWeekIndex,
    dayPointer,
    totalDays,
    weekCompletedDays,
    answeredSet,
  ]);

  const overviewRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (displayStage !== 'overview') {
      return;
    }
    const container = overviewRef.current;
    if (!container) {
      return;
    }
    const rowHeight = TILE_SIZE + GRID_GAP;
    const activeRowTop = normalizedWeekIndex * rowHeight;
    const start = container.scrollTop;
    const target = Math.max(activeRowTop - container.clientHeight / 2 + TILE_SIZE, 0);
    const distance = target - start;
    const duration = 1600;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      container.scrollTop = start + distance * eased;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [displayStage, normalizedWeekIndex]);

  return (
    <div className="rounded-3xl border border-emerald-300/40 bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 p-6 text-sm text-emerald-100 shadow-lg">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
        <span>Streak replay</span>
        <span>
          {streak} days <span className="text-emerald-400">streak</span>
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div className="rounded-[36px] border border-emerald-500/30 bg-gradient-to-b from-emerald-950/70 via-emerald-950 to-zinc-950 p-6">
          <div className="space-y-4">
            {displayStage === 'overview' ? (
              <div className="transition-opacity duration-500 opacity-100">
                <p className="text-center text-xs uppercase tracking-[0.35em] text-emerald-200/70">
                  52 weeks × 7 days. Square = day. Row = week.
                </p>
                <div className="mt-6 flex justify-center">
                  <div
                    ref={overviewRef}
                    className="relative overflow-hidden rounded-2xl border border-emerald-700/30 bg-emerald-950/60 p-3"
                    style={{ maxHeight: GRID_MAX_HEIGHT }}
                  >
                    <HighlightStrip index={normalizedWeekIndex} />
                    <div
                      className="relative grid"
                      style={{
                        gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${TILE_SIZE}px)`,
                        gap: GRID_GAP,
                      }}
                    >
                      {tiles.map((tile, index) => (
                        <Tile key={`tile-${index}`} tile={tile} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {displayStage === 'closeup' ? (
              <div className="transition duration-500">
                <CloseupWeek
                  weekIndex={normalizedWeekIndex}
                  tiles={tiles.slice(normalizedWeekIndex * DAYS_PER_WEEK, normalizedWeekIndex * DAYS_PER_WEEK + DAYS_PER_WEEK)}
                  weekCompletedDays={Math.min(weekCompletedDays, weekTotalDays)}
                  weekTotalDays={weekTotalDays}
                />
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={restartJourney}
                    className="inline-flex items-center rounded-full border border-emerald-400/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-50"
                  >
                    Replay
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          70% {
            transform: scale(1.2);
            opacity: 0.5;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes sheen {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

function HighlightStrip({ index }: { index: number }) {
  const rowHeight = TILE_SIZE + GRID_GAP;
  const offset = Math.max(index * rowHeight - GRID_GAP / 2, 0);
  return (
    <div
      className="pointer-events-none absolute left-[-8px] right-[-8px] rounded-xl border border-emerald-400/40 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.25)] transition-all"
      style={{
        top: `${offset}px`,
        height: TILE_SIZE + GRID_GAP,
      }}
    />
  );
}

type TileState = ReturnType<typeof paletteForWeek> & {
  filled: boolean;
  isCurrentWeek: boolean;
  isCurrentDay: boolean;
  weekIndex: number;
  dayIndex: number;
  answered: boolean;
  answeredHistoric: boolean;
};

function Tile({ tile }: { tile: TileState }) {
  let backgroundColor = tile.filledColor;
  let borderColor = tile.filledBorder;
  if (!tile.filled) {
    if (tile.answered || tile.answeredHistoric) {
      backgroundColor = tile.filledColor;
      borderColor = tile.filledBorder;
    } else {
      backgroundColor = tile.emptyColor;
      borderColor = tile.emptyBorder;
    }
  }
  const outlineClass =
    tile.answered || tile.answeredHistoric ? 'outline outline-1 outline-emerald-200/70' : '';

  return (
    <div
      className={`relative overflow-hidden rounded-sm transition duration-300 ${
        tile.filled ? 'shadow-[0_0_12px_rgba(16,185,129,0.55)] animate-[pulse_1.5s_ease-in-out]' : ''
      } ${outlineClass}`}
      style={{
        width: TILE_SIZE,
        height: TILE_SIZE,
        backgroundColor,
        border: `1px solid ${borderColor}`,
        opacity: tile.isCurrentWeek || tile.filled || tile.answered || tile.answeredHistoric ? 1 : 0.35,
      }}
      title={`Week ${tile.weekIndex + 1}, Day ${tile.dayIndex + 1}`}
    >
      {tile.filled ? (
        <span
          className="absolute inset-0 opacity-70"
          style={{
            background: tile.isCurrentDay
              ? `radial-gradient(circle, ${tile.sparkColor} 0%, transparent 60%)`
              : `radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)`,
            filter: 'blur(2px)',
          }}
        />
      ) : null}
      {tile.isCurrentDay ? (
        <>
          <span className="absolute inset-0 rounded-sm border border-emerald-200" />
          <span className="absolute inset-0 rounded-sm border border-emerald-200 animate-ping" />
        </>
      ) : null}
      <span className="absolute inset-0 animate-[sheen_2.4s_linear_infinite] opacity-20" />
    </div>
  );
}

function CloseupWeek({
  weekIndex,
  tiles,
  weekCompletedDays,
  weekTotalDays,
}: {
  weekIndex: number;
  tiles: TileState[];
  weekCompletedDays: number;
  weekTotalDays: number;
}) {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-100 shadow-inner">
      <p className="text-[0.65rem] uppercase tracking-[0.35em] text-emerald-200/80">Close up</p>
      <p className="mt-2 text-sm font-semibold text-center">
        Week {weekIndex + 1} · {weekCompletedDays}/{weekTotalDays} days in bloom
      </p>
      <div className="mt-3 flex items-center justify-center gap-3">
        {tiles.map((tile, index) => (
          <div
            key={`closeup-${index}`}
            className={`relative h-10 w-10 rounded-lg border ${
              tile.filled ? 'shadow-[0_0_14px_rgba(16,185,129,0.6)] animate-[pulse_1.2s_ease-in-out]' : ''
            }`}
            style={{
              borderColor: tile.filled ? tile.filledBorder : tile.emptyBorder,
              backgroundColor: tile.filled ? tile.filledColor : tile.emptyColor,
            }}
            title={`Day ${tile.dayIndex + 1}`}
          >
            {tile.isCurrentDay ? (
              <>
                <span className="absolute inset-0 rounded-lg border border-emerald-200" />
                <span className="absolute inset-0 rounded-lg border border-emerald-200 animate-ping" />
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

type Palette = {
  filledColor: string;
  filledBorder: string;
  emptyColor: string;
  emptyBorder: string;
  sparkColor: string;
};

function paletteForWeek(weekIndex: number): Palette {
  const season = Math.floor((weekIndex % TOTAL_WEEKS) / 13);
  switch (season) {
    case 0:
      return {
        filledColor: '#f8fafc',
        filledBorder: '#cbd5f5',
        emptyColor: '#1f2937',
        emptyBorder: '#475569',
        sparkColor: 'rgba(248,250,252,0.9)',
      };
    case 1:
      return {
        filledColor: '#4ade80',
        filledBorder: '#047857',
        emptyColor: '#064e3b',
        emptyBorder: '#0f766e',
        sparkColor: 'rgba(74,222,128,0.45)',
      };
    case 2:
      return {
        filledColor: '#fde047',
        filledBorder: '#b45309',
        emptyColor: '#713f12',
        emptyBorder: '#a16207',
        sparkColor: 'rgba(253,224,71,0.5)',
      };
    default:
      return {
        filledColor: '#fda4af',
        filledBorder: '#be123c',
        emptyColor: '#4c0519',
        emptyBorder: '#9f1239',
        sparkColor: 'rgba(251,113,133,0.5)',
      };
  }
}
