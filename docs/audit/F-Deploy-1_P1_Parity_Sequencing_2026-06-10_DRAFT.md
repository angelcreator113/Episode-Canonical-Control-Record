# F-Deploy-1 — P1 Build-Host Parity Sequencing: [3]-SPEC ITEM (DRAFT v0.1)

> **RESOLVES THE P1 SEQUENCING DEPENDENCY FLAGGED IN THE B INSTALL-METHOD NOTE. SPEC ONLY. AUTHORIZES NO BOX ACTION. PRIMES NOTHING.**
> The B Install-Method note (`F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md`, Sec 3)
> recorded a real ordering dependency and explicitly deferred its resolution to [3]-spec
> work: the off-box build must be provisioned to runtime parity *before* the [3] window,
> but the parity target is read *at* window open. This note resolves that dependency by
> decomposing the four-tuple by how each dimension's build target is knowable ahead of
> the window — without any box mutation — and by separating "parity known for build
> purposes" from "parity confirmed for authorization purposes." It defines sequencing
> only. It does NOT prime [3], does NOT spec the full [3] operation, and authorizes no
> box mutation. Box stays FROZEN; FD-31 OPEN; [3] not primed.

| | |
|---|---|
| **Trigger** | B Install-Method note Sec 3 flagged the P1 sequencing dependency and recorded its resolution as belonging to [3]-spec work, with a leaning ("build host pinned to best-known parity, confirmed-or-aborted at window open"). This note discharges that deferral. |
| **Inputs** | B Install-Method note (authority for method, P1 four-tuple, controls C1/C2, abort posture); recorded prod OS identity (Ubuntu → glibc); AWS control-plane (instance type → CPU family); headroom note (read-only box touch already established as admissible under freeze). |
| **Method** | Spec record only. Workstation. No SSH, no box, no mutation, no commit. Describes a sequence for a future [3] window, not for now. |
| **Status** | DRAFT v0.1 — sequencing recorded; write-up pending review. Not canon. Discharges a [3]-spec deferral; does not prime [3]. |

---

## Sec 0 — Headline

**The circularity is apparent, not real, because "parity known" splits into two different facts.**

The build needs a **target** to compile against. The window needs a **confirmation** to authorize extraction. The Install-Method note's flagged loop ("build can't finalize until parity known; parity known only at window") collapses these into one requirement. They are not one requirement:

- For the **build**, parity is *fully specifiable before the window* — three of four dimensions are knowable pre-window without touching the running box, and the fourth pair is pinnable from best-known record. The build compiles against this specified target and is finalized pre-window.
- For **authorization**, parity is *confirmed* at window open by the read-only four-tuple check the Install-Method note already defines. This is a gate on an already-built artifact, not a discovery the build waited on.

A mismatch at the gate aborts cleanly before any box byte is written (Install-Method Sec 3), and the only loss is a throwaway off-box build — which costs nothing on the constrained volume. So the sequence is: **specify target → build off-box → confirm-or-abort at window.** No step waits on a fact it cannot have.

---

## Sec 1 — The dependency, restated precisely

From Install-Method Sec 3, verbatim shape:

- The off-box build carries compiled native modules; for them to load on prod, the build host must match prod on the **full four-tuple** ABI context: Node major, npm major, CPU arch, libc family.
- Parity is verified by a **read-only check at [3]-window open**, inside the same abort envelope as the window's Phase 1 re-verify; mismatch = clean pre-write abort.
- The build host must be provisioned to match *before* the window, but the authoritative read happens *at* the window. That gap is the dependency this note sequences.

The resolution is not to move the authoritative read earlier (that would spend a standalone box-read session the Install-Method note's governance posture, Sec 4, deliberately avoids). It is to give the build a fully-specified target from sources that need no fresh box touch, and let the window read remain a confirm gate.

---

## Sec 2 — The four-tuple by provisioning-confidence tier

Each dimension classified by where its **pre-window build target** comes from and at what confidence. All four are still read at the window gate regardless of tier — tiering governs build provisioning, not the gate.

| Dimension | Pre-window source (no box mutation) | Confidence | Window-gate probe |
|---|---|---|---|
| **CPU arch** | AWS control-plane: `aws ec2 describe-instances` → instance type → family → arch (x86_64 vs aarch64/Graviton). Control-plane read, no SSH, no box touch, no volume cost. | **HIGH** — essentially certain; instance family does not change without a deliberate migration. | `uname -m` |
| **libc family** | Recorded prod OS identity (Ubuntu → glibc). Knowable from the AMI / prior session record; no fresh box touch. | **HIGH** — fixed by OS; an Alpine/musl prod box would be a known deviation, not a silent one. | `ldd --version` (glibc prints a version banner; musl differs/absent) |
| **Node major** | Best-known from prior deploy logs / prior session observation of the box. Not control-plane-visible; a deliberate runtime bump could have moved it since last record. | **MEDIUM** — soft; the dimension most likely to have drifted. | `node --version` |
| **npm major** | Best-known from prior record; tracks Node (bundled or co-installed). Same drift exposure as Node. | **MEDIUM** — soft; coupled to Node. | `npm --version` |

**Reading:** two dimensions (arch, libc) pin **HIGH** pre-window with **zero box touch** — control-plane and recorded OS identity carry them. The remaining two (Node, npm) are the only soft pins, and they are exactly the cheapest to be wrong about, because a mismatch on them aborts before any write and costs only an off-box rebuild.

This is the substance of "build host pinned to best-known parity": *best-known* is HIGH for arch/libc and MEDIUM for Node/npm — not uniform low-confidence guessing.

---

## Sec 3 — The provision-to-parity sequence (pre-window, off-box)

Workstation / build-host only. No prod box touch.

1. **Read arch from control-plane.** `aws ec2 describe-instances` on the prod instance → instance type → CPU family → arch. Pin the build host / build container to that arch (x86_64 or aarch64). Cross-arch native builds are fatal (Install-Method Sec 3); this read removes that risk at HIGH confidence with no SSH.
2. **Fix libc from recorded OS.** Build inside an environment whose libc matches prod's recorded OS family (Ubuntu/glibc → build on a matching glibc base, e.g. the corresponding Ubuntu major in a container, not Alpine/musl). An Alpine-built tree on a glibc prod fails at load (Install-Method Sec 3).
3. **Pin Node/npm to best-known majors.** From the most recent deploy log / session record, set the build host's Node major and npm major to the last-observed prod values. Record the source and date of the pin so the window gate can be read against a stated expectation, not a vague one.
4. **Build off-box and finalize the artifact.** `npm ci` against the committed lockfile on this provisioned host; verify the tree starts off-box (Install-Method Sec 2 step 2). The artifact is now finalized against a fully-specified target — three dimensions HIGH, two MEDIUM.

The build is complete before the window opens. Nothing in this sequence touches the frozen box; the only prod-directed read is control-plane (step 1), which is strictly weaker than the read-only SSH already exercised by the headroom note and so sits inside the freeze envelope.

---

## Sec 4 — The confirm-or-abort gate (at [3]-window open)

Unchanged from Install-Method Sec 3 in substance; this note only fixes its place in the sequence as a **gate, not a discovery**.

- At window open, inside the abort envelope and under the same SSH discipline as Phase 1 re-verify, run the read-only four-tuple probe: `uname -m`, `ldd --version`, `node --version`, `npm --version`.
- **Match on all four → proceed** to the box-side stream-extract (C1/C2 controls, Install-Method Sec 2 step 3).
- **Mismatch on any → clean pre-write abort.** No box bytes written. The off-box artifact is discarded; re-pin the drifted dimension (in practice: Node/npm, the MEDIUM tier), rebuild off-box, re-attempt at a subsequent window.
- The gate is read-only and folded into window open — **no standalone box-read session** is introduced, preserving Install-Method Sec 4's governance posture.

---

## Sec 5 — Why a MEDIUM pre-pin is safe, and the optional firm-up

**The abort asymmetry carries this.** A wrong Node/npm pin produces a build that fails the window gate *before* any write — the freeze is never violated, the constrained volume is never touched, and the cost is one off-box rebuild (cheap, off the critical volume). There is no failure path on which a soft pin damages the box. The Install-Method note's "low-confidence pre-pin is acceptable because mismatch aborts cleanly" is therefore exact, and this note narrows "low-confidence" to "MEDIUM on two coupled dimensions only."

**Optional firm-up (recorded, not recommended-by-default).** A single read-only four-tuple SSH read *before* the window would lift Node/npm from MEDIUM to HIGH and shrink the throwaway-rebuild probability to near zero. It is admissible under the freeze (read-only; weaker than the headroom read already taken). The cost is one standalone box-read session, which Install-Method Sec 4 mildly disfavors in preference for folding reads into the window. **Tradeoff for the [3]-spec decision, left open here:** one extra read-only session vs. a small chance of a discarded off-box build. Default leaning stays with the Install-Method posture (fold into window, accept the cheap rebuild risk); the firm-up is on record if a session judges the rebuild cost or window-time cost worth avoiding.

---

## Sec 6 — Governance boundary

This note **defines sequencing only.** It authorizes no box mutation and does not prime [3].

- Control-plane arch read (Sec 3 step 1) is an AWS API read, not a box SSH touch, and not a mutation.
- The off-box build (Sec 3 steps 1–4) is workstation/build-host work and touches no prod box.
- The window-open four-tuple read (Sec 4) is the one read-only box touch, folded into [3]-window open inside the abort envelope — not a standalone session, not authorized by this note.
- The stream-extract and cutover remain box mutations belonging to [3]'s own deliberate, backup-first window with a fresh Phase 1 abort re-verify at its start. Sequencing the build is not approving the operation.

---

## Sec 7 — Recommended register / handoff updates (DRAFTS — for Rule 7 execution separately)

- **[3] register / runbook:** record the P1 sequencing dependency as **DISCHARGED BY SPEC** — point here as authority. Record: arch pinned pre-window via control-plane (HIGH); libc fixed pre-window via recorded OS (HIGH); Node/npm pinned best-known pre-window (MEDIUM), confirmed-or-aborted at window-open four-tuple gate; gate is read-only, folded into window open, abort is clean pre-write.
- **B Install-Method note Sec 3:** update the "Sequencing note on P1 (flagged, not resolved here)" from *flagged* to *resolved* — point here. Its leaning recommendation is adopted and refined (best-known = HIGH for arch/libc, MEDIUM for Node/npm).
- **Selection-lean note:** B's lean firms by one further notch (the last open P1 sub-item — sequencing — is now spec'd), though B remains a lean, not a firm close, pending [3] execution.
- **Optional firm-up (Sec 5)** recorded as an open [3]-spec choice, not a standing action.
- **No fingerprint numbers re-inlined.** Point to the headroom note for disk/memory figures, to the Install-Method note for the method, and here for the sequencing.
- **Standing hazards restated** so the spec is not misread as authorization: FROZEN / FD-31 OPEN / [3] not primed.

---

## Sec 8 — What this does NOT change

- Prod box stays **FROZEN.** This is a sequencing-spec record; it authorizes no box action and primes nothing.
- **FD-31** schema-fork and degraded-state legs remain **OPEN.**
- **[3]** is **not primed.** Executing B still requires its own deliberate, backup-first window with a fresh Phase 1 abort re-verify at its start.
- The split-brain hazard (AG / H3) is untouched — B's cutover must still prove it landed on canon by IP/VPC + row counts, never by name string.
- No reconciliation strategy is *closed*. B stays the lean; C stays parked-not-killed under the Install-Method Sec 5 restated trigger (prerequisite-feasibility failure — which now includes "parity sequencing cannot be satisfied," though this note shows it can).

---
*Discharges the P1 build-host parity sequencing dependency that the B Install-Method note flagged and deferred to [3]-spec work. The flagged circularity (build needs parity known; parity confirmed only at window) is apparent only: it conflates the build's need for a compile **target** with the window's need for an authorization **confirmation**. The four-tuple provisions by confidence tier — CPU arch HIGH via AWS control-plane (no box touch), libc family HIGH via recorded prod OS (Ubuntu→glibc), Node major and npm major MEDIUM via best-known prior record — so the off-box build is finalized against a fully-specified target before the window, and the read-only four-tuple check at window open is a confirm-or-abort gate, not a discovery the build waited on. A MEDIUM pin is safe because any mismatch aborts cleanly pre-write, costing only a throwaway off-box rebuild on unconstrained disk; an optional pre-window read-only SSH read could firm Node/npm to HIGH at the cost of one standalone box-read session, left open as a [3]-spec choice with default leaning toward the Install-Method fold-into-window posture. Defines sequencing only — authorizes no box mutation, does not prime [3]. Box stays FROZEN; FD-31 OPEN; [3] not primed.*
