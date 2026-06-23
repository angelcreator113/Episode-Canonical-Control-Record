# F-Deploy-1 Fix Plan v1.15

**Mints FD-42 — Phase 1 (Sec 5) carries an unstated, currently-unmet off-box-credential precondition; and the stored-canon-credential staleness mechanism is reconciled. FD-42 SUPERSEDES FD-41's credential-staleness *mechanism* (the v1.14 "never applied to the canon `postgres` role" account) with a stale-by-later-rotation account, while RETAINING FD-41's unaffected observation legs. No gate moves; the freeze stands; FD-31 remains OPEN; [3] is not primed.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.14 (origin/main; confirmed live tail via directory read — v1.14 highest, no v1.15) |
| **Audit reference** | FD-41↔FD-42 Reconciliation note (2026-06-22, on main #851); FD-42 provisional note + provenance addenda #1–#3; Fix Plan v1.14 (FD-41); FD-31 PreFlight Plan §7 |
| **Author session** | 2026-06-22. Drafted as transcription of the merged FD-41↔FD-42 reconciliation; performs no first-instance reasoning and executes no query (no box or canon contact). |
| **Status** | DRAFT v1.15 |
| **Gate transition** | None. v1.15 mints one finding (FD-42) and records the reconciliation of FD-41's mechanism. No gate closes; none moves. Box stays FROZEN ("do not reboot" stands); FD-31 OPEN; [3] not primed. |
| **New register entry** | FD-42 — next after the live-confirmed register tail FD-41 (v1.14 runs through FD-41). Live directory read, not a remembered number. |

## §1 Purpose

v1.15 mints FD-42 and records the reconciliation of the canon-credential-staleness finding. FD-42 carries two linked elements: (a) a Phase 1 (Sec 5) precondition finding — the workstation→canon abort re-verify silently assumes a working off-box canon credential, and that assumption is currently unmet; and (b) the reconciliation of FD-41's staleness *mechanism* against the 2026-06-22 CloudTrail provenance chain. The reconciliation posture is **mechanism superseded, observations retained**: FD-42 supersedes FD-41's "never applied to canon" mechanism with a stale-by-later-rotation account, while FD-41's unaffected observation legs remain valid and carried. The credential-validity questions remain cold-[3]-locked behind FD-31 §7, unchanged.

**What v1.15 does NOT do:**
- Does NOT close or advance FD-31. FD-42 adds the precondition + reconciled-mechanism legs, OPEN.
- Does NOT establish canon-validity of any credential group (cold-[3]-locked; D1 holds).
- Does NOT authorize the canon credential apply or any prod-box action. Remediation runs in the gated [3] window.
- Does NOT prime, schedule, or score [3].
- Does NOT rewrite FD-41 or v1.14: FD-41 stands verbatim, its mechanism corrected by supersede, its observation legs retained.
- Does NOT assert "CONFIRMED/resolved" of the rotation mechanism: the mechanism is leading and strongly evidenced, completion inferred (see §3).

## §2 Reference documents

| Document | Section / artifact | Role in v1.15 |
|---|---|---|
| `docs/audit/F-Deploy-1_Fix_Plan_v1.14.md` (origin/main) | FD-41 register entry; inherited [3]-precondition state (Gate 2.5 CLOSED, FD-31 OPEN, box FROZEN) | Immediate predecessor; v1.15 inherits unchanged, mints one finding, supersedes FD-41's mechanism only. |
| `docs/audit/F-Deploy-1_FD41-FD42_Reconciliation_2026-06-22.md` (#851) | Full reconciliation: mechanism-superseded/observations-retained posture; evidence-dependency caveat | The settled input v1.15 transcribes. Forward-points here for the reasoning. |
| `docs/audit/F-Deploy-1_FD42_Phase1_OffBox_Credential_Precondition_DRAFT_2026-06-22.md` | FD-42 provisional note + provenance addenda #1–#3 (SSM history; 06-15 and 06-20 canon ModifyDBInstance events) | Evidentiary basis for the precondition finding and the rotation mechanism. |
| FD-31 PreFlight Plan | §7 (`.env`-credential cutover precondition) | The precondition the stored credential fails to satisfy. |

## §3 Register entry — FD-42

```
FD-42 — Phase 1 off-box-credential precondition unmet; stored-canon-credential
staleness mechanism reconciled (supersedes FD-41's mechanism).

PRECONDITION FINDING:
  Master Runbook Sec 5 (Phase 1) defines the workstation->canon abort re-verify
  (content counts, snapshot, dump) but does not name the credential the workstation
  authenticates with. It silently assumes a working off-box canon credential. As of
  06-20/06-22 evidence that assumption is FALSE: the only off-box credential a cold
  session can reach (SSM v2 = .env value, 97aac3b0... len 38) fails canon auth. The
  working canon credential exists only on-box (/home/ubuntu/episode-metadata/.env and
  pm2 id-3's in-memory pool). A cold workstation session cannot satisfy Phase 1 as
  written; it aborts at credential/identity before any count check. This is the
  mechanism of the 06-22 abort (#844) and recurs identically on every cold attempt
  until the off-box credential is reconciled. NOT a "Sec 5 wrong instruction" defect:
  Sec 5's instructions are correct; the unstated precondition is currently unmet.

MECHANISM RECONCILIATION (supersedes FD-41's mechanism; observations retained):
  FD-41 (v1.14) attributed the staleness to a 06-14/15 credential change "never
  applied to the canon postgres role," with canon assumed to hold the pre-06-15 value.
  The 2026-06-22 CloudTrail provenance chain supersedes that mechanism:
    - 2026-06-15 09:50:22Z  canon (episode-control-dev) master-password modify
                            requested, applyImmediately true (addendum #3)
    - 2026-06-15 09:53:10Z  SSM v2 written (addendum #1; matches FD-40 06-15 write)
    - 2026-06-20 23:16:50Z  canon master-password modify requested,
                            applyImmediately true (addendum #2)
    - no SSM write after 06-15
  Superseding mechanism: STALE-BY-LATER-ROTATION. SSM v2 captured the 06-15-era value;
  a later 06-20 canon modify moved canon again, stranding SSM. FD-41's CloudTrail-empty
  claim is WITHDRAWN (it was a scoping/window miss).

  EVIDENCE QUALIFICATION (register-safe): the rotation mechanism is the LEADING
  explanation, strongly evidenced by the event chain; COMPLETION of either modify is
  INFERRED, not directly proven from CloudTrail alone (events show requests issued and
  queued: applyImmediately true, pendingModifiedValues.masterUserPassword present).
  NOT recorded as "CONFIRMED/resolved" — that framing from the FD-42 draft is qualified
  down here and is not carried into register language without separate completion proof.

  EVIDENCE-DEPENDENCY CAVEAT: the supersede rests on FD-42 addenda #1–#3 prose-level
  CloudTrail/SSM summaries. Sound given those addenda are accurate; revisitable if any
  addendum is later found mis-scoped or misread (e.g., events on a different instance
  than recorded). A fresh warm CloudTrail re-read is an optional hardening step, not a
  prerequisite. (Reconciliation note §5.)

OBSERVATIONS RETAINED FROM FD-41 (unaffected by the mechanism supersede):
  - .env DB_PASSWORD == SSM v2, byte-identical (shared SHA-256 97aac3b0...41fae, len 38).
  - The stored value fails canon auth now from both box and workstation (server reached;
    an auth verdict, not a network mute).
  - The only currently-working credential exists in the running app's in-memory pool
    (uptime ~20d). Fragility: any pool refresh or restart and the app cannot reconnect
    on the stored value.

CARRIED-OPEN (cold-[3]-locked, unchanged):
  - Post-06-20 canon password value — not established (not in any warm-readable source).
  - Which credential group is canon-valid — cold-[3]-locked; warm-testable = false
    (Rotation Scoping v2; D1 holds).
  - Candidate-B canon-auth status — UNRESOLVED, load-bearing.
  All gated behind FD-31 §7 green. The freeze stands.

SEVERITY — binding cold-Phase-1 blocker + fragility: until an off-box canon-valid
credential is re-established (or Phase 1 is re-scoped to source the credential
differently), the cold [3] window cannot pass Phase 1; every cold attempt aborts at
credential/identity, as #844 did. Separately, the sole working credential exists only
in the running process (fragility leg, retained from FD-41).

REMEDIATION (planned direction, admin-chosen): apply the stored 2026-06-15 value to
canon as master - `postgres` is the confirmed RDS master user - via
`modify-db-instance --master-user-password`, making canon's live password match
.env/SSM (one canonical secret source). The app adopts the reconciled credential at
the [3] restart-to-align. NOT a recover-old-value path (higher ambiguity, weaker
control). Runs in the gated [3] window, not standalone: the app cannot adopt any
reconciled credential without the (currently unproven) restart.

Qualifier ties: the apply-to-canon will increment the credential rotation COUNT
(qualifier held OPEN, coming due on the [3] apply); in-memory-credential-clear qualifier
(self-reported-only) addressed by the post-restart state at [3].

Evidence: FD-41↔FD-42 Reconciliation note (#851); FD-42 provisional note + addenda #1–#3.
Status: OPEN — closed by the [3] reconciliation (apply a canon-valid value + restart-to-align).
```

## §4 Register decision — supersede FD-41's mechanism, do not retract FD-41

FD-42 mints as a new register number, not as an edit to FD-41. Discriminator:

1. **Does FD-42 carry independent content/lifecycle?** Yes — the Phase 1 precondition finding is new (not in FD-41), and the reconciled mechanism plus the binding cold-Phase-1-blocker severity are an actionable condition OPEN until the [3] reconciliation. FD-42 is a peer register entry, not a sub-detail.
2. **Does FD-42 retract FD-41?** No. FD-41 stands verbatim in v1.14. FD-42 supersedes FD-41's *mechanism* (additive supersede: the "never applied" account is corrected, not erased) and retains FD-41's observation legs. This is the same additive-supersede pattern FD-41 itself used to correct the original 2026-06-21 investigation.

The register topology: FD-41 (registered, v1.14, mechanism superseded by FD-42, observations retained) → FD-42 (registered, v1.15, reconciled mechanism + precondition finding, OPEN). No prior register entry is rewritten.

## §5 Closing

*Fix Plan revision v1.15. Mints FD-42 — Phase 1 (Sec 5) off-box-credential precondition unmet (the cold workstation→canon re-verify silently assumes a working off-box credential; SSM v2/.env fails canon auth; the working credential lives only on-box), and reconciles the stored-credential-staleness mechanism. FD-42 supersedes FD-41's "never applied to canon" mechanism with a stale-by-later-rotation account (06-15 and 06-20 canon ModifyDBInstance events per FD-42 addenda; FD-41's CloudTrail-empty claim withdrawn), qualified register-safe as leading-mechanism/completion-inferred — not "CONFIRMED/resolved" — and conditioned on the addenda's accuracy (revisitable; fresh re-read optional). FD-41's observation legs (.env==SSM v2 byte-identity, stored-value auth-failure-now, in-memory-only working credential) are retained. Credential-validity questions stay cold-[3]-locked behind FD-31 §7. Advances no gate; authorizes no prod-box action; does not prime [3]. The freeze stands; FD-31 remains OPEN. v1.14 (and the chain beneath it) canonical for anything v1.15 does not supersede.