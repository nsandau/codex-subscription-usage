export interface UsageWindow {
  durationSeconds: number;
  usedPercent: number;
  resetAt?: Date;
}

export interface ResetCredit {
  id: string;
  title?: string;
  expiresAt?: Date;
  status: "available" | "redeeming" | "redeemed";
}

export interface AvailableUsageIndicator {
  state: "available" | "stale";
  windows: readonly UsageWindow[];
  availableResetCreditCount: number;
}

export interface LoadingUsageIndicator {
  state: "loading";
}

export interface UnavailableUsageIndicator {
  state: "unavailable";
}

export type UsageIndicator =
  | AvailableUsageIndicator
  | LoadingUsageIndicator
  | UnavailableUsageIndicator;
