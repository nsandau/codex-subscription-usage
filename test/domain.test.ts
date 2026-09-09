import { describe, expect, test } from "bun:test";

import {
  formatCompactExpiry,
  formatUsageIndicator,
  isEligibleCodexProvider,
  type UsageIndicator,
} from "../src/domain";

describe("isEligibleCodexProvider", () => {
  test("allows only native Codex providers", () => {
    expect(isEligibleCodexProvider("openai-codex")).toBe(true);
    expect(isEligibleCodexProvider("openai-codex-account-work")).toBe(true);
    expect(isEligibleCodexProvider("openai")).toBe(false);
    expect(isEligibleCodexProvider("openai-codex-account-")).toBe(false);
    expect(isEligibleCodexProvider("openai-codex-custom")).toBe(false);
  });
});

describe("formatUsageIndicator", () => {
  const available: UsageIndicator = {
    state: "available",
    windows: [
      { durationSeconds: 5 * 60 * 60, usedPercent: 72 },
      { durationSeconds: 7 * 24 * 60 * 60, usedPercent: 40 },
    ],
    availableResetCreditCount: 1,
  };

  test("renders primary and secondary windows with available credits", () => {
    expect(formatUsageIndicator(available)).toBe("usage: Codex 5h 72% · 7d 40% · 1 reset");
  });

  test("formats the reset-credit count and omits it at zero", () => {
    expect(formatUsageIndicator({ ...available, availableResetCreditCount: 2 }))
      .toBe("usage: Codex 5h 72% · 7d 40% · 2 resets");
    expect(formatUsageIndicator({ ...available, availableResetCreditCount: 0 }))
      .toBe("usage: Codex 5h 72% · 7d 40%");
  });

  test("keeps loading, stale, and unavailable distinct", () => {
    expect(formatUsageIndicator({ state: "loading" })).toBe("usage: Codex loading");
    expect(formatUsageIndicator({ ...available, state: "stale" }))
      .toBe("usage: Codex 5h 72% · 7d 40% · 1 reset · stale");
    expect(formatUsageIndicator({ state: "unavailable" })).toBe("usage: Codex unavailable");
  });
});

describe("formatCompactExpiry", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  test("uses compact, relevant future units", () => {
    expect(formatCompactExpiry(new Date("2026-01-08T00:00:00.000Z"), now)).toBe("1w");
    expect(formatCompactExpiry(new Date("2026-01-03T00:00:00.000Z"), now)).toBe("2d");
    expect(formatCompactExpiry(new Date("2026-01-01T13:00:00.000Z"), now)).toBe("13h");
  });

  test("distinguishes unavailable and expired credits", () => {
    expect(formatCompactExpiry(undefined, now)).toBe("no expiry");
    expect(formatCompactExpiry(new Date("2025-12-31T23:59:00.000Z"), now)).toBe("expired");
  });
});
