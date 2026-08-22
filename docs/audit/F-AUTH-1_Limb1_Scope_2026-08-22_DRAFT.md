| **PRIME STUDIOS** **F-AUTH-1 SCOPING DOCUMENT** *Limb 1 scope. Rules nothing. Mints nothing. Recommends nothing.* |
| --- |

**Document version**

**DRAFT — LIMB 1 SCOPE.** Establishes what is and is not known about the size,
unit, and decomposability of §5.71 limb 1, the adjudicator-driven audit pass.
**Does not perform limb 1. Does not select a unit. Does not propose a size.**
Ships no code. Changes no gate, status, or disposition. Mints nothing — FD tail
remains **FD-68**; XK tail **XK-3**; PE tail **PE #67**. Limb 1 remains **OPEN**.
G3 limb 3 open; G4 not enterable; ASSESSMENT NOT COMPLETED.

Basis: `origin/main` at `cde71fbc`, derived live 2026-08-22.

**BASIS IS SHORT-LIVED.** PR #1090 is open and unmerged at this basis. Every
count below is a present-surface measurement and goes stale when anything
lands.

**Environment contact, stated in full.** Local file reads; `dotenv` loaded
`.env` into the probe process; per-router loading only — **`src/app` was never
required**, so **no database connection was initialized**, verified by absence.
**Redis was reached** (`127.0.0.1:6379`, refused) via a transitively required
service. No deployed host, no AWS call, no Cognito contact. **Prod FROZEN.**

---

# §1. What §5.71 actually says, and what it leaves open

Limb 1 is the qualitative half of §5.71's audit clause: an **adjudicator-driven
audit pass over CP1–CP12 cumulative work**, asking whether the disposition
judgments were correct — Tier 1 versus Tier 2 versus Tier 4, the 13 §5.21
mixed-tier calls, the PRESERVE decisions, the D20 `authenticateJWT` exclusions.

**§5.71 does not state the unit of judgment, the population, what a single
judgment consists of, or whether the pass is decomposable.** Every one of those
is required to know whether limb 1 is a session, a month, or a program.

# §2. The ~700 figure was never derived as a count of judgments

**It originates as a program metric and is relabelled two revisions later.**

| revision | wording |
|---|---|
| **v2.37** | *"~95–100 unique route files / **~700–750 handlers**"* — cumulative sweep scope at CP12 keystone closure |
| **v2.39** | *"~95–100 route files and ~700–750 handlers"* — carried unchanged |
| **v2.42 §2.3** | *"is roughly **700 handlers of adjudication**"* — still handler-denominated; range collapses to a point |
| **v2.43** | *"the qualitative audit pass over **~700 disposition judgments**"* — **unit changes from handlers to judgments** |
| v2.56 / v2.58 / v2.59 | carried as *"~700 disposition judgments"* |
| v2.57 | reverts to *"~700–750 handlers"* — **the register now carries both forms** |

**The substitution at v2.42→v2.43 asserts that one handler equals one
disposition judgment. No revision states that, and no revision derives it.**
It may be true. It is not established, and it is the assumption the whole size
estimate rests on.

**Recorded without irony intended:** v2.42 is the revision that introduced
*"adjudication"* into the phrase, and v2.42 §2.2 is where the register records
that an instrument transition *"is not marked"* and that reconciling across it
*"requires manual arithmetic that no revision had performed."* **The same
revision that named the defect carried an instance of it.**

# §3. The base figure does not reconcile against its own per-CP data

v2.37 reports per-CP handler counts alongside the ~700–750 cumulative. A crude
roll-up of those per-CP figures lands **substantially above 750** — on the order
of 1,100–1,200 depending on which CP7 figure is taken.

**This roll-up is not offered as a derivation and must not be quoted as one —
including in any summary of this document.** The per-CP figures mix
denominators: CP10 alone is reported three ways — *forecast 75*, *surface
enumeration ~108*, *close empirical ~120*. **Summing figures drawn from
different denominators asserts a measurement that was never taken.** Selecting
across them is exactly the manual arithmetic v2.42 §2.2 says no revision has
performed.

**A figure of that size, appearing in a document about a ~700 figure, will be
quoted. It should not be.** "1,100–1,200" is not a rival estimate of limb 1's
size and is not a correction to ~700–750. It is the arithmetic residue of an
unreconciled record.

**What is established is narrower and sufficient: ~700–750 is not obviously
reconcilable with the per-CP counts in the same document, and no revision has
reconciled it.** Whether the cumulative figure or the per-CP figures are right
is open.

# §4. The unit question, unresolved

"Disposition judgment" could denominate per **route declaration**, per
**handler function**, per **CP disposition already recorded**, per **file**, or
per **diff hunk**. The populations differ by close to an order of magnitude:

| candidate unit | present-surface size |
|---|---|
| route declarations | **1,394** |
| middleware + handler stack slots | **3,119** |
| route files carrying declarations | **136** |
| Tier dispositions already recorded by CP1–CP12 | **not derived here** |

**Several judgments in §5.71's own list are not per-handler at all.** The 13
§5.21 mixed-tier calls are per-file. The D20 `authenticateJWT` exclusions are
per-mount. A batch of Tier 4 catalog GETs sharing one rationale comment is
plausibly one judgment across many handlers. **A per-handler denominator is one
candidate among several, and it is the one currently assumed.**

# §5. Present-surface census — one instrument, 1,394 declarations

Per-router loading, all methods, single walk, duplicates suppressed by route
identity:

| | |
|---|---|
| route files scanned | 142 |
| routers loaded | 140 (1 load failure) |
| files carrying ≥1 declaration | **136** |
| **route declarations** | **1,394** |
| POST | 608 |
| GET | 504 |
| PUT | 119 |
| DELETE | 114 |
| PATCH | 49 |
| middleware + handler stack slots | 3,119 |

**Internal consistency check:** GET = 504 matches the independent read-side walk
in the FD-67 scoping exactly.

## §5.1 Two instruments agree exactly on reads and disagree by 22 on writes

**This is the first occasion on which two independently built instruments could
be compared on the same quantity. They do not close.**

| quantity | per-router walk (§5) | app-composition walk (FD-67 scoping) |
|---|---|---|
| GET declarations | **504** | **504** — exact agreement |
| write declarations | **890** (608+119+114+49) | **912** |

**Exact agreement on reads alongside a 22-declaration disagreement on writes is
more informative than either result alone.** Random divergence would not spare
one method class entirely. **The pattern indicates a structural difference
between the loading strategies, not measurement noise** — most plausibly
routers reachable through app-level mounting but not through per-router
`require`, or the converse. **Which, is not established here, and no estimate
of the gap's composition is offered.**

**This bears directly on the FD-67 filing (PR #1090) and its closing note.**
That document's write-side figure of **9 mount-only writes** was flagged there
as resting on an argument rather than on a second instrument — the argument
being that the `asyncHandler` opacity defect cannot reach a middleware-chain
fact. That argument stands. **But the 9 was derived from the 912 walk, and the
912 is now one of two disagreeing figures. The write-side 9 therefore has a
second, independent reason to be treated as uninstrumented, and it is a reason
that did not exist when #1090 was written.**

**Neither figure is corrected here.** #1090's counts stand at their own stated
basis. What changes is that the confirmation gap named in its closing note is
now wider than that note describes.

# §6. The population is not the present surface

**Limb 1's population is CP1–CP12 cumulative work — what the sweep touched.
That is a historical set. §5 measures the present surface. They are not the
same set, and substituting one for the other is precisely the class of error
this document exists to catch.**

Two facts show the gap is real rather than theoretical. v2.37 records the sweep
as **~95–100 route files**; the present surface carries declarations in **136**.
v2.37 records **~700–750 handlers**; the present surface carries **1,394
declarations**. The surface has changed since CP12 closure, by development that
limb 1's clause does not mention.

**So §5.71 admits two readings and does not choose:**

1. **Historical:** adjudicate the dispositions CP1–CP12 actually made. Population
   is fixed, recoverable only from the CP commit range, and does not grow.
2. **Present:** adjudicate the current route surface against Tier disposition.
   Population is 1,394 today and grows with development.

**These are different programs with different completion conditions.** Reading 1
can finish. Reading 2 is only finishable against a frozen surface.

**Deriving the historical population is a bounded, mechanical, unperformed
task:** enumerate declarations touched across the CP1–CP12 commit range. It
requires git history rather than the working tree, and **it was not attempted
here.**

# §7. What one judgment consists of, unresolved

Two readings, differing in cost per unit by a wide margin:

1. **Review the recorded disposition.** Read what CP-n ruled for a declaration
   and assess whether that ruling was correct on its face.
2. **Re-derive the disposition.** Establish the declaration's effective auth
   posture and independently determine the Tier it should carry, then compare.

**v2.61 §4.3 points at the second:** the corrected procedure must inspect
effective middleware of every write declaration *and tie each to its Tier
disposition*. **Reading 2 is materially more expensive and is the reading the
register's own procedure language implies. Neither is ruled.**

# §8. Decomposability, unresolved

§5.71 says *"cumulative work."* That may mean the pass must be performed as one
unit, or only that its scope accumulates across CPs. **The difference decides
whether limb 1 can produce partial results that hold.**

If decomposable — per-CP, per-file, or per-router — limb 1 becomes a series of
bounded passes with durable partial results, and can be started without being
finished. If not, it is a single indivisible program. **Nothing in §5.71
settles this, and no revision has raised it.**

# §9. Known edges

1. **`src/routes/templateStudio.js` fails to load** (`"url" argument must be of
   type string`). Its declarations are **uncounted** in §5.
2. **Declared routers, not mounted routers.** 140 routers loaded from 142 files;
   `app.js` names 134 route requires. **Unreconciled.**
3. **The 890/912 write discrepancy at §5.1 is unexplained**, and its
   composition is not estimated.
4. **The §3 roll-up is crude** and mixes reported denominators. It is evidence
   of non-reconciliation, **not a count.**
5. Duplicate mounting was not checked.
6. **Basis `cde71fbc` with PR #1090 open.** Every count goes stale on the next
   merge.

**No estimate is offered of how far these edges could move any figure above.**

# §10. What this document does not do

- **Does not perform limb 1**, or any Tier adjudication.
- **Does not select a unit, a population reading, a judgment definition, or a
  decomposition. Does not propose a size, and does not recommend one.**
- Does not correct v2.37, v2.42, v2.43, or any revision carrying ~700. **§2 is
  a provenance finding, not an amendment**; corrections are owed by whichever
  revision rules the unit.
- Does not derive the historical CP1–CP12 population (§6).
- Does not mint, close, or reopen anything. Does not change any gate. Does not
  advance Dimension 3, discharge limb 3, or enter G4.

# §11. The questions

Limb 1 cannot be sized until four things are ruled, and a fifth follows from
the first. **None is an infrastructure question. None needs a gate opened.**
That is the substantive result of this document: **limb 1 has been the item
that could not move even with every gate open, and the obstruction is
definitional, not one of authorization or access.**

1. **Unit** — per declaration, per handler, per recorded CP disposition, per
   file, or per mount? §4.
2. **Population** — the historical CP1–CP12 swept set, or the present surface?
   §6. If historical, deriving it is bounded, mechanical, and unperformed.
3. **Judgment** — review the recorded disposition, or re-derive it? §7. v2.61
   §4.3's language implies the second.
4. **Decomposability** — one indivisible pass, or a series with durable partial
   results? §8.

**5. Does ~700 survive at all?** §2 raises this and this document does not
answer it. **It is a possible outcome of ruling question 1, not a footnote to
it.** If the unit is ruled and ~700–750 was a count of handlers touched all
along, then **the figure is not a program size and never was**, and
**withdrawing it is a legitimate answer rather than a failure to produce one.**

**The analogue is PE #63's retirement.** There, a metric was true about what it
measured and false about what it was used for, and the disposition was to
retire it rather than to re-measure it. **~700 is in the same position: sound
as a sweep metric at v2.37, unsound as a work estimate from v2.43 forward.**
Retirement would not leave limb 1 unsized — limb 1 is unsized now, and has
been since the relabel. It would remove a figure that makes it look sized.

It is currently carried in two incompatible forms across live revisions, so
whichever way this is ruled, **the register cannot leave both standing.**

---

*Type: scoping only. Rules nothing, mints nothing, recommends nothing. No host,
AWS, database, or Cognito contact. Prod FROZEN.*
