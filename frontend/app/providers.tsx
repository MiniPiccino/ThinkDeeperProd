'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { ReactNode, createContext, useContext, useEffect, useState } from 'react';

import { supabaseClient } from '@/lib/supabaseClient';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

function AuthProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<AuthContextValue>({
    user: null,
    loading: Boolean(supabaseClient),
  });

  useEffect(() => {
    if (!supabaseClient) {
      setValue({ user: null, loading: false });
      return;
    }
    let active = true;

    supabaseClient.auth.getSession().then(({ data }) => {
      if (!active) return;
      setValue({ user: data.session?.user ?? null, loading: false });
    });

    const { data: subscription } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setValue({ user: session?.user ?? null, loading: false });
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <AuthProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </AuthProvider>
  );
}
