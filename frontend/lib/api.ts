export type DailyQuestionResponse = {
  id: string;
  prompt: string;
  theme: string;
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
  userId?: string;
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type FetchOptions = RequestInit & { headers?: HeadersInit };

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = new URL(path, API_BASE_URL);
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchDailyQuestion(userId?: string): Promise<DailyQuestionResponse> {
  const search = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return request<DailyQuestionResponse>(`/v1/questions/daily${search}`, {
    cache: "no-store",
  });
}

export function submitAnswer(payload: SubmitAnswerPayload): Promise<AnswerResponse> {
  return request<AnswerResponse>("/v1/answers", {
    method: "POST",
    body: JSON.stringify({
      questionId: payload.questionId,
      answer: payload.answer,
      userId: payload.userId,
      durationSeconds: payload.durationSeconds,
    }),
  });
}
