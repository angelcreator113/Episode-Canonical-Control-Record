# F-Deploy-1 -- Strategy B Install Method: PREREQUISITE FOR PRIMING (DRAFT v0.1)

> **DEFINES B'S INSTALL METHOD ONLY. AUTHORIZES NO BOX ACTION. PRIMES NOTHING.**
> This note resolves Strategy B's one open execution constraint -- the disk-peak
> question carried forward by `F-Deploy-1_BvC_SelectionLean_Consolidated_2026-06-10_DRAFT.md`
> (Sec 1) -- not by *measuring* a transient install peak (shown intractable below)
> but by *designing it out*: build dependencies off-box and stream a ready-to-run
> tree onto prod, so nothing but the steady-state tree ever touches the constrained
> volume. It records the method, its hard preconditions, its failure-mode controls,
> and the restated condition under which C reopens. It defines method only -- it does
> NOT prime [3], does NOT spec the full [3] operation, and authorizes no box
> mutation. Box stays FROZEN; FD-31 OPEN; [3] not primed.

| | |
|---|---|
| **Trigger** | The selection-lean note (Sec 1) carried B's `node_modules` reuse-vs-install / transient-peak question forward as the must-resolve-before-priming constraint and as the specific condition reopening C. This note resolves it by method-design. |
| **Inputs** | Selection-lean note (B chosen as lean; disk-peak the open constraint); headroom note (sufficient, disk-bound -- ~1.1 GB steady-state tree, ~1.4 GB residual on a single 68%-used volume, zero swap); pricing note Sec 2 (B is a real checkout with its own `node_modules`, not a symlink reuse); `package-lock.json` (v3); `deploy-to-ec2.sh:219` (existing `ci`/`install` oscillation). |
| **Method** | Design record only. Workstation. No SSH, no box, no mutation, no commit. The method it *describes* is for a future [3] window, not for now. |
| **Status** | DRAFT v0.1 -- method recorded; write-up pending review. Not canon. Defines prerequisite for B priming; does not prime. |

---

## Sec 0 -- Headline

**The disk-peak constraint is not measured; it is removed.**

B's steady-state tree (~1.1 GB) must exist on the box under any method -- that was never the risk. The risk was always the *transient excess above 1.1 GB* during an on-box `npm install`: npm cache growth, partial-unpack coexistence, build scratch -- the high-water mark that a thin ~1.4 GB residual on a zero-swap volume is sensitive to. An on-box install makes that transient real and unmeasurable in advance (Sec 1). Building off-box and streaming only the finished tree onto prod means the only thing that ever lands on the constrained volume is the steady-state ~1.1 GB. **Peak collapses to steady state.** The ~1.4 GB residual stops being a transient to estimate and becomes a static fit already known to hold from the headroom numbers (1.1 into 1.4 = ~0.3 GB genuine slack after the tree lands).

This note therefore does not "prove transient fit." It chooses a method with no on-box transient to prove.

---

## Sec 1 -- Why estimate-first was abandoned (non-gating evidence)

The selection-lean note left the peak open to be pinned before priming. Pinning it by estimation is intractable, and the attempt is recorded here as non-gating evidence only -- not as a number anyone should depend on:

- **The lockfile cannot produce a defensible peak.** `package-lock.json` (v3) carries resolved URLs and integrity hashes but **no unpacked-size fields**. The steady-state sum is already known (~1.1 GB, measured on-box via `du`); the *transient overshoot above steady-state* -- the only part that matters against a thin margin -- is not derivable from the lockfile without fetching and measuring every tarball, which is most of an install.
- **Peak is a property of method, not of the lockfile.** `deploy-to-ec2.sh:219` already oscillates between `npm ci` and `npm install` -- two different peak profiles (`ci` wipes and rebuilds `node_modules`; `install` mutates in place). Cache state (cold vs warm), concurrency, and dedup/prune timing all move the high-water mark. There is no single lockfile-deterministic peak to bound.
- **The only faithful measurement is on the box.** Running `npm install` on the frozen prod box to observe its footprint is a write, consumes the very margin in question, and is exactly the [3]-class mutation the freeze exists to prevent. That path is inadmissible.

**Decision posture:** treat lockfile/estimate math as non-gating; make B primeability depend on an install *method* that removes disk-peak sensitivity on the constrained volume; record that method as the prerequisite for [3], rather than trying to prove transient fit from fuzzy bounds.

---

## Sec 2 -- The method: build off-box, stream the finished tree onto prod

Four steps. The first two happen off-box; the third touches the box (and so belongs to [3], not here); the fourth preserves B's structural advantage.

1. **Build off-box from the pinned commit and lockfile**, on a host whose runtime matches prod (parity precondition, Sec 3). `npm ci` against the committed lockfile produces a deterministic `node_modules`; the app tree plus `node_modules` is the artifact. All cache growth, unpack transients, and build scratch occur off-box, where disk is not constrained.
2. **Produce a ready-to-run tree artifact off-box** -- app + `node_modules`, verified to start off-box before it is ever sent.
3. **Stream-extract directly into a fresh parallel path on prod** -- no on-box `npm install`, no on-box npm cache growth, no intermediate tar persisted on disk (stream piped straight into extraction). The only bytes that land on the constrained volume are the finished tree. (This step is a box write and is therefore [3]-gated -- see Sec 4.)
4. **Rollback stays a traffic switch only.** The existing hand-maintained serving tree is left running and untouched; cutover is the port/topology move (Track B), reversible by switching back. B's free standing rollback -- its abort-as-success property -- is preserved exactly; the install method changes nothing about it.

---

## Sec 3 -- Hard preconditions and failure-mode controls

**Precondition P1 -- runtime parity (hard, four-tuple).**
A tree built off-box carries compiled native modules (any dependency with a `.node` binary). For those to load on prod, the build host must match prod on the full ABI context, not just a version string:
- **Node major** (V8 / N-API ABI)
- **npm major** (lockfile/install semantics)
- **CPU architecture** (x86_64 vs arm -- prod EC2 family determines this; a Graviton/Intel mismatch is fatal to native modules)
- **libc family** (glibc vs musl -- an Alpine-built tree extracted onto Ubuntu/glibc links the wrong libc and fails at load)

Parity is verified by a **read-only check at [3]-window open** (`node --version`, `npm --version`, `uname -m`, libc family), under the same SSH discipline and abort envelope as the window's Phase 1 re-verify. A mismatch at window open is a clean **pre-write abort** -- no box bytes have been touched.

**Sequencing note on P1 (flagged, not resolved here):**

> **[SUPERSEDED 2026-06-12 -- P1 sequencing dependency RESOLVED.]** This dependency is
> discharged by `F-Deploy-1_P1_Parity_Sequencing_2026-06-10_DRAFT.md`, the [3]-spec note
> that resolves it: the build's compile **target** is fully specifiable pre-window with no
> box touch (arch HIGH via AWS control-plane, libc HIGH via recorded prod OS, Node/npm
> MEDIUM via best-known prior record), while the four-tuple read at window open is a
> confirm-or-abort **gate**, not a discovery the build waited on. The [3] runbook already
> reflects this (pre-2A off-box build row + parity gate); this note's Sec 3 is brought
> into line here. The original "flagged, not resolved here" paragraph below is retained
> unchanged as the at-filing record. Box FROZEN; FD-31 OPEN; [3] not primed.

the parity *target values* are read at [3]-open, but the off-box build must be provisioned to match *before* the window. This is a real ordering dependency -- the build cannot be finalized until parity is known, but parity is confirmed only when [3] opens. Resolution belongs to [3]-spec work, not this note; the leaning recommendation is **build host pinned to best-known parity, confirmed-or-aborted at window open** (a low-confidence pre-pin is acceptable because mismatch aborts cleanly before any write). Recorded so a future session does not trip over the dependency.

**Control C1 -- fresh target path.**
Stream-extract must target a **fresh path**, never over an existing tree. Extracting over an existing tree risks coexistence bulk (old + new) on the constrained volume -- reintroducing the very transient the method exists to remove.

**Control C2 -- mandatory cleanup-on-failure.**
A `tar -x` fed by a stream writes files as they arrive; an interrupted or failed stream leaves a **partial tree** that, left in place, strands up to ~1.1 GB and eats the ~0.3 GB slack. The method must define cleanup-on-failure: any aborted transfer removes its fresh target path before retry. This is what keeps "peak == steady state" true on the failure path, not just the happy path.

---

## Sec 4 -- Governance boundary

This note **defines method only.** It does not authorize box mutation and does not prime [3].

- The off-box build (Sec 2 steps 1-2) is workstation/build-host work and touches no prod box.
- The stream-extract and cutover (Sec 2 steps 3-4) are **box mutations** and belong to [3]'s own deliberate, backup-first window with a fresh Phase 1 abort re-verify at its start. Designing the method is not approving the operation -- same posture as every note in this chain.
- The parity read (P1) is the one read-only box touch the method needs; it is folded into [3]-window open, not run as a standalone box-read session.

---

## Sec 5 -- C-reopen trigger, restated

The selection-lean note set C to reopen "if B's disk-peak constraint fails to clear." Under design-first, the constraint is **removed, not measured** -- there is no peak measurement to fail. The trigger is restated accordingly:

- **B remains preferred if the method's prerequisites are satisfiable.**
- **C reopens only if prerequisite feasibility fails** -- specifically, if runtime parity (P1) cannot be achieved (build host cannot be matched to prod's four-tuple), **or** if safe stream-extract / cleanup controls (C1, C2) cannot be guaranteed.

C is **not** reopened by a transient-peak number, because no such measurement is taken under this method. A future session must not go looking for a peak figure that was deliberately designed out.

A withdrawn remains withdrawn. C's hazard analysis (pricing note) stays on record, recoverable under the restated trigger only.

---

## Sec 6 -- What this does NOT change

- Prod box stays **FROZEN.** This is a method-design record; it authorizes no box action and primes nothing.
- **FD-31** schema-fork and degraded-state legs remain **OPEN.**
- **[3]** is **not primed.** Executing B (off-box build's box-side steps + cutover) still requires its own deliberate, backup-first window with a fresh Phase 1 abort re-verify at its start.
- The split-brain hazard (AG / H3) is untouched -- B's cutover must still prove it landed on canon by IP/VPC + row counts, never by name string.
- No reconciliation strategy is *closed*. B stays the lean; C stays parked-not-killed under the restated trigger (Sec 5).

---

## Sec 7 -- Recommended register / handoff updates (DRAFTS -- for Rule 7 execution separately)

- **Reconciliation Plan Sec 4:** replace B's open execution constraint ("`node_modules` reuse-vs-install / transient peak") with **RESOLVED BY METHOD** -- off-box build + stream-extract; peak designed out; point here as authority.
- **Reconciliation Plan Sec 3 / fork:** update C-reopen trigger from "disk-peak fails to clear" to "prerequisite feasibility fails (parity P1, or controls C1/C2)" per Sec 5.
- **[3] register / runbook:** record P1 parity read as a [3]-window-open read-only check inside the abort envelope; record the P1 sequencing dependency (build-host pre-pin) as a [3]-spec item; record stream-extract steps as box-side [3] work with C1/C2 controls.
- **Selection-lean note:** its Sec 1 open constraint is now addressed by this note; the lean toward B firms by one notch (one fewer open item), though B remains a lean, not a firm close, pending [3] execution.
- **No fingerprint numbers re-inlined.** Point to the headroom note for disk/memory figures and to this note for the method.
- **Standing hazards restated** so the method is not misread as authorization: FROZEN / FD-31 OPEN / [3] not primed.

---
*Resolves Strategy B's one open execution constraint -- the disk-peak question -- not by measuring an on-box install transient (shown intractable: lockfile v3 carries no unpacked-size fields, peak is method-not-lockfile dependent, and the only faithful measurement is an inadmissible on-box write) but by designing it out. Method: build dependencies off-box from the pinned commit/lockfile on a runtime-parity-matched host, produce a ready-to-run app+node_modules tree, stream-extract it into a fresh parallel path on prod (no on-box install, no cache growth, no persisted tar), keep rollback as a reversible traffic switch. Peak collapses to steady state; the ~1.4 GB residual becomes a static fit (~0.3 GB slack) already known from the headroom read. Hard preconditions: P1 runtime parity as a four-tuple (Node major, npm major, CPU arch, libc family), verified read-only at [3]-window open with clean pre-write abort on mismatch; C1 fresh target path; C2 mandatory cleanup-on-failure so partial trees cannot strand disk. Defines method only -- authorizes no box mutation, does not prime [3]. C-reopen trigger restated: C reopens only if prerequisite feasibility fails (parity unachievable, or safe stream-extract/cleanup unguaranteeable), not on a transient-peak measurement that no longer happens. Box stays FROZEN; FD-31 OPEN; [3] not primed.*
