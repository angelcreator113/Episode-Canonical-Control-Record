| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Restoration revision. **RESTORES TRACK G3's STATUS. ENTERS NO TRACK.*** |
| --- |

**Document version**

v2.56 — **RESTORATION REVISION. ENTERS NO TRACK. MINTS NOTHING. SHIPS NO
CODE.** Restores Track G3's status to the record with its three §5.71 limbs
and their real dispositions (§1). Records that **Track G4's precondition is
not satisfied** and carries forward v2.55 §3.2's withdrawal (§2). **Records
the `Gate G<n>` / `Track G<n>` namespace question and DEFERS it** to a
revision of its own, with what was found (§3). Files the `origin/main` ↔
`origin/dev` divergence measurement as **evidence toward §5.71 limb 3**, and
rules on v2.38 §1.2 (§4). **Does not perform limb 1** and says so (§5). FD tail
remains **FD-66**; XK tail remains **XK-3**. Derived from git against
`origin/main` at `d68bfda78c0db3b609b085a2bb1808a62f00b899`. No live database
contact and no request issued to any deployed host.

> **CORRECTION BANNER — the Status field's `Gate G3` / `Track G3` pair is SUPERSEDED, and §3's deferral is DISCHARGED (added 2026-08-21, after `f214cece`, additive).**
> **Both changes are made by `F-AUTH-1_Fix_Plan_v2.57.md`. Nothing else in this revision moves.**
>
> - **The Status field carries *"Track G3 — OPEN"* and *"Gate G3 — DISCHARGED"* as two dispositions.** **They are one gate.** v2.57 §1.3 rules `Gate G<n>` and `Track G<n>` co-referential for n=3–6, and v2.57 §3 item 3 retires the two-line form. **The pair is superseded by a single line: `G3 — PARTIALLY DISCHARGED, OPEN` — v1.5 §6.1 clauses 1–4 discharged at v2.55 §3.1 and standing; §5.71 limbs 1 and 3 unattempted.** The discharge is **incomplete, not void**; nothing ruled at v2.55 §3.1 is unwound (v2.57 §2.1).
> - **§3's deferral is discharged.** §3 recorded the `Gate G<n>` / `Track G<n>` question and deferred it, naming the read it required. **That read was performed at `f214cece` and the ruling is at v2.57 §1.** §3's finding that *"the two schemes may be one sequence under two prefixes"* is **selected**; its reading 2 is refuted, and its reading 3 — under which this revision's Gate G3 discharge would have become void — **does not hold** (v2.57 §1.3).
> - **§3's read-pointer is corrected.** §3 names the required read as *"v1.5 §7.3 and §5.71 in full."* **v1.5 §7.3 is a G4/G5 artifact**, not a G3 one — v1.5 §7 opens *"Run this checklist on dev (during G4) and again on prod after G5 cutover."* **G3's specification is v1.5 §6.1 line 398**, with its clauses 3 and 4 substantiated at v1.5 §4.6. See v2.57 §1.1.
> - **§3's six-scheme deferral ground stands for the four schemes it named.** `CP12-G<n>`, `XK-3 Gate <n>`, F-Deploy-1's `Gate 2.5` and its Rule 7 window gates are **not bound** by v2.57 (v2.57 §1.4). Only `Gate G<n>` is newly bound into v2.38 §2.2's lock, as an alias of `Track G<n>` — **the part §3's stated ground never reached.**
>
> **What stands: everything else.** §1 and §1.1 including the limb table, §2 and §2.1, §4 and §4.1–§4.3, §5, §6's numeral disambiguation, and §7's non-establishments are unaffected. **§6's *"limb" vs "clause"* discipline is RETAINED and is now explained** — the two words name two specifications of one gate, not two gates (v2.57 §1.3). The original prose is preserved verbatim below as the at-filing record.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged.
**Track G3 — OPEN**, pending re-validation per v2.43 §4.3; limb 2 discharged,
limbs 1 and 3 unattempted (§1). **Gate G3 — DISCHARGED** at v2.55 §3.1;
**that discharge is not re-opened here and is not placed beyond question
here** (§3). **Track G4 — precondition NOT satisfied, not enterable** (§2).
Track G5 — **BLOCKED** per v2.43 §4.2. **Track G6 — not reached.** **FD-65 —
OPEN, P0.** FD-63, FD-64, FD-66 — open. Prod remains FROZEN; confirm freeze
status live before any prod-touching action.*

---

# PART I — THE RESTORATION

# §1. Track G3 — status restored

**v2.37 §5.71 defines Track G3 as three limbs**, quoted in full because every
later citation has quoted a fragment:

> *"adjudicator-driven audit pass over CP1–CP12 cumulative work; verify G1–G6
> still hold post-merge-resolution + cleanup-delete; production-readiness
> assessment for G4."*

| Limb | Disposition | Basis |
|---|---|---|
| 1 — adjudicator-driven audit pass over CP1–CP12 cumulative work | **UNATTEMPTED** | v2.42 §2.3; v2.43 §4.3; v2.44 |
| 2 — verify G1–G6 hold post-merge-resolution + cleanup-delete | **DISCHARGED** | v2.42 §1.4 — CP12-G4 re-run, 0 true positives |
| 3 — production-readiness assessment for G4 | **UNATTEMPTED** | v2.42 §2.3 (twice); v2.42 §5; v2.43 §4.3; v2.44 |

**Limbs 1 and 3 are recorded as not discharged in four revisions and as
discharged in none.** v2.44 states it plainly: *"§5.71's 'adjudicator-driven
audit pass over CP1–CP12 cumulative work' and its 'production-readiness
assessment for G4' are **not discharged by this revision**."*

## §1.1 How the status went quiet

**Fifteen consecutive revisions carried Track G3's status.** v2.39 (partially
discharged, two grounds) → v2.40, v2.41 (OPEN) → v2.42 (grep clause
discharged, remains OPEN) → v2.43 §4.3 (pending re-validation) → v2.44, v2.45,
v2.46, … v2.52, v2.53 (OPEN).

**v2.54 carries zero mentions. v2.55 carries one — its §5 glossary line
defining the label, not a status.**

**No revision closed it. The line stopped being written.**

**Two entries were dropped, not one.** v2.52's Status field carried five:
*"Gate G3 — NOT DISCHARGED. Track G4 — precondition NOT satisfied; not
entered. Track G3 — OPEN. Track G5 — BLOCKED. Track G6 — not reached."*
v2.55's carries Gate G3, Track G4 and Track G5. **Both Track G3 and Track G6
went silent in the same revision.** Track G6 is restored to the Status field
above alongside Track G3.

**The count is what makes this a finding rather than a slip.** A single
omission reads as oversight. **Two in one revision establishes that the
enumeration was not load-bearing for its author** — which is precisely why no
later reader can treat it as exhaustive.

**The vector generalizes, and is recorded here rather than only in a handoff:
any Status field that enumerates open items functions as a closure signal by
omission. A status line that drops an item is a silent close.** The reader
cannot distinguish *resolved and removed* from *not carried forward*, because
the field's form asserts a completeness its maintenance does not guarantee.
The single surviving glossary occurrence makes this harder to catch, not
easier — a reader grepping `Track G3` in v2.55 gets a hit and no disposition.

---

# §2. Track G4 — precondition NOT satisfied

**v2.55 §3.2's finding — *"Track G4 — precondition SATISFIED, not entered"* —
was WITHDRAWN by the correction banner added to that revision at
`d68bfda7`. This revision carries that withdrawal forward and states its
ground.**

**§5.71 limb 3 *is* the production-readiness assessment for G4.** The clause
whose function is to authorize G4 entry is one of the two never attempted.
**Track G4 is not enterable, and no revision has ever entered any track** —
every occurrence of the phrase in this register is negative.

## §2.1 The error's shape

**v2.55 §3.2 did not misread its source.** v2.47 §4.1's minimum genuinely is
Gate G3 clause 2, and clause 2 genuinely is met.

**Stated in the form that holds regardless of §3's deferral:** v2.55
discharged G3 against **v1.5's four requirements** (`F-AUTH-1_Fix_Plan_v1.5.md`
line 398, the `G3` row). **v2.37 §5.71's three limbs specify the same `G3` and
were not consulted.** Whether v1.5's G3 and §5.71's Track G3 are one gate with
two specifications or two gates is **deferred to §3 and is not relied on
here** — under every reading available, §5.71's limbs went unconsulted, and
limbs 1 and 3 are unattempted.

**This is the third instance of one premise standing for the whole, and the
first two are already written up in this register.**

1. **v2.52 §1.1** — a discharge ruling given against v2.47 §4.1's
   single-clause quotation of a four-clause gate: *"A ruling made against a
   partial premise does not reach the gate as written."*
2. **v2.55 §3.2** — Gate G3's satisfaction taken for Track G4's whole
   precondition, recorded in that revision's correction banner.
3. **v2.55 §3.1** — G3 discharged against one document's specification while
   another document's specification of the same G3 went unconsulted.

**The register named this shape, wrote it up as its own subject matter, and
reproduced it twice more.** Documenting a hazard class does not retire it.

---

# §3. The `Gate G<n>` / `Track G<n>` namespace — DEFERRED

**This section makes no ruling. It records what was found and why the question
is not decided here.**

**It is not cosmetic, and its absence from this revision must not be read as
though it were.**

**What was found.**

- **`Gate G3` is defined and has been since v2.47.** Five revisions —
  v2.47, v2.48, v2.49, v2.51, v2.52 — disambiguate it from `Track G3`
  explicitly, as *"F-AUTH-1's v1.5 six-gate sequence — 'Self-review passed,'
  the gate carrying the test minimum"* against *"the deployment track."*
- **`Gate G<n>` was never bound into v2.38 §2.2's lock**, which names only
  `CP12-G<n>` and `Track G<n>`.
- **`F-AUTH-1_Fix_Plan_v1.5.md` is on `main`** and carries the source table at
  lines 396–401: `G1` Pre-flight complete, `G2` Implementation complete, `G3`
  Self-review passed, **`G4` Dev verified + soak, `G5` Prod cutover, `G6`
  Post-deploy soak.**
- **v1.5's `G4`–`G6` are the same stages as `Track G4`–`Track G6`.** v2.37
  §5.71's forward chain reads *"G3 self-review → G4 dev verification + soak →
  G5 prod cutover → G6 post-deploy soak."* **The two schemes may be one
  sequence under two prefixes rather than two sequences.**
- **v1.5's `G3` row contains v2.52 §1's four clauses verbatim.** v2.52's table
  is a faithful transcription of the source, confirmed here.

**Three readings, none selected.**

1. **One object, two specifications** — v1.5's four requirements and §5.71's
   three limbs both specify one gate. What would then be owed is a
   reconciliation of the two specifications.
2. **Two objects** — as v2.47 through v2.52 assert. Their authors may have
   been distinguishing two references rather than two things.
3. **§5.71 redefines rather than implements v1.5's G3–G6.** **If reading 3
   holds, v2.55 discharged a superseded specification, and Gate G3's discharge
   returns to question.** That possibility is left open by this deferral and is
   not foreclosed by anything in this revision.

**Why deferred rather than ruled.** The question grew during this revision's
drafting from a two-scheme naming cleanup to **six schemes across three
keystones**, including `Gate 2.5` (F-Deploy-1, 81 occurrences) and F-Deploy-1's
Rule 7 window gates — namespaces F-AUTH-1 has no authority to bind. **A ruling
of that reach does not belong inside a restoration revision**, and the reading
that would reopen Gate G3 deserves its own basis and its own read of v1.5 §7.3
and §5.71 in full.

**No lock is extended here. v2.38 §2.2 stands unchanged.**

---

# PART II — EVIDENCE

# §4. `origin/main` ↔ `origin/dev` — measured, filed toward limb 3

**v2.38 §1.2 records that whether the divergence reflects content divergence
on the swept route files is not established, assigns per-file inspection to
Track G4, and names PE #14 as the owner.**

## §4.1 Method, and why the scope is broader than the swept set

**The comparison runs over all of `src/`, not the swept-set enumeration.**
v2.37 §5.4 enumerates CP1–CP11 as a *planning* listing; CP12 has no cluster
entry, only a count; the listing carries a corrected error
(`feedRelationshipRoutes.js`, v2.36 §5.4); and **§5.69 records that CP11
discovered ~22 files / ~130 handlers never enumerated in CP1–CP10.** The
post-hoc figure is a range — *"~95-100 unique route files."* **A comparison
scoped to that listing would inherit its known gap.** `src/` is strictly more
conservative and immune to it.

## §4.2 Result, stated exactly as measured

**Merge-base `880c8dd7` (2026-06-27).** At this revision's basis:

- **No commit in `origin/main..origin/dev` touches `src/routes` at all.**
- The only `src/` paths any of the 81 dev-only commits touch are
  `src/middleware/aiRateLimiter.js` and
  `src/migrations/20260718000000-create-episode-scripts-and-feed-posts.js`.
  **Both are byte-identical on both tips** — same blob hash.
- **Path-occurrence counts across the 81 dev-only commits** (not distinct
  paths): 46 `docs`, 6 `src`, 2 `scripts`, 2 `.gitignore`, 2 `.github`. The
  distinct `src/` paths are the two named above.
- **18 `src/routes` files differ between the two tips**, and `main` is **227
  commits ahead of the merge-base.**

**The claim, exactly: `origin/dev` holds no `src/` content that `origin/main`
lacks, at the cited basis.**

**That is not "main and dev agree."** The 18 differing route files are real
differences, all of them main advancing.

**One figure moved during this revision's own drafting.** The
commits-ahead count was **224** when first measured and is **227** at this
basis — `5a0bda60`, `3569162a` and `d68bfda7` landed in between. **A document
about figures going stale produced a stale figure inside a single session.**
Recorded because it is evidence for the method it argues for: every count here
was re-derived at the basis stamped above, not carried from the measurement
that produced them.

## §4.3 The ruling on v2.38 §1.2

**§4.2 measures. This section rules. The measurement discharges nothing by
itself** — this register's model throughout is that a condition being met is a
consequence and its closure is a ruling, and the two are not the same act.

**Ruling: v2.38 §1.2's per-file inspection obligation is DISCHARGED.** The
question it left open is answered on §4.2's evidence, which is git-derived,
reproducible at any basis, and broader in scope than what was owed.

**PE #14 was never the right owner.** PE #14 is v2.37 §11's *dev→main
fix-plan-document propagation* gap, remediated at `c3c5dbb4`. v2.38 hung an
unrelated live question on an entry whose own text reads as closed — so a
sweep closing PE #14 on its face would have taken the inspection obligation
with it. **The mis-assignment is recorded here; PE #14's remediated
disposition is unaffected; no PE is minted, because §4.2 answers the question
rather than re-homing it.** **A forward-pointer banner on PE #14 citing this
section is OWED and is not delivered here** — it cannot cite §4.3 until this
revision is on `main`.

**Does not discharge §5.71 limb 3.** A production-readiness assessment is
broader than a content-divergence check. §4 is **one input** to limb 3.

**Does not discharge v2.47 §4.1's soak. Both G4 obligations are stated here
together so neither survives alone.** §4.1 owes *dev verification plus a
2-hour soak*; v2.38 §1.2 owed a per-file inspection. **They were recorded in
two revisions that do not cite each other.** §4 touches the second and leaves
the first untouched. **Per v2.52 §2.1 the soak cannot discharge anything while
FD-65's issuance half is open** — *"A soak in which every request is
authenticated and every authenticated request is anonymous is a green soak."*
FD-65 is OPEN, P0.

**Gate G3 clause 2's coverage question is *not blocking*, not *satisfied*.**
v2.47 §4.1's bar is per-sub-form and clause 2 meets it; its stated reason is
per-handler — *"zero coverage over 95 changed handlers."* **FD-63 carries that
reason, and FD-63 is OPEN.**

---

# PART III — WHAT IS NOT DONE HERE

# §5. Limb 1 is not performed, and is not scheduled

**§5.71 limb 1 — the adjudicator-driven audit pass over CP1–CP12 cumulative
work, ~700 disposition judgments — is not attempted by this revision.** Not
deferred by implication, not partially begun, not scheduled.

**Stated explicitly rather than left to inference, because inference is how
this register loses obligations.** A revision that restores a status and files
evidence could be read as having advanced Track G3. **It has not.** Limb 1 is
its own revision and plausibly its own program.

---

# §6. Numeral disambiguation

**Descriptive. This section locks nothing and prohibits nothing** — see §3.

**Six `Gate`/`G` schemes are live in `docs/audit/`.** Three are `G<n>`-formed:

- **`CP12-G1` … `CP12-G6`** — CP12's §21 verification greps. Retrospective,
  closed. Locked at v2.38 §2.2.
- **`Track G3` … `Track G6`** — deployment stages. Forward, open. Locked at
  v2.38 §2.2.
- **`Gate G1` … `Gate G6`** — v1.5's six-gate sequence, `G3` = *"Self-review
  passed."* Coined v2.47. **Not in any lock; relationship to `Track G<n>`
  deferred (§3).**

Three are not `G<n>`-formed and are named here so a reader does not fold them
in:

- **`XK-3 Gate 1` … `XK-3 Gate 4`** — the Cross-Keystone Register's admission
  gates. **Measured: 37 XK-3-prefixed occurrences on `main`.**
- **`Gate 2.5` (F-Deploy-1)** — the canon credential-rotation gate. **Measured:
  81 occurrences.** F-AUTH-1 has no authority over this namespace.
- **F-Deploy-1's Rule 7 window gates** — *"Window structure (two-gate Rule 7):
  Gate 1 confirmed Step 0."* Likewise outside F-AUTH-1's authority.

**Bare-form counts, measured at this basis:** 136 total `Gate <n>` occurrences
in `docs/audit/*.md`; 37 preceded by `XK-3 `; **99 not.** The 99 include
F-Deploy-1's `Gate 2.5` (81) and the unprefixed tail of the construction
*"**XK-3 Gate 1 … Gate 4**"* itself. **No prohibition on bare `Gate <n>` is
issued here**; one would be violated at the moment of issue and would reach
into another keystone's register.

**Bare `G<n>` remains prohibited per v2.38 §2.2, unchanged.**

Other collisions carried forward:

- **"Limb" vs "clause."** Track G3 has **limbs** — §5.71, three. Gate G3 has
  **clauses** — v1.5 line 398 / v2.52 §1, four. Never interchanged.
- **§5.71's own `G1`–`G6`** are CP12 verification greps, per v2.46 §7.
- **PE #14 (F-AUTH-1 Track 8)** is document-propagation drift, not the
  route-file question (§4.3). **PE #63** lives in `Session_PE_Roster.md`, is
  session-scoped, and is unrelated to both.

# §7. What this revision does not establish

- **Not that Track G3 is discharged.** Two of three limbs are unattempted.
- **Not that Track G4 is entered, enterable, or scheduled.**
- **Not that the namespace question is cosmetic.** §3 defers a question that
  may reopen Gate G3's discharge. **A reader must not infer from this
  revision's shipping without a namespace ruling that none is needed.**
- **Not that Gate G3's discharge is beyond question.** It is not re-opened
  here and it is not placed beyond question here (§3 reading 3).
- **Not that the audit surface functions.** FD-63, FD-64, FD-65, FD-66 open.
- **Not that `origin/dev` is current.** It is stale at `dc18b83d`; §4's finding
  is one-directional and §4.2 states its scope on its face.
- **No FD minted, closed, or reprioritized. No XK. No PE. No lock extended. No
  schema changed. No deployed host contacted. Prod FROZEN.**

---

*Type: Restoration revision. Restores Track G3's status with its three §5.71
limbs, and Track G6 to the Status field (§1). Carries forward v2.55 §3.2's
withdrawal and records the error's shape as the third instance of one premise
standing for the whole (§2). **Records and DEFERS the `Gate G<n>` /
`Track G<n>` namespace question, including the reading under which Gate G3's
discharge would reopen (§3).** Files the main↔dev divergence measurement as
evidence toward limb 3 and rules v2.38 §1.2 DISCHARGED (§4). Does not perform
limb 1 (§5). Enters no track. Extends no lock. Ships no code. Mints nothing.
FD tail: FD-66. XK tail: XK-3. Track G3 OPEN. Track G4 not enterable. Track G5
BLOCKED. Track G6 not reached. Prod FROZEN. [skip-automerge]*
