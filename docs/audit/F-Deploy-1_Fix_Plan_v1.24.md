# F-Deploy-1 Fix Plan v1.24

**Register-integrity finding FD-47 — PR #716 shipped the pre-decision Planning doc draft; v1.4's §10/§12/§13/§14 citations are dangling; implementation-sequence authority re-homed to the Phase B G2 implementation doc**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.23 (FD-46, phase-position correction) |
| **Author start date** | 2026-07-08 |
| **Status** | DRAFT v1.24 |
| **Gate effect** | Advances no gate. Authorizes no prod-box action. Phase position unchanged from v1.23 §2. |

## §1 Purpose

v1.24 records a register-integrity finding (FD-47) discovered during the first Phase B G2 implementation-doc authoring session (2026-07-08), and re-homes the authority for the α implementation sequence. Performs no first-instance architectural reasoning; all architectural decisions cited here were locked in v1.4 §6. One first-instance procedural ruling is made in §2 (doc-authoring not FD-31-gated).

## §2 Phase position (unchanged)

Phase position per v1.23 §2, re-derived live at this session's open (v1.23 §3 self-certifying sequence: v1.4 §7.3 phase table read from origin/main; branch protection API confirmed FD-5/FD-23/FD-24 checks + strict mode + enforce_admins false; auto-merge-to-dev.yml confirmed opt-out/backend-syntax/-X ours steps intact):

- Phase A: CLOSED.
- Phase B G1: CLOSED (FD-26/27/28 locked at v1.4 merge).
- **Phase B G2: live gate.** Implementation doc not authored; α implementation not started.
  FD-31 (prod three-axis split-brain, P0, v1.6) is OPEN; G2 §4.2 execution is BLOCKED pending FD-31 close (per v1.23 §2). Ruling (this revision): implementation-doc *authoring* is not gated on FD-31 — authoring precedes execution and requires no prod-box access.
- Phase C: NOT STARTED.

v1.24 does not move any of these.

## §3 Register-integrity finding — FD-47

### §3.1 The finding

PR #716 (commit `4bb001ea`, merged 2026-05-26, 399 insertions, single commit in the file's history) shipped `docs/audit/F-Deploy-1_PhaseB_G1_Planning.md` as the **11-section pre-decision draft** (2026-05-19 authoring + 2026-05-23 §6 closure notes). The merged file's §10 is "What this planning artifact does NOT do" and states "Does not commit α or β."

The commit message for `4bb001ea` describes a **different document**: "See section 12 for the locked decision; section 10 for implementation sequence... Section 14 records the sub-amendment trail" — a 14-section version with the α decision lock, the six-step implementation sequence, deferred-items list, and amendment trail. That version was never committed.

### §3.2 Verification trail (all live reads, 2026-07-08)

1. `git show origin/main:docs/audit/F-Deploy-1_PhaseB_G1_Planning.md` header scan: sections end at §11. No §12/§13/§14.
2. `git log --oneline origin/main -- <file>`: exactly one commit (`4bb001ea`). Never truncated post-merge — what's on main is all that ever landed.
3. `git show 4bb001ea --stat`: 399 insertions, matching v1.4 §3.2's claim; the merged blob IS the file v1.4's author believed contained §12–§14.
4. `git fsck --lost-found` blob sweep (all standalone dangling blobs, content-filtered): no alternate Planning doc version. One incidental hit was a stranded Fix Plan v1.8 draft (noted §5).
5. Dangling-commit tree sweep (~120 commits): every dangling commit carrying the file carries blob `999798ef` — byte-identical to main. **Exactly one version of this file has ever existed in git.**

Conclusion: the extended version existed only in an uncommitted working-tree or editor-buffer state at PR #716 time. Recovery is dead; both git search spaces exhausted.

### §3.3 Consequence assessment

- **Dangling citations in v1.4.** v1.4's references to Planning doc §10 (six implementation steps), §12 (α decision lock), §13 (deferred items), and §14 (sub-amendment trail) point at sections that do not exist on main. v1.4 §4.4's "Planning doc §10 names six implementation steps" describes content that exists nowhere in git history.
- **FD-26/27/28 are NOT at risk.** v1.4 §6 restated each decision with self-contained rationale (α selection, `episode-dev-backend`, us-east-1d, t3.micro, `*-dev` PM2 retirement, cost basis, fallback paths). The register holds without the Planning doc's missing sections.
- **v1.4 §4 is NOT at risk.** Entry criteria, observable categories, and rollback triggers are stated in v1.4's own text, not by citation.
- **The α implementation sequence has no surviving authority document.** This is the operative gap for Phase B G2.

### §3.4 Decision FD-47

**Decision FD-47: PR #716 shipped the wrong file version — the pre-decision Planning doc draft rather than the extended decision document its commit message describes. v1.4's citations to Planning doc §10 (implementation steps), §12, §13, and §14 are dangling; the α implementation sequence exists nowhere in git history. Remediation: (a) the Phase B G2 implementation doc ORIGINATES the α implementation sequence as first-instance content, citing Fix Plan v1.4 §4 (entry criteria, observables, rollback triggers) and v1.4 §6 (FD-26/27/28) as its sole upstream authority; (b) no current or future document cites Planning doc §10-as-steps, §12, §13, or §14; (c) the merged Planning doc remains on main unmodified as the historical G1 preparation artifact — its §1–§8 architectural analysis and §6 closure notes remain valid citable content; (d) FD-26/27/28 are reaffirmed as standing on v1.4 §6's self-contained text. No re-litigation of the α decision is opened or implied.**

### §3.5 Register lesson (new, generalizes FD-46's class)

**Commit messages are not content authority — only blobs are.** A commit message can describe the intended file in convincing detail while the staged blob is a different version. FD-46's lesson was that Fix Plan prose can contaminate from partial reads; FD-47's lesson is that even the commit record itself can self-certify content it does not contain. Verification of any content claim terminates at `git show <ref>:<path>` on the blob, never at the commit message, the PR description, or a downstream document's citation.

## §4 Retained from v1.23 (explicitly not superseded)

- FD-46 and its contamination flags on v1.22 and the PR #906 evidence note: retained in full.
- The v1.23 §3 self-certifying derive sequence: retained; this session executed it verbatim.
- Phase position per v1.23 §2: retained, restated in §2 above.

## §5 Side observation — stranded Fix Plan v1.8 draft (flag only, no action)

The §3.2 blob sweep surfaced a dangling blob (`d53e22a3`) containing a Fix Plan v1.8 draft (sections: live SSH sequence, FD-36/FD-37 additions). Not compared against v1.8 on main in this session; not in v1.24's scope. Flagged for a future hygiene pass only if a v1.8-content question arises. No register entry.

## §6 Register hygiene

- Register tail at v1.24 open: FD-46 (v1.23). FD-47 minted here. Tail at v1.24 close: FD-47.
- FD numbers minted only by Fix Plan revisions — this revision conforms.
- v1.24 closes no findings, advances no gates, authorizes no prod-box or dev-box action.

## §7 What v1.24 unblocks

**Phase B G2 implementation doc authoring is unblocked** — the G2 doc originates the α sequence against v1.4 §4+§6 per FD-47 remediation. G2 §4.2 *execution* remains BLOCKED on FD-31; doc authoring precedes that gate and does not require prod box access.

---

*End of F-Deploy-1 Fix Plan v1.24 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-08.*
*Predecessor: v1.23.*
*Closed: none. Minted: FD-47. Advances no gate; authorizes no prod-box action. [skip-automerge]*
