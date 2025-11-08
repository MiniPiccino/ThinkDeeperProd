'use client';

import { ReactNode } from 'react';

type PrimingModalProps = {
  mode: 'intro' | 'reminder';
  emotionalHook: string;
  teaserQuestion: string;
  somaticCue: string;
  cognitiveCue: string;
  onClose: () => void;
  onBegin?: () => void;
};

const MODE_COPY: Record<PrimingModalProps['mode'], { title: string; lead: ReactNode }> = {
  intro: {
    title: 'Prime your nervous system first',
    lead: (
      <>
        ThinkDeeper sessions work best when feeling leads and thinking follows. Take 30 seconds to let
        today&apos;s theme hit your body before you open the prompt.
      </>
    ),
  },
  reminder: {
    title: 'Drop into the feeling for today',
    lead: (
      <>
        Quick reset: surface the emotion first, then convert it into deliberate reasoning when you
        unlock the prompt.
      </>
    ),
  },
};

export function PrimingModal({
  mode,
  emotionalHook,
  teaserQuestion,
  somaticCue,
  cognitiveCue,
  onClose,
  onBegin,
}: PrimingModalProps) {
  const copy = MODE_COPY[mode];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-rose-300/60 bg-rose-50 p-8 text-rose-950 shadow-2xl dark:border-rose-800/50 dark:bg-rose-950/50 dark:text-rose-100">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold">{copy.title}</h2>
          <p className="text-sm leading-relaxed text-rose-900/80 dark:text-rose-100/80">{copy.lead}</p>
        </header>

        <div className="mt-6 space-y-4 text-sm leading-relaxed">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Feel</p>
            <p className="mt-1">{emotionalHook}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Ask</p>
            <p className="mt-1">{teaserQuestion}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Breathe</p>
            <p className="mt-1">{somaticCue}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Translate</p>
            <p className="mt-1">{cognitiveCue}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-full border border-rose-400/60 px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-500 hover:bg-rose-100 dark:border-rose-700 dark:text-rose-100 dark:hover:border-rose-500 dark:hover:bg-rose-900/60"
        >
          I&apos;ll start in a moment
        </button>
        <button
          type="button"
          onClick={() => {
            onBegin?.();
          }}
          className="inline-flex items-center justify-center rounded-full bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-rose-500"
        >
          I&apos;m ready
        </button>
      </div>
      </div>
    </div>
  );
}
