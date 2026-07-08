# F-Deploy-1 Fix Plan — v1.23 (2026-07-08)

Formal revision. **Supersedes the Phase-position section of v1.22 only.**
All v1.22 register content stands except its "Phase position"
enumeration, which is corrected here. This revision records PHASE
POSITION, names two contaminated on-main documents, and mints one
register-integrity finding (FD-46). Performs no first-instance reasoning
beyond transcription and live verification; executes no box or canon
action; mints no gate advance.

Basis: live reads on 2026-07-08 against origin/main at f15bae0a —
- `.github/workflows/auto-merge-to-dev.yml` (full body; A-1/A-2/A-3 present)
- `gh api .../branches/main/protection` (C-1 live: 3 required checks, strict, 0 reviews, admins-false)
- `git log --follow` on the workflow file (PRs #705/#707/#709/#720 provenance)
- Fix Plan bodies v1.2, v1.3, v1.4, v1.6 (full or gate-scoped); chain scan v1.7–v1.13 (no Phase A reopen)
- Register tail confirmed: FD-45 last minted (v1.21); v1.22 minted none; PR #906 minted none — FD-46 clean.

This basis set is stated in full precisely because v1.22's error was a
partial basis (§3). Any successor revisiting phase position should widen,
not narrow, this set.

## §1 Purpose

v1.23 corrects a phase-position error in v1.22, names its propagation into
a second on-main document, and records the mechanism so it does not
regenerate. Specifically:

1. **Phase A is CLOSED**, since 2026-05-26. v1.22's "PHASE A IS OPEN …
   G2 REMAINS unexecuted" is wrong at the gate level. Corrected §2.
2. **The live frontier is Phase B G2, BLOCKED on FD-31**, not Phase A G2.
   Recorded §2.
3. **Two on-main documents carry the error** (v1.22 source; PR #906
   evidence note by inheritance). Named §2.1.
4. **The mechanism** — reconstruction from a partial register basis, then
   propagation — is documented §3 (FD-46) so a future cold session
   re-derives correct position in one read.

What v1.23 does NOT do:
- Does not disturb v1.22's other content. The credential-thread
  characterization (v1.14–v1.21 = deploy-box runtime work, not Phase A
  progress) and the Decision #9 transcription are correct and retained
  (§4).
- Does not adjudicate the PR #906 evidence note's FD-5-reconciliation
  reasoning. That reasoning rests on the false premise and is flagged
  contaminated (§2.1); assessing what, if anything, survives the
  correction is a separate gated read, not v1.23's scope.
- Does not advance any gate, close any FD, or authorize any box/canon
  action. FD-31 stays OPEN; prod box stays FROZEN; [3] stays un-primed.
- Does not modify the memory/handoff layer (§5, flag only).

## §2 Phase position (authoritative as of this revision)

**Phase A: CLOSED.** Lineage, each link corroborated by cited body plus
live artifacts:

| Gate | Disposition | Recorded | Live corroboration |
|---|---|---|---|
| Phase A G1 | CLOSED | v1.1 (FD-13) | — |
| G2 sub-form A (A-1/A-2/A-3) | SHIPPED | v1.2 (#705), v1.3 (#707/#709) | workflow file: opt-out grep + backend-syntax + -X ours steps present |
| G2 sub-form C (C-1) | SHIPPED | v1.3 (direct API) | `gh api`: Cost Exposure Audit + Tests + Route Validation, strict=true, 0 reviews, enforce_admins=false |
| G2 sub-form D (F-Deploy-G1-Y) | CLOSED (FD-22, identified—removal-sufficient, N=8) | v1.3 | — |
| **G2 gate** | **CLOSED** | v1.3 merge | — |
| G3 | SUPERSEDED (subsumed into sub-form D) | v1.3 §4.3 | — |
| G4 soak | **CLOSED CLEAN** (8-day, 05-19→05-26, 4-for-4) | v1.4 §3.1 | — |
| **Phase A overall** | **CLOSED (2026-05-26)** | v1.4 | inherited-CLOSED v1.6/v1.7/v1.8; dropped from carry list v1.9–v1.13 as settled |

**Phase B: G1 CLOSED, G2 BLOCKED.**
- G1 CLOSED at v1.4 (FD-26/27/28): α architecture, separate dev EC2
  `episode-dev-backend` (us-east-1d).
- G2 (α implementation) is the live frontier, **BLOCKED on FD-31** — prod
  three-axis split-brain (P0, v1.6). Sec 4.2 not executable while it
  stands. Credential/restart thread (v1.14–v1.21) is runtime work
  adjacent to this block.

**Keystone close:** Phase A (done) → Phase B G1 (done) → Phase B G2
(blocked on FD-31) → Phase C soak/verify. F-Stats-1 Phase B G2 unblocks at
F-Deploy-1 Phase B G2 close; Phase B/C-soak canonical-test exception
unchanged.

### §2.1 Contaminated documents on main

The phase-position error exists in two documents on origin/main as of
f15bae0a. Both are named here so a cold session hitting either has a
pointer to this correction.

| Document | Commit | Role | Disposition |
|---|---|---|---|
| Fix Plan v1.22 | d96b0e62 | **Index case** — asserts "Phase A open / G2 unexecuted" from a partial basis | Phase-position section **SUPERSEDED** by §2. Rest of v1.22 stands (§4). |
| `docs/audit/Finding_Main_BranchProtection_Bypass_EvidenceNote_2026-07-07.md` (70f01b68) | 70f01b68 | **First transmission** — states "v1.22's statement that G2 remains unexecuted stands" and builds FD-5-reconciliation reasoning on that false premise | **FLAGGED CONTAMINATED, not superseded.** Its premise is false per §2. Its FD-5 reasoning is not adjudicated here (out of scope, (a)-boundary); a separate gated read owns it. |

A cold session reading either document should treat v1.23 §2 as
authoritative and disregard their phase-position claims. The evidence
note's non-phase-position content is not assessed by v1.23.

## §3 Register-integrity finding — FD-46

**Decision FD-46: A phase-position error entered the register at v1.22
and propagated to a second on-main document (PR #906) within 24 hours;
this cold session began to inherit it a third time before live reads
broke it. The error has no basis in any prior revision.**

**Mechanism.** v1.22's declared basis was "live reads of v1.21, v1.20,
v1.19, v1.14, v1.1" — a set that **omits v1.2, v1.3, v1.4**, the exact
revisions where G2 executed, closed, and soak completed. v1.22 re-read
v1.1's *plan* for what G2 would be, confirmed no credential-thread
revision advanced it, and concluded "unexecuted" — never reading the
revisions where it was. Not a factual slip; a **reconstruction from a
partial basis that structurally could not see the closure.**

**Propagation.** The PR #906 evidence note (70f01b68, same day) did not
re-derive independently — it wrote "v1.22's statement … stands,"
inheriting the error and building FD-5 reasoning atop it. Index case →
first transmission in under 24 hours, both on main, both dated the day
before this session. This session's cold entry began to inherit it a
third time ("do a G2" nearly resolved to already-shipped work) before
reads of the contested surfaces refuted it.

**Aggravating factor.** v1.22 is the newest Fix Plan revision and
self-labels as the authority cold sessions should inherit from. Recency
plus self-labeling is why the error propagated instead of being caught.

**Self-certifying correction.** To re-derive true phase position in one
read:
1. `git show origin/main:docs/audit/F-Deploy-1_Fix_Plan_v1.4.md` → §3.1
   "G4 soak — 8-day clean"; §7.3 "Phase A | Overall | CLOSED"
2. `gh api .../branches/main/protection` → three required checks = C-1
   shipped = G2 sub-form C done
3. `auto-merge-to-dev.yml` → opt-out + backend-syntax + -X ours steps =
   sub-form A done

Any one refutes "Phase A open." All three agree. **Recency of a revision
is not authority; corroboration against live artifacts is.**

## §4 Retained from v1.22 (explicitly not superseded)

1. **Credential-thread characterization.** FD-31/38/42/43/44/45
   (v1.14–v1.21) is deploy-box runtime work adjacent to Phase B; not
   Phase A progress. (v1.22 item 2.) *More* true than v1.22 framed it —
   Phase A was already closed when the thread began, so it never bore on
   Phase A at all.
2. **Decision #9 gate.** F-Stats-1 Phase B gated on KEYSTONE CLOSE (Phase
   C complete), not Phase A close; sole exception F-Stats-1 Phase B G2 as
   canonical test DURING F-Deploy-1 Phase B/C soak. (v1.22 item 3,
   transcribed correctly from F-Stats-1 Fix Plan v1.2 §9.)

## §5 Forward-note — suspected memory/handoff origin (flag only, no action)

Both this session and the v1.22-authoring session carried in a *belief*
that Phase A was open before reading anything — suggesting an origin
upstream in the memory/handoff layer, not solely in v1.22's basis
selection. The on-main document contamination is handled by §2.1; this
note concerns only the un-verifiable upstream seed. v1.23 does not act on
it (memory layer out of scope, not register-verifiable) but flags it so
the pattern receives attention rather than regenerating a future
revision. Recommended attention item, not a gate.

## §6 Register hygiene

- Doc-only revision. No code, config, or box/canon contact.
- All issue/PR references (#704/#705/#707/#708/#709/#720/#906) historical;
  **FD-21 closing-keyword check on the commit message before commit** (no
  `close/fix/resolve #N` adjacent forms — note #906/#708 appear in body).
- Ships with `[skip-automerge]`.
- FD-46 confirmed clean against live tail (FD-45 last minted at v1.21;
  v1.22 and PR #906 minted none).

*Closed: none. Minted: FD-46. Advances no gate; authorizes no prod-box
action. [skip-automerge]*

---
*End of F-Deploy-1 Fix Plan v1.23 (draft).*
*Author: Claude, cold session with Evoni, 2026-07-08.*
*Predecessor: v1.22 (d96b0e62). Supersedes v1.22 Phase-position section only.*
*Successor: TBD. Live frontier on merge = Phase B G2, blocked on FD-31.*
