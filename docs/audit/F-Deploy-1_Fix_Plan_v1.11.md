# F-Deploy-1 Fix Plan v1.11

**Mints FD-39 (keystone-class): the prod box runs a month of uncommitted, prod-only on-box code on a stale git remote ~dozens of PRs behind `origin/main`, including two keystone-class edits (the `sequelize.js` split-brain fix and the F-Stats-1 CharacterState model) that exist in no commit. This is the cross-environment drift root cause the audit has chased. It supersedes the Minimal-B premise and reparents [3] Phase 2 behind a box↔repo reconciliation. The finding is investigation-stage; this revision FILES it as canon and points at the plan doc. It authorizes NO box action, schedules NO session, and the FROZEN box state and FD-31 open legs stand unchanged.**

> **CORRECTION BANNER - FD-39 prose superseded by the Sec 4 register row (added 2026-06-21, additive).**
> The prose in this revision (headline, Sec 1, Sec 2, and the closing summary) records the **at-filing reading** of FD-39 and is **CORRECTED** below. Where the prose says the prod box runs *uncommitted, prod-only* code that "exists in no commit" - including the two keystones (`sequelize.js` split-brain fix, F-Stats-1 `CharacterState.js`) - that is **refuted**. The authoritative reading is the **Sec 4 register row** (correction authority: Session1_Results v1.0; reinforced by v1.12's standing instruction to use the stale-git-pointer reading, not the at-filing framing):
>
> - **Divergence is real; its NATURE was misread.** The box-repo gap is a **stale git pointer** (`episode-backend` HEAD ~a month / dozens of PRs behind a stale un-fetched `origin/main`), **NOT unique uncommitted work**.
> - **All seven tracked box changes - including both named keystones - are already in current `origin/main`.** The "exists in no commit" / "prod-only" / "uncommitted" framing throughout the prose is false: the work is committed and present upstream; the box simply never fetched it.
> - **The Sec 2 "Risk closed" bullet's rationale is superseded.** The off-box capture (2026-06-08) was sound practice and is preserved, but the "one-disk-only prod-code risk" it claims to close **did not exist** - the code was already in `origin/main`. Read that bullet as a backup-of-record, not as closure of a unique-on-disk risk.
> - **FD-39 stays OPEN** as the divergence record. The OPEN status, the supersession of Minimal-B, and the reparenting of [3] Phase 2 behind box-repo reconciliation all **stand** - those consequences follow from the divergence itself, which is confirmed, and are unaffected by the nature-correction.
>
> The original prose is preserved verbatim below as the at-filing record. Do not read it as current; read this banner plus the Sec 4 row as the corrected finding.

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.10 (ratified decision (a) = A2; register through FD-38) |
| **Gate transition** | NONE. FD-31 remains OPEN. Sec 4.2 stays BLOCKED. Box remains FROZEN; "do not reboot" stands. [3] Phase 2 is now reparented behind reconciliation (see Sec 2). v1.11 files a finding only. |

## Sec 1 Purpose

The 2026-06-04 [3] session, assembling the Minimal-B config edit against live state, found the prod box diverged from `origin/main` by ~a month and dozens of PRs on a stale un-fetched remote, AND that prod is maintained by direct, uncommitted on-box hand-edits — including keystone work. Code was captured + verified off-box 2026-06-08. This revision registers that finding as FD-39 and records its two structural consequences (supersession of Minimal-B; reparenting of [3]). No new investigation in this revision; no live action. The authoritative scope/decision-framing lives in the plan doc, cited below.

## Sec 2 FD-39 minted — box↔repo month-of-divergence

**FD-39 (keystone-class). Prod box runs uncommitted, prod-only code on a stale git remote.**

- **Divergence.** `episode-backend` git HEAD is ~a month and dozens of PRs behind true `origin/main`, on a stale un-fetched remote — the reason the box `ecosystem.config.js` is the pre-#746 version and why #746-and-after never reached the box.
- **Uncommitted prod-only edits.** Prod is maintained by direct on-box edits never committed or pushed. Two are keystone-class: the `sequelize.js` change removing the `DATABASE_URL` parse pathway (the split-brain root cause fixed *in code* — FD-36 / HAZARD landmine), and the `index.js` + untracked `CharacterState.js` wiring the F-Stats-1 Phase A G2 model live on prod, in no commit.
- **Root cause.** This is the cross-environment schema/code drift the audit has chased.
- **Risk closed.** Code captured + verified off-box 2026-06-08 (`Documents\PrimeStudios-Backups\box-uncommitted-20260608\`: five literal source files + full `git diff` patch). The one-disk-only prod-code risk is closed.
- **Authoritative source:** `docs/audit/F-Deploy-1_Box_Repo_Reconciliation_Plan_DRAFT.md`. No fingerprint numbers or per-file deltas are inlined here — the plan doc and the 06-08 backup are the authorities (per existing discipline).

## Sec 3 Structural consequences

1. **Supersedes the Minimal-B premise.** Minimal-B assumed the box `ecosystem.config.js` is the correct artifact for the next lifecycle event. That premise is FALSE while the box runs uncommitted divergent code on a stale remote. The ecosystem file, if landed at all, must go by direct file write and only after reconciliation is planned (per plan doc).
2. **Reparents [3] Phase 2.** The Combined Restart Master Runbook's Phase 2 ("restart-to-align against the box ecosystem") cannot proceed while the box serves uncommitted divergent code. Reconciliation is now the prerequisite to [3], not a side quest. The runbook's Phase 0 / Phase 1 GREENs still hold and are reusable; this revision does not edit the runbook (additive-supersede convention — a runbook edit + Handoff v16 fold are separate follow-ups).

## Sec 4 State of play at v1.11 close

| Area | Item | Status |
|---|---|---|
| Register | FD-39 | INVESTIGATED (Session 1, read-only) - box↔repo divergence CONFIRMED but its nature CORRECTED: stale git pointer, not unique uncommitted work. All seven tracked box changes (incl. both named keystones) already in current origin/main. Finding-body above records the at-filing reading; correction authority: Session1_Results v1.0. FD-39 stays OPEN as divergence record. |
| Decision | (a) [3] restart vehicle | RATIFIED A2 (2026-06-03) — unchanged from v1.10 |
| Reconciliation | box↔repo divergence | OPEN — new prerequisite to [3]; plan doc frames it, no strategy chosen |
| Reconciliation | FD-31 schema-fork / degraded-state legs | OPEN — unchanged; now downstream of box↔repo reconciliation |
| Sequencing | [3] Phase 2 | REPARENTED behind box↔repo reconciliation (Sec 3) — unchanged otherwise |
| Prod box | `episode-backend` | FROZEN + DEGRADED — unchanged. No v1.11 action. "Do not reboot" stands. |

**Path A discipline note:** v1.11 adds no scope beyond registering a finding and recording its two structural consequences. It authorizes no prod-box action, schedules no session, and chooses no reconciliation strategy. The next executable step is the plan doc's Session 1 — read-only, workstation-only, the per-file box-vs-origin delta. The freeze stands; FD-31 remains open; [3] is not scheduled.

---
*Fix Plan revision v1.11. Mints FD-39 (keystone-class): prod box runs a month of uncommitted, prod-only code on a stale git remote ~dozens of PRs behind origin/main, including the sequelize split-brain fix and the F-Stats-1 CharacterState model. Drift root cause; backed up off-box 2026-06-08. Supersedes the Minimal-B premise; reparents [3] Phase 2 behind a box↔repo reconciliation. Files the finding as canon; advances no gate; authorizes no prod-box action; the freeze stands; [3] is not primed.*
