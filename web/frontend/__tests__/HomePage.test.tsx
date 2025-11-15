import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import HomePage from "@/app/page";
import { Mock, vi } from "vitest";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      let urlString: string;
      if (typeof input === "string") {
        urlString = input;
      } else if (input instanceof URL) {
        urlString = input.toString();
      } else if (typeof Request !== "undefined" && input instanceof Request) {
        urlString = input.url;
      } else {
        urlString = String(input);
      }
      const url = new URL(urlString);

      if (init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            feedback: "Great insight!",
            xpAwarded: 8,
            baseXp: 8,
            bonusXp: 0,
            xpTotal: 18,
            streak: 2,
            evaluatedAt: new Date().toISOString(),
            difficultyLevel: "primer",
            difficultyMultiplier: 1,
            weekCompletedDays: 1,
            weekTotalDays: 7,
            weekBadgeEarned: false,
            badgeName: null,
            level: 1,
            xpToNextLevel: 102,
            nextLevelThreshold: 120,
            xpIntoLevel: 18,
            levelProgressPercent: 15,
          }),
        } as Response;
      }

      if (url.pathname.endsWith("/v1/questions/daily")) {
        return {
          ok: true,
          json: async () => ({
            id: "week-1-day-1",
            prompt: "What makes discipline powerful?",
            theme: "Week 1 — The Stoic Mind",
            weekIndex: 0,
            dayIndex: 0,
            availableOn: "2024-01-01",
            timerSeconds: 300,
            xpTotal: 10,
            streak: 1,
            previousFeedback: null,
            difficulty: {
              label: "primer",
              score: 1,
              multiplier: 1,
            },
            weekProgress: {
              completedDays: 0,
              totalDays: 7,
              badgeEarned: false,
            },
          }),
        } as Response;
      }

      return {
        ok: false,
        text: async () => "Not found",
      } as Response;
    });

    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders daily prompt and handles submission flow", async () => {
    renderWithClient(<HomePage />);

    const startButton = await screen.findByRole("button", { name: /start thinking/i });
    expect(
      screen.queryByRole("heading", { name: /what makes discipline powerful/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(startButton);
    const heading = await screen.findByRole("heading", { name: /what makes discipline powerful/i });
    expect(heading).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "My considered answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    await waitFor(() => expect(screen.getByText("Great insight!")).toBeInTheDocument());
    expect(screen.getByText(/Submission Complete/i)).toBeInTheDocument();
    await waitFor(() => {
      const xpGainLabel = screen.getByText(/XP gained/i);
      const xpGainValue = xpGainLabel.parentElement?.querySelector('div.mt-1');
      expect(xpGainValue?.textContent?.startsWith('+')).toBe(true);
    });
    expect(screen.getByText(/Focus time:/)).toBeInTheDocument();
    expect(screen.getByText(/lightning strike of insight/i)).toBeInTheDocument();

    const overlay = screen.getByTestId("celebration-overlay");
    fireEvent.click(overlay);

    const fetchMock = global.fetch as unknown as Mock;
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    if (postCall) {
      const body = JSON.parse(postCall[1]?.body as string);
      expect(body).toHaveProperty("durationSeconds");
    }
  });
});
