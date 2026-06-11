# F-Deploy-1 [3] Phase 2 — Gate 2.5 RE-VERIFICATION (2026-06-11)

> **RE-VERIFICATION / FINDING DOCUMENT.** This is NOT a new outcome — the box-side
> credential reconcile was executed and gate 2.5 was re-marked GREEN on 2026-06-02 in
> `F-Deploy-1_BoxSide_Credential_Reconcile_Outcome_2026-06-02.md` (#751). This note
> records an independent re-confirmation of that GREEN state nine days later, ahead of
> the [3] window, plus one read (`DB_HOST`) that the #751 record did not explicitly
> capture. Read-only throughout; no mutation, no restart, no `pm2` action.

| | |
|---|---|
| **Authority** | Gate 2.5 GREEN established by #751 (`..._Outcome_2026-06-02.md`). This note re-verifies; it does not supersede or re-decide. |
| **Parent** | `F-Deploy-1_BoxSide_Credential_Reconcile_Runbook.md` (#750); FD-31 Pre-Flight v1.4 gate 2.5; master runbook `F-Deploy-1_[3]_Master_Runbook_DRAFT.md` (#762). |
| **Session** | 2026-06-11. Re-ran the #750 read-only inspection (Sec 2–Sec 3) as a hold-check. |
| **Main HEAD at session** | `0e86c383` (#776). |
| **Box** | `episode-backend`, `54.163.229.144`, user `ubuntu`. |
| **Result** | Gate 2.5 GREEN **holds**. Box `.env` unchanged since #751. `DB_HOST` confirmed canon. No mutation. |

---

## Sec 0 — Why this note exists (process honesty)

This session opened treating Phase 0 (box-side credential reconcile) as the next
*unexecuted* step, on the basis of the master runbook (#762) and #750, both of which
still describe Phase 0 as "the next executable session." That framing was accurate when
those docs were written (2026-06-02) but went stale when #751 landed and closed gate 2.5
the same day. The stale pointer was caught mid-session via #751's cross-reference, after
the box reads had already been re-run.

Rather than discard the re-run, it is recorded here as an independent hold-check: the box
state is re-confirmed nine days on, and the master runbook's stale "Phase 0 is next"
pointers are corrected in the same change (additive-supersede; see that doc's updated
Status row, Sec 0, and phase-map Phase 0 row). The corrective value — preventing a *third*
re-run — is the point of landing this.

## Sec 1 — What was re-read (read-only throughout)

Executed per #750 Sec 2–Sec 3, one read-only command at a time. No `pm2` mutation, no
restart, no `.env` edit. The Sec 4 gate did not trigger (box `.env` already correct, as
in #751).

**Live state (#750 Sec 2):**
- `git log` HEAD `0e86c383` (#776); local fast-forwarded to match origin. Confirmed.
- `https://primepisodes.com/health` → `200`. Prod up, DB-connected. Confirmed.

**Topology (`pm2 list`, read-only):** unchanged from #751's record —
- id `3` `episode-api-prod-hotfix` (fork, online, ~10D uptime, 0 restarts) — live-serving reference.
- id `0` `episode-api` (cluster, online, ~10D, 1 restart).
- id `1` `episode-worker` (fork, online, ~11D, 0 restarts).
- id 3's 0 restarts since boot means its in-memory credential is its boot credential —
  the one prod has authenticated canon with continuously.

**Credential (#750 Sec 3):**
- **3a** — `pm2 env 3 | grep -i db_password` (read-only): id 3's working in-memory credential.
- **3b** — `grep '^DB_PASSWORD=' /home/ubuntu/episode-metadata/.env` (read-only): box `.env`-on-disk.
- **Comparison: 3a == 3b.** Box `.env` holds the working canon credential. Matches #751.

**`DB_HOST` (landmine 1 — read added this session):**
- `grep '^DB_HOST=' /home/ubuntu/episode-metadata/.env` (read-only) →
  `episode-control-dev....rds.amazonaws.com` — the **canon** endpoint (populated
  `episode-control-dev`), NOT the empty `episode-control-prod` fork.
- #751's record captured the credential reads (3a/3b) but did not explicitly record a
  `DB_HOST` read; this note closes landmine 1 with an explicit live read. Corroborated by
  prod serving 200/DB-connected against this exact `.env` for the process's full uptime.

## Sec 2 — Outcome: gate 2.5 GREEN holds; landmine 1 clear

- **Gate 2.5 (credential):** GREEN, re-confirmed. Box `.env` == running id 3 == working
  canon credential. Unchanged across the nine days since #751.
- **Landmine 1 (`DB_HOST`):** clear. Box `.env` points at canon `episode-control-dev`.
- **No mutation.** Read-only session; Sec 4 not triggered; no `.bak` created.

Both restart-breaking landmines (master runbook Sec 1) are confirmed clear from live box
reads. Gate 2.5 requires no further action ahead of [3].

## Sec 3 — Carried forward (unchanged from #751, not re-litigated here)

- **Two live prod API processes (id 3 + id 0)** remains a topology item for the combined
  [3] restart-to-align window (Track B), not a reconcile-session concern. Flagged, not resolved.
- **Likely cause of the original 06-02 divergence** remains: workstation-side `.env` drift
  (box + both running processes agreed on the working value; only the workstation `.env`
  differed), stated likely, pending the AK audit. Not re-investigated this session.
- **Workstation `.env` staleness** is non-blocking to gate 2.5 (does not govern a prod
  restart). Worth a local fix for workstation tooling; out of scope here.

## Sec 4 — What this session did NOT do

- Did NOT restart, reload, or `pm2`-mutate anything.
- Did NOT edit the box `.env` (3a == 3b) or the workstation `.env`.
- Did NOT execute [3], the restart-to-align, or Phase 2A.
- Did NOT rotate the canon password (FD-31 Sec 6.5, deferred to the combined window).
- Did NOT run the AK five-point audit (still required, separate work).

## Sec 5 — Where [3] actually stands (corrected pointer)

[3]'s remaining entry gates (#751 Sec 5 / #749 Sec 5):
1. Live abort-check re-verify — still required (per #749).
2. Credential gate 2.5 — **GREEN** (#751, re-verified 2026-06-11 here). ✅
3. AK five-point audit — still required (separate work).
4. Combined window: Phase 2A (Strategy B code-reconcile) + FD-31 rotation + Track B
   restart-to-align + route fix + security sweep — the deliberate [3] session (#762).

**The next genuinely-unexecuted entry-gate work is the live abort-check re-verify and/or
the AK five-point audit — NOT Phase 0, which is closed.** Box remains FROZEN, FD-31 OPEN,
[3] not primed.

---
*Independent re-verification (2026-06-11, HEAD `0e86c383`) of the gate-2.5 GREEN state
established by #751 on 2026-06-02. Box `.env` re-read read-only: DB_PASSWORD still == the
working in-memory credential (3a == 3b); DB_HOST confirmed canon (`episode-control-dev`),
closing landmine 1 which #751 did not explicitly record. No mutation, no restart, no pm2
action. Corrects the stale "Phase 0 is next" pointers in master runbook #762. Gate 2.5
needs no further action ahead of [3].*
