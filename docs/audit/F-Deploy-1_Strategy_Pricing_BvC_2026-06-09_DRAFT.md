# F-Deploy-1 -- Reconciliation Strategy Pricing (B vs C): RESULT (DRAFT v0.1)

> **READ-ONLY ANALYSIS RESULT. AUTHORIZES NO BOX ACTION. CHOOSES NO STRATEGY.**
> This note prices the two live reconciliation candidates -- C (in-place reset) and
> B (parallel checkout + cutover) -- so the fork narrowed by the 2026-06-08
> strategy-revisit note and made ripe by the 2026-06-09 #3-GREEN boot test can be
> weighed on real costs rather than first impressions. It prices C's four hazards
> through to their true cost, prices B's shape and structural advantages from the
> Reconciliation Plan's own definition, and isolates the single axis that still
> separates them. It does NOT select a strategy (that is Evoni's deliberate call),
> authorizes no box action, and schedules no session. Box stays FROZEN; FD-31 legs
> stand; [3] not primed.

| | |
|---|---|
| **Trigger** | Open thread after #3-GREEN: "price B concretely so the fork is symmetric on both halves." The C-pricing half preceded this note in-session; this note records both halves. |
| **Inputs** | Reconciliation Plan DRAFT Sec 3 (A/B/C definitions) + Sec 0 (fixed facts: box process topology, untracked files); strategy-revisit note (A withdrawn; B-vs-C fork; named trap); #3-GREEN boot-test note (bootability retired, four C-hazards carried forward intact); Session 1 Results (zero box-unique tracked content; encoding direction-of-truth). |
| **Method** | Workstation analysis only. No SSH, no box, no working-tree mutation, no commit. |
| **Status** | DRAFT v0.1 -- analysis complete; write-up pending review. No execution. Not canon. No strategy chosen. |

---

## Sec 0 -- Headline

Pricing both candidates collapses the question to a single measurable axis.

- **C made safe is not light.** #3-GREEN moved C from unselectable to selectable; pricing its four hazards shows its defining advantage (a quick in-place reset) is largely illusory once the hazards are neutralized. Two of the four (H2 credential, H4 encoding) sit at **precondition** level -- they can block C's admissibility, not merely add checklist steps. A third (H1 rollback) is a cost C pays uniquely because it lacks a standing rollback. Only H3 is neutral.
- **B's cost is concentrated, not diffuse.** B carries two structural advantages C cannot match (it absorbs the Track B topology realignment [3] needs anyway; its rollback is free and standing, not manufactured). Its real cost is singular: standing up a parallel checkout + process **on the frozen prod box**, whose disk and memory headroom are unverified and whose memory gate is a known-tight axis.
- **The deciding axis:** does the prod box have verified disk + memory headroom to host B's parallel process without pressuring the live prod process or tripping the memory hard-gate? This is the one cost line that cannot be priced from workstation facts; it requires a deliberate read-only box read. Until it is answered the fork stays genuinely open -- but it is now a *single measured fact* away from resolvable, not a diffuse judgment call.

---

## Sec 1 -- Strategy C priced: four hazards, two at precondition level

C's raw form (stash/commit on box, fetch, merge/reset, resolve) is the cheapest path on paper. Pricing each hazard's neutralization shows what *safe* C actually costs.

**H1 -- destructive op on a live-serving prod box (manufactured rollback).**
The dev boot that returned #3-GREEN ran on an idle box; prod serves traffic. C mutates the only serving tree in place, so it has no standing fallback -- a rollback must be *built*: full box-state backup before the reset, a defined restore-to-serving procedure, and an acceptable degraded/down window. This is the same backup-first gated envelope [3]'s Session 3 already requires, so it is not extra over [3] discipline -- but it is a cost C pays that B does not (see Sec 2: B's rollback is free). Reframed from the C-pricing pass: H1 is not merely "session discipline," it is the rollback C must manufacture because it lacks B's standing one.

**H2 -- untracked `.env.bak*` credential files (PRECONDITION, sharpened).**
A `git clean`/`reset --hard` deletes or clobbers untracked files; the box carries three `.env.bak*` (Plan Sec 0), credential-bearing. The neutralization is not "handle before reset" -- it is **classify retain/remove/rotate before C is even admissible**. If any `.env.bak*` holds a still-live canon credential, that credential must be rotated before any destructive operation touches it (same posture as the boot-test credential exposure that forced rotation). A live credential in a backup file is therefore a *gate on C's admissibility*, not a step within C. This is genuine added work C carries that B sidesteps entirely (B never runs a destructive command against the existing tree).

**H3 -- AG split-brain check (NEUTRAL).**
A box op can land on the wrong DB host and still boot clean and serve -- silently wrong. The mandatory post-op verification (`DB_HOST` resolves to canon AND row counts match) is unavoidable and **identical for B and C**: both must prove they landed on canon, not the empty fork, and the naming-inversion hazard means identity is confirmed by IP/VPC and counts, never by name string. H3 does not differentiate the two; it is priced into both.

**H4 -- encoding direction-of-truth (PRECONDITION; attacks C's defining advantage).**
Session 1 found the *box* carries cleaner encoding while origin/main carries mojibake + BOM. A naive `git reset --hard origin/main` therefore *regresses* encoding -- it makes the dirtier source authoritative. Neutralization forces one of two moves: (a) fix origin/main's encoding upstream *before* C can run safely, or (b) replace the blind reset with a selective, file-aware reconciliation that preserves the box's cleaner encoding. Either kills C's defining simplicity: C stops being "reset the box" and becomes "precondition-PR first" or "selective merge." This is the hazard that attacks C's advantage rather than appending to its checklist.

**C priced, net:** Once H4 forces C off a blind reset (onto a precondition-PR or a selective merge) and H1 forces it into a backup-first window with a manufactured rollback, C has acquired most of B's properties (verify, preserve, reversible) while keeping its one disadvantage -- it still operates destructively on the live serving tree rather than cutting over from a verified parallel checkout. With H2 and H4 both at precondition level, C's lightness is largely illusory once made safe.

---

## Sec 2 -- Strategy B priced: shape from the Plan, two structural advantages, one concentrated cost

The Reconciliation Plan Sec 3 defines B specifically (not as an abstract "parallel checkout"): blue/green-ish -- stand up a clean checkout of the chosen origin/main state in a parallel location/process, verify it serves, then **cut prod traffic to it** (port/topology per Track B), leaving the existing hand-maintained tree untouched as instant rollback. That definition yields two advantages and one cost.

**Advantage 1 -- B absorbs the Track B topology realignment.**
B's cutover *is* the port/topology move (the 3002->3000 / correct pm2 topology realignment that is already a named [3] component). B therefore does not *add* topology cost -- it folds in work [3] needs done regardless. C reconciles the tree but leaves topology realignment as separate downstream work. This is a credit to B that the first-impression framing ("B = higher infra cost") did not count.

**Advantage 2 -- B's rollback is free and standing.**
B leaves the existing serving tree running and untouched; cutover is a traffic switch, reversible by switching back. The rollback C must *manufacture* under H1, B gets *for free* as a property of the method. The same rollback capability appears as a built cost on C's side and a zero-cost property on B's.

**The concentrated cost -- B's defining act touches the frozen prod box.**
B is lower-risk *to the running process* (it never mutates the serving tree), but its defining act is standing up a second checkout + node process **on the frozen prod box**. That is not zero-touch on a FROZEN box -- "stand up a parallel process on prod" is itself operating on the box the discipline is built to leave alone. The real B-side question is therefore resource and host safety, and it has a favorable starting fact and an unverified one:

- **Favorable (Plan Sec 0):** the box is *already* multi-process and *already* hosts a second app -- id 3 `episode-api-prod-hotfix` (3000, prod), id 0 `episode-api` (3002, dev), id 1 worker. A parallel app is not a new class of thing on this box; the dev-process slot is arguably the model B's checkout would use or mirror. This lowers the "new class of risk" concern materially.
- **Unverified (requires box read):** actual **disk free** for a second full checkout, and **memory headroom** for a second node process alongside the live prod process. Memory is a known-tight axis on this infrastructure (the dev box carries a memory hard-gate as a standing milestone). A second process that pressures the serving process's memory, or trips the gate, would convert B's "low risk to process" claim into a real risk.

**B priced, net:** B's cost is not diffuse "infra effort" -- it is one concentrated question (safe disk + memory headroom on prod for a parallel process), partly de-risked by the box already being multi-process, partly unverified pending a box read. Against that single cost, B carries two advantages C cannot match.

---

## Sec 3 -- The fork, symmetric, and the one open axis

Both halves are now priced on the same terms:

- **C:** no parallel infra, but four hazards -- H2 and H4 at precondition level (can block admissibility), H1 a rollback C uniquely manufactures, H3 neutral. Made safe, C loses most of its lightness and keeps its one disadvantage (destructive on the live serving tree).
- **B:** absorbs Track B topology (credit), free standing rollback (credit), lower risk to the running process -- but its defining act stands up a parallel process on the frozen prod box, costed as one concentrated question (disk + memory headroom), partly de-risked by existing multi-process state, partly unverified.

**The single remaining asymmetry is measurable:** does the prod box have verified disk + memory headroom to host B's parallel checkout + process without pressuring the live prod process or tripping the memory hard-gate?

- **Headroom verified sufficient** -> B's structural advantages (topology absorbed, free rollback, no destructive op on the serving tree) likely dominate, and B's one cost is paid down.
- **Headroom tight or unknown** -> B's "low risk" claim weakens; C's no-infra nature regains weight despite its hazards; the fork stays genuinely open.

This axis is the natural next step and it is **box-touching**: a read-only check of disk free, memory headroom, and current process footprint on the prod box. Read-only does not violate FROZEN, but it is not a workstation read -- it goes through the Plan Sec 0 SSH discipline (confirm prompt, single read-only command, separate terminal) and should be run as a deliberate read, not casually. **This note does not authorize or schedule that read; it identifies it as the gating input.**

---

## Sec 4 -- The trap, restated (still standing after pricing)

Pricing does not retire the named trap; it explains it. "Nothing box-unique to lose" + "trivial delta" + "now it boots" -> "just reset the box" feels safe because #3-GREEN and Session 1 retired the two risks they retired (bootability, content loss). Pricing shows the inference is still wrong: C's real costs (H1 manufactured rollback, H2 credential precondition, H4 encoding precondition) are untouched by both findings, and made-safe C converges toward B's properties anyway. The seductive read is "C is now the cheap option"; the priced read is "C's cheapness is mostly illusory once it is safe." Both prior notes arrived at this trap independently; pricing is the third pass that confirms it from the cost side.

---

## Sec 5 -- What this does NOT change

- Prod box stays **FROZEN.** "Do not reboot" stands. The box-capacity read in Sec 3 is read-only and unauthorized by this note.
- **FD-31** schema-fork and degraded-state legs remain **OPEN.**
- **[3]** is **not primed.** The box-mutating session still requires its own deliberate, backup-first window with a fresh abort re-verify at its start.
- The split-brain hazard (AG) is untouched and priced into both strategies (H3).
- **No reconciliation strategy is chosen.** B vs C is now priced on both halves; selection remains Evoni's deliberate decision, gated on one measured fact.
- Read-only workstation analysis. Advances **understanding**, not execution; **not canon** until reviewed and placed under Rule 7.

---

## Sec 6 -- Recommended register / handoff updates (DRAFTS -- for Rule 7 execution separately)

- **Reconciliation Plan Sec 3 / fork:** record B and C as priced on common terms; record the single remaining asymmetry as the prod-box disk + memory headroom question; record A as remaining withdrawn.
- **Reconciliation Plan Sec 4:** note the box-capacity read-only check as the identified gating input for B-vs-C selection -- a deliberate read-only box read under Sec 0 SSH discipline, not a workstation task and not authorized here.
- **[3] register:** no change from this note beyond the prior Template Studio correlation observation; B's topology-absorption is noted as a pricing consideration, not a selection.
- **No fingerprint numbers inlined.** Point to the Plan, Session 1 Results, the strategy-revisit note, and the #3-GREEN boot-test note as authorities.

---
*Reconciliation strategy pricing for the prod box->repo divergence, weighing the live B-vs-C fork on common cost terms after #3-GREEN made it ripe. Result: C made safe is not light -- H2 (credential) and H4 (encoding) sit at precondition level and can block C's admissibility, H1 is a rollback C uniquely manufactures, H3 is neutral; made-safe C converges toward B's properties while keeping its one disadvantage (destructive on the live serving tree). B carries two structural advantages C cannot match (absorbs Track B topology realignment; free standing rollback) and one concentrated cost (standing up a parallel process on the frozen prod box), partly de-risked by the box already being multi-process, partly unverified. The single remaining asymmetry is measurable: verified prod-box disk + memory headroom for B's parallel process. No strategy chosen; box stays FROZEN; FD-31 open; [3] not primed; the box-capacity read is identified as the gating input but not authorized or scheduled here.*
