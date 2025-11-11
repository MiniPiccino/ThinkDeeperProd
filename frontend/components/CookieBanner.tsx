'use client';

import { useEffect, useReducer } from 'react';

const STORAGE_KEY = 'thinkdeeper-cookie-consent';

type ConsentState = 'unknown' | 'accepted' | 'declined';

/**
 * Minimal cookie banner that records consent in localStorage and
 * exposes hooks for analytics / tracking vendors to read.
 */
export function CookieBanner() {
  const [state, dispatch] = useReducer(
    (_: ConsentState, next: ConsentState) => next,
    'unknown',
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ConsentState | null;
      if (stored === 'accepted' || stored === 'declined') {
        dispatch(stored);
      }
    } catch {
      // Ignore storage errors (e.g., Safari private mode).
    }
  }, []);

  useEffect(() => {
    if (state === 'accepted') {
      document.dispatchEvent(new Event('thinkdeeper-consent-granted'));
    }
    if (state === 'declined') {
      document.dispatchEvent(new Event('thinkdeeper-consent-denied'));
    }
  }, [state]);

  const setConsent = (value: ConsentState) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore storage errors.
    }
    dispatch(value);
  };

  if (state !== 'unknown') return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-black/90 px-6 py-4 text-sm text-white shadow-lg md:flex md:items-center md:justify-between">
      <div className="md:w-2/3">
        We use cookies and local storage to keep you signed in, remember preferences, and measure
        product usage. By clicking &ldquo;Accept&rdquo; you consent to non-essential tracking. You
        can learn more in our{' '}
        <a className="underline" href="/cookies">
          Cookie Policy
        </a>
        .
      </div>
      <div className="mt-3 flex gap-3 md:mt-0">
        <button
          type="button"
          className="rounded-md border border-white/40 px-4 py-2 text-white transition hover:border-white hover:bg-white/10"
          onClick={() => setConsent('declined')}
        >
          Decline
        </button>
        <button
          type="button"
          className="rounded-md bg-white px-4 py-2 font-medium text-black transition hover:bg-white/90"
          onClick={() => setConsent('accepted')}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
