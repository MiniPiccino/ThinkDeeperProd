'use client';

type PreviousFocus = {
  feedback: string;
  friendlyFeedback?: string | null;
  capturedOn?: string | null;
};

type QuestionCardProps = {
  theme: string;
  prompt: string;
  onStart?: () => void;
  hasStarted: boolean;
  previousFocus?: PreviousFocus | null;
  sessionTips?: string[];
  challengeNote?: {
    title: string;
    description: string;
  };
};

export function QuestionCard({
  theme,
  prompt,
  onStart,
  hasStarted,
  previousFocus,
  sessionTips = [],
  challengeNote,
}: QuestionCardProps) {
  const focusMessage = previousFocus?.friendlyFeedback ?? previousFocus?.feedback;
  const showPreviousFocus = !hasStarted && Boolean(focusMessage);
  const hasSessionTips = sessionTips.length > 0;

  return (
    <div className="w-full rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm font-medium uppercase tracking-wide text-emerald-600">
        {theme}
      </div>
      {hasStarted ? (
        <h2 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {prompt}
        </h2>
      ) : (
        <p className="mt-4 text-base text-zinc-600 dark:text-zinc-300">
          Press start to reveal today&apos;s question. Take a breath, clear your mind, and then dive in.
        </p>
      )}
      {showPreviousFocus ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 shadow-sm dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-100">
          <p className="font-semibold text-emerald-900 dark:text-emerald-50">Yesterday&apos;s focus</p>
          <p className="mt-2 leading-relaxed">{focusMessage}</p>
          <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-200/80">
            {previousFocus?.capturedOn
              ? `Captured on ${previousFocus.capturedOn}. Keep it in mind as you write today.`
              : "Carry this insight into today's reflection."}
          </p>
        </div>
      ) : null}
      {!hasStarted && challengeNote ? (
        <div className="mt-5 rounded-2xl border border-sky-300/40 bg-sky-50 p-5 text-sm text-sky-900 shadow-sm dark:border-sky-700/40 dark:bg-sky-950/40 dark:text-sky-100">
          <p className="font-semibold text-sky-900 dark:text-sky-100">{challengeNote.title}</p>
          <p className="mt-2 leading-relaxed">{challengeNote.description}</p>
        </div>
      ) : null}
      {!hasStarted ? (
        <button
          type="button"
          onClick={onStart}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-emerald-600"
        >
          Start Thinking
        </button>
      ) : null}
      {hasSessionTips ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
          <p className="font-semibold text-zinc-800 dark:text-zinc-100">Session tips</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {sessionTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
