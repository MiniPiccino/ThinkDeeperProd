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

const API_BASE_URL = 'http://10.0.2.2:8000';

type FetchOptions = RequestInit & {headers?: HeadersInit};

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const base = API_BASE_URL.replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchDailyQuestion(
  userId?: string,
): Promise<DailyQuestionResponse> {
  const search = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return request<DailyQuestionResponse>(`/v1/questions/daily${search}`);
}
