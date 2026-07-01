# F-Deploy-1 — Finding: All PM2 Processes Stopped on Prod Box (2026-06-30)

**Type:** Finding document. Additive. Does not supersede any prior doc. Does not advance
any gate. Does not mint a new FD number — recorded as an unclassified finding pending
operator triage. Box was not mutated this session.

| | |
|---|---|
| **Observed** | 2026-06-30, live read this session |
| **Box** | `i-02ae7608c531db485` / `54.163.229.144` (identity proven this session: control-plane + IMDS in-band, both vectors agree) |
| **Session type** | Gate re-verify / [3] pre-entry — NOT the [3] window itself |

---

## Sec 1 — Observation (live, this session)

`pm2 list` on `i-02ae7608c531db485` returned all four processes in `stopped` state:

| id | name | mode | restarts | status |
|---|---|---|---|---|
| 0 | `episode-api` | cluster | 2 | stopped |
| 1 | `episode-worker` | fork | 4 | stopped |
| 3 | `episode-api-prod-hotfix` | fork | 0 | stopped |
| 4 | `episode-api-parallel` | fork | 0 | stopped |

Restart-count asymmetry noted as observation (not inference): id 0 and id 1 have non-zero
restart counts (ran and stopped); id 3 and id 4 have 0 restarts (never auto-restarted in
this PM2 daemon session, or stopped cleanly before any retry fired).

No mutation was made. `pm2 list` is read-only.

---

## Sec 2 — Gate impact

**Gate 2.5 (box-side credential confirm): BLOCKED — not failed.**

The gate-2.5 runbook (`F-Deploy-1_BoxSide_Credential_Reconcile_Runbook.md`, parent #750 —
referenced from warm context, not live-confirmed this session) uses `pm2 env 3 | grep -i
db_password` as the known-good credential reference, on the explicit basis that the running
process is authenticated against canon. With no running process, that reference is absent.
The comparison (3a vs 3b) cannot be performed with the required semantic guarantee.

**[3] window entry: correctly NOT taken this session.**

The window requires a live serving process as a precondition. That precondition is not
met. Entering the window in this state would have been wrong.

---

## Sec 3 — What this finding does NOT conclude

- **Cause unknown.** Whether the stopped state is: a deliberate stop by the operator; a
  crash with no auto-restart configured; a reboot that did not resume PM2; a Phase 2A
  staging action; or something else — is not determined by this observation. Cause
  determination is a separate operator investigation, not part of this session's scope.
- **Site serving state unknown.** Whether `primepisodes.com` is currently returning `200`
  or not was not checked. Nginx may be serving independently; the PM2 state does not
  determine the HTTP answer.
- **No topology conclusion.** Process names (`episode-api-prod-hotfix`, `episode-api-parallel`)
  are recorded as observed facts. No inference is drawn about what Phase 2A did or didn't
  do to the process topology.

---

## Sec 4 — Next steps (operator to determine)

1. **Investigate cause** — using warm context and prior session records (this is a diagnosis
   task, not a [3] entry; warm context is appropriate). Determine why all processes are
   stopped and whether the site is serving.
2. **Update this finding** — with "expected: [reason]" or "unexpected: root cause [X]"
   once established.
3. **Gate 2.5 re-attempt** — only after a running process is confirmed and the known-good
   reference for 3a is available again.

---
*Live observation, 2026-06-30. Additive, no gate advanced, no mutation made. [skip-automerge]*