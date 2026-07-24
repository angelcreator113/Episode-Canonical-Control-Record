# F-Stats-1 Fix Plan v1.3

**CharacterState Sequelize Model Creation + Raw-SQL Consolidation — Prime Studios audit canon**

| | |
|---|---|
| **Version** | 1.3 |
| **Date** | 2026-07-22 |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Supersedes** | v1.2 (plan-of-record since 2026-05-14) |
| **Predecessor keystone** | F-Deploy-1 (KEYSTONE CLOSED 2026-07-22, Fix Plan v1.48) |
| **Gate status** | **Decision #9 gate SATISFIED** — Phase B G2 executable |
| **Surface basis** | F-Stats-1_Surface_Reverification_2026-07-21.md (certified at 45d73f00); PR 1 inventory derived live this revision at 3cfc1718 |
| **Register effect** | Mints no FD (FD numbers are F-Deploy register; F-Stats findings are §12.N). Adds §12.21–§12.23; revises §12.3, §12.13, §12.18; adds Decisions #10–#12. |

---

## What changed in v1.3

v1.2's substantive plan content (problem statement, scope, phase structure,
model spec, §12.1–§12.20) is carried forward except as revised below. Updates:

- **§9:** Decisions #10 (gate satisfied / Phase B resumes), #11 (branch
  naming outside `claude/**`), #12 (PR 1 'lala'-read handling) added
- **§12:** §12.21 (unregistered remediation reconciliation), §12.22
  (asymmetric drift extension into PR 1 files), §12.23 (careerGoals
  untransacted completion writers) added; §12.3, §12.13, §12.18 revised
  per the 2026-07-21 surface reverification
- **§13 (new):** PR 1 conversion inventory, derived live at main 3cfc1718
- **§11:** v1.3 row added
- Provenance correction: Phase A G2 landed as squash **30f10fe7** (#684);
  v1.2 header's `178c981` is the pre-squash branch commit, unreachable
  from main by design

---

## §9 Decisions Locked (Decisions #10–#12 ADDED)

Decisions #1–#9 unchanged.

### Decision #10 — Decision #9 gate satisfied; Phase B G2 resumes

F-Deploy-1 keystone CLOSED 2026-07-22 (F-Deploy-1 Fix Plan v1.48: G2 s8
criteria 1–8 satisfied, Phase B closed, keystone closed). Per the
2026-06-28 Gate Reconciliation, Decision #9 is the single authoritative
gate; it is satisfied. **F-Stats-1 Phase B G2 is executable.**

Decision #9's reason of record (autonomous merge landing Phase B code on
main) verified dead this session, live at 3cfc1718:

- No Auto-merge-to-main workflow exists in `.github/workflows/` (four
  files: auto-merge-to-dev, deploy-dev, deploy-production, validate)
- `deploy-dev.yml` carries no push trigger (guarded read returned no
  match)
- `auto-merge-to-dev.yml` remains armed on `claude/**` pushes but its
  deploy cascade is severed (deploy-dev has no push trigger); residual
  hazard is review-bypass into dev only, neutralized structurally by
  Decision #11

**Locked: 2026-07-22.**

### Decision #11 — Phase B branches named outside `claude/**`

All F-Stats-1 Phase B branches use the **`fstats/`** prefix (e.g.
`fstats/phase-b-pr1`). `auto-merge-to-dev.yml`'s `claude/**` filter
structurally cannot match; no per-commit `[skip-automerge]` discipline is
required or relied upon. Structural exclusion chosen over procedural
opt-out (one forgotten token on a multi-push PR fires the merge with
`-X ours` hunk-discard risk).

**Locked: 2026-07-22.**

### Decision #12 — PR 1 'lala'-read handling: convert-verbatim, do not fix

The four 'lala' state reads inside PR 1's files (§12.22) are converted to
ORM calls **preserving `character_key = 'lala'` exactly as written**.
Rationale: F-Stats-1's mandate is mechanical raw-SQL → ORM consolidation;
the character_key drift fix is F-Sec-3's mandate (register order locked).
Fixing keys mid-conversion would (a) change runtime behavior inside a
"mechanical" PR, (b) partially remediate the drift asymmetrically — the
exact failure mode §12.22 documents from prior partial remediation, and
(c) blur the register's ownership of the §12.12 war-chest fix. Each
converted 'lala' site receives an inline comment naming F-Sec-3 as owner.
**Owner-comments are mandatory at every converted 'lala' site and are
verified at PR review — a converted site without its comment fails
review.**

**Locked: 2026-07-22.**

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-14 | Initial plan. Committed at `a278a69`. |
| v1.1 | 2026-05-14 | Path 1 confirmed; §12.1–§12.18 populated. Committed at `dbd32f13`. |
| v1.2 | 2026-05-14 | §12.19 (deploy incident); Decision #8 (F-Deploy-1 promoted). |
| v1.3 | 2026-07-22 | Gate satisfied (Decision #10); branch naming (Decision #11); 'lala' handling (Decision #12); §12.21–§12.23; §12.3/§12.13/§12.18 revised; §13 PR 1 inventory; 30f10fe7 provenance correction. |

v1.3 supersedes v1.2 for all forward references.

---

## §12 Findings (REVISED + §12.21–§12.23 ADDED)

### §12.3 — REVISED (was: drift comment at evaluation.js:619-623)

Superseded-in-part per the 2026-07-21 reverification: evaluation.js:621's
comment now documents a fix, not the bug. The 'key === lala' gate was
dropped; evaluation.js writes are canonical-'justawoman'. See §12.21 for
the crediting commit.

### §12.13 — REVISED (was: transactional gap at episodeCompletionService:405)

Fixed in evaluation.js (~614: transaction wraps state UPDATE + history +
ledger mirror), via the §12.21 commit. episodeCompletionService's own
transaction posture remains **unverified** — carried as an open
verification item for the executing session.

### §12.18 — REVISED (was: careerPipelineService 'lala' queries)

Remediated: no `character_key='lala'` query remains in
careerPipelineService (guarded grep, exit 1 on quoted form; reverification
2026-07-21). Introducing commit untraced. worldEvents ~3832's warning
against this bug is now stale.

### §12.21 — Unregistered remediation reconciliation (NEW)

evaluation.js's transaction wrapper, ledger mirror, idempotent seeding,
and lala-gate drop landed via commit **ddebf9d3** ("Claude/f auth 1
backup", #658) — F-AUTH-1-adjacent work predating #684, previously
claimed by no F-Stats-1 register entry. This revision credits it and
revises §12.3/§12.13 accordingly. careerPipelineService's 'lala'-removal
(§12.18) is similarly credited as remediated-by-untraced-commit; tracing
the introducing commit is documentation-tier, not gating.

### §12.22 — Asymmetric drift extends into PR 1 files (NEW)

**Severity: F-Sec-3 evidence (P0 mechanism); F-Stats-1 handles per
Decision #12 only.**

The 2026-07-21 reverification established the drift as asymmetric
(canonical-'justawoman' writes vs 'lala' wardrobe reads/deducts). Live
inventory at 3cfc1718 extends the 'lala' read surface into PR 1's own
files — four sites the reverification did not cover:

- careerGoals.js:386 (create flow — state read)
- careerGoals.js:529 (**evaluate flow** — state read feeding goal
  completion checks)
- careerGoals.js:609 (suggest flow — state read)
- episodes.js:941 (state read)

Consequence sharpens §12.12: career-goal evaluation reads the 'lala' row
that episode-completion deltas (canonical-'justawoman') never credit.
"Build the war chest" evaluates against a row its income never reaches.
Routed to F-Sec-3 as evidence; PR 1 converts these sites verbatim with
owner-comments (Decision #12).

### §12.23 — careerGoals.js completion writers are untransacted (NEW)

**Severity: F-Tx-1 / architectural (live instance of the parallel
completion-writer P0).**

careerGoals.js contains zero transaction usage (guarded grep, 0 matches).
The evaluate flow's writes — current_value update (:553) and completion
write (:561, `status='completed', completed_at=NOW()`) — run bare,
adjacent to state reads, with no atomicity. One of the known "4 parallel
completion writers." Disposition: **out of PR 1 scope** (mechanical
conversion preserves the no-transaction posture verbatim); routed to
F-Tx-1. Adding transactions during conversion would be scope creep into
behavior change — same reasoning as Decision #12.

Construction-hygiene note for the converting session: careerGoals.js:478
builds `SET ${setClauses.join(', ')}` by string interpolation. Verify
during conversion that setClauses inputs are code-controlled
(allowlisted fields), not request-controlled; the ORM conversion
(`Model.update` with attribute object) retires the pattern regardless.

---

## §13 PR 1 Conversion Inventory (NEW — derived live at 3cfc1718)

Method: guarded Select-String passes over `origin/main:` blobs
(match-count printed per FD-51; placeholder-execution defect on the first
pass round disclosed and re-run resolved).

**episodes.js — 2 conversion units.** File already substantially ORM
(transaction-wrapped Episode/Scene/TimelineData block confirmed at
~218–284). Remaining raw sites:

| # | Line | Statement | Convert to |
|---|---|---|---|
| E1 | 931 | SELECT world_events by used_in_episode_id LIMIT 1 | WorldEvent.findOne |
| E2 | 941 | SELECT character_state ('lala') LIMIT 1 | CharacterState.findOne — verbatim key + F-Sec-3 owner comment |

**careerGoals.js — 17 conversion units, zero ORM, zero transactions.**

| # | Line | Flow | Statement | Convert to |
|---|---|---|---|---|
| C1 | 46 | List | Dynamic SELECT (string-built query + replacements) | CareerGoal.findAll with where object |
| C2 | 80 | Seed | SELECT title existence check | CareerGoal.findAll (titles) |
| C3 | 300 | Seed | INSERT career_goals | CareerGoal.bulkCreate or create |
| C4 | 370 | Create | SELECT COUNT dup check | CareerGoal.count |
| C5 | 386 | Create | SELECT character_state ('lala') | CharacterState.findOne — verbatim + owner comment |
| C6 | 396 | Create | INSERT career_goals | CareerGoal.create |
| C7 | 426 | Create | Re-SELECT created row | Returned instance from C6 (unit retired) |
| C8 | 478 | Update | UPDATE with interpolated SET clause | CareerGoal.update with attribute object (§12.23 hygiene note) |
| C9 | 483 | Update | Re-SELECT updated row | instance.reload or returned values |
| C10 | 505 | Delete | DELETE career_goals | CareerGoal.destroy |
| C11 | 529 | Evaluate | SELECT character_state ('lala') | CharacterState.findOne — verbatim + owner comment |
| C12 | 537 | Evaluate | SELECT active goals | CareerGoal.findAll |
| C13 | 553 | Evaluate | UPDATE current_value | instance.update — **no txn added** (§12.23) |
| C14 | 561 | Evaluate | UPDATE status='completed' | instance.update — **no txn added** (§12.23) |
| C15 | 601 | Suggest | SELECT active goals | CareerGoal.findAll |
| C16 | 609 | Suggest | SELECT character_state ('lala') | CharacterState.findOne — verbatim + owner comment |
| C17 | 624 | Suggest | SELECT world_events (draft/ready) | WorldEvent.findAll |

**Model prerequisite check (owed before branch cut):** CharacterState
model exists (30f10fe7, unmodified). Existence of CareerGoal and
WorldEvent Sequelize models is **unverified** — first task of the
executing session. If either is absent, model creation joins PR 1 scope
(mirroring Phase A's CharacterState pattern) and the inventory's
"Convert to" column is re-cut accordingly.

**Behavioral invariant:** PR 1 is response-identical. Same rows read,
same rows written, same keys, same status codes. Only the query mechanism
changes. Any diff in behavior is a defect in the conversion, not a
feature.

---

## Open items carried to the executing session

1. CareerGoal / WorldEvent model existence check (gates inventory's
   Convert-to column)
2. episodeCompletionService transaction posture (§12.13 residue)
3. character_state unique-constraint status (carried since v1.1; owner
   F-Sec-3, verify-only here)
4. PR 2–4 inventories (wardrobe, evaluation, worldEvents) — re-derive at
   execution time per the reverification's staleness verdicts; NOT
   pre-derived here (they'd be stale by their own execution date)

---

## Forward Statement

v1.3 is the plan-of-record. Phase B G2 PR 1 scope: 19 conversion units
(17 careerGoals + 2 episodes), branch `fstats/phase-b-pr1`, behavioral
invariant enforced, 'lala' keys preserved verbatim per Decision #12.
After PR 1: PRs 2–4 per the planning doc, inventories re-derived per PR.
After F-Stats-1 closes: fix-cycle continues per the locked register order
(F-Ward-1 next).

---
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-22. Main at 3cfc1718 (#948). Predecessor: v1.2.*
*Minted: §12.21–§12.23, Decisions #10–#12, §13. No FD numbers. [skip-automerge]*