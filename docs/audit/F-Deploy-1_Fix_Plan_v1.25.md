# F-Deploy-1 Fix Plan v1.25

> **Provenance-integrity finding — FD-48 (register), FD-49 (derive sequence). Corrects v1.24 §2.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.24 (FD-47 mint, merged 2026-07-08 via PR #908, commit `47e6fe9f`) |
| **Register tail at open** | FD-47 |
| **Register tail at close** | FD-49 |
| **Closed** | none |
| **Minted** | FD-48, FD-49 |
| **Gate effect** | Advances no gate. Authorizes no prod-box or dev-box action. Phase position restated in §2 with one correction. |

---

## §1 Purpose

v1.25 records a provenance-integrity finding (FD-48) that generalizes and subsumes FD-47, and a derive-sequence defect (FD-49) discovered while executing v1.23 §3's self-certifying sequence on 2026-07-08 (second session that day).

v1.24 §1 stated: *"all architectural decisions cited here were locked in v1.4 §6."* That statement is correct and is the load-bearing fact of this revision. What v1.24 did not know is that **v1.4 §6 disclaims originating those decisions**, and the document it defers to does not contain them.

v1.25 performs no first-instance architectural reasoning. It re-homes decision authority to text that already exists on main, and repairs the derive sequence. It does not re-litigate α, and it does not reopen Phase B G1.

One procedural correction is made in §2.

---

## §2 Phase position (corrected)

Re-derived live at this session's open. Wake-up trio clean: `origin/main` at `47e6fe9f`, no open PRs.

- **Phase A: CLOSED.**
- **Phase B G1: CLOSED** (FD-26/27/28 locked at v1.4 merge). See §5 — the *substance* of that close survives; its *citations* do not.
- **Phase B G2: live gate.**
  - **Correction to v1.24 §2:** v1.24 stated "Implementation doc not authored." **This is false.** Three G2 implementation docs exist on `origin/main` and have since 2026-05-28. See §3.1.
  - α **implementation** has not started. That part of v1.24 §2 stands.
  - FD-31 (prod three-axis split-brain, P0, v1.6) remains **OPEN**. G2 §4.2 *execution* remains **BLOCKED** pending FD-31 close, per v1.23 §2. v1.25 does not touch FD-31.
- **Phase C: NOT STARTED.**

v1.25 moves no gate.

---

## §3 The finding — FD-48

### §3.1 What exists on main

`git log --format="%h %ad %s" --date=short origin/main -- "docs/audit/F-Deploy-1_PhaseB_G2_Implementation*.md"`

```
8043a591  2026-05-28  G2 Implementation v1.2 — topology correction + AD/AE/AF (#722)
2a410108  2026-05-27  G2 Implementation v1.1 (#719)
10017f31  2026-05-26  G2 Implementation v1.0 [skip-automerge] (#718)
```

Plus `docs/audit/F-Deploy-1_G2_4.2_Sequencing_Readiness_Decision_2026-06-15_DRAFT.md` (standalone; no register authority; not read in this session).

The G2 implementation doc was authored six weeks before v1.24 asserted it had not been.

### §3.2 The Planning doc is a pre-decision options paper

Live header spine of `docs/audit/F-Deploy-1_PhaseB_G1_Planning.md` (blob `999798ef`, sole version ever committed, per FD-47 §3.2):

| Section | Actual content |
|---|---|
| §1 | Purpose and scope |
| §2 | The architectural problem sub-form B addresses |
| §3 (§3.1–§3.4) | Sub-form B findings inventory |
| **§4 (§4.1–§4.7)** | **Option α — separate-EC2** |
| **§5 (§5.1–§5.7)** | **Option β — shared-safe** |
| **§6 (§6.1–§6.4)** | **Inputs needed before α/β can be chosen** |
| §7 (§7.1–§7.4) | Contingent decisions hinging on α/β |
| §8 (§8.1–§8.3) | Sub-form D outcome as input (per FD-8) |
| §9 | What this planning artifact unblocks |
| §10 | What this planning artifact does NOT do |
| §11 | Path forward |

**The document ends at §11. §6 ends at §6.4. §9 and §10 have no subsections.**

The Planning doc enumerates α and β, then lists the inputs still required to choose between them. **It does not select α.**

### §3.3 Citation resolution — Fix Plan v1.4 §6

| Decision | Cites | Resolves? |
|---|---|---|
| **FD-26** — α selection; `episode-dev-backend`; **us-east-1d** | Planning §12; §8.1, §8.2, §8.3 | §12 **does not exist**. §8.1–§8.3 exist but contain "what sub-form D means for α/β" — **wrong content** |
| **FD-27** — dev instance class t3.micro | Planning §12; §6.3 "close on 2026-05-20: *dev can run minimal*"; §9.1 t3.small fallback; §13 deferral | §12, §9.1, §13 **do not exist**. §6.3 is "Input 3 — dev workload mirror requirement" — **wrong content** |
| **FD-28** — retire `*-dev` PM2 app definitions | Planning §10.3 | **Does not exist.** §10 is "What this planning artifact does NOT do" |

v1.4 §6 states of FD-26: *"the decision itself was made in the Planning doc §12 and is not re-litigated here."*

v1.4 §7, Path A discipline note, states: *"FD-26/27/28 each cite a Planning doc section that pre-dates v1.4's authoring; v1.4 records the decisions rather than originating them."*

*(Attribution note: both quotations are verbatim from a live `git show origin/main:docs/audit/F-Deploy-1_Fix_Plan_v1.4.md | Select-String -Pattern "us-east-1d|FD-26" -Context 0,6` read, 2026-07-08. The Path A discipline note's subsection number was not visible in that read and is deliberately not asserted. Per FD-49's corollary, it is cited to §7 only.)*

**Both statements defer origination to sections that have never existed in git.** Per FD-47 §3.2 (blob sweep + ~120-commit dangling-tree sweep, both search spaces exhausted), exactly one version of the Planning doc has ever existed. Recovery is dead.

### §3.4 Citation resolution — G2 Implementation v1.2

The same corrupted map propagated downstream. Every Planning citation in G2 v1.2:

| G2 v1.2 cites | Resolves? |
|---|---|
| §10 — "six-step implementation sequence"; doc "mirrors §10's structure" | **phantom** |
| §10.3 — "steps, made concrete" | **phantom** |
| §10 — rebuild guide for post-§4.5.2 incident response | **phantom** |
| §12 — prod-AZ parity (us-east-1d) | **phantom** |
| §13 — deferred items | **phantom** |
| §9 — risks (memory profile, NAT audit, cutover state loss, scope drift) | §9 is "What this unblocks" — **wrong content** |
| §9.1 — t3.small fallback | **phantom** |
| §6.5.3 — NAT-cost-zero placement | **phantom** (§6 ends at §6.4) |
| §6.3 — "dev-can-run-minimal close (2026-05-20)" | **wrong content** |

**Not one Planning citation in the G2 implementation doc resolves.**

### §3.5 Authoring-window reconstruction

All three artifacts landed 2026-05-26; ordering below is by PR number, not by verified commit timestamp.

```
PR #716  4bb001ea  Planning doc (11 sections; §10 = "what this does NOT do")
PR #717  75f2052a  Fix Plan v1.4 — G1 close, FD-26/27/28 locked
PR #718  10017f31  G2 Implementation v1.0
```

Per FD-47 §3.1, the commit message for `4bb001ea` describes a **14-section document** with the α decision lock (§12), the six-step implementation sequence (§10), deferred items (§13), and a sub-amendment trail (§14). That document existed in an uncommitted working-tree or editor-buffer state and was never committed.

**v1.4 and G2 v1.0 were both authored against that buffer.** The buffer was real to their author and is absent from git. This is a single authoring-session failure with two downstream consumers, not two independent errors.

Note: v1.4 §4.1 entry criterion 3 requires *"no open PEs against v1.0 §6 framing, Planning doc §12, or Planning doc §10."* Two of those three targets do not exist. The criterion is unsatisfiable as written and has been trivially "satisfied" by that fact for six weeks.

---

## §4 Consequence assessment

### §4.1 What is lost

Nothing that was ever committed. The phantom sections' *content* is unrecoverable; both git search spaces are exhausted (FD-47 §3.2).

### §4.2 What survives — and why

**v1.4 §6 does not merely cite. It restates.** Each FD entry carries its own rationale inline:

- **FD-26** restates: architectural isolation; operational simplicity for the solo-maintainer; cost as supporting-not-dispositive input (compute delta ~$10–15/month at t3.micro, dwarfed by α/β-independent NAT topology cost); and the AZ rationale — us-east-1d parity with prod `episode-backend` to eliminate AZ-pinned confounds during F-Stats-1 Phase B G2 pilot work.
- **FD-27** restates: functional parity (env vars, schema, S3 bucket structure, dependency versions) is the operational requirement, not resource parity; 0.74% average CPU on the current shared instance as the supporting evidence; t3.small in-place class change as the fallback, explicitly *not* a reopening of α/β.
- **FD-28** restates the retirement steps inline: confirm `deploy-dev.yml` retargeting is live and new dev instance healthy → stop and delete `*-dev` PM2 app definitions on the shared instance → remove `*-dev` definitions from committed PM2 ecosystem config → verify shared-instance PM2 process tree contains only prod apps post-retirement.

**Decision content that v1.4 restated survives in v1.4's own prose. Decision content that v1.4 only pointed at is gone.** No decision in FD-26/27/28 is known to be unrecoverable on this basis.

**Specifically: `us-east-1d` survives.** Its rationale is restated in FD-26's own text. The subnet-sharing placement in G2 v1.2 §4.1 — which shares the sole us-east-1d default-VPC subnet with the frozen prod `episode-backend` instance — therefore rests on restated v1.4 §6 prose, not on the phantom. **No prod-touching decision is orphaned.** This was the principal risk under investigation and it does not materialize.

### §4.3 What survives in G2 v1.2

G2 v1.2's **operational** content is anchored in v1.4, not the Planning doc, and is unaffected:

- §4.1 prerequisites ← v1.4 §4.1 (G2 start gate)
- §4.2 observables with thresholds ← v1.4 §4.2
- §6 rollback procedures ← v1.4 §4.3 rollback triggers
- §4.5 burn-in window ← closes v1.4 §4.5's explicit punt
- §9.6 topology correction + AD/AE/AF file placement ← originated from live 2026-05-28 AWS discovery, not from any doc

**The AD/AE/AF content in §9.6 is load-bearing and is not contaminated.** Per standing discipline, AD (no IAM instance profile / static keys in `.env`), AE (prod box security-group exposure), and AF (class finding across all RDS security groups, P0) remain three distinct findings and are not collapsed by this revision.

G2 v1.2 requires a **citation-repair pass, not a rewrite.** Its structural spine ("mirrors Planning doc §10") must be re-homed to originate from v1.4 §4 + §6 — which is precisely the remediation v1.24 §7 prescribed, arrived at for adjacent reasons.

### §4.4 FD-47 is subsumed

FD-47 recorded dangling citations in v1.4 pointing at Planning §10/§12/§13/§14. FD-48 records that (a) the same phantom map corrupted the G2 implementation doc, and (b) the decisions FD-26/27/28 themselves defer origination into the void. FD-47 stands as minted; FD-48 is its generalization. Neither is closed here.

---

## §5 Does Phase B G1 reopen?

**Ruling: G1 stays closed.** *(Ruling by the maintainer (Evoni), 2026-07-08. Basis: §4.2 restated prose in v1.4 §6; the decision-vs-deliberation distinction below is the maintainer's, recorded here as register authority. Claude drafted §3–§4 and stated a lean; the lean was not the ruling.)*

The register entry is the decision. Planning doc §12 — which has never existed in git — was the deliberation-and-rationale artifact recording the reasoning that led to FD-26/27/28. Its absence means the deliberation record is unrecoverable. It does not mean the decisions are unrecorded.

Phase B G1 would reopen only if v1.4 §6 were itself missing or circular — citing the Planning doc for the decisions' rationale rather than stating it. v1.4 §6 states it. Each of FD-26, FD-27, and FD-28 carries its own rationale inline (§4.2). The citations being void means the pointer chain is broken; it does not mean the decision at the destination was never made. The decisions were made, restated, and locked in v1.4 §6's own prose.

G1 does not reopen.

---

## §6 The derive-sequence defect — FD-49

v1.23 §3 specifies a self-certifying sequence for cold-session phase derivation:

1. `git show origin/main:docs/audit/F-Deploy-1_Fix_Plan_v1.4.md` → **§7.3 phase table**
2. `gh api branches/main/protection` → required checks present
3. `auto-merge-to-dev.yml` → opt-out / backend-syntax / `-X ours` steps intact

**Step 1 is structurally incapable of observing current document state.**

v1.4 §7.3 contains the row:

```
| Phase B G2 | Implementation doc | NOT AUTHORED (authoring unblocks at v1.4 merge) |
```

v1.4 merged 2026-05-26. The G2 docs landed 2026-05-26, 05-27, and 05-28. **That table has been wrong since the day after it was written**, and has been read as live by every cold session since — including the session that authored v1.24, which propagated the false claim into v1.24 §2.

A frozen table inside a historical revision is a **snapshot**, not an observable. Reading it does not certify anything. The sequence produced a stale-but-coherent result while wearing the costume of the procedure built to defeat exactly that failure.

This is the FD-46 class (partial register read yielding confident false state), recurring one layer up: not a partial read of the register, but a **correct read of a structurally stale source**.

### §6.1 Corrected derive sequence

Step 1 is replaced. Document state is derived from the filesystem, never from a revision's prose:

1. `git fetch origin` / `git log --oneline -1 origin/main` / `gh pr list` — wake-up trio.
2. `git ls-tree --name-only origin/main docs/audit/` — **enumerate what exists.** Identify the highest Fix Plan revision and all G2/Phase artifacts present.
3. Read the **highest** Fix Plan revision's phase section. If it defers ("unchanged from vN"), follow the pointer; a revision that declines to restate phase is not the phase source.
4. Cross-check any document-state claim in that revision against step 2's enumeration. **Prose about which documents exist is never authority; `git ls-tree` is.**
5. `gh api branches/main/protection` → FD-5 / FD-23 / FD-24 checks, strict mode, `enforce_admins: false`.
6. `auto-merge-to-dev.yml` → opt-out / backend-syntax / `-X ours` steps intact.

Steps 5–6 are retained from v1.23 §3 unchanged; both read live API/workflow state and are sound.

---

## §7 Decisions log — additions FD-48, FD-49

v1.24 ended at FD-47. v1.25 adds FD-48 and FD-49.

- **Decision FD-48: The provenance of FD-26, FD-27, and FD-28 is void.** Every Planning-doc section cited by the three decisions either does not exist (§9.1, §10.3, §12, §13, §14) or contains unrelated content (§6.3, §8.1–§8.3, §9, §10). The same phantom citation map propagated into `F-Deploy-1_PhaseB_G2_Implementation.md` v1.0/v1.1/v1.2, in which **no** Planning citation resolves. **Remediation:** decision authority for FD-26/27/28 is re-homed to the restated prose within Fix Plan v1.4 §6 itself, which carries each decision's rationale inline and is sufficient to reconstruct all three (§4.2). No decision content is known to be unrecoverable. The G2 implementation doc requires a citation-repair pass re-homing its structural spine to v1.4 §4 + §6; its operational content (§4.1, §4.2, §6, §4.5, §9.6 incl. AD/AE/AF) is v1.4-anchored or live-derived and is **sound as written**. FD-48 subsumes and generalizes FD-47; neither is closed. Phase B G1 does not reopen (§5 ruling). (Verification trail: §3.1–§3.5, all live reads, 2026-07-08.)

- **Decision FD-49: The v1.23 §3 self-certifying derive sequence is defective at step 1.** Reading the phase table in Fix Plan v1.4 §7.3 derives document state from a table frozen at v1.4's merge; that table's "Implementation doc: NOT AUTHORED" row has been false since 2026-05-26 and was propagated into v1.24 §2 by a session that believed it had verified live. **Remediation:** step 1 is replaced by `git ls-tree --name-only origin/main docs/audit/` as the sole authority on which documents exist, followed by reading the *highest* Fix Plan revision (following any "unchanged from vN" pointer) and cross-checking its document-state claims against the enumeration. Corrected sequence at §6.1. Steps 5–6 (branch protection, workflow) are retained unchanged. **Register lesson (generalizing FD-46 and FD-47):** a document's prose about the state of other documents is never authority. Prose is authority only over its own reasoning. Existence is a filesystem question and is answered by `git ls-tree`; content is answered by `git show` on the contested file. Corroboration among a session brief, memory, and a Fix Plan revision is not evidence — they share a common ancestor and go stale together.

---

## §8 Retained from v1.24 (explicitly not superseded)

- **FD-47** as minted. §3.1–§3.3 verification trail stands.
- **FD-31** (prod three-axis split-brain, P0) remains OPEN. G2 §4.2 execution remains BLOCKED.
- **v1.24 §2 procedural ruling:** implementation-doc *authoring* is not FD-31-gated; authoring precedes execution and requires no prod-box access. **Retained.** It now applies to citation repair rather than first authoring.
- **v1.24 §5** side observation — stranded Fix Plan v1.8 draft (dangling blob `d53e22a3`). Flag only. No action. No register entry. Not read in this session.

---

## §9 Register hygiene

- Register tail at v1.25 open: FD-47 (v1.24). FD-48 and FD-49 minted here. Tail at close: FD-49.
- FD numbers are minted only by Fix Plan revisions — this revision conforms.
- `F-Deploy-1_G2_4.2_Sequencing_Readiness_Decision_2026-06-15_DRAFT.md` and `F-Deploy-1_Fix_Plan_v1.19_NOTES.md` are standalone artifacts in the audit namespace. Neither is a revision. Neither carries register authority. Any self-applied closure banner on either is void per standing discipline.
- **Unverified in this session, flagged only:** G2 v1.2 cites Fix Plan v1.5 (PR #721, merged 2026-05-28) and FD-30. Neither was read live here. Not in v1.25's scope.
- v1.25 closes no findings, advances no gates, authorizes no prod-box or dev-box action.

---

## §10 What v1.25 unblocks

**Phase B G2 citation-repair pass** — re-homes the G2 implementation doc's structural spine from phantom Planning citations to v1.4 §4 + §6. Doc-only; no prod-box access required. Per retained v1.24 §2 ruling; G1 stays closed per §5.

G2 §4.2 *execution* remains BLOCKED on FD-31.

---

*End of F-Deploy-1 Fix Plan v1.25 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-08.*
*Predecessor: v1.24.*
*Closed: none. Minted: FD-48, FD-49. Advances no gate; authorizes no prod-box action. [skip-automerge]*
