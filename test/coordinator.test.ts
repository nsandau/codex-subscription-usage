import { describe, expect, test } from "bun:test";

import { UsageCoordinator, type ActiveCodexAuth, type UsageSnapshot } from "../src/usage";

const auth: ActiveCodexAuth = {
  provider: "openai-codex",
  accessToken: "token",
  accountId: "account-a",
};
const snapshot: UsageSnapshot = {
  windows: [
    { durationSeconds: 18_000, usedPercent: 72 },
    { durationSeconds: 604_800, usedPercent: 40 },
  ],
  availableResetCreditCount: 1,
};

describe("UsageCoordinator", () => {
  test("clears previous values immediately when the active provider changes", async () => {
    let provider = "openai-codex";
    const status: string[] = [];
    const coordinator = new UsageCoordinator({
      getActiveProvider: () => provider,
      resolveAuth: async () => auth,
      fetchUsage: async () => snapshot,
      now: () => 0,
    });

    await coordinator.refresh();
    expect(coordinator.indicator()).toMatchObject({ state: "available" });

    provider = "anthropic";
    coordinator.handleProviderChange();
    expect(coordinator.indicator()).toEqual({ state: "unavailable" });
    expect(await coordinator.refresh()).toEqual({ state: "unavailable" });
    void status;
  });

  test("refreshes on demand and marks retained data stale after failure", async () => {
    let fail = false;
    const coordinator = new UsageCoordinator({
      getActiveProvider: () => "openai-codex",
      resolveAuth: async () => auth,
      fetchUsage: async () => {
        if (fail) throw new Error("token");
        return snapshot;
      },
      now: () => 0,
    });

    await coordinator.refresh();
    fail = true;
    await expect(coordinator.refresh({ force: true })).resolves.toMatchObject({ state: "stale" });
  });
});
