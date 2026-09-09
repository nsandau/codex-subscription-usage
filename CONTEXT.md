# Subscription Usage

This package shows best-effort Codex subscription usage for the account backing Pi’s active Codex model, and lets the user deliberately consume an earned usage-limit reset.

## Language

**Usage window**:
A provider-reported rate-limit period with current remaining capacity and a reset time. It is not a generic token balance.
_Avoid_: quota, allowance

**Reset credit**:
An earned, provider-issued, single-use entitlement that may reset one or more current Codex usage windows when consumed. It can expire.
_Avoid_: reset, bonus

**Redemption**:
The user-confirmed, account-mutating consumption of one selected reset credit.
_Avoid_: refresh, reset

**Active Codex account**:
The subscription account authenticated for Pi’s currently selected native Codex provider. It is the only account whose usage this package may display or act on.
_Avoid_: account slot, profile

**Usage indicator**:
The compact status-bar summary of the active Codex account’s primary and secondary usage windows. It includes an available reset-credit count only when one or more credits exist.
_Avoid_: quota display, usage dashboard

**Stale usage indicator**:
A usage indicator retained from the last successful refresh after a subsequent refresh fails. It is explicitly labeled `stale`.
_Avoid_: unavailable usage

**Usage summary**:
The read-only command view of the active account’s usage windows, cache age, reset-credit count, and reset-credit expiry times.
_Avoid_: account dashboard

**Redemption attempt**:
One user-confirmed request to consume a selected reset credit, identified by an in-memory idempotency key. An uncertain result may be retried only with that same key while the interaction remains open.
_Avoid_: automatic retry, reset request

**Expiring reset credit**:
An available reset credit ordered by soonest expiry for selection. Its expiry is shown as a compact relative duration using the relevant units, such as `1w`, `2d`, or `13h`.
_Avoid_: ready reset
