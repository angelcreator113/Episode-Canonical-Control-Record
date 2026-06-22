# F-Deploy-1 Fix Plan v1.14

**Registers FD-41 — stored canon credential stale against canon (an admin-initiated credential change written to SSM/`.env` on 2026-06-14/15 was never applied to the canon `postgres` role). CORRECTS the original 2026-06-21 investigation, whose two headline claims ("no on-hand credential authenticates" and "`.env` SHA ≢ SSM v2 SHA") were both refuted by live re-verification. No gate moves; the freeze stands; FD-31 remains OPEN; [3] is not primed.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.13 (origin/main; confirmed live tail via `git ls-tree origin/main`) |
| **Audit reference** | FD-31 PreFlight Plan §7 (`.env`-credential precondition); `docs/audit/F-Deploy-1_G1_Audit.md` |
| **Author session** | 2026-06-21. Original finding drafted from a warm read-only investigation; CORRECTED the same day after a live read-only re-verification (the step-zero reads) refuted the original claims. |
| **Status** | DRAFT v1.14 |
| **Gate transition** | None. v1.14 registers one corrected finding (FD-41) and points to its evidence note and the step-4 abort record. No gate closes; none moves. Box stays FROZEN ("do not reboot" stands); FD-31 OPEN; [3] not primed. |
| **New register entry** | FD-41 — next after the live-confirmed register tail FD-40 (v1.13 runs through FD-40 and mints none). Live read, not a remembered number. |

## §1 Purpose

v1.14 registers a single finding about the canon database credential, and corrects the record of how that finding was first stated. A 2026-06-21 warm read-only investigation reported that no credential authenticated against canon and that `.env` and SSM v2 digests differed. A same-day live re-verification (read-only) refuted both claims: the running application authenticates against canon and is healthy, and `.env` and SSM v2 are byte-identical. The real, narrower condition is that the **stored** canon credential is stale against canon — an admin-initiated credential change was written to SSM and `.env` on 2026-06-14/15 but never applied to the canon `postgres` role, so the only working credential currently exists in the running process's in-memory pool.

**What v1.14 does NOT do:**
- Does NOT close or advance FD-31. This finding adds the stored-credential-stale leg, OPEN.
- Does NOT authorize the canon credential apply or any prod-box action. Remediation runs in the gated [3] window.
- Does NOT prime, schedule, or score [3].
- Does NOT claim a fork auth result (the fork was network-unreachable from the box this session; see §3 fork scope).
- Does NOT assert a security incident: the credential writes are admin-recognized and benign (see §3).

## §2 Reference documents

| Document | Section / artifact | Role in v1.14 |
|---|---|---|
| `docs/audit/F-Deploy-1_Fix_Plan_v1.13.md` (origin/main) | Inherited [3]-precondition state (Gate 2.5 CLOSED via FD-40, FD-31 OPEN, box FROZEN, AF CORRECTED class finding, Locus 7 deferred) | Immediate predecessor; v1.14 inherits unchanged, adds one finding. |
| FD-31 PreFlight Plan | §7 (`.env`-credential cutover precondition) | The precondition the stored credential fails to satisfy. |
| Evidence note — 2026-06-21 canon auth investigation (adjudication record) | Box/workstation auth tests, A6==B7 hash identity, two-instance describe, SSM v1/v2 timeline, fork-unreachable result | Evidentiary backing for FD-41 and for the correction. Forward-points here. |
| Step-4 auth/credential abort record — 2026-06-21 | Separate filing; cross-links PR #835 | Procedural-consequence event; distinct from #835. Forward-points to FD-41. |
| PR #835 (cold-entry abort, 2026-06-21) | Cold-entry abort filing | Cross-referenced; a SEPARATE event from the step-4 abort. |

## §3 Register entry — FD-41

```
FD-41 — Stored canon credential stale against canon. An admin-initiated credential
change (SSM v1 2026-06-14, v2 2026-06-15) was synced to .env but never applied to
the canon `postgres` role; the only working credential exists in the running app's
in-memory pool.

CORRECTION RECORD (additive; original investigation claims preserved verbatim,
refuted by live state 2026-06-21):
  The original FD-41 (2026-06-21 warm investigation) asserted, verbatim:
    (a) "no on-hand credential authenticates against canon as role postgres"
    (b) ".env SHA != SSM v2 SHA (97aac3b0...41fae); mismatch confirmed"
  Both are FALSE on live read-only re-verification (2026-06-21):
    (a) REFUTED - the running app authenticates against canon and is healthy
        (/health 200, database:connected, currentDatabase=episode_metadata,
        showCount 1 / episodeCount 18, uptime ~20d). A credential DOES authenticate;
        it is held in the running process's in-memory pool, not on disk.
    (b) REFUTED - .env DB_PASSWORD and SSM v2 are BYTE-IDENTICAL:
        env_pw_sha256 == ssm_v2_sha256 ==
        97aac3b0db096fa8176902ac3de71cf2286cef121f3ba8517e5d2f2a17041fae
        (both len=38, first F, last 9). The 97aac3b0...41fae value the original cited
        as the point of mismatch is in fact the SHARED hash of both stored values.

CORRECTED FINDING (live state, 2026-06-21):
  - The stored canon credential (.env DB_PASSWORD == SSM v2, both = the 2026-06-15
    intended value) FAILS password auth against canon `episode-control-dev` from BOTH
    the box and the workstation: psql returns `password authentication failed for
    user "postgres"` in both shells; the server was reached (auth verdict, not a
    network mute).
  - The only credential that currently authenticates against canon is the one the
    running app loaded at start (process uptime ~20d, start ~2026-06-01) and holds in
    its in-memory connection pool.
  - Cause (admin-confirmed, benign): a credential change was written to SSM
    (v1 2026-06-14, v2 2026-06-15, both by evoni-admin) and .env synced to it, but the
    matching apply to the canon `postgres` role never completed. The stored value is
    the intended-but-never-activated password; canon's live password is the pre-06-15
    value the app still holds. NOT an intrusion (admin-recognized); NOT a cross-wire
    (FORK_DB_PASSWORD is a distinct value - see fork scope).
  - No RDS-side rotation trace: CloudTrail ModifyDBInstance empty; SSM has no v3; the
    only RDS event in window is a 2026-06-08 engine-version upgrade (unrelated).

SEVERITY - fragility, not outage: canon is healthy now, but the sole working
credential exists only in the running process. Any connection-pool refresh or
app/box restart and the app cannot reconnect on the stored value.

FORK SCOPE (out of scope for FD-41):
  - No cross-wire between DB_PASSWORD and FORK_DB_PASSWORD; they are distinct values
    (admin-confirmed).
  - The fork (`episode-control-prod`, 34.237.165.225) was NETWORK-UNREACHABLE from the
    box on :5432 this session (connection timed out). No fork auth conclusion is
    claimed. FORK_DB_PASSWORD is treated as correctly scoped unless a separate
    fork-auth check later disproves it.

REMEDIATION (planned direction, admin-chosen): apply the stored 2026-06-15 value to
canon as master - `postgres` is the confirmed RDS master user - via
`modify-db-instance --master-user-password`, making canon's live password match
.env/SSM (one canonical secret source). The app adopts the reconciled credential at
the [3] restart-to-align. NOT a recover-old-value path (higher ambiguity, weaker
control). Runs in the gated [3] window, not standalone: the app cannot adopt any
reconciled credential without the (currently unproven) restart.

Step-4 abort (sub-detail, distinct from #835): the 2026-06-21 step-4 work halted
because the credentials available to the investigation session (.env, SSM v2) failed
auth, so the canon identity check could not proceed. The abort was CORRECT - the
original finding it was attached to was wrong, and proceeding would have driven a
needless rotation framing against a healthy canon. Recorded as sub-detail, not a peer
FD (no independent remediation/lifecycle). Cross-links #835 (cold-entry abort,
separate event); no merge.

Qualifier ties: the apply-to-canon will increment the credential rotation COUNT
(qualifier held OPEN, now coming due on the [3] apply); in-memory-credential-clear
qualifier (self-reported-only) addressed by the post-restart state at [3].

Evidence: 2026-06-21 canon-auth-investigation evidence note (adjudication record).
Status: OPEN - closed by the [3] reconciliation (apply stored value to canon +
restart-to-align).
```

## §4 Register decision — one FD, not two (unchanged by the correction)

The correction narrowed the finding's content but not its shape: it remains a single condition (stored credential stale against canon) with the step-4 abort as a procedural sub-detail. Discriminator, unchanged:

1. **Independent remediation / lifecycle?** The finding is an actionable condition — OPEN until the [3] apply reconciles it. The step-4 abort has no remediation of its own and is terminal.
2. **If no independent remediation, do not mint a second FD for the procedural consequence.** The abort is a sub-detail, not a peer FD.

The live-register read (against the Fix Plan tail v1.13 + scan across v1.0–v1.13) found no always-FD mandate for abort/incident records; precedent attaches the FD to the finding and files the event as a doc/PR (FD-35/v1.7; PR #704/v1.3). Flip-to-two condition not met.

## §5 Closing

*Fix Plan revision v1.14. Registers FD-41 — stored canon credential stale against canon (admin-initiated 2026-06-14/15 change synced to `.env`/SSM but never applied to the canon `postgres` role; working credential lives only in the running app's in-memory pool). Corrects the original 2026-06-21 investigation: its claims of "no credential authenticates" and "`.env` SHA ≠ SSM v2 SHA" were both refuted by live re-verification (the app authenticates; `.env` == SSM v2, shared hash `97aac3b0…41fae`). Benign admin-incomplete-rotation cause, not an incident; fork out of scope and network-unreachable this session. Planned remediation: apply the stored value to canon as master, picked up at the [3] restart-to-align — one canonical secret source. Step-4 abort recorded as a sub-detail (the abort was correct). Advances no gate; authorizes no prod-box action; does not prime [3]. The freeze stands; FD-31 remains OPEN. v1.13 (and the chain beneath it) canonical for anything v1.14 does not supersede.*
