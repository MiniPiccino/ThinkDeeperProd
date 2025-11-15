'use client';

type EvaluatingInsightProps = {
  message?: string;
  className?: string;
};

const DOTS = Array.from({ length: 3 });

export function EvaluatingInsight({ message = '🧠 Evaluating your insight...', className }: EvaluatingInsightProps) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border border-sky-500/40 bg-gradient-to-r from-sky-900/60 via-sky-900/40 to-emerald-900/40 px-4 py-3 text-sky-100 shadow-inner ${className ?? ''}`.trim()}
    >
      <span className="font-medium">{message}</span>
      <span className="flex gap-1">
        {DOTS.map((_, index) => (
          <span
            key={`pulse-${index}`}
            className="h-2 w-2 rounded-full bg-sky-200"
            style={{
              animation: 'pulse-dot 1.2s ease-in-out infinite',
              animationDelay: `${index * 0.2}s`,
            }}
          />
        ))}
      </span>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes pulse-dot {
            0%, 100% { opacity: 0.2; transform: scale(0.9); }
            50% { opacity: 1; transform: scale(1.15); }
          }`,
        }}
      />
    </div>
  );
}
