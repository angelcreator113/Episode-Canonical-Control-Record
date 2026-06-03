# F-Deploy-1 [3] Phase 2 — Box-Side Credential Reconcile OUTCOME (2026-06-02)

> **OUTCOME / FINDING DOCUMENT.** Records the result of executing the box-side
> credential reconcile runbook. The reconcile was **read-only** — 3a == 3b, no
> Sec 4 correction was needed, nothing on the box was edited. Result: FD-31
> Pre-Flight gate 2.5 is re-marked **GREEN**.

| | |
|---|---|
| **Parent** | `F-Deploy-1_BoxSide_Credential_Reconcile_Runbook.md` (#750); FD-31 Pre-Flight v1.4 gate 2.5; the 2026-06-02 re-verify finding (`F-Deploy-1_PreFlight_Reverify_2026-06-02.md`, esp. Sec 3). |
| **Session** | 2026-06-02. Executed the runbook Sec 2–Sec 5. |
| **Box** | `episode-backend`, `54.163.229.144`, user `ubuntu`. |
| **Result** | Gate 2.5 GREEN. Box `.env` already held the working canon credential; no mutation made. |
| **Main HEAD at session** | `285a913a` (#750). |

---

## Sec 1 — What was done (read-only throughout)

Executed per runbook, one read-only command at a time. No `pm2` mutation, no
restart, no `.env` edit. The single Rule 7 gate (Sec 4 `.env` write) **never
triggered** because the box `.env` was already correct.

**Live state (runbook Sec 2):**
- `git log` HEAD `285a913a` (#750), branch up to date with origin. Confirmed.
- `https://primepisodes.com/health` → `200`. Prod up and DB-connected; the running
  process holds a working canon credential in memory. Confirmed.

**Credential read (runbook Sec 3):**
- `pm2 list` showed two `online` prod processes (see Sec 3 below): id `3`
  `episode-api-prod-hotfix` (fork, 25h, 0 restarts) and id `0` `episode-api`
  (cluster, 40h, 1 restart).
- **3a** — read `DB_PASSWORD` from BOTH running processes (`pm2 env 3`, `pm2 env 0`,
  read-only). Both processes hold the **same** password.
- **3b** — read `DB_PASSWORD=` from the box's on-disk
  `/home/ubuntu/episode-metadata/.env` (`grep`, read-only).
- **Comparison: 3a == 3b.** The box's `.env`-on-disk holds the same working
  credential the running processes authenticated with against canon.

## Sec 2 — Outcome: gate 2.5 GREEN

Because 3a == 3b, the file a restart actually reads
(`/home/ubuntu/episode-metadata/.env`) already holds the credential canon
(`episode-control-dev`) accepts. A future restart is **auth-safe** — the box will
read `.env`, obtain the working password, and authenticate.

- **FD-31 Pre-Flight gate 2.5 → GREEN.** Re-marked on the basis of this reconcile.
- **No Sec 4 correction was made.** The box `.env` was already good; nothing on the
  box was written or changed.

## Sec 3 — Findings carried forward (NOT resolved this session)

**Two live prod processes (topology item for the combined [3] window).**
`pm2 list` showed both id `3` (fork) and id `0` (cluster, 1 restart) `online`,
both now confirmed on the **same** credential. Their agreement is good for the
gate-2.5 question and is why this session is clean. But two simultaneously-online
prod API processes is itself a topology question (which serves the health route;
is one a stale leftover) and belongs to the combined [3] restart-to-align window,
not here. **Flagged, not resolved.** Do not act on it in a reconcile session.

**Likely cause of the 06-02 divergence (06-02 Sec 3.4 open question).**
The 06-02 finding left open whether canon was rotated post-06-01 without updating
`.env`, or the workstation `.env` was edited wrong. This session's triangulation
points at the **workstation** copy as the divergent one: the box disk (`.env`) and
**both** running box processes agree on the working value; only the workstation
`.env` (already known-stale from 06-02) differs. That is consistent with a local
workstation `.env` drift, **not** a canon rotation. Stated as **likely, pending
the AK audit** — not closed here.

**Workstation `.env` is stale (cosmetic to this gate).** The workstation
`.env` still holds a password canon rejects. It does NOT govern a prod restart, so
it does not affect gate 2.5. Worth fixing locally so workstation psql/tooling
authenticates, but out of scope for this session and non-blocking.

## Sec 4 — What this session did NOT do

- Did NOT restart, reload, or `pm2`-mutate anything.
- Did NOT execute [3] or the restart-to-align.
- Did NOT rotate the canon password (FD-31 Sec 6.5 rotate-at-cutover still stands,
  best folded into the combined [3] window).
- Did NOT run the AK five-point audit (still required, separate work).
- Did NOT edit the box `.env` (3a == 3b, so Sec 4 was skipped) or the workstation `.env`.

## Sec 5 — Where [3] stands now (updated from runbook Sec 6)

[3]'s remaining entry gate (v13 Sec 4 / #749 Sec 5):
1. Live abort-check re-verify — per #749.
2. Credential gate 2.5 — **GREEN** (this reconcile). ✅
3. AK five-point audit — still required (separate work).
4. Then the combined window: FD-31 rotation + Track B restart-to-align + route fix
   + security sweep, ONE restart, post-restart `/health` = canon host + matching
   counts or ABORT+restore.

---
*Outcome of the box-side credential reconcile (runbook #750). Read-only: confirmed
live state (HEAD 285a913a, /health 200), read both running prod processes' credential
(3a, same on id 0 and id 3) and the box's on-disk .env (3b), found 3a == 3b. Box .env
already holds the working canon credential — no mutation made, Sec 4 skipped. Gate 2.5
re-marked GREEN. Carried forward: two-live-prod-processes topology item and the likely
workstation-side cause of the 06-02 divergence (pending AK audit). No restart, no pm2
mutation, no [3] execution.*
