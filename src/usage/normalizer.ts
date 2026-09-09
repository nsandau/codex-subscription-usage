import type { UsageWindow } from "../domain";
import { UsageError } from "./error";

export interface UsageSnapshot {
  windows: readonly UsageWindow[];
  availableResetCreditCount: number;
}

export function normalizeCodexUsage(value: unknown): UsageSnapshot {
  const record = asRecord(value);
  const rateLimit = asRecord(record?.rate_limit);
  const primary = normalizeWindow(rateLimit?.primary_window);
  const secondary = normalizeWindow(rateLimit?.secondary_window);
  const resetCredits = asRecord(record?.rate_limit_reset_credits);
  const availableResetCreditCount = resetCredits?.available_count;

  if (!primary || !isNonNegativeInteger(availableResetCreditCount)) throw new UsageError();

  return { windows: secondary ? [primary, secondary] : [primary], availableResetCreditCount };
}

function normalizeWindow(value: unknown): UsageWindow | undefined {
  const window = asRecord(value);
  const durationSeconds = window?.limit_window_seconds;
  const usedPercent = window?.used_percent;
  const resetAt = window?.reset_at;

  if (!isPositiveFiniteNumber(durationSeconds) || !isPercent(usedPercent)) return undefined;
  if (resetAt !== undefined && !isFiniteNumber(resetAt)) return undefined;

  return {
    durationSeconds,
    usedPercent,
    ...(resetAt === undefined ? {} : { resetAt: new Date(toMilliseconds(resetAt)) }),
  };
}

function toMilliseconds(timestamp: number): number {
  return timestamp < 10_000_000_000 ? timestamp * 1_000 : timestamp;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isPercent(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}
