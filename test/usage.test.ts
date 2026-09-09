import { describe, expect, test } from "bun:test";

import {
  CODEX_USAGE_URL,
  UsageCache,
  UsageError,
  fetchCodexUsage,
  normalizeCodexUsage,
  resolveActiveCodexAuth,
  type ActiveCodexAuth,
} from "../src/usage";

const auth: ActiveCodexAuth = {
  provider: "openai-codex",
  accessToken: "header.payload.signature",
  accountId: "account-id",
};

const usageFixture = {
  rate_limit: {
    primary_window: { used_percent: 72, limit_window_seconds: 18_000, reset_at: 1_800_000_000 },
    secondary_window: { used_percent: 40, limit_window_seconds: 604_800, reset_at: 1_800_100_000 },
  },
  rate_limit_reset_credits: { available_count: 1 },
};

describe("normalizeCodexUsage", () => {
  test("uses provider-reported window durations and reset-credit count", () => {
    expect(normalizeCodexUsage(usageFixture)).toEqual({
      windows: [
        { durationSeconds: 18_000, usedPercent: 72, resetAt: new Date(1_800_000_000_000) },
        { durationSeconds: 604_800, usedPercent: 40, resetAt: new Date(1_800_100_000_000) },
      ],
      availableResetCreditCount: 1,
    });
  });

  test("rejects malformed responses without quoting their contents", () => {
    expect(() => normalizeCodexUsage({ rate_limit: { primary_window: { used_percent: "secret" } } }))
      .toThrow("Usage data is unavailable");
  });
});

describe("resolveActiveCodexAuth", () => {
  const accountId = "account-id";
  const token = `header.${btoa(JSON.stringify({
    "https://api.openai.com/auth": { chatgpt_account_id: accountId },
  })).replace(/=/g, "")}.signature`;

  test("accepts only matching native OAuth credentials", async () => {
    await expect(resolveActiveCodexAuth("openai-codex", {
      getCredential: () => ({ type: "oauth", access: token, accountId }),
      getAccessToken: async () => token,
    })).resolves.toEqual({ provider: "openai-codex", accessToken: token, accountId });

    await expect(resolveActiveCodexAuth("openai", {
      getCredential: () => ({ type: "oauth", access: token, accountId }),
      getAccessToken: async () => token,
    })).rejects.toThrow("Usage data is unavailable");
  });
});

describe("fetchCodexUsage", () => {
  test("constructs a fixed-origin, non-redirecting request", async () => {
    let request: Request | undefined;
    await fetchCodexUsage(auth, {
      fetch: async (input) => {
        request = input instanceof Request ? input : new Request(input);
        return Response.json(usageFixture);
      },
    });

    expect(request?.url).toBe(CODEX_USAGE_URL);
    expect(request?.method).toBe("GET");
    expect(request?.redirect).toBe("error");
    expect(request?.headers.get("authorization")).toBe("Bearer header.payload.signature");
    expect(request?.headers.get("chatgpt-account-id")).toBe("account-id");
  });

  test("does not send a request after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await expect(fetchCodexUsage(auth, {
      signal: controller.signal,
      fetch: async () => { calls += 1; return Response.json(usageFixture); },
    })).rejects.toThrow("Usage data is unavailable");
    expect(calls).toBe(0);
  });

  test("sanitizes transport failures", async () => {
    await expect(fetchCodexUsage(auth, {
      fetch: async () => {
        throw new Error("Bearer header.payload.signature account-id");
      },
    })).rejects.toEqual(expect.objectContaining<Partial<UsageError>>({ message: "Usage data is unavailable" }));
  });
});

describe("UsageCache", () => {
  test("bypasses a fresh value only when explicitly forced", async () => {
    let calls = 0;
    const snapshot = normalizeCodexUsage(usageFixture);
    const cache = new UsageCache({ load: async () => { calls += 1; return snapshot; } });
    await cache.read();
    await cache.read();
    await cache.read({ force: true });
    expect(calls).toBe(2);
  });

  test("does not start a load for an aborted reader", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    const cache = new UsageCache({ load: async () => { calls += 1; return normalizeCodexUsage(usageFixture); } });
    await expect(cache.read({ signal: controller.signal })).rejects.toThrow("Usage data is unavailable");
    expect(calls).toBe(0);
  });

  test("deduplicates loads, expires after ten minutes, and retains stale data on refresh failure", async () => {
    let now = 0;
    let calls = 0;
    let resolveLoad: ((value: typeof usageFixture) => void) | undefined;
    const cache = new UsageCache({
      now: () => now,
      load: () => {
        calls += 1;
        return new Promise((resolve) => { resolveLoad = (value) => resolve(normalizeCodexUsage(value)); });
      },
    });

    const first = cache.read();
    const second = cache.read();
    expect(calls).toBe(1);
    resolveLoad?.(usageFixture);
    await expect(first).resolves.toMatchObject({ state: "available" });
    await expect(second).resolves.toMatchObject({ state: "available" });

    now = 9 * 60_000;
    await expect(cache.read()).resolves.toMatchObject({ state: "available" });
    expect(calls).toBe(1);

    now = 10 * 60_000;
    const staleCache = new UsageCache({
      now: () => now,
      load: async () => { throw new Error("Bearer header.payload.signature"); },
    });
    staleCache.seed(normalizeCodexUsage(usageFixture), 0);
    await expect(staleCache.read()).resolves.toMatchObject({ state: "stale" });
  });
});
