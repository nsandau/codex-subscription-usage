import type { UsageIndicator } from "./types";

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const WEEK_SECONDS = 7 * DAY_SECONDS;

export function formatUsageIndicator(indicator: UsageIndicator, now = new Date()): string {
  if (indicator.state === "loading") return "Codex loading";
  if (indicator.state === "unavailable") return "Codex unavailable";

  const segments = indicator.windows.map((window) => {
    const remainingPercent = 100 - window.usedPercent;
    const reset = window.resetAt ? ` ↻ ${formatCompactExpiry(window.resetAt, now)}` : "";
    return `${formatUsageWindowDuration(window.durationSeconds)} ${formatPercent(remainingPercent)}${reset}`;
  });

  if (indicator.availableResetCreditCount > 0) {
    const creditLabel = indicator.availableResetCreditCount === 1 ? "reset" : "resets";
    segments.push(`${indicator.availableResetCreditCount} ${creditLabel}`);
  }

  if (indicator.state === "stale") segments.push("stale");

  const plan = indicator.planType ? ` ${formatPlanType(indicator.planType)}` : "";
  return `Codex${plan} ${segments.join(" · ")}`;
}

function formatPlanType(planType: string): string {
  return planType.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatCompactExpiry(expiresAt: Date | undefined, now: Date): string {
  // The reset-credit API may omit `expires_at`; absence does not establish that a credit never expires.
  if (!expiresAt) return "expiry unknown";

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
