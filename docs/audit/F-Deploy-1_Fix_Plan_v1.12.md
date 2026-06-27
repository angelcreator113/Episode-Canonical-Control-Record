# F-Deploy-1 Fix Plan v1.12

**Mints FD-40 (gate-record class): the canon credential rotation gate record is now validly minted in the Fix Plan register. The close is supported by independently re-verified evidence carried in the FD-40 record's supersede banner (five points). The at-filing execution path was irregular and is recorded as such, not laundered. This revision aligns register authority and gate accounting only; it advances no other gate, authorizes no box action, and does not prime [3].**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.11 (register through FD-39) |
| **Gate transition** | Gate 2.5 (canon credential rotation) register status UNCONFIRMED -> CLOSED on valid FD-40 mint. Two gate-hygiene items carried OPEN (see Sec 2). FD-31 remains OPEN. Box remains FROZEN; "do not reboot" stands. [3] not primed. |

## Sec 1 Purpose

This revision exists to supply mint authority that the canon credential rotation gate record never had. The rotation that closed Gate 2.5 (2026-06-15) executed and was independently re-verified from live state, but it was never minted by a Fix Plan revision - it existed only as a standalone cluster keyed to the number FD-40, whose self-applied "closed" banners are not register authority. This revision supplies that authority by minting FD-40, so the register tail and the gate record agree. Scope is numbering/register alignment plus gate-accounting correction. No new live-state investigation is claimed in this revision.

Source anchors:
- F-Deploy-1_FD40_Canon_Credential_Rotation_Gate_Record_DRAFT.md (and its 2026-06-15 supersede banner - the independent re-verification authority)
- F-Deploy-1_FD40_Reconciliation_FORK_AND_BLOCK_DRAFT.md (Path 1 selected; referent-collision rejection)
- F-Deploy-1_Fix_Plan_v1.11.md (predecessor; register tail FD-39)

Note: when FD-39 is referenced in this revision, use the corrected stale-git-pointer reading from v1.11's own register row, not the at-filing "exists in no commit" framing.

## Sec 2 FD-40 minted — canon credential rotation gate record

**FD-40 (gate-record class). Gate 2.5 closure is now register-authoritative.**

Established by independent re-verification in the FD-40 supersede banner and adopted in this minting revision (five evidence points):
- RDS episode-control-dev applied; PendingModifiedValues: {} (nothing in flight).
- SSM /episode-metadata/canon/db_password v2 SecureString metadata confirmed.
- Byte-equality confirmed by SHA-256 hash and length: SSM v2 == box .env DB_PASSWORD, both length 38 (HASH_EQUAL=TRUE, LEN_EQUAL=TRUE).
- CloudTrail ordering confirmed: ModifyDBInstance (09:50:22) then PutParameter (09:53:10), both evoni-admin - correct RDS-then-SSM order.
- Canon probe discriminator confirmed: episode_metadata|143|10.0.20.224.

Recorded qualification (do not soften):
- The at-filing path was irregular: the rotation executed ahead of its Rule 7 drafted-and-confirmed block - not staged draft->confirm->execute. The credential-drift hazard did not bite, but that was verified after execution, not gated before it. Close sound; path irregular. Recorded, not normalized.

Carried OPEN with the close (do not count settled):
- In-memory PlainPw/SecurePw clear is a self-report from the at-filing pass, not independently verified.
- Rotation COUNT is held OPEN (CloudTrail redacts values) per the 2026-06-16 chain-step forward note.
- Stop Gate #1 (no-repeat-at-cutover) remains MANDATORY regardless of this close.

Register-integrity handling rule:
- The tripwire that surfaced the missing mint files as an evidence note plus forward-pointer, not as a separate FD number, per the FD mechanism (a thread that corroborates an existing finding is a note, not a new mint).
- Referent collision rejected: FD-40 is assigned to the gate-record subject (the rotation), not to the defect-about-the-subject (the missing mint). Minting FD-40 to the defect would force the gate to FD-41 or orphanhood.

## Sec 3 Structural consequences

1. **Gate-accounting consequence.** Gate 2.5 can now be counted CLOSED by register authority rather than by a standalone's self-applied banner. The two carried-open hygiene items above travel with the close; they qualify it, they do not block it.

2. **Cleanup consequence.** Orphan standalone cluster reconciliation remains separate and open. The verified existing cluster is **5 FD-40-named standalones, not 6** (the sixth file, F-Deploy-1_FD40_Reconciliation_FORK_AND_BLOCK_DRAFT.md, is this reconciliation's own framing artifact, not part of the verified pre-existing cluster):
   - F-Deploy-1_FD40_Canon_Credential_Rotation_Gate_Record_DRAFT.md
   - F-Deploy-1_Register_Integrity_Tripwire_FD40_Orphan_DRAFT.md
   - F-Deploy-1_[3]_Master_Runbook_FD40_Reconciliation_Readiness_Note_2026-06-15_DRAFT.md
   - FD40_Runbook_Reconciliation_EditSet_DRAFT.md
   - Prime_Studios_Session_Handoff_v20_2026-06-15_FD40.md

3. **Carry-forward precision rule.** Any security-state statement not re-verified in this session is labeled carried or last-known-as-of-date, not asserted as current fact. This applies in particular to the AF class finding and the fork SG exposure state (see Sec 4 note).

## Sec 4 State of play at v1.12 close

| Area | Item | Status |
|---|---|---|
| Register | FD-40 | MINTED (gate-record class) |
| Gate | 2.5 credential rotation | CLOSED by register authority; two hygiene items (in-memory clear self-report; rotation count) carried OPEN |
| Register integrity | orphan FD-40 standalone cluster (5) | OPEN cleanup task - decision implemented in this mint; cluster reconciliation pending |
| Reconciliation | FD-31 legs | OPEN, unchanged |
| Sequencing | [3] | Not primed in this revision |
| Prod box | freeze state | FROZEN, unchanged; "do not reboot" stands |

Notes:
- Any mention of fork SG sg-0164d0b20fbebacbb exposure state (last known open 0.0.0.0/0:5432) is carried from prior records, not re-verified in this minting session; do not phrase as newly established live fact. AF remains a CLASS finding (all three RDS SGs at filing; authority 8043a591/#722 + G1_Audit.md); fork SG closure is deferred to the post-[3] sweep. Standing escalation trigger unchanged: 0.0.0.0/0 or 3.94.166.174/32 reappearing on canon ingress :5432.
- The 2026-06-15 v20 session handoff as the propagation vector for "register through FD-40" entering memory as fact is inferred/likely, not proven.

**Path A discipline note:** v1.12 is register-and-gate accounting only. No production action, no new session scheduling, no additional gate closure beyond Gate 2.5 authority alignment. FD-39's internal prose/table inconsistency and the orphan-cluster reconciliation are separate matters, untouched here. The freeze stands; FD-31 remains OPEN; [3] is not primed.

---
*Fix Plan revision v1.12. Mints FD-40 for the canon credential rotation gate record, aligns register authority with gate status, records the verified close with its path-irregularity qualifier and two carried-open hygiene items, rejects referent collision (FD-40 = gate subject, not the defect-about-it), leaves orphan-standalone cleanup as separate open work, and advances no other gate. AF inherited as CORRECTED class finding, fork SG state carried not re-verified. Freeze stands; FD-31 OPEN; [3] not primed.*