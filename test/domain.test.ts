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
      { durationSeconds: 7 * 24 * 60 * 60, usedPercent: 40, resetAt: new Date("2026-01-05T00:00:00.000Z") },
    ],
    availableResetCreditCount: 1,
  };

  test("renders primary and secondary windows with reset times and credits", () => {
    expect(formatUsageIndicator(available, new Date("2026-01-01T00:00:00.000Z")))
      .toBe("usage: Codex 5h 28% · 7d 60% ↻ 4d · 1 reset");
  });

  test("formats the reset-credit count and omits it at zero", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(formatUsageIndicator({ ...available, availableResetCreditCount: 2 }, now))
      .toBe("usage: Codex 5h 28% · 7d 60% ↻ 4d · 2 resets");
    expect(formatUsageIndicator({ ...available, availableResetCreditCount: 0 }, now))
      .toBe("usage: Codex 5h 28% · 7d 60% ↻ 4d");
  });

  test("keeps loading, stale, and unavailable distinct", () => {
    expect(formatUsageIndicator({ state: "loading" })).toBe("usage: Codex loading");
    expect(formatUsageIndicator({ ...available, state: "stale" }, new Date("2026-01-01T00:00:00.000Z")))
      .toBe("usage: Codex 5h 28% · 7d 60% ↻ 4d · 1 reset · stale");
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

  test("distinguishes unknown and expired credit expiries", () => {
    expect(formatCompactExpiry(undefined, now)).toBe("expiry unknown");
    expect(formatCompactExpiry(new Date("2025-12-31T23:59:00.000Z"), now)).toBe("expired");
  });
});
