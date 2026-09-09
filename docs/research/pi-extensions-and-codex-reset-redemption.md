# Pi usage design inspiration and Codex reset redemption

**Scope.** Static source research only: no package was installed and no authenticated request was made.

## Conclusion

`narumiruna/pi-extensions` is useful **design inspiration**, especially its `packages/pi-usage`, but is not a minimal-package template to copy wholesale. It supports many providers, settings, statusline updates, target selection, Fast mode, and credential-source interoperability. A minimal package should reuse its *boundaries* (one provider adapter, pure normalization, short-lived auth, and an explicit mutation flow), not its breadth. The monorepo explicitly says extensions run with full user permissions and recommends source review before installation ([root README](https://github.com/narumiruna/pi-extensions/blob/main/README.md); [`pi-usage` README](https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-usage/README.md)).

Codex subscription reset redemption is technically feasible. It is not merely speculative: OpenAI's own Codex backend client implements the ChatGPT paths and `POST` consumption ([official source](https://github.com/openai/codex/blob/136386e1c3c20589db0121fe4b3bc52f3afd0f9d/codex-rs/backend-client/src/client/rate_limit_resets.rs)); OpenAI's merged PR describes the client UI need to select and consume an earned credit ([PR #30395](https://github.com/openai/codex/pull/30395)). It **mutates account state**: it consumes an earned reset credit and can reset current rate-limit windows. Treat it as an irreversible, unsupported-by-public-REST-docs account action, not an ordinary usage read.

## Exact known contract

| Operation | Method and endpoint | Request | Important response fields |
|---|---|---|---|
| Read current usage | `GET https://chatgpt.com/backend-api/wham/usage` | `Authorization: Bearer <OAuth access token>` and account header for the selected account | `plan_type`; `rate_limit.primary_window` / `secondary_window`: `used_percent`, `limit_window_seconds`, `reset_at`; `credits`; `rate_limit_reset_credits.available_count`; optional `additional_rate_limits` ([adapter](https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-usage/src/query.ts), [normalizer](https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-usage/src/providers/codex.ts)). |
| List earned reset details | `GET https://chatgpt.com/backend-api/wham/rate-limit-reset-credits` | Same authorization and `chatgpt-account-id` | `available_count`; `credits[]` including opaque `id`, `reset_type` (`codex_rate_limits`), `status` (`available`/`redeeming`/`redeemed`), `granted_at`, nullable `expires_at`, and (as observed by `pi-usage`) `title`, `description` ([OpenAI client](https://github.com/openai/codex/blob/136386e1c3c20589db0121fe4b3bc52f3afd0f9d/codex-rs/backend-client/src/client/rate_limit_resets.rs), [`pi-usage` parser](https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-usage/src/codex-resets.ts)). The official app-server schema says detail rows can be fewer than `availableCount` (at most ten) ([schema](https://github.com/openai/codex/blob/136386e1c3c20589db0121fe4b3bc52f3afd0f9d/codex-rs/app-server-protocol/schema/json/v2/AccountRateLimitResetCreditListResponse.json)). |
| Redeem one credit | `POST https://chatgpt.com/backend-api/wham/rate-limit-reset-credits/consume` | JSON: `{"redeem_request_id":"<stable idempotency key>","credit_id":"<opaque id>"}`; `credit_id` is optional, in which case the backend selects a credit. Same auth headers. | `code`: `reset`, `nothing_to_reset`, `no_credit`, or `already_redeemed`; `windows_reset` non-negative integer ([official client](https://github.com/openai/codex/blob/136386e1c3c20589db0121fe4b3bc52f3afd0f9d/codex-rs/backend-client/src/client/rate_limit_resets.rs), [`pi-usage` contract test](https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-usage/test/codex-resets.test.ts)). |

OpenAI's app-server API independently specifies `idempotencyKey` as identifying one logical reset attempt and recommends a UUID; retrying the same attempt must reuse it. It also specifies that an omitted `creditId` lets the backend select the next available credit ([schema](https://github.com/openai/codex/blob/136386e1c3c20589db0121fe4b3bc52f3afd0f9d/codex-rs/app-server-protocol/schema/json/v2/ConsumeAccountRateLimitResetCreditParams.json)).

## What to adopt for a minimal package

1. **One read adapter, one pure normalizer.** Keep transport/auth separate from parsing. Represent returned windows by their actual duration; do not assume the first window is always five hours. `Sarrius/pi-multi-account` at the requested commit shows why: it parses `limit_window_seconds`, preserves the backend's `allowed`/`limit_reached` verdict, and labels a 30-day window as 30d rather than 5h ([`usage.ts` at `531fb669`](https://github.com/Sarrius/pi-multi-account/blob/531fb669bc953dbe81654fa52e0bca541cb6e069/usage.ts)).
2. **Read-only by default.** A `/usage` command can fetch and render the active Codex account's plan, windows, credits, and reset count. Do not add background polling, persistent statusline cache, cross-provider support, account switching, or settings until there is a concrete need.
3. **Make mutation a distinct, opt-in feature.** `pi-usage` requires the *current* `openai-codex` model, freshly resolves auth, matches it to a stored OAuth credential/account, rejects proxy/custom origins, and only then offers redemption ([implementation](https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-usage/src/codex-resets.ts)). Those are strong patterns worth retaining.

## Required command UX if redemption is implemented

- Expose it only from an interactive `/usage` menu as **Redeem usage-limit reset…**; never silently redeem during refresh, failover, startup, or a flag that bypasses interaction.
- First issue the read/list calls, show the selected credit's sanitized title/description and expiry, the current account/plan, and the explicit warning: “Consumes one earned reset for this account and may reset its current limits.”
- Use a confirmation gate with **No, go back** as the default. Cancellation before confirmation must send no `POST`.
- On confirm, generate one idempotency key; if transport outcome is uncertain, offer retry using that *same* key. Do not offer a cancel button after the `POST` begins. This mirrors the upstream package's documented flow ([operations guide](https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-usage/docs/operations.md)).
- Render all four outcomes distinctly, then refresh usage for the same still-current account. Never claim success from HTTP success alone: only `code: "reset"` (or idempotent `already_redeemed`) establishes completion.

## Network, credential, and security implications

- A read sends subscription-account metadata requests to `chatgpt.com`; redemption adds a state-changing `POST`. Network availability, server-side logging, and an endpoint contract that may change are unavoidable.
- The request carries a bearer OAuth access token and `chatgpt-account-id`; both are sensitive. The token authenticates the account, and the account ID identifies the selected ChatGPT account/workspace. Do not log, persist, display, include in errors, or place either in session text.
- This is a ChatGPT/Codex OAuth-subscription flow, not an OpenAI API-key flow. Require that Pi's freshly resolved runtime token exactly match the selected stored OAuth credential and that its JWT account claim match the credential account ID; fail closed on mismatch, ambiguity, missing refresh credential, or an account/model change during the flow. `pi-usage` demonstrates these checks ([source](https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-usage/src/codex-resets.ts)).
- Send credentials only to the exact HTTPS official origin `https://chatgpt.com`; reject custom base URLs/proxies and redirects before transmission. Bound request and response sizes, use abort/timeouts, and redact known secrets from all errors.
- Reset/credit IDs are opaque sensitive account metadata. Keep them in memory only for the selected interaction and do not write them to settings, caches, telemetry, or debug logs.
- The `POST` consumes a scarce earned credit and changes server-side account state. A confirmation gate, idempotency-key reuse, and a post-action refresh are therefore security and correctness requirements, not UX polish.
- All Pi extensions execute with the user's process permissions. Avoid importing a third-party extension as a runtime dependency merely to obtain this feature; implement and audit the small required surface locally.

## Source-quality note

The endpoint paths are corroborated by OpenAI's public Codex source, including its backend client and app-server schemas, rather than by a public OpenAI REST reference. They should therefore be treated as an observed/implemented ChatGPT backend contract that can change, with graceful failure and no speculative fallback. `narumiruna/pi-extensions` and `Sarrius/pi-multi-account` are third-party source references, not authorities for OpenAI account behavior.
