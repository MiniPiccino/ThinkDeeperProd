'use client';

import { FormEvent, forwardRef } from 'react';

type AnswerFormProps = {
  answer: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  disabled?: boolean;
};

export const AnswerForm = forwardRef<HTMLTextAreaElement, AnswerFormProps>(function AnswerForm(
  { answer, onChange, onSubmit, isSubmitting, disabled }: AnswerFormProps,
  ref,
) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 w-full space-y-4"
      aria-label="answer form"
    >
      <label className="flex w-full flex-col">
        <span className="text-sm font-medium text-zinc-600">Your Answer</span>
        <textarea
          value={answer}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Capture your thoughts here. The more concrete and nuanced, the better."
          className="mt-2 h-40 w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 text-base leading-6 text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          disabled={disabled || isSubmitting}
          required
          ref={ref}
        />
      </label>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || disabled || answer.trim().length === 0}
          className="inline-flex items-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          {isSubmitting ? "Scoring..." : "Submit Answer"}
        </button>
      </div>
    </form>
  );
});
