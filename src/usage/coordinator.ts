import { isEligibleCodexProvider, type UsageIndicator } from "../domain";
import { UsageCache } from "./cache";
import { UsageError } from "./error";
import type { UsageSnapshot } from "./normalizer";
import type { ActiveCodexAuth } from "./transport";

export interface UsageCoordinatorOptions {
  getActiveProvider(): string | undefined;
  resolveAuth(provider: string): Promise<ActiveCodexAuth>;
  fetchUsage(auth: ActiveCodexAuth, signal: AbortSignal): Promise<UsageSnapshot>;
  now?: () => number;
}

export interface RefreshUsageOptions {
  force?: boolean;
  signal?: AbortSignal;
}

export class UsageCoordinator {
  private readonly getActiveProvider: UsageCoordinatorOptions["getActiveProvider"];
  private readonly resolveAuth: UsageCoordinatorOptions["resolveAuth"];
  private readonly fetchUsage: UsageCoordinatorOptions["fetchUsage"];
  private readonly cache: UsageCache;
  private activeProvider?: string;
  private activeAccountId?: string;
  private current?: UsageIndicator;

  constructor(options: UsageCoordinatorOptions) {
    this.getActiveProvider = options.getActiveProvider;
    this.resolveAuth = options.resolveAuth;
    this.fetchUsage = options.fetchUsage;
    this.cache = new UsageCache({
      now: options.now,
      load: async (signal) => {
        if (!this.activeProvider || !this.activeAccountId) throw new UsageError();
        const auth = await this.resolveAuth(this.activeProvider);
        if (auth.accountId !== this.activeAccountId) throw new UsageError();
        return this.fetchUsage(auth, signal);
      },
    });
  }

  indicator(): UsageIndicator {
    return this.current ?? { state: "unavailable" };
  }

  cacheAge(): number | undefined {
    return this.cache.age();
  }

  handleProviderChange(force = false): UsageIndicator {
    const provider = this.getActiveProvider();
    if (!force && provider === this.activeProvider) return this.indicator();
    this.activeProvider = provider;
    this.activeAccountId = undefined;
    this.current = isEligibleCodexProvider(provider ?? "") ? { state: "loading" } : { state: "unavailable" };
    this.cache.clear();
    return this.current;
  }

  async refresh(options: RefreshUsageOptions = {}): Promise<UsageIndicator> {
    const provider = this.getActiveProvider();
    if (provider !== this.activeProvider) this.handleProviderChange();
    if (!provider || !isEligibleCodexProvider(provider)) {
      this.current = { state: "unavailable" };
      return this.current;
    }

    try {
      const auth = await this.resolveAuth(provider);
      if (provider !== this.getActiveProvider()) throw new UsageError();
      if (this.activeAccountId && auth.accountId !== this.activeAccountId) this.cache.clear();
      this.activeProvider = provider;
      this.activeAccountId = auth.accountId;
      this.current = await this.cache.read(options);
    } catch {
      this.current = this.cache.stale() ?? { state: "unavailable" };
    }
    return this.current;
  }
}
