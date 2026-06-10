# F-Deploy-1 -- Prod-Box Disk + Memory Headroom Check: RESULT (DRAFT v0.1)

> **READ-ONLY MEASUREMENT RESULT. AUTHORIZES NO BOX ACTION. CHOOSES NO STRATEGY.**
> This note records the deliberate read-only box read that the B-vs-C pricing note
> (`F-Deploy-1_Strategy_Pricing_BvC_2026-06-09_DRAFT.md`, Sec 3) identified as the
> single gating input for the B-vs-C selection. It records the four measured numbers,
> interprets them against the pricing note's own axis, and corrects one
> over-reading of the §4.2 memory gate made in-session before measurement. It does
> NOT select a strategy (that remains Evoni's deliberate call), authorizes no box
> action, and schedules no session. Box stays FROZEN; FD-31 legs stand; [3] not primed.

| | |
|---|---|
| **Trigger** | The pricing note (Sec 3) isolated the fork's single remaining asymmetry as a measurable, box-touching fact and identified the read-only box read as the gating input -- without authorizing or scheduling it. This session was opened deliberately to run that read. |
| **Inputs** | Live prod box (`54.163.229.144`), confirmed by IP + ED25519 host key + PM2 three-process topology (id 0 `episode-api` 3002 / id 3 `episode-api-prod-hotfix` 3000 live-serving / id 1 `episode-worker`). Pricing note Sec 3 (the axis); Plan Sec 0 (topology, identity discipline). |
| **Method** | SSH under Plan Sec 0 discipline (confirm prompt, one read-only command at a time, results returned before next). Commands: `pm2 list`, `free -m`, `df -h`, `pm2 jlist` (cwd), `du -sh`. No mutation, no commit, no write to any box file. |
| **Status** | DRAFT v0.1 -- measurement complete; write-up pending review. No execution. Not canon. No strategy chosen. |

---

## Sec 0 -- Headline

Headroom is **sufficient but disk-bound.** Memory clears with wide margin; disk fits but with thin margin on a single volume already at 68%. Per the pricing note's own logic (Sec 3: "headroom verified sufficient -> B's structural advantages likely dominate"), the measured result lands in the B-favorable branch -- with one real qualifier that B's execution plan must respect (disk margin), not a clean unconditional pass.

This note's measurement does not select B. It pays down B's one concentrated cost (the unverified-headroom half) and hands the fork back to Evoni with both halves now priced *and measured*.

---

## Sec 1 -- The four measured numbers

All figures read-only, live box, this session.

| Axis | Measured | Source command |
|---|---|---|
| System memory total | 1910 MiB | `free -m` |
| System memory **available** | **1201 MiB** | `free -m` (free + reclaimable cache) |
| Swap | **0** (none configured) | `free -m` |
| Live-serving process (id 3) resident | ~147 MiB | `pm2 list` (PM2 accounting) |
| Full PM2 footprint (id 0 + 3 + 1) | ~421 MiB | `pm2 list` |
| Disk free on `/` (only writable volume) | **2.5 GB** (of 7.6 GB, 68% used) | `df -h` |
| Deployed tree size (`/home/ubuntu/episode-metadata`) | **1.1 GB** | `du -sh` (incl. node_modules, .git) |

Notes on the reads:
- `available` (not `free`) is the headroom figure; the 953 MiB gap between them is reclaimable buff/cache.
- All other mounts are tmpfs (RAM-backed) or the tiny EFI partition -- not usable for a checkout. `/` is the only landing volume.
- The deployed-tree path was taken from live process metadata (`pm2 jlist` -> `pm_cwd`), not assumed.

---

## Sec 2 -- Interpretation against the pricing note's axis

The pricing note's gating question (Sec 3): *does the prod box have verified disk + memory headroom to host B's parallel checkout + process without pressuring the live prod process or tripping the memory hard-gate?* Answered per axis.

**Memory -- comfortable. Not the binding constraint.**
1201 MiB available against a ~147 MiB live-serving process and ~421 MiB full PM2 footprint. B's parallel process is defined (pricing note Sec 2) to mirror the existing second-app slot (id 0, measured ~159 MiB); a second process in that class fits with wide margin and does not pressure the live process. **Operating caveat: swap is zero** -- there is no soft landing on a peak spike; an overshoot past available is a hard OOM event, not paging. The margin is comfortable enough that this is an operating note for B's execution, not a blocker.

**Correction to an in-session over-reading of §4.2.**
Before measurement, this session floated the arithmetic "820 (§4.2 dev ceiling) + 421 (PM2 footprint) = 1241 > 1201 available, therefore OOM risk." That mis-applies §4.2. The §4.2 hard-gate (<=820 MiB peak resident) is the **dev box's own standing gate**, not a budget B's prod parallel process is expected to consume. The pricing note frames the memory question as "does B's second process pressure the live process or trip the gate," not "must B's process fit under 820 on top of the existing footprint." The 820 figure does not transfer as a B-process budget. With that corrected, memory is not the tight axis.

**Disk -- the binding constraint. Fits, but thin.**
2.5 GB free; B's second tree ~1.1 GB (it is a real checkout with its own node_modules, mirroring the id 0 dev slot per pricing note Sec 2 -- not a symlink reuse). 1.1 GB into 2.5 GB leaves ~1.4 GB. It fits -- but on a single volume already at 68%, with no separate data volume, and no headroom to spare for transient install peak, build artifacts, or log growth during cutover. This is a "yes, with margin to respect," not a "yes, comfortably."

---

## Sec 3 -- Net, and what is handed back

- **Memory:** sufficient, wide margin, zero-swap operating caveat. Not binding.
- **Disk:** sufficient, thin margin. Binding axis. B's execution plan must respect it -- clean build, no leftover artifacts, watch transient install/checkout peak against the ~1.4 GB residual.

Per the pricing note Sec 3, this lands in the **headroom-verified-sufficient** branch: B's structural advantages (Track B topology absorbed, free standing rollback, no destructive op on the serving tree) are now weighed against a cost that is paid down on memory and thin-but-fits on disk. The fork is no longer blocked on an unverified fact.

**This does not select B.** It removes the one measurable blocker the pricing note named. Selection remains Evoni's deliberate decision, now made on a fork that is priced on both halves *and* measured on its single open axis.

---

## Sec 4 -- What this does NOT change

- Prod box stays **FROZEN.** "Do not reboot" stands. This was a read-only read; it authorizes no box mutation.
- **FD-31** schema-fork and degraded-state legs remain **OPEN.**
- **[3]** is **not primed.** The box-mutating session (whichever strategy is chosen) still requires its own deliberate, backup-first window with a fresh Phase 1 abort re-verify at its start.
- The split-brain hazard (AG / H3) is untouched and priced into both strategies -- any chosen op must still prove it landed on canon by IP/VPC + row counts, never by name string.
- C's hazards (H1 manufactured rollback, H2 credential precondition, H4 encoding precondition) are untouched by this note -- it measured B's open axis only.
- **No reconciliation strategy is chosen.**

---

## Sec 5 -- Recommended register / handoff updates (DRAFTS -- for Rule 7 execution separately)

- **Reconciliation Plan Sec 3 / fork:** record the headroom axis as MEASURED (sufficient, disk-bound); point to this note as the authority for the numbers; record B-vs-C as now priced on both halves and measured on the single open axis, selection still open and Evoni's.
- **Reconciliation Plan Sec 4:** mark the box-capacity read-only check as DONE (this note), replacing "identified gating input, not yet run."
- **This note holds the fingerprint numbers.** Other notes point here rather than re-inlining disk/memory figures.
- **Onboarding doc:** no change needed -- it already records the correct SSH user (`ubuntu@54.163.229.144`). The stale `episode-backend` SSH user was a memory-summary error, not a doc error; flagged separately for memory correction, not a doc edit.

---
*Read-only prod-box headroom read, run as the deliberate gating input the B-vs-C pricing note identified. Result: headroom sufficient but disk-bound -- memory comfortable (1201 MiB available, ~147 MiB live process, zero-swap operating caveat), disk fits thin (2.5 GB free, ~1.1 GB second tree, ~1.4 GB residual on a single 68%-used volume). Lands in the pricing note's headroom-verified-sufficient branch; B's one concentrated cost is paid down on memory and thin-but-fits on disk. Corrects an in-session over-reading that mis-applied the §4.2 dev-box memory ceiling as a B-process budget. No strategy chosen; box stays FROZEN; FD-31 open; [3] not primed; selection remains Evoni's deliberate call.*
