# F-Deploy-1 â€” Session Close: Phase 1 GREEN + P-4 Handoff

**Date:** 2026-06-16
**Session type:** Live abort re-verify (Phase 1) + Phase 2A prerequisite reconciliation. Read-only throughout.
**Status:** FILED â€” settled session record. Authorizes no box action; primes nothing.
**Box state at close:** FROZEN. FD-31 OPEN. [3] NOT primed.

---

## 0. One-line

Phase 1 live abort re-verify ran GREEN this session (all ten Sec 5 checks, live, none
inherited). The "ready off-box artifact" going-in premise was found false against three
agreeing sources; the authoritative next work is P-4 (off-box build), which the Phase 2A
spec names as deserving its own clean session start. No box was touched.

---

## 1. Phase 1 â€” Live abort re-verify: GREEN (confirmed live, not inherited)

Per `[3]_Master_Runbook` Sec 5 / FD-31 Â§7. Workstationâ†’canon RDS, read-only
(`PGOPTIONS=-c default_transaction_read_only=on`, PreFlight Reverify Sec 1 method â€”
never the on-box psql path). Credential sourced live from SSM SecureString
`/episode-metadata/canon/db_password` v2 (the FD-40 backup-of-record), decrypted at
read time, cleared after.

| Sec 5 check | Expected | Live result | |
|---|---|---|---|
| db | episode_metadata | episode_metadata | âœ“ |
| server | 10.0.20.224 | 10.0.20.224 | âœ“ |
| shows | 10 | 10 | âœ“ |
| episodes | 72 | 72 | âœ“ |
| assets | 64 | 64 | âœ“ |
| world_events | 53 | 53 | âœ“ |
| wardrobe | 40 | 40 | âœ“ |
| social_profiles | 444 | 444 | âœ“ |
| franchise_knowledge | 605 | 605 | âœ“ |
| table total (public schema) | 143 | 143 | âœ“ |
| Snapshot `episode-control-dev-prefreeze-insurance-20260530` | available | available | âœ“ |
| Verified dump `...-verified-20260530.dump` | present, 2,828,246 B | present, 2,828,246 B | âœ“ |

Discriminator `episode_metadata|143|10.0.20.224` matches on all three terms. Counting
method for the 143 total confirmed empirically: `information_schema.tables WHERE
table_schema='public'` yields exactly 143.

**Caveat per spec gate-inheritance:** this GREEN is banked for THIS session. The Phase 2A
ExecutionSpec requires a FRESH Phase 1 re-verify at the actual [3] window's own start â€”
this session's GREEN does not carry into the window.

## 2. Phase 2A prerequisite reconciliation â€” the corrected picture

Going-in premise (session open): "off-box build finalized and ready to extract." **FALSE.**
Contradicted by three agreeing sources:

- `Pre2A_OffBox_Build_Confirmation_2026-06-14_PASS.md` Sec 5: "No artifact was persisted.
  Rebuild-at-priming is selected." (verified on HEAD this session)
- `Phase2A_ExecutionSpec_2026-06-12_DRAFT.md` Sec 0/Sec 1: P-4/P-5 (off-box build + start
  verify) **OPEN**; "the next executable work is NOT a box-side 2A step."
- Rebuild-at-priming policy: build against current tip at window open, not a persisted tree.

**Consequence:** no box-side Phase 2A step is the next action. P-4 (off-box build) is, and
the spec flags it as "a discrete build task deserving its own session start, not a
tail-of-session continuation."

## 3. State banked this session (git-verified)

- **Parity four-tuple target** (build expectation, for the eventual G2A-1 confirm):
  x86_64 / glibc (Ubuntu 22.04, 2.35) / Node 20 / npm 10.x. P-1..P-3 CLOSED 2026-06-12.
- **Arch dimension HIGH-confirmed THIS session:** `aws ec2 describe-instances` on prod
  instance `i-02ae7608c531db485` â†’ `t3.small` / `x86_64`. (Prod instance ID confirmed from
  audit docs, not memory.)
- **Lockfile delta f8253262â†’5db6493a (HEAD):** 11 commits, ALL `docs(audit):` (docs-only,
  zero code). `package.json` / `package-lock.json` UNCHANGED across the range. P-4's
  `npm ci` against current tip is expected to reproduce the 06-14 PASS result (946 pkgs,
  no native-ABI failure). Dependency-tree variable removed; runtime-parity gate (G2A-1
  Node/npm confirm) still stands.
- **Rebuild-at-priming** confirmed from HEAD as the operative policy.
- **SSM v2** confirmed as live canon credential source (describe-parameters: SecureString,
  v2, LastModified 2026-06-15, evoni-admin).

## 4. Boundary checks (this session)

- No production SSH. No box mutation. No restart.
- No credential written or rotated; SSM read-only (decrypt for probe, cleared after).
- No shared-state mutation by Claude. This note is filed via the operator's own Rule 7 gate.
- The parity four-tuple probe (`uname`/`ldd`/`node`/`npm`) was NOT run on the box this
  session. A stray paste of it into local PowerShell returned workstation values
  (node v22.22.0 / npm 10.9.4) â€” VOID, not a box reading, discarded. G2A-1 remains
  un-run, as designed for this session.

## 5. Open items carried forward

- **Stop Gate #1 (rotation count, one-vs-two):** still OPEN. No-repeat-at-cutover holds
  either way per runbook; count unresolved.
- **P-4 / P-5:** OPEN â€” next executable work, own session start.
- **Untracked working-tree artifacts found this session (NOT triaged, NOT committed):**
  `git status --short` showed 13 untracked files, including `Dockerfile.p4` (suggests a
  P-4 build was at least partially scaffolded outside our sessions), FD-40 reconciliation
  apply-plan drafts (`F-Deploy-1_FD40_Reconciliation_ApplyPlan_DRAFT.md`,
  `..._ChangeSet_DRAFT.md`, `..._Runbook_Hunks_DRAFT.patch`, `FD40_note.md`), and assorted
  `pr-body-*` / scratch files. **Next session: triage these deliberately before P-4 â€”
  the Dockerfile.p4 in particular means do NOT assume P-4 starts from a clean slate, and
  the FD-40 apply-plan drafts may be real unfiled work, not scratch. "Nothing to lose" is
  not "safe to delete."**
- **Sec 7 chain put-parameter step:** the ExecutionSpec/PASS chain places an SSM
  put-parameter between build-confirm and window. SSM v2 exists and authenticated this
  session â€” but whether the chain's intermediate step is formally satisfied was NOT
  separately confirmed. Verify, don't assume, at P-4 session.
- **Two operator touchpoints** (Locus 1 filing-shape, Locus 7 fork-SG) â€” apply-time
  decisions, not resolved here.

## 6. Chain position at close

1. Phase 0 (gate 2.5): CLOSED (PR #799, FD-40).
2. Phase 1 live abort re-verify: GREEN this session (re-run required at window).
3. P-4 off-box build: **OPEN â€” next executable work, fresh session.**
4. P-5 start-verify: OPEN (blocked on P-4).
5. [3] window (G2A-1 â†’ G2A-2 â†’ box-side 2A â†’ 2B flip): later gated session.

[3] NOT primed. Box FROZEN. FD-31 OPEN.
