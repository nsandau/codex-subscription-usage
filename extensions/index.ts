import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { formatUsageIndicator, isEligibleCodexProvider } from "../src/domain";
import {
  creditLabel,
  fetchCodexUsage,
  fetchResetCredits,
  redeemResetCredit,
  resolveActiveCodexAuth,
  UsageCoordinator,
} from "../src/usage";

const STATUS_KEY = "codex-subscription-usage";

export default function codexSubscriptionUsage(pi: ExtensionAPI): void {
  let activeProvider: string | undefined;
  const usage = new UsageCoordinator({
    getActiveProvider: () => activeProvider,
    resolveAuth: (provider) => resolveActiveCodexAuth(provider, {
      getCredential: (id) => contextForAuth?.modelRegistry.authStorage.get(id),
      getAccessToken: (id) => contextForAuth
        ? contextForAuth.modelRegistry.getApiKeyForProvider(id)
        : Promise.resolve(undefined),
    }),
    fetchUsage: (auth, signal) => fetchCodexUsage(auth, { signal }),
  });
  let contextForAuth: ExtensionContext | undefined;

  const updateStatus = (ctx: ExtensionContext): void => {
    contextForAuth = ctx;
    if (!isEligibleCodexProvider(activeProvider ?? "")) {
      ctx.ui.setStatus(STATUS_KEY, undefined);
      return;
    }
    ctx.ui.setStatus(STATUS_KEY, formatUsageIndicator(usage.indicator()));
  };

  const refreshInBackground = (ctx: ExtensionContext, force = false): void => {
    void usage.refresh({ force }).then(() => updateStatus(ctx));
  };

  pi.on("session_start", (_event, ctx) => {
    activeProvider = ctx.model?.provider;
    usage.handleProviderChange();
    updateStatus(ctx);
    refreshInBackground(ctx);
  });

  pi.on("model_select", (event, ctx) => {
    activeProvider = event.model.provider;
    usage.handleProviderChange(true);
    updateStatus(ctx);
    refreshInBackground(ctx);
  });

  pi.registerCommand("subscription-usage", {
    description: "Show Codex subscription usage; add refresh to bypass the cache",
    handler: async (args, ctx) => {
      contextForAuth = ctx;
      if (args.trim() === "redeem") {
        await redeemSelectedCredit(ctx, activeProvider);
        return;
      }
      const force = args.trim() === "refresh";
      const indicator = await usage.refresh({ force });
      updateStatus(ctx);
      ctx.ui.notify(renderSummary(indicator, usage.cacheAge()), "info");
    },
  });
}

async function redeemSelectedCredit(ctx: ExtensionContext, provider: string | undefined): Promise<void> {
  if (!ctx.hasUI || !provider || !isEligibleCodexProvider(provider)) {
    ctx.ui.notify("Codex reset-credit redemption is unavailable.", "warning");
    return;
  }
  try {
    const auth = await resolveActiveCodexAuth(provider, {
      getCredential: (id) => ctx.modelRegistry.authStorage.get(id),
      getAccessToken: (id) => ctx.modelRegistry.getApiKeyForProvider(id),
    });
    const credits = await fetchResetCredits(auth);
    const choices = credits.map((credit) => creditLabel(credit, new Date()));
    const selectedLabel = await ctx.ui.select("Redeem a Codex reset credit", choices);
    const credit = credits[choices.indexOf(selectedLabel ?? "")];
    if (!credit || ctx.model?.provider !== provider) return;
    const confirmed = await ctx.ui.confirm("Redeem reset credit?", `${creditLabel(credit, new Date())}\nConsumes one earned reset credit for this account and may reset its current limits.`);
    if (!confirmed || ctx.model?.provider !== provider) return;
    const key = crypto.randomUUID();
    const result = await redeemResetCredit(auth, credit.id, key);
    ctx.ui.notify(`Redemption result: ${result.code.replaceAll("_", " ")}.`, "info");
  } catch {
    ctx.ui.notify("Reset-credit redemption could not be completed.", "warning");
  }
}

function renderSummary(indicator: ReturnType<UsageCoordinator["indicator"]>, cacheAge: number | undefined): string {
  if (indicator.state === "loading" || indicator.state === "unavailable") {
    return formatUsageIndicator(indicator);
  }

  const windows = indicator.windows
    .map((window) => `${Math.round(window.usedPercent)}% used in ${formatDuration(window.durationSeconds)}`)
    .join("; ");
  const cache = cacheAge === undefined ? "cache age unavailable" : `cache age ${formatDuration(Math.floor(cacheAge / 1_000))}`;
  const stale = indicator.state === "stale" ? "; stale" : "";
  return `Codex usage: ${windows}; ${indicator.availableResetCreditCount} reset credits; ${cache}${stale}`;
}

function formatDuration(seconds: number): string {
  if (seconds >= 86_400) return `${Math.round(seconds / 86_400)}d`;
  if (seconds >= 3_600) return `${Math.round(seconds / 3_600)}h`;
  return `${Math.max(1, Math.round(seconds / 60))}m`;
}
