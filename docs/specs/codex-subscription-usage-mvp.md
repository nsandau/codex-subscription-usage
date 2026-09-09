# Codex subscription usage MVP

## Outcome

A minimal Pi package displays best-effort subscription usage for the active native Codex OAuth account in Pi’s status bar. It also lets a user deliberately redeem one selected, eligible Codex reset credit.

## Scope

- Eligible providers: `openai-codex` and `openai-codex-account-*` only.
- Resolve auth for the currently active provider; never choose, rotate, or fall back to another account.
- Read usage from a fixed allowlisted ChatGPT origin, normalize provider-reported primary and secondary windows by their actual durations, and retain an in-memory cache for 10 minutes.
- Footer form: `usage: Codex 5h 72% · 7d 40% · 1 reset`. Omit the reset segment at zero. Clear or show loading immediately when the active account/provider changes. Mark last-known data `stale` after a failed refresh; use `unavailable` when no usable value exists.
- `/subscription-usage` shows a read-only summary: windows, cache age, reset-credit count, and available-credit expiry times. `/subscription-usage refresh` bypasses TTL. `/subscription-usage redeem` lists available reset credits by nearest expiry first and allows one to be selected.
- Redemption displays a sanitized title and compact relative expiry, requires an immediate Yes/No confirmation, and only then performs the fixed-origin consume request. A request with uncertain transport outcome may be retried only from that interaction and only with the same in-memory idempotency key.
- Read/list calls are bounded and abortable. Background refreshes fetch usage only; credit details are fetched only for command flows.

## Security boundary

- No credential persistence, refresh implementation, auth-file writes, logs containing credentials/account metadata, proxy/custom origin support, provider request hooks, account selection, retries/failover, child processes, or server creation.
- Fail closed if native Codex OAuth/auth cannot be safely tied to the active account, or if auth, provider, or account changes during a flow.
- Send credentials only to the exact HTTPS provider origin; do not follow redirects.
- The backend usage/reset contract is best-effort and may change. Error output is sanitized and unobtrusive.

## Validation

Focused fixture/unit tests cover provider eligibility, response normalization and formatting, cache/in-flight/timeout behavior, provider transitions, allowlisted request construction, sensitive-data redaction, and non-mutating handling of all read errors and redemption outcomes.

No authenticated call is part of automated validation. A read-only live probe requires explicit approval at final QA. A real reset redemption is never tested by the package.

## Non-goals

Claude support, API-key/Codex custom-provider support, persistent state/configuration, automatic polling beyond stale event refresh, reset automation, quota enforcement, and any account-management capability.
