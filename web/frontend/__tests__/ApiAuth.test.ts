import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/lib/supabaseClient", () => ({
  supabaseClient: {
    auth: { getSession },
  },
}));

import { fetchDailyQuestion, submitAnswer } from "@/lib/api";

describe("API authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      data: { session: { access_token: "signed-access-token" } },
      error: null,
    });
  });

  it("adds the Supabase bearer token and omits selectable user identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ feedback: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await submitAnswer({
      questionId: "week-1-day-1",
      answer: "A considered answer",
      durationSeconds: 90,
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer signed-access-token");
    expect(JSON.parse(init.body)).toEqual({
      questionId: "week-1-day-1",
      answer: "A considered answer",
      durationSeconds: 90,
    });
  });

  it("allows the public daily prompt without a session", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "week-1-day-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchDailyQuestion();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("fails closed when a private request has no session", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(
      submitAnswer({ questionId: "week-1-day-1", answer: "Answer", durationSeconds: 10 }),
    ).rejects.toThrow("Sign in to continue.");
  });
});
