const ACCOUNT_PROVIDER_PREFIX = "openai-codex-account-";

export function isEligibleCodexProvider(provider: string): boolean {
  return provider === "openai-codex"
    || (provider.startsWith(ACCOUNT_PROVIDER_PREFIX) && provider.length > ACCOUNT_PROVIDER_PREFIX.length);
}
