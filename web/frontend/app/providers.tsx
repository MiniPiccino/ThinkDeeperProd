'use client';

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { ReactNode, createContext, useContext, useEffect, useReducer, useState } from 'react';

import { supabaseClient } from '@/lib/supabaseClient';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [value, dispatch] = useReducer(
    (_: AuthContextValue, next: AuthContextValue) => next,
    {
      user: null,
      loading: Boolean(supabaseClient),
    },
  );

  useEffect(() => {
    if (!supabaseClient) {
      dispatch({ user: null, loading: false });
      return;
    }
    let active = true;

    supabaseClient.auth.getSession().then(({ data }) => {
      if (!active) return;
      dispatch({ user: data.session?.user ?? null, loading: false });
    });

    const { data: subscription } = supabaseClient.auth.onAuthStateChange((event, session) => {
      dispatch({ user: session?.user ?? null, loading: false });
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void queryClient.invalidateQueries();
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

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
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
