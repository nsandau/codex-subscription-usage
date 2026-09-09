# Codex subscription usage for Pi

A minimal Pi package that displays best-effort subscription usage for Pi's active native Codex OAuth account. It can also redeem one user-selected, earned reset credit after confirmation.

## Install

Install a pinned Git revision with Pi (replace the commit with the release you intend to trust):

```sh
pi install git:github.com/nsandau/codex-subscription-usage@<commit-sha>
```

For a project-local installation, add `-l`. This package is currently in a private repository, so Pi/Git must be authenticated for the GitHub account that can read it.

## Use

- The status bar shows the active Codex account's usage indicator when Pi uses `openai-codex` or `openai-codex-account-*`.
- `/subscription-usage` shows a read-only cached summary.
- `/subscription-usage refresh` bypasses the ten-minute in-memory cache.
- `/subscription-usage redeem` lists available reset credits and requires immediate Yes/No confirmation before redemption.

## Security and operational boundary

The ChatGPT endpoints used here are observed/private backend contracts, not a supported public REST API. They can change or stop working without notice.

- Supports only the currently active native Codex OAuth account. It never selects, rotates, falls back to, or manages accounts.
- Sends credentials only to fixed `https://chatgpt.com` endpoints; proxies, custom origins, provider request hooks, and redirects are not supported.
- Does not persist credentials, usage data, credit IDs, configuration, or telemetry; it does not implement token refresh or write Pi auth files.
- Background refreshes request usage only. Credit details are requested only by an interactive command flow.
- Redemption is never automatic. It requires selection plus confirmation and uses an in-memory idempotency key for that attempt.
- Errors are intentionally sanitized and may be uninformative when the backend contract changes.

The rationale for the confirmation gate is recorded in [ADR 0001](docs/adr/0001-confirmation-gated-codex-reset-redemption.md).

## Human QA

Automated tests use fixtures only. No authenticated request is made during automated validation.

A read-only live usage probe requires explicit approval immediately before final QA. Do not perform a live reset-credit redemption as a test: it consumes an earned entitlement and changes account state.
