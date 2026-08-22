| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *FD-67 branch ruling. Rules a third branch.* |
| --- |

**Document version**

v2.65 — **RULES A THIRD BRANCH FOR FD-67. THE GLOBAL `optionalAuth` MOUNT AT
`src/app.js:236` IS RETAINED.** v1.5 §7.7's global-mount removal requirement is
**RETIRED as unexecutable**. It is replaced by a verification procedure
**scoped to an enumerated population** rather than to the full route surface.

**This is neither branch offered at v2.61 §4.4.** It is not option 1 — the mount
is not removed. It is not option 2 — the procedure is not defined over the full
surface. **It is named here as a third branch and justified as one (§3, §4).**

**Does not close FD-67.** FD-67 remains **OPEN/P2** until the procedure is
specified, executed, and its results recorded. Does not implement code. Does not
perform Tier adjudication. Does not perform limb 1.

FD tail remains **FD-68**; XK tail **XK-3**; PE tail **PE #67**. Dimension 3
remains **NOT PERFORMED**; limb 3 open; G4 not enterable; ASSESSMENT NOT
COMPLETED. Prod FROZEN.

**Basis:** `origin/main` at `a7f0156f`, 2026-08-22. **PR #1090 merged there
unchanged from its filed text**, so §6's population is on `main` and this
document's citation of it is not a forward reference. §6's figures were
*derived* at `cde71fbc`, the basis #1090 states; `a7f0156f` is where they
landed. **If anything further merges before this document is filed, re-check
that §6 still matches `main`.**

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

Ruling. Retires one procedure requirement, retains the mount, and bounds the
successor procedure's scope. Ships no code. Closes nothing.

---

# §1. Question ruled

v2.61 §4.4 stated two branches and declined to select:

> 1. remove the global mount and place optional identity explicitly on every
>    legitimate consumer; or
> 2. retain the mount and define a complete effective-middleware verification
>    procedure proving every write is protected independently of it.
>
> *Current history points toward option 2 but does not rule it.*

**Ruling: neither. A third branch is taken.**

**§4.4's lean toward option 2 is withdrawn** as formed while option 1's cost was
unknown — **not as mistaken when recorded.**

# §2. The third branch, stated

1. **The global mount at `src/app.js:236` is RETAINED.** No change is authorized
   to it.
2. **v1.5 §7.7's global-mount removal requirement is RETIRED as unexecutable.**
3. **The successor verification procedure is SCOPED to an enumerated
   population** — the write declarations that rely on the mount alone — rather
   than to the full route surface.

# §3. Why this is a third branch and not a variant of either

**It is not option 1.** Option 1 removes the mount. The mount is retained, and
§7.7's removal requirement is retired rather than satisfied. **A ruling that
retires the removal requirement while claiming option 1 would leave `:236` live
under the branch that deletes it, and would not dispose of FD-67 at all.**

**It is not option 2.** Option 2 defines a procedure over the full surface,
tying every declaration to its Tier disposition — which v2.61 §4.3 states is
limb 1. This branch defines a procedure over a bounded, enumerated population.

**The difference is the scope of the procedure, and it is the whole of the
difference.** Both option 2 and this branch retain the mount; only this one
bounds what must be verified.

# §4. Why this branch was not available at v2.61

**Because the population did not exist yet.**

§4.4 could offer only "the full surface" because no bounded alternative had been
enumerated. **A procedure cannot be scoped to a set before the set exists.**

**And the enumeration required an instrument, not merely effort.** v2.61 §4.3
records that token greps miss bare declarations under the global mount, router
presets, multiline declarations and non-`router` variables — which is why it
concludes a grep cannot substitute for the stale assertion. **The composed-stack
walk in PR #1090 identifies middleware by function identity off the runtime
router stack and is not subject to those misses.** §4.3's objection is met by
the instrument rather than argued around.

**So this branch is not an option v2.61 overlooked. It is one the scoping
created**, and it could not have been ruled before the scoping existed.

# §5. What is retired, and what is not

**Retired: §7.7's global-mount removal requirement only.** Its premise — that
`app.js` would cease to apply global `optionalAuth` — was never authorized by
any landed revision. v2.47 records the mount surviving the 95-handler
remediation deliberately, as *"the fallback for routes that no longer rely on
it… it has legitimate consumers and its own disposition question."* **A
procedure step that requires an architectural state the architecture
deliberately declined to adopt is unexecutable, and retiring it is the accurate
disposition.**

**Not retired: the rest of §7.7.** Its third checkbox — *"No bare optionalAuth
on a write route without a `// PUBLIC:` justifying comment"* — stands, and §6's
procedure is how it is discharged. **Nothing else in §7.7 is withdrawn.**

# §6. The scoped population

**The population is the write declarations relying on the mount alone: 9.**

| | |
|---|---|
| write declarations (PR #1090, derived at `cde71fbc`, on `main` at `a7f0156f`) | 912 |
| carrying explicit authentication | 903 |
| **relying on the global mount alone — THE POPULATION** | **9** |
| no auth middleware at all | 0 |

**The read set is NOT a work population under this branch, and this is a
consequence of retaining the mount.** PR #1090 enumerated 13–27
identity-dependent reads to cost option 1: removal would have stripped their
identity and required explicit placement. **The mount is retained, so those
reads continue to resolve identity unchanged and require no work.** §7.7's
checkbox governs write routes; reads are outside it.

**The read enumeration is retained as evidence, not as scope.** It records what
removal would have cost and is part of why removal was not taken. **It must not
be carried forward as a population of work under this ruling.**

**The procedure must therefore establish, for each of the 9, its Tier
disposition and whether unauthenticated write access is correct for it.** Three
are `POST /login`, `/refresh`, `/validate` — auth endpoints, where
unauthenticated access is definitionally correct. The remainder are four
roles-shaped writes, `/validate-required`, and
`/world/generate-ecosystem-preview`. **No member is prejudged here.**

# §7. §4.4's ambiguity is left unresolved, deliberately

§4.4 requires a procedure *"proving every write is protected."* **"Define"
admits a specification reading; "proving" admits an execution reading.** The two
differ in whether FD-67 could close on a document or only on a completed pass.

**This ruling does not resolve that ambiguity, and does not need to.** The
ambiguity is a property of option 2. **This branch is not option 2**, and it
specifies its own discharge condition directly at §6 and §10: the procedure must
be specified *and executed* over the 9. **Nothing here turns on what §4.4 meant.**

**Recorded so a later revision does not read this silence as agreement with
either reading.**

# §8. Conditions carried

**These are conditions of the ruling, not commentary.**

1. **The population is basis-stamped, and the stamp now holds.** §6's figures
   were derived in PR #1090 at `cde71fbc` and merged to `main` at `a7f0156f`
   **unchanged from their filed text** — verified by diff, not assumed. The
   re-check this condition originally reserved against a revised #1090 is
   therefore discharged. **It revives if §6's figures are ever restated against
   a later basis:** the surface changes with development, and a population
   correct at `a7f0156f` is not automatically correct later.

2. **THE 9 IS UNINSTRUMENTED, AND UNDER THIS BRANCH THAT IS LOAD-BEARING.**
   PR #1090's closing note recorded that the 9 rests on an argument — that the
   `asyncHandler` opacity defect cannot reach a middleware-chain fact — rather
   than on a second instrument. PR #1091 §5.1 adds a second reason: the 9
   derives from the 912-declaration app-composition walk, and 912 disagrees by
   22 with the per-router walk's 890 while both agree exactly on 504 reads.

   **Under option 1 a wrong 9 would have been one of two sets and would not have
   disturbed the reasoning. Under this branch the 9 IS the entire scope of the
   procedure.** A wrong 9 is a wrong procedure scope, and a write omitted from
   it is a write the successor check never examines.

   **RULED: independent confirmation of the 9 is a prerequisite to specifying
   the procedure, not an optional refinement.** The reason is that **an
   unconfirmed bound is not a bound** — and a bounded procedure is preferable to
   option 2's full-surface one precisely because its bounds are known. A branch
   that takes its warrant from being bounded cannot leave the boundary
   unverified.

   **The 890-vs-912 disagreement makes this live rather than hypothetical:** two
   instruments disagree on exactly the quantity the scope is drawn from.

   Confirmation is cheap — a second walk identifying mount-only writes by a
   different criterion either agrees or does not. **The status of this check
   changed as a consequence of choosing this branch**, and under the earlier
   option-1 formulation it was correctly optional: there the 9 was one of two
   sets and a wrong 9 did not disturb the reasoning.

3. **Legitimate need remains Tier adjudication and is uncounted.** §6 enumerates
   writes that *rely on* the mount, not writes that *should*. Deciding each
   member's Tier is adjudication. **This ruling authorizes the scope of that
   work. It does not perform it and prejudges no member.**

4. **FD-67 does not close on this ruling.** It remains OPEN/P2 pending
   specification and execution of §6's procedure. v2.61 §3.5's successor-G4
   requirements are untouched here.

# §9. Gate effect

**Dimension 3 does not advance.** FD-67 remains open; its live half remains
unattempted and unauthorized; v2.61 §6's finding stands that Dimension 3 cannot
pass while required procedure checks lack executable expected results.

**Limb 3 is not discharged. Limb 1 is not performed and is not sized by this
ruling** — and is not a prerequisite to it, which is the practical effect of
bounding the procedure. G4 is not entered or scheduled. **Prod remains FROZEN.**

# §10. What v2.65 does not do

- Does not close FD-67, FD-63, or any finding. **Mints nothing.**
- Does not remove, alter, or authorize any change to the mount at `:236`.
- Does not implement, test, or deploy code.
- Does not specify the successor procedure — it rules the procedure's **scope**.
- Does not perform limb 1, Tier adjudication, or adjudicate any of the 9.
- Does not resolve §4.4's specification/execution ambiguity (§7).
- Does not rule any question raised in PR #1091, or amend the ~700 figure.
- Does not advance Dimension 3, discharge limb 3, enter G4, or alter the freeze.

---

*Type: FD-67 branch ruling. Rules a third branch, retains the mount, retires
§7.7's removal requirement, and bounds the successor procedure. Closes nothing.
No host, AWS, database, or Cognito contact. Prod FROZEN.*
