# Confirmation-gated Codex reset redemption

The package may redeem a selected Codex reset credit only through the fixed `https://chatgpt.com` origin after fail-closed active-account authentication checks and an immediate interactive confirmation. This non-public, account-mutating backend action consumes a scarce entitlement, so we prefer explicit user control and an in-memory idempotency-key retry over automatic redemption, fallback, proxying, or silent retries.
