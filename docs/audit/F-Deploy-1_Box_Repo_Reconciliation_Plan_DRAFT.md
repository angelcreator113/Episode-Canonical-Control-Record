# F-Deploy-1 — Prod Box ↔ Repo Reconciliation: PLAN (DRAFT v0.1)

> **PLANNING / INVESTIGATION DOCUMENT. AUTHORIZES NO BOX ACTION BY ITSELF.**
> Reading or drafting this changes nothing on `episode-backend`
> (`54.163.229.144`, `i-02ae7608c531db485`). The box stays FROZEN. No git
> write (`pull`/`fetch`+merge/`checkout`/`reset`/`stash`/`clean`) and no
> process restart occurs under this plan until a later, explicitly gated
> session. This doc scopes the problem, fixes the facts, and lays out the
> decision structure — it does not resolve it and invents no mechanics.

> **SUPERSEDED IN PART (post-filing, 2026-06-08 → 2026-06-10).** This Plan is the
> at-filing record (DRAFT v0.1, 2026-06-04/06-08). Its Sec 2 investigation and Sec 3
> strategy framing have been overtaken by a later note chain and must NOT be read as
> current: Sec 2 #1/#3 are ANSWERED, and the Sec 3 A/B/C fork is RESOLVED — Strategy A
> withdrawn, Strategy B selected as a lean (C parked-not-killed). The live record is,
> in order: Strategy-Revisit (`F-Deploy-1_Reconciliation_Strategy_Revisit_2026-06-08_DRAFT.md`),
> Pricing (`F-Deploy-1_Strategy_Pricing_BvC_2026-06-09_DRAFT.md`),
> Headroom (`F-Deploy-1_ProdBox_HeadroomCheck_2026-06-10_DRAFT.md`),
> Selection-Lean (`F-Deploy-1_BvC_SelectionLean_Consolidated_2026-06-10_DRAFT.md`),
> Install-Method (`F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md`). Body text below is
> left intact as the at-filing record; these notes are the correction authority.

| | |
|---|---|
| **Why this exists** | The 2026-06-04 [3] session, assembling the Minimal-B config edit against live state, found the prod box is a month and dozens of PRs behind true origin/main on a stale un-fetched remote, AND that prod runs a month of uncommitted, prod-only hand-edits — including keystone work. This is the root cause of the cross-environment schema/code drift the audit has chased. It is larger than the ecosystem-file question that opened [3], and it blocks [3]/Minimal-B. |
| **Supersedes** | The Master Runbook's Minimal-B premise ("land the #746 ecosystem file via the box's git"). That path is dead: the box git is a stale divergent remote and the working tree carries irreplaceable uncommitted work. The ecosystem file, if landed at all, must go by direct file write — and only after this reconciliation is planned. |
| **Status** | DRAFT v0.1 — investigation + decision framing only, no execution. |
| **Standing constraint** | Box one-keystroke-from-disaster. SSH discipline applies to every box-touching step: single read-only commands, confirm `ubuntu@ip-172-31-26-1` prompt before any box command, one terminal for box reads, do repo git work in a separate workstation terminal. Rule 7 hard-gate on every box mutation. |

---

## Sec 0 — Fixed facts (verified read-only, 2026-06-04 / 2026-06-08)

These are established and not to be relitigated:

- **Box git HEAD = `8425c13e`** ("fix(ci): escape github-script inputs…"), with `origin/main`/`origin/HEAD` on the box also pointing there. Prior commit `1f9d5167` carries tag `f-auth-1-keystone-v1.0` and `f8744ecd` references #664 — i.e. the box's newest commit is ~2026-05-09 era.
- **Workstation / true origin HEAD = `db274597`** (#762), with #751/#755/#757–#762 all merged. The box has none of this.
- **The box's "up to date with origin/main" is against a stale, un-fetched ref.** This is why the box `ecosystem.config.js` is the pre-#746 4-app version — #746 and everything after never reached the box. Keep `ecosystem.config.js` and `.github/scripts/deploy-production.sh` in the box-vs-origin delta review, because they define the reconciled Track B end-state.
- **Prod is maintained by direct, uncommitted on-box edits**, never committed or pushed. Tracked modifications: `src/app.js` (−96), `src/config/sequelize.js` (−53), `src/middleware/aiRateLimiter.js`, `src/migrations/20260718000000-…`, `src/models/index.js` (+4); ~90 `scripts/` deletions (AK-5-class cleanup). Untracked: `src/models/CharacterState.js`, three `.env.bak*`.
- **Two of these edits are keystone-class:**
  - `sequelize.js` removes the `DATABASE_URL` parse pathway from the `production` config (commented as eliminating the silent-override drift class) — this is the **split-brain root cause fixed in code** (FD-36 / HAZARD landmine).
  - `index.js` + untracked `CharacterState.js` wire in the **F-Stats-1 Phase A G2 model** — live on prod, in no commit.
- **All of the above is now BACKED UP off-box** at `Documents\PrimeStudios-Backups\box-uncommitted-20260608\`: five literal source files + a full `git diff` patch (356KB, includes the deletions). Verified 2026-06-08. The single biggest risk (one-disk-only prod code) is closed.
- **Box otherwise unchanged / FROZEN.** No restart, no mutation across the 06-04 and 06-08 sessions. Phase 0 GREEN (#751), Phase 1 fingerprint GREEN (10/72/64/53/40/444/605, total 143, snapshot + dump confirmed). Live process topology: id 3 `episode-api-prod-hotfix` (3000, prod), id 0 `episode-api` (3002, dev), id 1 `episode-worker`.

## Sec 1 — The problem, stated precisely

Two histories have diverged for ~a month and must be brought back into agreement **without a destructive git operation on a live prod box**:

1. **Repo history** advanced ~dozens of PRs ahead (`8425c13e` → `db274597`) — almost entirely the forensic-audit doc work plus committed code changes, on the workstation/origin.
2. **Box working tree** advanced independently — a month of hand-edits applied directly to prod, never committed.

The hazard: any normal git reconciliation on the box (`fetch` + `merge`/`rebase`/`pull`, or a `checkout`/`reset` to clean first) would attempt to fold a month of upstream history onto a dirty tree carrying uncommitted keystone work, on the machine actively serving prod. Collisions, silent overwrites, or a boot-breaking merge state are all live-outage risks.

## Sec 2 — Investigation questions (read-only, before any plan is chosen)

> **STATUS (post-filing):** #1 (per-file delta) ANSWERED — Session 1 Results: zero
> box-unique tracked content, all seven tracked changes already in canon, divergence
> was a stale git pointer (FD-39). #3 (does clean origin/main boot) ANSWERED GREEN —
> dev-box boot test 2026-06-09, booted against canon with no schema mutation. #2/#4/#5
> not separately closed here; see the note chain. Questions left verbatim below as
> at-filing record.

Resolve these first; each is a workstation or read-only-box task. None mutate the box.

1. **What is the true delta between box edits and repo state?** For each of the five modified files, diff the captured box copy against the *current origin/main* version (workstation, fully read-only):
   - Are the box's edits ALREADY present in origin/main (i.e. someone committed equivalent changes upstream and the box just never pulled)? If so, the box edit is redundant and reconciliation is "fast-forward the box."
   - Or are they UNIQUE to the box (applied on-box, never upstreamed)? If so they must be captured into commits BEFORE any history reconciliation.
   - Expect a mix. `CharacterState.js` is likely box-unique. `sequelize.js` split-brain fix — check whether an equivalent landed upstream.
2. **Is the AK-5 `scripts/` deletion already done upstream?** The ~90 deletions may match a committed cleanup on origin/main. If so they're not box-unique work, just an un-pulled state.
3. **Does origin/main, checked out clean, actually run on the box?** The reconciliation target is "box runs committed code." Before committing to that, confirm origin/main is bootable against a dev-safe configuration on the DEV box `i-016395bb5f7a51a0b`, NOT prod — no `DB_SYNC_FORCE`, `ENABLE_DB_SYNC` stays off, and the test must not point the dev box at canon RDS directly.
4. **What is the box's git remote URL and why is it stale?** `git -C … remote -v` + `git -C … log origin/main` read-only — establish whether it's a never-fetched remote, a wrong remote, or a detached deploy. Determines whether "fetch" is even safe/meaningful.
5. **Is the deploy pipeline implicated?** `Deploy to Production` is disabled (AK path a). Was it ever the mechanism that updated the box, or has the box ALWAYS been hand-maintained? Answers whether re-enabling a pipeline is part of the end-state or a separate hazard.

## Sec 3 — Candidate reconciliation strategies (to be chosen AFTER Sec 2)

> **FORK RESOLVED (post-filing).** The A/B/C framing below is at-filing and is NOT
> current. Strategy A is WITHDRAWN. Strategy B is the SELECTED LEAN (not a firm close);
> its one open execution constraint — the disk-peak question — is RESOLVED BY METHOD
> (off-box build + stream-extract; peak designed out), see the Install-Method note.
> Strategy C is PARKED-NOT-KILLED; it reopens only if B's method prerequisites prove
> infeasible (runtime parity unachievable, or safe stream-extract/cleanup unguaranteeable),
> NOT on any transient-peak measurement. The "B = higher infra effort" / "A = likely the
> spine" framing below is the stale first impression the Pricing note was written to
> correct. See the note chain (banner, top) for the live record.

Framed, not chosen. Each ends with the box running committed code that matches a known origin/main state, with prod continuity preserved.

- **Strategy A — Upstream-first (commit box edits to repo, then align box).** Turn the captured box edits into proper commits/PRs on the workstation (the backup patch is the input). Land the keystone fixes (sequelize split-brain, CharacterState) and the AK-5 deletions into origin/main through normal gated PRs. THEN bring the box to that origin/main by a controlled, deliberate operation. Advantage: the keystone work enters canon properly and stops being prod-only. This is likely the spine of the answer.
- **Strategy B — Fresh deploy alongside, cut over (blue/green-ish).** Stand up a clean checkout of the chosen origin/main state in a parallel location/process, verify it serves correctly, then cut prod traffic to it (port/topology handled per Track B). Leaves the existing hand-maintained tree untouched as instant rollback. Higher infra effort; lowest risk to the running process.
- **Strategy C — In-place git reconciliation on the box.** Stash/commit the box edits locally on the box, fetch, merge/rebase, resolve. REJECTED as primary on its face: most direct path to a destructive collision on a live server. Documented only to be explicitly ruled out unless Sec 2 shows the delta is trivial.

The choice depends on Sec 2 #1 (how much is box-unique) and #3 (does clean origin/main run). If most box edits are already upstream → lighter alignment. If much is box-unique keystone work → Strategy A's commit-first step is mandatory regardless.

## Sec 4 — Sequencing & session boundaries

> **SUPERSEDED IN PART (post-filing, 2026-06-08 → 2026-06-10).** The session structure below is the at-filing plan and must NOT be read as the current runbook. Live status:
> - **Session 1 — CLOSED.** The read-only per-file delta ran; result: **zero box-unique tracked content** — all seven tracked box changes (incl. both keystones: sequelize split-brain fix, F-Stats-1 CharacterState) already present in canon; divergence was a stale git pointer, not divergent work. FD-39. Authority: Session 1 closed on `F-Deploy-1_Box_Repo_Reconciliation_Session1_Result.md`; the FD-39 nature correction (divergence = stale pointer, not box-unique work) is anchored by `F-Deploy-1_Box_Repo_Reconciliation_Session1_Results.md` (v1.0).
> - **Session 2 — COLLAPSED / NO-OP.** Its sole purpose was to commit box-unique keystone work to canon. Session 1 proved there is none to commit. The commit-box-unique step is a no-op and does not run. Any residual doc/register work is tracked separately, not as a Session 2 box-prep step.
> - **Session 3 — B-ONLY execution window.** The A/B fork is resolved (A withdrawn, B the lean — see Sec 3 banner). Session 3 is B's mechanics only: off-box build + stream-extract into a fresh parallel path, with controls C1 (fresh target path) and C2 (cleanup-on-failure), and a **P1 runtime-parity read** (Node major / npm major / CPU arch / libc family) run read-only at window open inside the abort envelope, clean pre-write abort on mismatch. Authority for method and controls: `F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md`. Still its own deliberate, backup-first window; **not primed**; fresh Phase 1 abort re-verify at its start stands unchanged.
> Body text below left intact as the at-filing record; the notes named above are the correction authority. Box stays FROZEN; FD-31 OPEN; [3] not primed.

- **Session 1 (next, low stakes, read-only / workstation):** Sec 2 investigation. Produce the per-file box-vs-origin delta table. No box mutation.
- **Session 2 (workstation, normal gated PRs):** If Sec 2 confirms box-unique keystone work, commit it to origin/main via standard PRs (Rule 7 on shared-state changes). The 06-08 backup patch + literal files are the source. This is repo work, no box risk — and it independently advances F-Stats-1 (CharacterState enters canon) and closes the split-brain fix into the codebase.
- **Session 3 (deliberate, backup-first, its OWN session):** The chosen box-alignment operation (Strategy A/B mechanics). The one box-mutating session. Full rollback in hand (canon snapshot + verified dump per FD-31 §6.4; plus the box backup from 06-08; plus the additive-hotfix re-launch bridge). Fresh abort re-verify at its start, untrusted from prior. Rule 7 on every box step. ONLY opens after Sessions 1–2 close.
- **Folds in:** the Minimal-B ecosystem-file landing and the [3] Track-B topology align become part of Session 3's box operation (the box ends on committed code AND correct topology in one deliberate window), OR are explicitly sequenced after it. Decide during Session 1.

## Sec 5 — Relationship to existing plans

- **[3] / Master Runbook:** parked behind this. Phase 0/Phase 1 GREENs still hold and are reusable, but Phase 2's "restart-to-align against the box ecosystem" cannot proceed while the box runs uncommitted divergent code. This reconciliation is now the prerequisite to [3], not a side quest.
- **Track B Minimal-B:** its premise (box file is correct for the next lifecycle event) is FALSE until the box runs committed code. Reconciliation must precede it.
- **F-Stats-1 Phase B:** was BLOCKED on F-Deploy-1. Committing CharacterState to canon (Session 2) is a concrete unblock-adjacent step — confirm sequencing with the F-Stats-1 plan.
- **FD register / handoff:** this finding should be filed as a new FD entry (keystone-class) and folded into the next handoff (v16) as the headline. Do NOT inline fingerprint numbers; point to authoritative sources per existing discipline.

## Sec 6 — What this plan does NOT do

- Does NOT touch, fetch, pull, checkout, reset, stash, clean, restart, or edit anything on the prod box.
- Does NOT choose a strategy — Sec 3 options are framed pending Sec 2.
- Does NOT authorize or schedule the box-alignment session (Sec 4 Session 3).
- Does NOT provide paste-runnable git or restart commands — assembled at session time against live state, never pasted from a doc.
- Does NOT relitigate Path A, Rule 7, the locked decision (a) = A2, or any closed gate.

---
*Reconciliation plan for the prod box ↔ repo month-of-divergence finding (2026-06-04 [3] session, code captured + verified 2026-06-08). Headline: prod runs a month of uncommitted, prod-only hand-edits — including the sequelize split-brain fix and the F-Stats-1 CharacterState model — on a box whose git is a stale remote ~dozens of PRs behind true origin/main. Backed up off-box 2026-06-08. This is the drift root cause and the new prerequisite to [3]. Plan: investigate the per-file delta read-only (Session 1), commit box-unique keystone work to canon via normal PRs (Session 2), then align the box in its own deliberate backup-first session (Session 3). Box stays FROZEN until then. Prep only; authorizes no action.*
