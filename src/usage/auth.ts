import { isEligibleCodexProvider } from "../domain";
import { UsageError } from "./error";
import type { ActiveCodexAuth } from "./transport";

export interface StoredCodexCredential {
  type: "oauth";
  access: string;
  accountId: string;
}

export interface RuntimeProviderAuth {
  source?: string;
  auth?: { apiKey?: string; baseUrl?: string };
}

export interface RuntimeModelRegistry {
  getProviderAuth(provider: string): Promise<RuntimeProviderAuth | undefined>;
}

export interface ActiveCodexAuthResolver {
  getCredential(provider: string): unknown;
  getAccessToken(provider: string): Promise<string | undefined>;
}

export async function resolveRuntimeCodexAuth(
  provider: string,
  registry: RuntimeModelRegistry,
): Promise<ActiveCodexAuth> {
  if (!isEligibleCodexProvider(provider)) throw new UsageError();
  try {
    const resolved = await registry.getProviderAuth(provider);
    const accessToken = resolved?.auth?.apiKey;
    if (!accessToken || !resolved?.source?.toLowerCase().includes("oauth")) throw new UsageError();
    const accountId = getJwtAccountId(accessToken);
    if (!accountId) throw new UsageError();
    return { provider, accessToken, accountId };
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError();
  }
}

export async function resolveActiveCodexAuth(
  provider: string,
  resolver: ActiveCodexAuthResolver,
): Promise<ActiveCodexAuth> {
  if (!isEligibleCodexProvider(provider)) throw new UsageError();

  try {
    const accessToken = await resolver.getAccessToken(provider);
    const credential = resolver.getCredential(provider);
    if (!accessToken || !isStoredCodexCredential(credential) || credential.access !== accessToken) {
      throw new UsageError();
    }

    const tokenAccountId = getJwtAccountId(accessToken);
    if (!tokenAccountId || tokenAccountId !== credential.accountId) throw new UsageError();

    return { provider, accessToken, accountId: tokenAccountId };
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError();
  }
}

function isStoredCodexCredential(value: unknown): value is StoredCodexCredential {
  if (value === null || typeof value !== "object") return false;
  const credential = value as Partial<StoredCodexCredential>;
  return credential.type === "oauth"
    && typeof credential.access === "string"
    && typeof credential.accountId === "string";
}

function getJwtAccountId(token: string): string | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const parsed = JSON.parse(json) as { "https://api.openai.com/auth"?: { chatgpt_account_id?: unknown } };
    const accountId = parsed["https://api.openai.com/auth"]?.chatgpt_account_id;
    return typeof accountId === "string" && accountId.length > 0 ? accountId : undefined;
  } catch {
    return undefined;
  }
}
