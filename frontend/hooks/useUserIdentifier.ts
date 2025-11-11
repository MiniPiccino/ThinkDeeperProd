import { useEffect, useReducer } from 'react';

import { useAuth } from '@/app/providers';

const USER_STORAGE_KEY = 'thinkdeeper.userId';

type GuestIdState = string | null;

function generateUserId() {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const buffer = new Uint8Array(16);
      crypto.getRandomValues(buffer);
      buffer[6] = (buffer[6] & 0x0f) | 0x40;
      buffer[8] = (buffer[8] & 0x3f) | 0x80;
      const hex = [...buffer].map((b) => b.toString(16).padStart(2, '0'));
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
        .slice(8, 10)
        .join('')}-${hex.slice(10, 16).join('')}`;
    }
  }
  return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useUserIdentifier(): string | null {
  const { user } = useAuth();
  const [guestId, dispatchGuestId] = useReducer(
    (_state: GuestIdState, next: GuestIdState) => next,
    null,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    let existing = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!existing) {
      const generated = generateUserId();
      window.localStorage.setItem(USER_STORAGE_KEY, generated);
      existing = generated;
    }
    dispatchGuestId(existing);
  }, []);

  return user?.id ?? guestId;
}
