import {useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_STORAGE_KEY = 'thinkdeeper.userId';

function generateUserId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const now = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2);
  return `user-${now}-${rand}`;
}

export function useUserIdentifier(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const existing = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (existing) {
          if (mounted) {
            setUserId(existing);
          }
          return;
        }
        const generated = generateUserId();
        await AsyncStorage.setItem(USER_STORAGE_KEY, generated);
        if (mounted) {
          setUserId(generated);
        }
      } catch {
        if (mounted) {
          setUserId(generateUserId());
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return userId;
}
