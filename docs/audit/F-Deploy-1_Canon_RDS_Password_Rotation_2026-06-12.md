# F-Deploy-1 Canon RDS Password Rotation Outcome (2026-06-12)

> **OUTCOME / FINDING DOCUMENT.** Records the canonical RDS password rotation on `episode-control-dev` and the post-rotation re-verification of the box-side credential state. This supersedes the prior credential premise in #751 / 06-02 / FD-31 Sec 6.5 for any future session work that depends on canon authentication.

| | |
|---|---|
| **Parent** | `F-Deploy-1_[3]_Master_Runbook_DRAFT.md`; FD-31 credential and restart sequencing notes; prior box-side credential reconcile (`F-Deploy-1_BoxSide_Credential_Reconcile_Outcome_2026-06-02.md`). |
| **Scope** | Canon RDS `episode-control-dev` in `us-east-1`, box `/home/ubuntu/episode-metadata/.env`, and read-only auth probe from the app box. |
| **Rotation time** | 2026-06-12 10:57:18 -0400 CloudTrail event time for `ModifyDBInstance` on `episode-control-dev`. |
| **Operator / path** | IAM user `evoni-admin` via `aws-cli/2.33.2` with `rds.modify-db-instance` and `--apply-immediately`. |
| **Result** | Rotation applied cleanly. `PendingModifiedValues` cleared to `{}`. Box `.env` was updated to the new value. Read-only SSL probe succeeded against canon. |
| **Gate impact** | FD-31 gate 2.5 is **GREEN** again only after the box `.env` update and successful probe. |

---

## Sec 1 - What changed

`episode-control-dev` was rotated with a new master password using `aws rds modify-db-instance --master-user-password ... --apply-immediately`.

This was not a routine hygiene rotation. It was gap recovery: pre-rotation probing found no Secrets Manager entry, no SSM parameter, no valid off-box copy of the canon password, and no working credential in the box `.env`. The live pm2 pool remained up only because it was still holding the pre-gap in-memory credential.

The control plane returned to a clean state:

- `DBInstanceStatus = available`
- `PendingModifiedValues = {}`
- endpoint remained `episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com`

The application box at `54.163.229.144` was then updated so `/home/ubuntu/episode-metadata/.env` contains the new `DB_PASSWORD` value.

## Sec 2 - Verification

The post-rotation probe was run from the app box with SSL required and read-only transaction settings enabled. It succeeded and returned:

- `current_database() = episode_metadata`
- `inet_server_addr() = 10.0.20.224`

That confirms the updated box credential authenticates to canon.

## Sec 3 - Scope notes

The box `.env` now tracks the rotated canon password.

The PM2 processes on the box were **not** restarted during this reconcile. Their uptime remained about 11 days, so the live process state was not rehydrated as part of this session. Any later restart-to-align must treat process credential state as a separate checkpoint from the on-disk `.env` file.

`FORK_DB_PASSWORD` was present on the box but empty at the time of inspection; the meaningful credential on disk was `DB_PASSWORD`.

## Sec 4 - Operational meaning

This rotation means the previous credential basis in #751 / 06-02 / FD-31 Sec 6.5 is no longer sufficient on its own. Any future phase work that depends on canon authentication must use the post-rotation value and must re-verify against `episode-control-dev` before proceeding.

FD-31 Sec 6.5's rotate-at-cutover item has already been executed here, so Phase 2 no longer carries a rotation step; it only restarts-to-align onto the already-rotated credential.

The proper label for this event is gap-recovery, not optional hygiene.

The workstation `.env` is now doubly stale: it was already stale before this rotation, and it is now one additional rotation behind the live canon password.

For this session, the safe state is:

- canon RDS rotation is recorded,
- box `.env` is aligned to the rotated password,
- the SSL read-only probe passes,
- gate 2.5 is GREEN,
- restart-to-align remains a separate action.

