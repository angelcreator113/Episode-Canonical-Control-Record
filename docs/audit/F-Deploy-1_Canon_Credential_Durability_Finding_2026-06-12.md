# F-Deploy-1 Canon Credential Durability Finding (2026-06-12)

> **FINDING DOCUMENT.** Records the durability gap uncovered during the 2026-06-12 credential reconcile. The canon password had no durable off-box home at the time of discovery, which forced emergency rotation to recover gate 2.5.

| | |
|---|---|
| **Parent** | `F-Deploy-1_Canon_RDS_Password_Rotation_2026-06-12.md`; `F-Deploy-1_[3]_Master_Runbook_DRAFT.md` Sec 0 / Sec 7. |
| **Scope** | Canon credential storage state for `episode-control-dev`, box `.env`, and future restart safety. |
| **Finding** | The working canon password existed only in the live pm2 process memory and the box `.env` once written. There was no Secrets Manager entry, no SSM parameter, and no other durable off-box copy. |
| **Risk** | If the box `.env` is lost or corrupted before a durable copy exists, the next restart will fail canon auth and the system returns to a credential gap. |
| **Required follow-up** | Store the post-rotation canon credential in durable encrypted off-box storage before any later restart-to-align window. |

---

## Sec 1 - What this means

The 2026-06-12 event was recoverable because the live pm2 pool kept the app up long enough to rotate canon and rewrite the box `.env`.

That does not solve the underlying durability problem. It only replaces one fragile copy with another. Until the new canon password has a secure durable off-box home, the system still depends on a single mutable box file and live process memory.

## Sec 2 - Why it matters

This is the same class of problem as the static-credentials-on-box hazard: if the only durable copy lives on the box, a local file loss or corruption can strand canon access.

The correct state for the post-rotation credential is:

- canon RDS accepts it,
- the box `.env` accepts it,
- a durable encrypted off-box store also holds it.

Only then is the gap fully closed.
