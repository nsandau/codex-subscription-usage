import { formatCompactExpiry, isEligibleCodexProvider, type ResetCredit } from "../domain";
import { UsageError } from "./error";
import type { ActiveCodexAuth } from "./transport";

const CREDITS_URL = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
const CONSUME_URL = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits/consume";

export interface CreditFetchOptions { fetch?: typeof globalThis.fetch; signal?: AbortSignal }
export interface RedemptionResult { code: "reset" | "nothing_to_reset" | "no_credit" | "already_redeemed"; windowsReset: number }

export async function fetchResetCredits(auth: ActiveCodexAuth, options: CreditFetchOptions = {}): Promise<readonly ResetCredit[]> {
  const response = await request(CREDITS_URL, auth, undefined, options);
  try {
    const value = await response.json() as { credits?: unknown };
    if (!Array.isArray(value.credits)) throw new UsageError();
    return value.credits.flatMap(parseCredit).sort((a, b) => expiry(a) - expiry(b));
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError();
  }
}

export async function redeemResetCredit(auth: ActiveCodexAuth, creditId: string, idempotencyKey: string, options: CreditFetchOptions = {}): Promise<RedemptionResult> {
  const response = await request(CONSUME_URL, auth, { credit_id: creditId, redeem_request_id: idempotencyKey }, options);
  try {
    const value = await response.json() as { code?: unknown; windows_reset?: unknown };
    if (!isOutcome(value.code) || !Number.isInteger(value.windows_reset) || value.windows_reset < 0) throw new UsageError();
    return { code: value.code, windowsReset: value.windows_reset };
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError();
  }
}

export function creditLabel(credit: ResetCredit, now: Date): string {
  return `${credit.title ?? "Codex reset credit"} · ${formatCompactExpiry(credit.expiresAt, now)}`;
}

async function request(url: string, auth: ActiveCodexAuth, body: unknown, options: CreditFetchOptions): Promise<Response> {
  if (!isEligibleCodexProvider(auth.provider) || !auth.accessToken || !auth.accountId || options.signal?.aborted) throw new UsageError();
  try {
    const response = await (options.fetch ?? globalThis.fetch)(new Request(url, {
      method: body ? "POST" : "GET", redirect: "error", signal: options.signal,
      headers: { Authorization: `Bearer ${auth.accessToken}`, "chatgpt-account-id": auth.accountId, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));
    if (!response.ok) throw new UsageError();
    return response;
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError();
  }
}

function parseCredit(value: unknown): ResetCredit[] {
  if (!value || typeof value !== "object") return [];
  const credit = value as Record<string, unknown>;
  if (typeof credit.id !== "string" || credit.status !== "available" || credit.reset_type !== "codex_rate_limits") return [];
  const expiresAt = typeof credit.expires_at === "number" ? new Date(credit.expires_at * 1_000) : undefined;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return [];
  return [{ id: credit.id, status: "available", expiresAt, title: sanitizeTitle(credit.title) }];
}

function sanitizeTitle(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const title = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return title || undefined;
}
function expiry(credit: ResetCredit): number { return credit.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY }
function isOutcome(value: unknown): value is RedemptionResult["code"] { return value === "reset" || value === "nothing_to_reset" || value === "no_credit" || value === "already_redeemed" }
