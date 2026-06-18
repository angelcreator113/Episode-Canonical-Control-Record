> **CORRECTION 2026-06-18 (additive-supersede):** The "[P-4/P-5 CLOSED 2026-06-18
> — PASS]" banner near the top of this file is **superseded**. P-4/P-5 is **NOT
> PASSED** — see the canonical correction in `F-Deploy-1_P4P5_PASS_2026-06-18.md`
> (2026-06-18). This file's "still OPEN / next executable work" statements for
> P-4/P-5 are therefore **current**. The A5 gate-rule decision (A1 engines-range,
> Edits 1–5) is unaffected and stands. Box FROZEN; [3] not primed.

# F-Deploy-1 — A5 Gate-Rule Reconciliation (REVIEW-ONLY DRAFT, 2026-06-17)

> **PLANNING / REVIEW ARTIFACT. AUTHORIZES NO BOX ACTION. PRIMES NOTHING. EDITS NO RUNBOOK BODY.**
> Drafted in a WARM session (2026-06-17). This note proposes the A5 edits the cold-entry
> checklist (PR #816) requires before a Phase 2A cold window can open without guaranteed
> re-abort. It is a draft for a future confirm-and-apply PR — applied fresh, not from this
> session. Box remains FROZEN; FD-31 OPEN; [3] NOT PRIMED.
>
> **Owner-level content.** The A1 decision below is the runbook owner's (Evoni's) call,
> recorded with her rationale. Claude drafts the wording; the decision is hers and lands
> attributed.

| | |
|---|---|
| Drafted | 2026-06-17 (warm) |
| Predecessor chain | #812 (parity abort) → #813 (hold) → #814 (provenance resolved) → #816 (cold-entry checklist) |
| Live anchors verified | runbook Sec 7A step 1 ("build-host pins"); ExecutionSpec G2A-1 / Sec 1 P-3 ("Node 20 / engines range") — both read from origin/main 2026-06-17 |
| Applies | as a single confirm-and-apply PR in a FRESH session; `[skip-automerge]`, no closing keywords (FD-21) |
| Does NOT | open the cold window, prime [3], touch the box, or resolve P-4/P-5 (off-box build still OPEN) |

> **[APPLIED 2026-06-17 via this PR.]** Edits 1-5 executed in the same PR; this file is now the on-main A5 decision record cited by Master Runbook Sec 7A/Sec 7/Sec 5 and the ExecutionSpec. The "review-only" framing below is the at-drafting state, preserved verbatim per additive-supersede.

> **[P-4/P-5 CLOSED 2026-06-18 — PASS; supersedes the "OPEN" statements below.]** The A5 statements below that describe P-4/P-5 as "still OPEN / next executable work" are this file's at-drafting state, retained as at-filing record — do not read them as current. The off-box parity build PASSED; result in `F-Deploy-1_P4P5_PASS_2026-06-18.md` (recorded on main in `36a7cf27`). This changes nothing else about A5's scope: A5 still does not open the cold window, prime [3], or touch the box. Box FROZEN; FD-31 OPEN; [3] NOT PRIMED.

---

## 1) The A1 decision (OWNER-LEVEL — record verbatim, attributed, dated)

**Decision (A1), 2026-06-17, owner (Evoni):** Phase 2A Step 1 Node parity is satisfied by
**ABI / engines-range** compatibility, **not** exact-patch identity. The gate asserts a
compatible runtime contract (major/minor within the `package.json` engines range, ABI-stable),
not patch-byte equality with the build-host binary.

**Rationale (record on main):**
- Exact-patch is the wrong invariant for a **source-on-box deploy**: there is no compiled
  artifact whose ABI must byte-match a specific patch release. The load-bearing property is
  that the box runtime satisfies the app's engines contract (`engines.node >=20.0.0`,
  `engines.npm >=9.0.0`) and is ABI-compatible — same major, stable ABI.
- Exact-patch has already produced a **known false abort** (#812): box `v20.20.1` vs pinned
  `v20.20.2` aborted on a benign same-major/same-ABI skew. #814 then established `v20.20.2`
  was merely the build-container's Node, never a prod requirement.
- This is a **realignment**, not a loosening. The ExecutionSpec's G2A-1 already matches against
  the Sec 1 pins, which are engines-ranges ("Node 20 / npm 10.x"), not a patch pin. The
  divergence lived in the master runbook's "build-host pins" wording, which read patch-exact
  when the build host happened to sit at v20.20.2. A1 brings both docs to the rule the
  ExecutionSpec already intended.

**Provenance note for a future reader:** the gate is NOT being weakened from a correct
exact-patch rule. It is being stated explicitly as engines-range because "implied engines-range"
(ExecutionSpec) plus "build-host pins" (runbook) was enough ambiguity to cause #812. After A5,
both docs say the same thing in the same words.

**Load-bearing coupling — A1 is what makes rebuild-at-priming viable (verified 2026-06-17
against the Pre-2A Build Confirmation PASS, #806):** The off-box build policy is
rebuild-at-priming with NO persisted artifact (PASS doc Sec 5) — the artifact is rebuilt at
window open against the then-current origin/main pin. The 06-14 PASS confirmed build viability
on a parity container at **Node v20.20.2** (PASS doc Sec 3.1). The box runtime is **v20.20.1**.
That one-digit patch difference is exactly the #812 skew. The container's Node comes from
NodeSource `setup_20.x`, which installs the **then-latest Node 20.x patch at run time** — it was
.2 on 06-14 and will be whatever the latest 20.x patch is at the next window open (.2, .3, …).
The box patch is not pinned to chase it. **So under an exact-patch gate, any rebuild-at-priming
cycle whose resolved container patch differs from the box patch re-arms the #812 abort** — and
because the container rolls latest-20.x while the box does not, that divergence will recur
unpredictably. A fresh artifact does not fix this; only the gate strictness does. **Therefore:
rebuild-at-priming is only a sound strategy UNDER engines-range parity (A1). The two decisions
are coupled — an exact-patch gate and a rolling-latest build policy are mutually incompatible by
construction.** This is the single strongest argument for A1, and the reason the PASS (06-14) and
the abort (06-17) are not contradictory: viability was real; the gate then aborted on a patch
skew the build policy can reproduce at will. A1 closes that loop. *(Claim scope: this asserts
recurrence is possible/likely under rolling resolution, NOT a fixed .2-forever recurrence —
the provenance supports latest-20.x-at-runtime, not a constant patch.)*

---

## 2) The reconciliation — four edit targets (two docs)

Anchored to live origin/main text read 2026-06-17. Each is an additive/replace edit under the
existing additive-supersede convention; original wording preserved where the convention calls for it.

### Edit 1 — Master runbook Sec 7A step 1 (the strict-wording fix; HIGHEST priority)

**Live text (origin/main):**
> Parity confirm gate (read-only, at window open). `uname -m; ldd --version | head -1; node --version; npm --version` — Match all four against the build-host pins → proceed. Mismatch any → CLEAN PRE-WRITE ABORT…

**Problem:** "match against the build-host pins" reads patch-exact when the build host is at a
specific patch (v20.20.2). This is the wording that produced #812.

**Reconciled replacement (draft):** keep the probe command and the clean-pre-write-abort posture
verbatim. Replace the match criterion only:
> Match arch and libc **exactly** (HIGH-tier pins — x86_64 / glibc Ubuntu 22.04); match Node and
> npm against the **engines-range contract** (`engines.node >=20.0.0`, `engines.npm >=9.0.0`;
> Node major 20, ABI-stable), **not** patch-exact against the build-host binary. A same-major,
> ABI-compatible Node (e.g. v20.20.1 vs a build host's v20.20.2) **PASSES** — it is not a
> mismatch. Mismatch = arch/libc differ, OR Node major differs / falls outside the engines range
> → CLEAN PRE-WRITE ABORT (discard off-box artifact, re-pin the drifted dimension, rebuild
> off-box, re-attempt at a later window; no box bytes written).
> *[A1 decision, 2026-06-17, owner: see A5 reconciliation record. Supersedes the "build-host pins"
> patch-exact reading that caused the #812 false abort.]*

### Edit 2 — ExecutionSpec G2A-1 (make the engines-range explicit; it is only implied today)

**Live text (origin/main):** "Match all four against the Sec 1 pins (arch, libc, Node, npm). All
match → proceed to G2A-2."

**Problem:** the Sec 1 pins ARE engines-ranges, but "match all four against the pins" is read by an
operator as four equal-strictness matches. #812 proves the implied range was not enough.

**Reconciled replacement (draft):** state the per-dimension strictness explicitly, mirroring Edit 1
so the two docs are word-aligned:
> Match arch and libc exactly (HIGH-tier). Match Node and npm against the engines-range contract
> (Node major 20, ABI-stable; `engines.node >=20.0.0` / `engines.npm >=9.0.0`) — NOT patch-exact.
> Same-major ABI-compatible Node passes. All match → proceed to G2A-2; mismatch (arch/libc differ,
> or Node outside engines range) → CLEAN PRE-WRITE ABORT.
> *[Aligned to A1 decision 2026-06-17; consistent with master runbook Sec 7A step 1.]*

### Edit 3 — Fold A2-cfg (config-vs-runtime drift) — NEW gate text near the restart step

> **Label note (READ FIRST):** this decision is **A2-cfg**, NOT "A2". The bare ID `A2` is already
> a durable, cross-referenced decision in the master runbook Sec 2 decision register —
> *A2 = direct pm2/ecosystem cutover; Deploy to Production disabled* (ratified 2026-06-03). To
> avoid a terminology collision a cold operator could trip over under restart pressure, the
> config-vs-runtime decision is labelled **A2-cfg** throughout. (The cold-entry checklist #816
> calls this item "A2" — when applying, relabel it there too, or note the equivalence.)

**Context (verified in repo / unresolved on live box):** ecosystem config does NOT merely pin a
version string. It prepends a fully qualified nvm path,
`/home/ubuntu/.nvm/versions/node/v20.20.0/bin`, to `PATH`, sets `NODE_VERSION='20.20.0'`, and then
uses `interpreter: 'node'`. That means the restart resolves `node` against the PATH-forced binary
FIRST. If `/home/ubuntu/.nvm/versions/node/v20.20.0/bin/node` exists on the box, restart binds
**v20.20.0** regardless of the currently running runtime. If that directory does NOT exist,
resolution falls through to the next PATH entry and restart may bind the box default instead.
Which behavior is real is a LIVE box read, not knowable from the repo alone.

**Why this is bigger than simple config-vs-runtime drift:** the current state can place THREE
different patches in play at once — build-verified off-box start viability on `v20.20.2`, current
box runtime `v20.20.1`, and restart config that may force `v20.20.0`. Under A1's engines-range
gate all three are Node 20 / ABI-compatible, so G2A-1 can pass while the restart silently binds the
one runtime nobody verified. Therefore A2-cfg is not a cosmetic follow-up; it is the guard that
keeps A1 from turning a false-abort fix into a restart-bind hole.

**Decision (A2-cfg), owner direction recorded for fresh apply:** choose **(c) — reframe the fix at
the mechanism level, not the patch-string level.** The target is to align the config's
Node-selection mechanism to the engines-compatible box runtime actually intended to run. The
current `PATH`/`NODE_VERSION` hardcode to `v20.20.0` is a defect because it can force restart onto a
patch that is neither the live runtime (`v20.20.1`) nor the build-verified one (`v20.20.2`). The
exact config edit is DEFERRED to the fresh A5 apply / [3]-disciplined session because it depends on
a live box read confirming whether `/home/ubuntu/.nvm/versions/node/v20.20.0/bin` exists and which
binary `interpreter: 'node'` would actually resolve to.

**Consequence for apply shape:** option "set `20.20.0` → `20`" is NOT directly expressible in the
current config form. To express "use an engines-compatible runtime," the mechanism itself must be
changed — for example by repointing PATH at the confirmed target binary or by removing the PATH
override and letting `interpreter: 'node'` resolve against the confirmed box default. Record the
decision now; choose and execute the exact mechanism only after the live box read.

**Draft gate text (Phase 2B pre-restart; HARD gate):**
> **Pre-restart runtime-bind check (A2-cfg).** Before the restart-to-align, verify which binary
> `interpreter: 'node'` will actually resolve to under the live ecosystem `PATH`, and verify that the
> resolved binary is PRESENT on box and within the A1 engines-range contract. The restart MUST bind a
> confirmed-present, engines-compatible Node that is the explicitly decided target for the window.
> If the PATH-forced `v20.20.0` binary exists, treat that as the bound runtime unless and until the
> config mechanism is changed. If the PATH-forced directory does NOT exist, record the fall-through
> target actually selected by resolution. If the operator cannot prove which binary restart will bind,
> or the bound binary is not the decided target, or it falls outside engines-range → ABORT BEFORE
> restart. Engines-range parity (G2A-1) is necessary but NOT sufficient here: it does not prove which
> on-box Node the restart will actually execute.

### Edit 4 — Carry G2A-1/G2A-2 status into Step 0 / abort re-verify (checklist A5 proper)

**Record (from A4, this session — both gates verified DEFINED on origin/main in the ExecutionSpec):**
- **G2A-1** (parity confirm) — DEFINED; window-time live gate; now engines-range per A1 (Edits 1+2).
  Status for cold open: live-confirm-required-at-window, not resolvable in advance.
- **G2A-2** (disk precheck) — DEFINED; window-time live gate; `df -h /` live read, ~1.1 GB tree /
  ~1.4 GB residual / ~0.3 GB slack reference, zero-swap hard-OOM caveat. Read LIVE not from doc.
  Status for cold open: live-confirm-required-at-window.
- **Freeze asterisk (A0):** inert `/tmp/pm2jlist.json` written by an un-gated probe (#813). The
  abort re-verify must expect this artifact and NOT read it as a new mutation.

**Edit:** fold the above into runbook Step 0 / the abort re-verify text so the cold window inherits
it through its one permitted read, as settled main content — keeping the window cold.

### Edit 5 (dissolves) — A3 rebuild-at-priming applicability

Per the checklist's own prediction: under engines-range (A1), the "rebuild off-box against confirmed
pin" question dissolves for the runtime layer — there is no patch-exact artifact to rebuild against.
A3 governs only the off-box build-viability checks (P-4/P-5), which remain OPEN and unchanged.
**Confirm at apply time; do not assert.** If confirmed, record A3 as dissolved-into-A1 with one line.

---

## 3) Apply order (for the fresh confirm-and-apply session)


1. Record the A1 decision (§1) on main as a runbook-rule clarification (no new FD) — owner-attributed, dated. *This is the gating decision; nothing downstream is real until it lands.*
2. Apply Edit 1 (runbook Sec 7A step 1) and Edit 2 (ExecutionSpec G2A-1) **together** in one PR so the two docs never sit on main disagreeing.
3. Carry the **A2-cfg decision** (option (c), reframed as a mechanism-level fix) and Edit 3's hardened pre-restart gate text into the apply PR as a doc-only record. The live box read (does `/home/ubuntu/.nvm/versions/node/v20.20.0/bin` exist?) and the exact `ecosystem.config.js` mechanism change are explicitly deferred to the cold [3] window as pre-restart discipline — not done in A5, which must remain pure doc edits.
4. Apply Edit 4 (fold into Step 0 / abort re-verify).
5. Confirm/record Edit 5 (A3 dissolution) if it holds.

*[CONFIRMED AT APPLY 2026-06-17: A3 dissolves into A1 for the runtime layer -- there is no
patch-exact runtime artifact to rebuild against under engines-range. A3 governs only P-4/P-5
off-box build-viability, which remain OPEN / unchanged.]*
6. One `[skip-automerge]` PR, no closing keywords. `git diff --cached --stat` gate before commit. `gh pr create --head`. **Include in PR checklist:** verify `engines.node` and `engines.npm` literals against live `package.json` before writing gate text.

**Only after all of the above is on main does the cold window become openable** (per checklist Section A: "Until A5 is on main, do not open the cold window").

---

## 4) What this draft deliberately does NOT do

- Does NOT edit any runbook or ExecutionSpec body (review-only).
- Does NOT perform the live box read or edit `ecosystem.config.js` — the exact A2-cfg config change depends on a live box read confirming whether `/home/ubuntu/.nvm/versions/node/v20.20.0/bin` exists, and belongs to the cold [3] window as pre-restart discipline, not to this warm doc-only PR.
- Does NOT assert the A3 dissolution — flags it for confirm-at-apply.
- Does NOT resolve P-4/P-5 (off-box build still OPEN — separate next executable work).
- Does NOT prime [3], touch the box, or open the cold window.
- Does NOT inline FD-38 fingerprint counts — cold open requires a live read.

## 5) Items still needing owner input before A5 applies

*(None. A1 decision is recorded (§1). A2-cfg direction is recorded (§2). Apply order is settled.)*

**Pre-apply checklist for the fresh session:**
- Verify `engines.node` and `engines.npm` values against live `package.json` before writing Edit 1/Edit 2 gate text. Current draft cites `>=20.0.0` and `>=9.0.0`; confirm these match the source of truth.

*Review-only draft. Author: Claude (warm session), with Evoni. Owner-level items: A1 (decided, §1), A2-cfg (direction recorded, exact mechanism deferred, §2). Applied fresh in a future gated session — not from this one.*
