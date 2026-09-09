import type { AvailableUsageIndicator } from "../domain";
import { UsageError } from "./error";
import type { UsageSnapshot } from "./normalizer";

const CACHE_TTL_MS = 10 * 60_000;

export interface UsageCacheOptions {
  load(signal: AbortSignal): Promise<UsageSnapshot>;
  now?: () => number;
}

export interface ReadUsageOptions {
  force?: boolean;
  signal?: AbortSignal;
}

interface CachedUsage {
  snapshot: UsageSnapshot;
  fetchedAt: number;
}

export class UsageCache {
  private readonly load: UsageCacheOptions["load"];
  private readonly now: () => number;
  private cached?: CachedUsage;
  private inFlight?: Promise<AvailableUsageIndicator>;
  private refreshController?: AbortController;
  private generation = 0;

  constructor(options: UsageCacheOptions) {
    this.load = options.load;
    this.now = options.now ?? Date.now;
  }

  read(options: ReadUsageOptions = {}): Promise<AvailableUsageIndicator> {
    if (options.signal?.aborted) return Promise.reject(new UsageError());
    if (!options.force && this.cached && this.now() - this.cached.fetchedAt < CACHE_TTL_MS) {
      return waitFor(Promise.resolve(toIndicator("available", this.cached.snapshot)), options.signal);
    }

    if (!this.inFlight) {
      const generation = this.generation;
      const controller = new AbortController();
      this.refreshController = controller;
      this.inFlight = this.refresh(controller, generation);
    }
    return waitFor(this.inFlight, options.signal);
  }

  seed(snapshot: UsageSnapshot, fetchedAt = this.now()): void {
    this.cached = { snapshot, fetchedAt };
  }

  age(): number | undefined {
    return this.cached ? Math.max(0, this.now() - this.cached.fetchedAt) : undefined;
  }

  stale(): AvailableUsageIndicator | undefined {
    return this.cached ? toIndicator("stale", this.cached.snapshot) : undefined;
  }

  clear(): void {
    this.generation += 1;
    this.cached = undefined;
    this.refreshController?.abort();
    this.refreshController = undefined;
    this.inFlight = undefined;
  }

  private async refresh(controller: AbortController, generation: number): Promise<AvailableUsageIndicator> {
    try {
      const snapshot = await this.load(controller.signal);
      if (generation !== this.generation) throw new UsageError();
      this.cached = { snapshot, fetchedAt: this.now() };
      return toIndicator("available", snapshot);
    } catch {
      if (generation === this.generation && this.cached) return toIndicator("stale", this.cached.snapshot);
      throw new UsageError();
    } finally {
      if (generation === this.generation) {
        this.inFlight = undefined;
        this.refreshController = undefined;
      }
    }
  }
}

function toIndicator(
  state: AvailableUsageIndicator["state"],
  snapshot: UsageSnapshot,
): AvailableUsageIndicator {
  return { state, ...snapshot };
}

function waitFor<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new UsageError());

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new UsageError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}
