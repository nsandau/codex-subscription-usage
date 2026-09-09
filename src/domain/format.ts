import type { UsageIndicator } from "./types";

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const WEEK_SECONDS = 7 * DAY_SECONDS;

export function formatUsageIndicator(indicator: UsageIndicator): string {
  if (indicator.state === "loading") return "usage: Codex loading";
  if (indicator.state === "unavailable") return "usage: Codex unavailable";

  const segments = indicator.windows.map(
    (window) => `${formatUsageWindowDuration(window.durationSeconds)} ${formatPercent(window.usedPercent)}`,
  );

  if (indicator.availableResetCreditCount > 0) {
    const creditLabel = indicator.availableResetCreditCount === 1 ? "reset" : "resets";
    segments.push(`${indicator.availableResetCreditCount} ${creditLabel}`);
  }

  if (indicator.state === "stale") segments.push("stale");

  return `usage: Codex ${segments.join(" · ")}`;
}

export function formatCompactExpiry(expiresAt: Date | undefined, now: Date): string {
  if (!expiresAt) return "no expiry";

  const secondsRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1_000);
  if (secondsRemaining <= 0) return "expired";
  if (secondsRemaining >= WEEK_SECONDS) return `${Math.floor(secondsRemaining / WEEK_SECONDS)}w`;
  if (secondsRemaining >= DAY_SECONDS) return `${Math.floor(secondsRemaining / DAY_SECONDS)}d`;
  if (secondsRemaining >= HOUR_SECONDS) return `${Math.floor(secondsRemaining / HOUR_SECONDS)}h`;
  if (secondsRemaining >= 60) return `${Math.floor(secondsRemaining / 60)}m`;
  return "<1m";
}

function formatUsageWindowDuration(durationSeconds: number): string {
  if (durationSeconds >= DAY_SECONDS) return `${Math.round(durationSeconds / DAY_SECONDS)}d`;
  if (durationSeconds >= HOUR_SECONDS) return `${Math.round(durationSeconds / HOUR_SECONDS)}h`;
  return `${Math.max(1, Math.round(durationSeconds / 60))}m`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
