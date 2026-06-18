> **[RESOLVED 2026-06-18 — P-4/P-5 CLOSED (PASS).]** Prerequisite 2 (Sec 0) and the P-4/P-5 rows (Sec 1) are discharged. Operative result recorded in `F-Deploy-1_P4P5_PASS_2026-06-18.md` (build from pinned `903517f2`, `Node v20.20.2`/glibc 2.35/x86_64, start-verified). Node v20.20.2 recorded as empirical confirm; MEDIUM pin language unchanged. The "OPEN" markers below are retained as at-filing record; do not read them as current. Box-side Sec 2+ unchanged. Box FROZEN; [3] not primed.
# F-Deploy-1 — Phase 2A Execution Spec: [3]-WINDOW BOX-MUTATION HALF (DRAFT v0.1)

> **EXECUTION-ORDERED SPEC. AUTHORIZES NO BOX ACTION. PRIMES NOTHING.**
> This note consolidates the three Phase-2A source records — the B Install-Method
> (`F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md`), the P1 Parity Sequencing
> (`F-Deploy-1_P1_Parity_Sequencing_2026-06-10_DRAFT.md`), and the Headroom check
> (`F-Deploy-1_ProdBox_HeadroomCheck_2026-06-10_DRAFT.md`) — into one
> execution-ordered specification for Phase 2A: the additive, box-mutating half of
> the [3] window that stands up a PARALLEL tree + process beside the live-serving
> tree without touching it. It invents no steps; every gate traces to a source doc,
> cited inline. The two box mutations (stream-extract, parallel-process standup) are
> left **un-templated** by design — assembled at session time against live state.
> This spec records prerequisites, gates, and abort posture; it does NOT prime [3].
> Box stays FROZEN; FD-31 OPEN; [3] not primed.

| | |
|---|---|
| **Parent** | F-Deploy-1 / FD-31. Phase 2A per `[3]_Master_Runbook` Sec 3 (#762) + Sec 7A. |
| **Sources consolidated** | (1) B Install-Method — method, C1/C2 controls, abort posture. (2) P1 Parity Sequencing #767 — four-tuple tiers, provision sequence, confirm-gate. (3) Headroom — disk/memory numbers, zero-swap caveat, binding axis. |
| **Selected strategy** | **B** (RECORDED v1.0, #781; C parked-not-killed). This spec assumes B; if the call ever reverts to C, this spec is replaced, not edited. |
| **Gate inheritance** | Phase 2A opens only after Phase 0 GREEN (gate 2.5) AND Phase 1 GREEN (live abort re-verify) — the same gates as 2B. Both re-confirmed live 2026-06-12 (this session); a fresh Phase 1 re-verify is still required at the actual [3]-window's own start. |
| **Status** | DRAFT v0.2 — spec recorded; pending review. Not canon. Parity four-tuple PINNED 2026-06-12 (P-1..P-3 closed); one prerequisite OPEN (P-4/P-5 off-box build). Does not prime [3]. |

---

## Sec 0 — Headline + the two blocking prerequisites

Phase 2A is execution-ready in **method**, the parity target is now **pinned** (Sec 1
P-1..P-3 closed 2026-06-12), and one prerequisite remains OPEN before any box-side step:

1. **Parity four-tuple target — PINNED 2026-06-12.** P1 #767 Sec 3 steps 1–3 executed
   off-box / control-plane (zero box mutation): arch x86_64 (HIGH), libc glibc/Ubuntu
   22.04 (HIGH), Node 20 (MEDIUM), npm 10.x bundled (MEDIUM). Provenance in Sec 1. The
   build now has a fully-specified target. **CLOSED.**
2. **No off-box build artifact exists — OPEN.** Install-Method Sec 2 steps 1–2 (build
   off-box from the pinned commit/lockfile on the parity-matched host; verify the tree
   STARTS off-box) have not been done. There is nothing to stream-extract until this
   artifact exists and is verified to start. This is the next executable work (P-4/P-5).

**Consequence:** the next executable work is NOT a box-side 2A step. It is prerequisite 2
— build off-box against the now-pinned target + verify it starts (P-4/P-5), off-box, zero
box mutation — and only then does a primed [3] window run the box-side gates below. P-4 is
a discrete build task deserving its own session start, not a tail-of-session continuation.

---

## Sec 1 — Prerequisite chain (off-box / control-plane; must complete before window)

| # | Step | Touches box? | Source | State |
|---|---|---|---|---|
| P-1 | CPU arch pinned **x86_64** (`aws ec2 describe-instances` on `i-02ae7608c531db485` → t3.small → x86_64) | NO — control-plane read | P1 #767 Sec 3 step 1 | **CLOSED 2026-06-12** |
| P-2 | libc pinned **glibc** (Ubuntu 22.04.5 LTS → glibc 2.35); build on glibc base, NOT Alpine/musl | NO — record (SSH login banner) | P1 #767 Sec 3 step 2 | **CLOSED 2026-06-12** |
| P-3 | Node/npm pinned **Node 20 / npm 10.x (bundled)**; source `deploy-production.yml` ×3 + 3 other workflows, corroborated by `package.json engines.node >=20.0.0` / `engines.npm >=9.0.0`; no `.nvmrc` | NO — repo record | P1 #767 Sec 3 step 3 | **CLOSED 2026-06-12** |
| P-4 | Build off-box: `npm ci` against committed lockfile on the parity-matched host (x86_64 / glibc / Node 20 / npm 10); produce app + node_modules artifact | NO — build host | Install-Method Sec 2 steps 1–2 | **OPEN** — next executable work; own session |
| P-5 | Verify the artifact STARTS off-box before it is ever sent | NO — build host | Install-Method Sec 2 step 2 | **OPEN** (blocked on P-4) |

**Pinned four-tuple (build target):** x86_64 / glibc (Ubuntu 22.04, 2.35) / Node 20 /
npm 10.x. Arch + libc HIGH; Node + npm MEDIUM. All sourced off-box (control-plane + repo
record), preserving G2A-1 as an independent live confirm against this stated expectation —
NOT a discovery the build waited on. The MEDIUM pins (Node/npm) are the only drift
exposure, and a mismatch at G2A-1 aborts cleanly before any box write (off-box rebuild
only).

---

## Sec 2 — The box-side Phase 2A gate sequence (the [3] window itself)

Runs only after Sec 1 complete AND a fresh Phase 1 re-verify GREEN at the window's own
start. Under HAZARD Sec 3 SSH discipline: single read-only commands, confirm prompt, one
at a time. **No `pm2 restart/reload/delete/stop/save/start/kill`** — the flip is Phase 2B,
not here.

### Gate G2A-1 — Parity confirm (read-only, at window open)
The four-tuple confirm-or-abort gate. Read-only SSH, inside the abort envelope:
```
uname -m; ldd --version | head -1; node --version; npm --version
```
Match all four against the Sec 1 pins (arch, libc, Node, npm).

*[CORRECTED 2026-06-17 -- aligned to A1 decision; word-aligned with Master Runbook Sec 7A step 1.
Per-dimension strictness: match arch and libc EXACTLY (HIGH-tier). Match Node and npm against the
engines-range contract (Node major 20, ABI-stable; engines.node >=20.0.0 / engines.npm >=9.0.0) --
NOT patch-exact. A same-major ABI-compatible Node (box v20.20.1 vs build host v20.20.2) passes. The
Sec 1 pins ARE engines-ranges; "match all four against the pins" is NOT four equal-strictness
matches. Mismatch = arch/libc differ, OR Node outside engines range -> CLEAN PRE-WRITE ABORT.
See docs/audit/F-Deploy-1_A5_GateRule_Reconciliation_DRAFT_2026-06-17.md.]*
- **All match → proceed to G2A-2.**
- **Any mismatch → CLEAN PRE-WRITE ABORT.** Discard the off-box artifact, re-pin the
  drifted dimension (in practice Node/npm — the MEDIUM tier), rebuild off-box, re-attempt
  at a later window. **No box bytes written on this abort** — the cheapest abort in the
  runbook. (Install-Method Sec 3; P1 #767 Sec 4.)

### Gate G2A-2 — Disk precheck (read-only)
Confirm the writable volume still admits the ~1.1 GB tree with margin:
```
df -h /
```
Reference numbers (Headroom, 06-10; re-confirmed consistent on the 06-12 login banner at
67.3%): 2.5 GB free on a single 7.6 GB volume at 68% used; the ~1.1 GB tree leaves
~1.4 GB residual (~0.3 GB genuine slack after the tree lands). **Zero swap** — an
overshoot past available is a hard OOM, not paging; there is no soft landing.
- **Residual will hold the finished tree (no persisted tar, no on-box install, so peak ==
  steady state) → proceed.**
- **Residual will NOT hold it → ABORT before extract.** No partial extract.
- Read live, not from this doc: two days of log growth can move the number; the gate is
  the live `df`, not the recorded figure.

### Gate G2A-3 — Stream-extract to a FRESH PARALLEL path (GATED MUTATION — un-templated)
First box write. Per Install-Method Sec 2 step 3 + controls C1/C2:
- **C1 — fresh target path.** Extract into a fresh path that does NOT exist yet; NEVER
  over an existing tree (coexistence bulk would reintroduce the transient the method
  removes). The tree lands BESIDE `/home/ubuntu/episode-metadata`, not over it.
- **No intermediate tar persisted.** The transfer is piped STRAIGHT into extraction — a
  persisted-then-unpacked tar would make old-tar + extracting-tree coexist on the
  constrained volume and re-introduce the transient peak (load-bearing).
- **C2 — cleanup-on-failure.** Any interrupted/failed stream leaves a partial tree that
  strands up to ~1.1 GB and eats the ~0.3 GB slack. The procedure MUST remove the fresh
  target path on any aborted transfer before retry. This keeps "peak == steady state"
  true on the failure path, not just the happy path.
- **Rule 7:** confirm the target is the fresh PARALLEL path and NOT the serving tree —
  twice — before execution. Command assembled at session time against live state; do not
  paste a mutation line from any doc.

### Gate G2A-4 — Stand up the parallel process (GATED MUTATION — un-templated)
Second box write. A second process against the new tree, mirroring the existing id 0
second-app slot class (~159 MiB measured; fits the 1201 MiB available with wide margin,
Headroom Sec 2). The live-serving process (id 3, ~147 MiB) is NOT touched. Zero-swap
operating caveat applies — confirm the new process settles within available before
relying on it.
- **Rule 7:** confirm the process targets the new parallel tree, not the serving tree,
  twice, before execution.
- **The serving tree and its process remain untouched.** B's free standing rollback —
  abort-as-success — is preserved exactly; the flip to the parallel process is Phase 2B,
  not 2A.

---

## Sec 3 — Abort posture (carried from sources)

| Abort point | Trigger | Cost | Bytes written |
|---|---|---|---|
| G2A-1 parity mismatch | any four-tuple dimension differs | off-box rebuild only | NONE |
| G2A-2 disk precheck fail | live residual won't hold tree + margin | re-plan disk | NONE |
| G2A-3 stream interrupted | failed/partial transfer | C2 cleanup removes partial path | partial → removed |
| any post-extract concern | — | parallel tree is additive; serving tree untouched | parallel tree (removable) |

The defining safety property (Install-Method Sec 2 step 4, Sec 6): the serving tree is
left running throughout 2A. Nothing in 2A is irreversible. The one irreversible action of
the whole window — the restart/flip — is Phase 2B, gated separately.

---

## Sec 4 — What this does NOT change / standing hazards

- Prod box stays **FROZEN.** This spec authorizes no box action and primes nothing.
- **FD-31** schema-fork and degraded-state legs remain **OPEN.**
- **[3]** is **not primed.** Phase 2A's box-side gates require their own deliberate,
  backup-first window with a fresh Phase 1 abort re-verify at its start.
- **Split-brain hazard (AG / H3) untouched.** The parallel process, when it later serves
  (2B), must still prove it landed on canon by IP/VPC + row counts, never by name string.
- **Phase 0 / Phase 1 GREEN are re-confirmed live 2026-06-12** (this session: fingerprint
  match on `episode_metadata` / 10.0.20.224; both Sec 1 landmines clear; snapshot
  `available`; verified dump present). This does NOT carry into the [3] window — re-verify
  fresh at the window's own start per the standing [3] rule.
- **Phase 2B (cutover) is OUT OF SCOPE here.** Note the FD-31 §6.3 step-2 rotation is
  ALREADY EXECUTED (06-12 emergency rotation) — DO NOT re-rotate at cutover; the
  restart-to-align is now the credential cutover onto the box `.env` value, MUST come up
  green or ABORT+restore. That belongs to the 2B spec, not this one.

---

## Sec 5 — Recommended register / handoff updates (DRAFTS — for Rule 7 execution separately)

- **[3] runbook Sec 7A:** point to this spec as the consolidated Phase 2A authority;
  record the Sec 1 prerequisite chain (P-1..P-5) as the gating off-box work, two items
  currently OPEN.
- **Reconciliation Plan / fork:** no change to B-vs-C state — B remains the recorded lean
  (#781); this spec assumes B and records its execution shape, it does not re-open or
  re-decide the fork.
- **No fingerprint/disk numbers minted as new canon.** Disk/memory figures point to the
  Headroom note; method points to Install-Method; parity points to P1 #767.
- **Standing hazards restated** so this spec is not misread as authorization:
  FROZEN / FD-31 OPEN / [3] not primed.

---
*Consolidates the three Phase-2A source records into one execution-ordered spec for the additive box-mutating half of [3]: stand up a parallel tree + process beside the untouched live-serving tree. Two prerequisites are OPEN and block all box-side work — the parity four-tuple is unpinned (P1 #767 Sec 3 steps 1–3 unexecuted) and no verified off-box build artifact exists (Install-Method Sec 2 steps 1–2). The box-side sequence, gated behind Phase 0 GREEN + a fresh Phase 1 re-verify, is: G2A-1 parity confirm (read-only, clean pre-write abort on mismatch) → G2A-2 disk precheck (live df; zero-swap hard-OOM caveat; abort before extract if residual won't hold tree + margin) → G2A-3 stream-extract to a fresh parallel path (C1 fresh path, no persisted tar, C2 cleanup-on-failure; Rule 7 twice) → G2A-4 parallel-process standup (mirrors id 0 slot, serving tree untouched; Rule 7 twice). Both mutations un-templated by design. Serving tree left running throughout; nothing in 2A irreversible; the flip is 2B. Box stays FROZEN; FD-31 OPEN; [3] not primed.*
