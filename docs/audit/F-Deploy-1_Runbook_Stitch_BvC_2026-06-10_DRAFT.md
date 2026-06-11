# F-Deploy-1 — [3] Runbook Stitch: fold Strategy B code-reconcile as Phase 2A (DELTA, DRAFT v0.1)

> **ADDITIVE DELTA. APPLY AGAINST LIVE FILES; AUTHORIZES NO BOX ACTION; PRIMES NOTHING.**
> This is not a runbook. It is the set of edits that fold Strategy B's code reconciliation
> into the [3] master runbook as an explicit Phase 2A, per the 2026-06-10 placement call
> (fold into the window, not a separate mutation session). It contains insert blocks with
> anchors, the new phase in the runbook's own voice, the consequent abort/rollback edits,
> and the two supersession markers. Box stays FROZEN; FD-31 OPEN; [3] not primed.

## How to apply (read first)

- **Target file (authoritative):** `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md` (#762, `db274597`).
- **Anchors below are written against the FD-38 version you pasted.** Verify each anchor against the live file before applying — I am working from a paste, not the live blob. If the live structure differs, the *content* of each block still stands; only the insertion point moves.
- **Mutation discipline preserved.** Every box-mutating step in Phase 2A is left un-templated, exactly as the existing Phase 2 leaves the restart/rotation un-templated. Only the read-only parity probe is fenced (consistent with how the existing integrity gate fences its read-only psql).
- **Rule 7:** this is a draft; you confirm and execute the edits.

## Two flags before the blocks

1. **Filename align — RESOLVED 2026-06-10 (#769).** The selection lean was consolidated and landed canonical on origin/main as `F-Deploy-1_BvC_SelectionLean_Consolidated_2026-06-10_DRAFT.md` (2460decc); the earlier `F-Deploy-1_BvC_SelectionLean_2026-06-10_DRAFT.md` is banner-superseded v0.1. All block bindings below are aimed at the Consolidated file. No rename outstanding.
2. **Install-Method seam (honest).** Phase 2A's mutation mechanics (stream-extract C1/C2 controls, parallel-process standup) are written from the `B_Install_Method` note *through citation* — I have not seen that note directly, only its reflections in the headroom and parity notes. Reconcile Phase 2A steps 3–4 against the actual Install-Method note before the phase is considered complete. If C1/C2 differ from how I've framed them, steps 3–4 are where it shows.

---

## BLOCK A — Supersession marker (insert near the Sources / Phase-map area)

**Anchor:** immediately after the front-matter table (after the `Standing constraint` row), before `## Sec 0`.

```
> **Additive supersession (2026-06-10) — Strategy B code-reconcile folded in.**
> This runbook is extended to fold Strategy B's code reconciliation into the [3] window
> as **Phase 2A** (plus a pre-window off-box build). Prior revisions scoped the window as
> credential + topology + security only; that scope is now incomplete — the code
> reconciliation carries the window's newest risk-bearing mechanics (disk thin-margin,
> zero-swap operating caveat, parity gate) and belongs on the master phase map, not in a
> parallel "authoritative" sequence. The B track's method, gating, and constraints are
> bound into the Phase 2A gates from three 2026-06-10 artifacts:
> - `F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md` — method, C1/C2 extract controls, abort posture.
> - `F-Deploy-1_ProdBox_HeadroomCheck_2026-06-10_DRAFT.md` — disk/memory headroom; **disk is the binding axis** (thin-but-fits), zero-swap operating caveat.
> - `F-Deploy-1_BvC_SelectionLean_Consolidated_2026-06-10_DRAFT.md` — **B is the selected lean; C parked-not-killed.** Phase 2A assumes B; if the call ever reverts to C, this phase is replaced, not edited.
>
> No box action authorized; [3] not primed.
```

---

## BLOCK B — Phase-map rows (insert into the Sec 3 phase-map table)

**Anchor:** in the Sec 3 table, insert a pre-window row at the top and a `2A` row immediately **before** the existing `**2**` row.

```
| **pre-2A** | Off-box build to parity target (arch/libc HIGH, Node/npm best-known) | NO — workstation/build-host | NO | Parity Sequencing #767 Sec 3 | Pre-window prep; no box session |
| **2A** | Strategy B code reconcile: parity confirm gate → stream-extract built tree to a PARALLEL path → stand up parallel process; serving tree/process untouched | YES — additive only (parallel tree + process) | NO (additive; the flip is in 2B) | B Install-Method (C1/C2); Parity #767 (gate); Headroom (disk/swap); Selection-Lean (lean) | The [3] window — opens the box-mutating window, before cutover |
```

**Anchor note:** rename the existing `**2**` row's "What" to begin "Cutover (Phase 2B): cred rotation + restart-to-align + route fix + security sweep" so the split between additive 2A and flipping 2B is legible on the map. Existing step numbers inside Sec 7 do **not** renumber (additive discipline) — see Block C.

---

## BLOCK C — New phase body (insert as a new section **before** the current Sec 7)

**Anchor:** new `## Sec 7A — PHASE 2A`, placed immediately before the existing `## Sec 7 — PHASE 2`. The existing Sec 7 becomes "Phase 2B" in prose (its step list is unchanged except the one note at the end of this block).

```
## Sec 7A — PHASE 2A: Strategy B code reconciliation (the additive half of the window)

**Begins only after Phase 0 GREEN + Phase 1 GREEN — the same gates as 2B.** Phase 2A is
the opening of the box-mutating window: it stands up a PARALLEL checkout and a PARALLEL
process and does **not** touch the live-serving tree (id 3) or its process until the 2B
flip. That additivity is Strategy B's defining safety property — a free standing rollback —
and the reason B is the selected lean over Strategy C's destructive reset
(`F-Deploy-1_BvC_SelectionLean_Consolidated_2026-06-10_DRAFT.md`). This phase assumes B.

**Pre-window (no box touch).** The off-box build is finalized before the window per the
parity sequencing note (`F-Deploy-1_P1_Parity_Sequencing_2026-06-10_DRAFT.md` Sec 3): pin
build-host arch from AWS control-plane (HIGH), libc from recorded prod OS (HIGH), Node/npm
to best-known prior record (MEDIUM); `npm ci` against the committed lockfile; verify the
tree starts off-box. No prod box is touched to build. The only prod-directed pre-window
read is control-plane (arch), strictly weaker than the read-only SSH already taken.

Steps (the read-only probe is fenced; both mutations are left un-templated by design —
assemble at session time against live state, do not paste a mutation line from any doc):

1. **Parity confirm gate (read-only, at window open).** Inside the abort envelope, under
   the same SSH discipline as Phase 1, run the four-tuple probe:
   ```
   uname -m; ldd --version | head -1; node --version; npm --version
   ```
   Match all four against the build-host pins → proceed. **Mismatch any → CLEAN PRE-WRITE
   ABORT:** discard the off-box artifact, re-pin the drifted dimension (in practice Node/npm,
   the MEDIUM tier), rebuild off-box, re-attempt at a later window. **No box bytes are
   written on this abort** — it is the cheapest abort in the runbook. (Parity note Sec 4.)
2. **Disk precheck (read-only).** Confirm the writable volume still admits the ~1.1 GB
   second tree with margin. Per the headroom note (Sec 2), residual is ~1.4 GB on a single
   68%-used volume — **disk is the binding axis.** `df -h /` read; if residual will not hold
   the tree plus transient install/build peak → **ABORT before extract.** No partial extract.
3. **Stream-extract the built tree to a PARALLEL path — GATED MUTATION (un-templated).**
   Per the Install-Method note's C1/C2 controls. The transfer must be **piped straight into
   extraction with no intermediate tar persisted on the constrained volume** — this is
   load-bearing: a persisted-then-unpacked tar would make old-tar + extracting-tree coexist on
   disk and reintroduce the very transient peak the off-box method exists to remove (note Sec 0,
   Sec 2 step 3). Because there is no on-box `npm install` and no persisted tar, **the only bytes
   landing on the volume are the finished ~1.1 GB steady-state tree — peak collapses to steady
   state** against the ~1.4 GB residual (~0.3 GB slack, headroom Sec 2). The tree lands BESIDE
   the serving tree at a fresh parallel path (C1); it does **not** overwrite
   `/home/ubuntu/episode-metadata`. **Rule 7 — confirm the target is the fresh PARALLEL path and
   NOT the serving tree, twice.** (Method authority: `F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md`.)
4. **Stand up the parallel process — GATED MUTATION (un-templated).** A second process
   against the new tree, mirroring the existing id 0 second-app slot class (~159 MiB; fits
   with margin per headroom). **Zero-swap operating caveat:** there is no paging soft-landing
   — an overshoot past available is a hard OOM. Watch standup memory. This does **not** touch
   id 3 (live-serving). **Rule 7.**
5. **Verify the parallel process against canon (read-only).** Same identity + unfiltered
   integrity discipline as the 2B integrity gate (`current_database()` + `inet_server_addr()`
   + the seven-table unfiltered fingerprint), run against the parallel process's connection.
   id 3 is still the serving process; this proves the new process is canon-correct **before**
   any flip. Mismatch → ABORT before 2B; serving process untouched.

**Phase 2A output:** a reconciled parallel tree + a healthy parallel process running against
canon, with the live-serving tree and process untouched and retained as the standing
rollback. The flip onto the reconciled tree happens in Phase 2B step 5.
```

**Anchor (one-line edit inside the existing Sec 7, step 5):** append to the restart-to-align step —

```
  Under Strategy B, this "restart-to-align" is the additive **flip**: point serving onto
  the Phase 2A reconciled tree/process, not a re-launch of the old tree. The old tree +
  old process are **RETAINED** as the standing rollback — do NOT delete until 2B is
  confirmed green (Sec 8 gate passes). Assemble the flip at session time; un-templated.
```

---

## BLOCK D — Consequent abort conditions (insert into Sec 8)

**Anchor:** add to the Sec 8 bullet list, grouped before the Phase 2 post-restart bullets.

```
- Phase 2A: parity four-tuple mismatch → CLEAN PRE-WRITE ABORT (discard off-box artifact,
  re-pin Node/npm, rebuild, retry a later window). Not a box-state abort — nothing written.
- Phase 2A: disk residual will not hold the ~1.1 GB second tree + extract margin at the
  precheck → ABORT before extract. **C2 cleanup mechanic:** any aborted or failed transfer must
  **remove its fresh target path before any retry** — a partial tree left in place strands up to
  ~1.1 GB and eats the ~0.3 GB slack, breaking peak==steady-state on the failure path (note Sec 3, C2).
- Phase 2A: OOM / memory pressure during parallel-process standup (zero swap = hard OOM,
  not paging) → ABORT standup, tear down the parallel process; live-serving id 3 unaffected.
- Phase 2A: parallel process fails the canon identity/integrity verify → ABORT before any
  2B flip; serving process untouched.
```

---

## BLOCK E — Consequent rollback edit (insert into Sec 9)

**Anchor:** add as a paragraph after the existing Sec 9 two-deep rollback text.

```
**Code-layer rollback (Strategy B's standing-rollback advantage).** Distinct from the DB
snapshot/dump rollback above, which covers the DATA layer. Under B, the old serving tree +
old process are retained through Phase 2A and the 2B flip; if the flip misbehaves, revert
serving to the retained old process (mechanics per the Install-Method note; un-templated,
assemble at session time). This is why B was preferred over C: C's `git reset --hard`
destroys the serving tree and has no equivalent in-window code-layer revert. Do not delete
the retained old tree/process until the 2B post-restart integrity gate passes green.
```

---

## BLOCK F — Old-file retired pointer

**Target file:** `F-Deploy-1_Combined_Restart_Master_Runbook.md` (`a0945e98`, touched `7dc2892e`).
**Anchor:** insert at the very top, above the existing title/banner.

```
> **SUPERSEDED (2026-06-10) — retained for history, DO NOT EXECUTE.**
> The authoritative [3] runbook is `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md`
> (#762, `db274597`), now extended with the Strategy B code-reconcile phase (Phase 2A) and
> bound to the 06-10 B-track artifacts (Install-Method, Headroom, Selection-Lean). This
> near-duplicate is retired in place to avoid two drifting box-mutation sequences. Not
> deleted, to preserve history. Use the #762 draft.
```

---

## What this delta does NOT do

- Does NOT authorize, schedule, or begin [3], Phase 0, Phase 2A, or any box action.
- Does NOT provide paste-runnable extract, standup, flip, restart, or rotation commands — every mutation is un-templated; only the read-only parity probe is fenced.
- Does NOT select a strategy — it records that B is the lean and builds the phase B requires; C stays parked-not-killed and would replace, not edit, Phase 2A.
- Does NOT touch the split-brain proof obligation — the 2A canon-verify and 2B integrity gate both assert identity by `current_database()`/`inet_server_addr()`, never name string.
- Does NOT reconcile Phase 2A steps 3–4 against the Install-Method note (seam flagged above) — that is the one open item before Phase 2A is complete.

---
*Additive delta folding Strategy B's code reconciliation into the #762 [3] master runbook as
Phase 2A, per the 2026-06-10 placement call. Insert blocks with anchors (verify against live
before applying): supersession marker bound to the three 06-10 B-track artifacts; pre-window
off-box build + Phase 2A phase-map rows; the Phase 2A body (parity confirm gate → disk
precheck → stream-extract to parallel path → parallel-process standup → canon verify, all
gated/un-templated except the read-only probe); consequent Sec 8 abort and Sec 9 code-layer
rollback edits; and the retired-pointer for the old near-duplicate. Mutation discipline
preserved; B's additive standing-rollback advantage made explicit. Authorizes nothing; box
stays FROZEN; FD-31 OPEN; [3] not primed.*
