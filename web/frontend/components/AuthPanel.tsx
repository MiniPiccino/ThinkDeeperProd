'use client';

import { FormEvent, useState } from 'react';

import { useAuth } from '@/app/providers';
import { supabaseClient } from '@/lib/supabaseClient';

type AuthMode = 'signin' | 'signup';

export function AuthPanel() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const client = supabaseClient;

  if (!client) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsProcessing(true);
    setMessage(null);
    try {
      if (mode === 'signup') {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}` },
        });
        if (error) {
          throw error;
        }
        setMessage('Check your inbox to confirm your email.');
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
        setMessage('Welcome back!');
      }
      setEmail('');
      setPassword('');
    } catch (error) {
      const err = error as { message?: string };
      setMessage(err.message ?? 'Something went wrong.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOut = async () => {
    setIsProcessing(true);
    setMessage(null);
    try {
      const { error } = await client.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (error) {
      const err = error as { message?: string };
      setMessage(err.message ?? 'Unable to sign out.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return null;
  }

  if (user) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 shadow-sm dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-semibold">Signed in as {user.email ?? user.id}</p>
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200/80">Your streaks and XP are now personal to you.</p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isProcessing}
          className="mt-3 inline-flex items-center rounded-full border border-emerald-500/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 transition hover:border-emerald-600 hover:text-emerald-600 disabled:opacity-50 dark:border-emerald-300/60 dark:text-emerald-100"
        >
          {isProcessing ? 'Signing out…' : 'Sign out'}
        </button>
        {message ? <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-200/80">{message}</p> : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-900 dark:text-slate-100">Save your progress</p>
        <div className="flex gap-1 rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === 'signin' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-slate-50' : 'text-slate-500 dark:text-slate-300'}`}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === 'signup' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-slate-50' : 'text-slate-500 dark:text-slate-300'}`}
            onClick={() => setMode('signup')}
          >
            Register
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          required
        />
      </div>
      <button
        type="submit"
        disabled={isProcessing}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 disabled:opacity-50"
      >
        {isProcessing ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
        {mode === 'signup' ? 'You will receive a verification email.' : 'Forgot your password? Use the Register tab to send a new invite.'}
      </p>
      {message ? <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-300">{message}</p> : null}
    </form>
  );
}
