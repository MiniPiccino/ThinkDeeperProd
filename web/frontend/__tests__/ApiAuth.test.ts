import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, refreshSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabaseClient: {
    auth: { getSession, refreshSession, signOut },
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
    refreshSession.mockResolvedValue({
      data: { session: { access_token: "refreshed-access-token" } },
      error: null,
    });
    signOut.mockResolvedValue({ error: null });
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

  it("refreshes an expired token once and retries with the new access token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ detail: "expired" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ feedback: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);

    await submitAnswer({ questionId: "week-1-day-1", answer: "Answer", durationSeconds: 10 });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer refreshed-access-token");
  });

  it("signs out locally and fails closed when token refresh fails", async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("refresh failed") });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: "expired" }),
    }));

    await expect(
      submitAnswer({ questionId: "week-1-day-1", answer: "Answer", durationSeconds: 10 }),
    ).rejects.toThrow("Your session expired. Please sign in again.");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
