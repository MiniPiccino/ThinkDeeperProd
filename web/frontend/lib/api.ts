import { supabaseClient } from "@/lib/supabaseClient";

export type DailyQuestionResponse = {
  id: string;
  prompt: string;
  theme: string;
  nextTheme?: string | null;
  weekIndex: number;
  dayIndex: number;
  availableOn: string;
  timerSeconds: number;
  xpTotal: number;
  streak: number;
  previousFeedback: {
    feedback: string;
    submittedAt: string;
    questionId: string;
  } | null;
  priming?: {
    emotionalHook: string;
    teaserQuestion: string;
    somaticCue: string;
    cognitiveCue: string;
  };
  difficulty: {
    label: string;
    score: number;
    multiplier: number;
  };
  weekProgress: {
    completedDays: number;
    totalDays: number;
    badgeEarned: boolean;
  };
  hasAnsweredToday?: boolean;
  dopamine?: {
    curiosityHook?: string;
    curiosityPrompts?: string[];
    activeDifficulty?: string;
    challengeModes?: Array<{
      label: string;
      description: string;
      multiplier?: number;
      unlocked?: boolean;
    }>;
    rewardHighlights?: Array<{
      title: string;
      description: string;
      earned?: boolean;
    }>;
    anticipationTeaser?: string;
    nextPromptAvailableAt?: string;
  };
};

export type SubmitAnswerPayload = {
  questionId: string;
  answer: string;
  durationSeconds: number;
};

export type AnswerResponse = {
  feedback: string;
  xpAwarded: number;
  baseXp: number;
  bonusXp: number;
  xpTotal: number;
  streak: number;
  evaluatedAt: string;
  difficultyLevel: string;
  difficultyMultiplier: number;
  weekCompletedDays: number;
  weekTotalDays: number;
  weekBadgeEarned: boolean;
  badgeName: string | null;
  level: number;
  xpToNextLevel: number;
  nextLevelThreshold: number;
  xpIntoLevel: number;
  levelProgressPercent: number;
};

export type ReflectionEntry = {
  questionId: string;
  prompt: string;
  theme: string;
  answeredAt: string;
  xpAwarded: number;
  durationSeconds: number;
  excerpt: string;
  answer: string;
  feedback?: string | null;
};

export type ReflectionDaySummary = {
  date: string;
  weekday: string;
  hasEntry: boolean;
  entry?: ReflectionEntry | null;
};

export type ReflectionTeaser = {
  questionId: string;
  prompt: string;
  answeredAt: string;
  snippet: string;
};

export type ReflectionOverview = {
  plan: string;
  today?: ReflectionEntry | null;
  todayLocked: boolean;
  week: ReflectionDaySummary[];
  teasers: ReflectionTeaser[];
  timelineUnlocked: boolean;
  answeredDates?: string[];
};

export type ReflectionHistoryItem = {
  answeredAt: string;
  prompt: string;
  theme: string;
  questionId: string;
  excerpt: string;
  xpAwarded: number;
  durationSeconds: number;
};

export type CheckoutResponse = {
  checkoutUrl: string;
};

export type PaddleClientTokenResponse = {
  token: string;
};

export type PaddleConfirmResponse = {
  confirmed: boolean;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

type FetchOptions = RequestInit & {
  headers?: HeadersInit;
  auth?: "optional" | "required";
};

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { auth, ...fetchOptions } = options;
  let accessToken: string | null = null;
  if (auth && supabaseClient) {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      throw new Error("Unable to verify your session. Please sign in again.");
    }
    accessToken = data.session?.access_token ?? null;
  }
  if (auth === "required" && !accessToken) {
    throw new Error("Sign in to continue.");
  }
  const url = new URL(path, API_BASE_URL);
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchDailyQuestion(): Promise<DailyQuestionResponse> {
  if (USE_MOCKS) {
    return Promise.resolve(mockDailyQuestion);
  }
  return request<DailyQuestionResponse>("/v1/questions/daily", {
    cache: "no-store",
    auth: "optional",
  });
}

export function submitAnswer(payload: SubmitAnswerPayload): Promise<AnswerResponse> {
  if (USE_MOCKS) {
    return Promise.resolve(mockAnswerResponse);
  }
  return request<AnswerResponse>("/v1/answers", {
    method: "POST",
    body: JSON.stringify({
      questionId: payload.questionId,
      answer: payload.answer,
      durationSeconds: payload.durationSeconds,
    }),
    auth: "required",
  });
}

export function fetchReflectionOverview(timezoneOffsetMinutes: number): Promise<ReflectionOverview> {
  const params = new URLSearchParams({ timezoneOffsetMinutes: timezoneOffsetMinutes.toString() });
  return request<ReflectionOverview>(`/v1/reflections/overview?${params.toString()}`, {
    cache: "no-store",
    auth: "required",
  });
}

export function fetchReflectionHistory(limit = 50, search?: string): Promise<ReflectionHistoryItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (search) {
    params.set("q", search);
  }
  return request<ReflectionHistoryItem[]>(`/v1/reflections/history?${params.toString()}`, {
    cache: "no-store",
    auth: "required",
  });
}

export function createCheckoutSession(successUrl?: string, cancelUrl?: string, priceId?: string): Promise<CheckoutResponse> {
  return request<CheckoutResponse>("/v1/billing/checkout", {
    method: "POST",
    body: JSON.stringify({
      successUrl,
      cancelUrl,
      priceId,
    }),
    auth: "required",
  });
}

export function createPaddleClientToken(): Promise<PaddleClientTokenResponse> {
  return request<PaddleClientTokenResponse>("/v1/billing/client-token", {
    method: "POST",
    body: JSON.stringify({}),
    auth: "required",
  });
}

export function confirmPaddleTransaction(transactionId: string): Promise<PaddleConfirmResponse> {
  return request<PaddleConfirmResponse>("/v1/billing/confirm", {
    method: "POST",
    body: JSON.stringify({ transactionId }),
    auth: "required",
  });
}

const baselineMockDailyQuestion: DailyQuestionResponse = {
  id: "week-5-day-3",
  prompt: "Is comfort a distraction from purpose?",
  theme: "Week 5 — Truth and Lies",
  weekIndex: 4,
  dayIndex: 2,
  availableOn: new Date().toISOString(),
  timerSeconds: 300,
  xpTotal: 75,
  streak: 3,
  previousFeedback: {
    feedback: "Nice depth yesterday! Improve: add an example to ground the idea.",
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
    questionId: "week-5-day-2",
  },
  priming: {
    emotionalHook: "Let today’s question nudge the gut feeling that shows up when you think about distraction versus purpose.",
    teaserQuestion: "What does that feeling ask before your rational mind edits it?",
    somaticCue: "Take one 4-6 breath and name the feeling out loud.",
    cognitiveCue: "When the reflection unlocks, turn the feeling into one bold claim you can test.",
  },
  difficulty: {
    label: "deepening",
    score: 3,
    multiplier: 1.15,
  },
  weekProgress: {
    completedDays: 2,
    totalDays: 7,
    badgeEarned: false,
  },
  hasAnsweredToday: false,
  dopamine: {
    curiosityHook: "Prime your mind around truth vs. comfort today.",
    curiosityPrompts: [
      "Theme focus: Truth and Lies",
      "Day 3 of 7 in this chapter",
      "Where does honesty pinch the most?",
    ],
    activeDifficulty: "deepening",
    challengeModes: [
      { label: "Primer flow", description: "Ease back in with lighter nuance.", multiplier: 1, unlocked: true },
      { label: "Deepening", description: "Pull apart comfort vs purpose for more insight.", multiplier: 1.15, unlocked: true },
      { label: "Mastery", description: "Defend a bold claim about honesty.", multiplier: 1.35, unlocked: false },
    ],
    rewardHighlights: [
      { title: "Total XP", description: "75 XP so far", earned: true },
      { title: "Streak", description: "3 days alive", earned: true },
      { title: "Weekly badge", description: "5 sessions left until badge", earned: false },
    ],
    anticipationTeaser: "Tomorrow tests whether you’ll act on what you write today.",
    nextPromptAvailableAt: new Date(Date.now() + 86400000).toISOString(),
  },
};

const mockDailyQuestion: DailyQuestionResponse = baselineMockDailyQuestion;

const mockAnswerResponse: AnswerResponse = {
  feedback: "Loved the honesty. Improve: add a concrete scenario.",
  xpAwarded: 14,
  baseXp: 12,
  bonusXp: 2,
  xpTotal: 89,
  streak: 4,
  evaluatedAt: new Date().toISOString(),
  difficultyLevel: "deepening",
  difficultyMultiplier: 1.15,
  weekCompletedDays: 3,
  weekTotalDays: 7,
  weekBadgeEarned: false,
  badgeName: null,
  level: 2,
  xpToNextLevel: 151,
  nextLevelThreshold: 240,
  xpIntoLevel: 89,
  levelProgressPercent: 37,
};
