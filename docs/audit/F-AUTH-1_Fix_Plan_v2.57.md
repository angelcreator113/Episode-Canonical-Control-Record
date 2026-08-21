| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Namespace ruling. **RULES `Gate G<n>` ≡ `Track G<n>` FOR n=3–6. CORRECTS G3's STATUS. ENTERS NO TRACK.*** |
| --- |

**Document version**

v2.57 — **NAMESPACE RULING. ENTERS NO TRACK. MINTS NOTHING. SHIPS NO CODE.**
Rules the `Gate G<n>` / `Track G<n>` question deferred at v2.56 §3: **the two
schemes are one sequence under two prefixes for n=3–6** (§1). Selects none of
v2.56 §3's three readings and states the reading the text supports (§1.3).
Rules **Gate G3's discharge INCOMPLETE, not VOID** — v2.55 §3.1 stands as to
what it covered and does not reach the gate as a whole (§2). Records that
**nothing downstream rested on the discharge** and gives the sweep (§2.2).
Locates the incompleteness at **v2.53 §4**, not v2.55 (§2.3). **Rules the
forward vocabulary** so the next author does not re-derive it (§3). Records
**the sentence that manufactured the collision** (§4). FD tail remains
**FD-66**; XK tail remains **XK-3**. Derived from git against `origin/main` at
`f214cece149a139522eef2b4653322a4596de71b`. No live database contact and no
request issued to any deployed host.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged.
**G3 (`Gate G3` ≡ `Track G3`) — PARTIALLY DISCHARGED.** v1.5 §6.1 clauses 1–4
discharged at v2.55 §3.1, standing. **§5.71 limbs 1 and 3 UNATTEMPTED**; limb 2
discharged at v2.42 §1.4. **The gate is not discharged as a whole and G3 is
OPEN** (§2). **G4 — precondition NOT satisfied, not enterable** (v2.56 §2,
unchanged). **G5 — BLOCKED** per v2.43 §4.2. **G6 — not reached. No revision
has entered any track. FD-65 — OPEN, P0.** FD-63, FD-64, FD-66 — open. Prod
remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# PART I — THE RULING

# §1. `Gate G<n>` and `Track G<n>` are one sequence, n=3–6

**v2.56 §3 deferred this question and named the read it required:** *"its own
basis and its own read of v1.5 §7.3 and §5.71 in full."* That read was
performed at this basis. **This section makes the ruling v2.56 withheld.**

## §1.1 The evidence — the two chains agree at every position, by name

`F-AUTH-1_Fix_Plan_v1.5.md` §6.1 and `F-AUTH-1_Fix_Plan_v2.37.md` §5.71's
**NEXT TRACK SEQUENCE**, transcribed:

| n | v1.5 §6.1 (lines 396–401) | §5.71 NEXT TRACK SEQUENCE |
|---|---|---|
| 3 | **Self-review passed** | **G3 self-review** |
| 4 | **Dev verified + soak** | **G4 dev verification + soak** |
| 5 | **Prod cutover** | **G5 prod cutover** |
| 6 | **Post-deploy soak** | **G6 post-deploy soak** |

**Same numbers, same names, same order, same program.** v2.56 §3 raised this
as a possibility — *"The two schemes may be one sequence under two prefixes
rather than two sequences"* — and left it unselected. **It is selected here.**

**Correction to a pointer in v2.56 §3.** That section names the required read
as *"v1.5 §7.3 and §5.71 in full."* **v1.5 §7.3 is not a G3 artifact.** v1.5 §7
opens *"Run this checklist on dev (during G4) and again on prod after G5
cutover"* — §7.3 is a **G4/G5** verification item. G3's specification is v1.5
§6.1 line 398, and the substance of its clauses 3 and 4 is at v1.5 §4.6. The
read performed here used §6.1, §4.6 and §9.9. **v2.56 §3's pointer is
corrected; its deferral and its findings are otherwise undisturbed.**

## §1.2 Neither specification subsumes the other — each has an orphan

**This is the decisive fact, and it is what rules out three of the four
readings on the table.**

| | Specification | Kind | Orphan obligation with no counterpart |
|---|---|---|---|
| **v1.5 §6.1** | four **clauses** | **states** — the column head is *"What must be true before proceeding"* | **Clause 4** — *"Frontend interceptor handles `AUTH_REQUIRED` and `AUTH_INVALID_TOKEN` as distinct paths."* §5.71 has no counterpart; §5.71 is expressly *"backend Step 3 sweep"* scope. |
| **v2.37 §5.71** | three **limbs** | **activities** — a pass, a verification, an assessment | **Limb 3** — *"production-readiness assessment for G4."* v1.5's G3 has no counterpart; v1.5's only readiness check is §6.2, which is **Pre-G5**, not pre-G4. |

**Each specification contains an obligation the other cannot account for.**

## §1.3 The ruling

**RULED: `Gate G<n>` and `Track G<n>` are co-referential for n=3–6. One
sequence, two prefixes. There are not two gates.**

**v2.56 §3 reading 2 — "two objects" — is REFUTED by the text.** v2.47 through
v2.52 were distinguishing **two references**, not two things. v2.56 §3 itself
allowed for this: *"Their authors may have been distinguishing two references
rather than two things."*

**None of v2.56 §3's three readings is adopted.** Each fails on §1.2's orphans:

- **Reading 3 — §5.71 redefines v1.5's G3–G6 — is REFUTED.** A redefinition
  replaces. If §5.71 replaced v1.5's G3, **clause 4's frontend-interceptor
  obligation would silently vanish from the program.** A backend closure
  marker has no scope to drop a frontend obligation, and no document records
  it as dropped. **The reading under which Gate G3's discharge would become
  VOID does not hold.**
- **Reading 1 — two specifications owed a reconciliation — is incomplete as
  stated.** It frames the two as competing. They are not: they are different
  *kinds* of document, and their content is complementary rather than
  conflicting.
- **A fourth reading — §5.71 as the *method* for satisfying v1.5's G3 — holds
  for limbs 1 and 2 and fails for limb 3.** It is recorded because it is
  correct about most of §5.71 and because it explains limb 1's existence.

**The ruling — the reading the text supports:**

> **§5.71 is a PARTIAL RE-SPECIFICATION of the same G3, adapted to the shape
> the program actually took, carrying one forward-looking limb that v1.5's G3
> never had. Both specifications are live. Neither supersedes the other.
> Neither is complete on its own. G3's full content is their union.**

**Why "adapted to the shape the program actually took" is not a gloss.** v1.5
clause 1 reads *"Every commit in **the PR** read end-to-end"*, and v1.5 §5.3
assumed a single PR. The program executed as **12 CPs, 38 cumulative pushes,
~95–100 route files, ~700–750 handlers** (§5.71 program metrics). **§5.71 limb
1 — *"adjudicator-driven audit pass over CP1–CP12 cumulative work"* — is
clause 1 rescaled to what the program became.** Limb 2 likewise re-expresses
coverage as greps. **The two specifications diverge because the program
outgrew the first one, not because anyone changed the gate.**

**This also explains the vocabulary split that five revisions maintained.**
v2.56 §6 records *"'Limb' vs 'clause' … **Never interchanged**"* as a collision
carried forward. **It is not a collision. Clauses and limbs are different
words because they name different kinds of thing — states versus activities —
in two documents of different kinds specifying one gate.** The discipline was
correct and its reason is now on the record.

## §1.4 What this ruling does NOT reach

**The ruling binds two schemes. Six are live** (v2.56 §6). **The other four are
untouched and remain outside F-AUTH-1's authority:**

- **`CP12-G1` … `CP12-G6`** — CP12's §21 verification greps. **Retrospective,
  closed, and NOT co-referential with either scheme ruled here.** See §4.
- **`XK-3 Gate 1` … `XK-3 Gate 4`** — the Cross-Keystone Register's admission
  gates. Another register's namespace.
- **`Gate 2.5` (F-Deploy-1)** — the canon credential-rotation gate.
- **F-Deploy-1's Rule 7 window gates.**

**A reader must not read this ruling as ruling "the namespace."** It rules the
relation between `Gate G<n>` and `Track G<n>` and nothing else. **v2.56 §3
deferred on the ground that the question had grown to six schemes across three
keystones; that ground stands for the four not ruled here.**

---

# §2. Gate G3's discharge — INCOMPLETE, not VOID

## §2.1 What the discharge covered, and what it does not reach

**v2.55 §3.1's ruling stands as to what it covered.** Its four-clause table is
a faithful reading of v1.5 §6.1 line 398, confirmed at this basis, and clause
4's live-evidence caveat at v2.55 §3.1 is undisturbed.

**Under §1.3, that discharge reaches part of G3, not G3.**

| G3's content | Disposition | Basis |
|---|---|---|
| v1.5 clause 1 — every commit read end-to-end | **Evidenced** | v2.47 §3; v2.55 §3.1 |
| v1.5 clause 2 — auth + unauth test per sub-form | **MET** | `436a8772`, `148698cb` |
| v1.5 clause 3 — F-Auth-5 `decision_logs` test | **MET** | `956697c0`, `16c47a5f` |
| v1.5 clause 4 — interceptor distinct paths | **MET** | `api.js:82`, `:98`; live evidence |
| §5.71 limb 1 — adjudicator-driven audit pass | **UNATTEMPTED** | v2.42 §2.3; v2.43 §4.3; v2.44 |
| §5.71 limb 2 — verify CP12-G1–G6 still hold | **DISCHARGED** | v2.42 §1.4 |
| §5.71 limb 3 — production-readiness assessment for G4 | **UNATTEMPTED** | v2.42 §2.3, §5; v2.43 §4.3; v2.44 |

**RULED: Gate G3's discharge is INCOMPLETE. It is not void, and it is not
re-opened.** Nothing ruled at v2.55 §3.1 is unwound. **G3 is OPEN, and what
remains open is limbs 1 and 3.**

**This is a materially better outcome than v2.56 §3 reading 3 anticipated.**
Reading 3 would have made the discharge void — made against a superseded
specification. **Incomplete is not void. A partial discharge is preserved; a
void one is not.**

## §2.2 Downstream reliance — swept, and there is none

**The question asked before this revision was drafted: did anything downstream
decide something on the strength of "Gate G3 DISCHARGED"?**

**Swept at this basis** across `docs/audit/*.md` for every affirmative
assertion that G3 is discharged or satisfied. **Result: four sites, and none
of them is load-bearing for anything else.**

| Site | What it does | Exposure |
|---|---|---|
| `v2.55` title, version block, §3, §3.1 | **Makes** the discharge | None — it is the ruling, not a reliance |
| `v2.55` §3.2 — *"Track G4 — precondition SATISFIED"* | **Relied on it** | **ALREADY WITHDRAWN** by banner at `d68bfda7`; carried forward at v2.56 §2 |
| `v2.56` Status field | **Carries** it forward | Superseded by this revision's Status field |
| `Audit Handoff v23` Sec 1 row, Sec 2 | **Carries** it forward | Bannered after `f214cece`; superseded by this ruling |

**Three sites examined and cleared explicitly:**

- **`v2.56` §4.3** — the ruling that v2.38 §1.2 is DISCHARGED — **rests on
  §4.2's git-derived divergence measurement, not on Gate G3.** It holds limb 3
  and clause 2 separate on its own face: *"Does not discharge §5.71 limb 3 …
  §4 is **one input** to limb 3."* **Unaffected.**
- **`FD-66`** carries nine `Gate G3` references and is **OPEN, P0**. All
  predate the discharge and rely on the gate being **open**, not discharged —
  *"Gate G3 remains NOT DISCHARGED, clause 3 unmet."* **Unaffected by this
  ruling.** Its clause 3 statements were already superseded by v2.55 §3 before
  this revision, and this revision does not disturb them further.
- **`v2.53` §4 and `v2.54`** predate the discharge and speak of it
  prospectively. **Unaffected as rulings** — but see §2.3.

**Nothing requires re-examination. The only thing that ever leaned on the
discharge was withdrawn two revisions ago.**

## §2.3 Where the incompleteness originates — v2.53 §4, not v2.55

**v2.55 did not err against its instruction.** v2.55 §3.1 names its governing
citation: **v2.53 §4**, quoted there as *"G3's four clauses become 1 evidenced,
2 met, 3 met, 4 met — at which point the discharge ruling withheld at v2.52
§1.1 can be re-made **against the full text**."*

**"The full text" meant v2.52 §1's full four-clause text — v1.5's
specification. It did not mean G3's full content.** v2.53 set the sufficiency
premise **two revisions before the discharge**, scoped it to one of the two
live specifications, and v2.55 executed it faithfully.

**This relocates the finding recorded at v2.56 §2.1 and at Audit Handoff v23
Sec 4.2 instance 3.** Both place the omission at v2.55 §3.1. **Both name the
wrong revision.**

**v2.55 executed a faithful instruction, and is not where this went wrong.**
v2.53 §4 named the sufficient premise. v2.55 §3.1 verified each of its four
named clauses against current `main`, **re-verified the one clause whose
evidence is live rather than historical** rather than inheriting v2.52's read,
recorded that clause 1 remaining at *evidenced* was the specified state and not
a shortfall, and then ruled. **Every step v2.55 took was correct against the
instruction it cited.** An author following v2.53 §4 to the letter arrives
exactly where v2.55 arrived, and would arrive there again.

**The omission is inherited, and it is v2.53's.** v2.53 defined sufficiency
against one of the two live specifications, **in the very phrase that promised
completeness.**

**The phrase "against the full text" is the mechanism.** It is a completeness
claim. It was true of the document it named and false of the gate it ruled.
**This is Audit Handoff v23 Sec 4.3's defect — a form asserting a completeness
its maintenance stopped guaranteeing — appearing at the level of a *citation*
rather than a value, an enumeration, or a definition. A fourth scale.**

---

# §3. Forward vocabulary — RULED, so it is not re-derived

**v2.56 §6 records six schemes and locks none. v2.38 §2.2 locks `CP12-G<n>`
and `Track G<n>` and never bound `Gate G<n>`. Five revisions' worth of
documents use `Track G3`. This section rules what the strings mean going
forward, because the alternative is that the next author re-derives the
disambiguation locally — which is what produced this question.**

**RULED, for `n = 3, 4, 5, 6`:**

1. **`Gate G<n>` and `Track G<n>` are co-referential.** Either string names the
   same gate. **Neither is prohibited and neither is retired.** Existing
   documents using either remain correct on their face and require no banner
   for this reason alone.
2. **`Gate G<n>` is bound into v2.38 §2.2's lock**, as a permitted alias of
   `Track G<n>`. **This is the only extension of that lock made here**, it is
   within F-AUTH-1's own namespace, and it prohibits nothing that was
   previously permitted. **Bare `G<n>` remains prohibited, unchanged.**
   **This item does what v2.56 §3 declined to do, and the ground of that
   declining is why it is available now.** v2.56 §3 deferred because the
   question *"grew … to six schemes across three keystones … namespaces
   F-AUTH-1 has no authority to bind."* **That ground covers the four external
   schemes and does not cover `Gate G<n>`**, which is F-AUTH-1's own and which
   §1.4 carves out from the four. **v2.56's judgment is not overridden; this
   item acts on the part its reason never reached, now that the read exists.**
   Recorded so that a reader comparing the two revisions does not find a
   deferral reversed without a reason.
3. **RETIRED: carrying `Gate G<n>` and `Track G<n>` as two status lines with
   independent dispositions.** One gate has one disposition. v2.56's Status
   field and Audit Handoff v23 Sec 1 and Sec 2 each carry *"Gate G3 —
   DISCHARGED"* alongside *"Track G3 — OPEN"*. **Those pairs are incoherent
   under this ruling and are superseded by this revision's Status field.**
4. **The canonical status form for G3 is a single line naming both
   specifications' states**, as this revision's Status field does.
5. **`clause` continues to mean v1.5 §6.1's four; `limb` continues to mean
   §5.71's three. The distinction is RETAINED and is now explained** (§1.3).
   **They are still never interchanged** — not because they name two objects,
   but because they name two specifications of one.

**For `n = 1, 2`: no co-reference is ruled.** v1.5 has `G1` (pre-flight) and
`G2` (implementation); **`Track G1` and `Track G2` do not exist** — §5.71's
chain begins at G3. `Gate G1` and `Gate G2` have no Track counterpart and this
ruling says nothing about them.

**`CP12-G1` … `CP12-G6` are NOT co-referential with either.** They are a third
scheme, retrospective and closed, and the collision between them and the
sequence ruled here is §4's subject.

---

# §4. The sentence that manufactured the collision

**v2.56 §6 records that *"§5.71's own `G1`–`G6` are CP12 verification greps,
per v2.46 §7."* That is true of §5.71's closure half. It is not the whole
story, and the remainder is where this question came from.**

**§5.71 carries both G-systems, and one sentence carries both at once:**

> *"(1) **G3 self-review** — adjudicator-driven audit pass over CP1–CP12
> cumulative work; verify **G1–G6** still hold post-merge-resolution +
> cleanup-delete; production-readiness assessment for **G4**."*

**Three different referents in one sentence.** The leading `G3` and the
trailing `G4` are **deployment stages**. The medial `G1–G6` are **CP12
verification greps** — the six enumerated in §5.71's own closure half, items
(1) through (6), where `G3` means *"§5.43 reference model coverage"* and `G4`
means *"F-AUTH-4 obsolescence: 0 true positives."*

**`G3` and `G4` each denote two different things inside one sentence, and the
sentence is the definition of a gate.** v2.37's line 6 does the same across one
paragraph: *"G1 0 optionalAuth-on-writes … G6 0 legacy alias residue"*
immediately followed by *"NEXT TRACK: G3 self-review → G4 dev verification +
soak → G5 prod cutover → G6 post-deploy soak."*

**RECORDED: this is the origin of the `Gate`/`Track` question.** v2.38 §2.2
locked `CP12-G<n>` and `Track G<n>` **because of collisions of this kind, and
never went back to the sentence that caused them.** The lock prevented new
occurrences and left the generating text unannotated, so every subsequent
author met the ambiguity at its source and disambiguated locally. **v2.47
through v2.52 each re-derived the distinction; none folded it back** — which is
Audit Handoff v23 Sec 4.3's third row, at the level of a source sentence.

**No banner is placed on v2.37 by this revision.** v2.37 is `LOCKED COMPLETE`
and its §5.71 is a correct closure marker whose numerals are correct in each
half taken alone. **What was missing is the reading that holds both halves at
once, and it is supplied here rather than by editing the source.**

---

# PART II — WHAT IS NOT DONE HERE

# §5. What this revision does not establish

- **Not that G3 is discharged.** Limbs 1 and 3 are unattempted. **G3 is OPEN.**
- **Not that G4 is entered, enterable, or scheduled.** v2.56 §2 stands
  unchanged: **limb 3 is the production-readiness assessment for G4**, and it
  is one of the two never attempted. **Nothing in this ruling advances G4.**
- **Not that limb 1 or limb 3 is any smaller than it was.** §1.3's ruling
  changes what G3 *is*, not what its open limbs *require*. **Limb 1 remains an
  adjudicator-driven pass over ~700–750 handlers across 12 CPs.**
- **Not a ruling on "the namespace."** Four of six schemes are untouched and
  named at §1.4. **`Gate 2.5`, `XK-3 Gate <n>`, and F-Deploy-1's Rule 7 window
  gates are outside F-AUTH-1's authority and are not bound here.**
- **Not a re-opening of v2.55 §3.1.** The discharge is incomplete, not void
  (§2.1). **No prior ruling is unwound by this revision.**
- **Not a correction to FD-63, FD-64, FD-65 or FD-66.** All remain open on
  their own terms; **FD-65 is OPEN and P0**.
- **Not a re-derivation of the other Audit Handoff v23 Sec 1 rows.** Only the
  F-AUTH-1 row was re-derived at this basis, and it is unchanged — the
  authority is `F-AUTH-1_Fix_Plan_v2.56.md`, now succeeded by this revision.
  **v23 Sec 6 item 2 remains PARTIALLY RUN** and is recorded as such in v23's
  correction banner.
- **Owed and not delivered here:** a forward-pointer banner on `PE #14` citing
  v2.56 §4.3, recorded as owed at v2.56 §4.3 and still owed. **A banner on
  `F-AUTH-1_Fix_Plan_v1.5.md`** recording that §6.1's heading reads *"The Seven
  Gates"* over a six-row table — resolved at v1.5 §9.9, where v1.4's `G1`–`G7`
  collapsed to six on the removal of the staging environment. **The heading is
  a survival of v1.4 and "six-gate sequence" is correct wherever it appears.**
- **No FD minted, closed, or reprioritized. No XK. No PE. No schema changed.
  No track entered. No deployed host contacted. Prod FROZEN.**

---

*Type: **Namespace ruling.** Rules `Gate G<n>` ≡ `Track G<n>` for **n=3–6
only** (§1) and rules the forward vocabulary (§3). **Rules the other four live
`Gate`/`G` schemes OUT OF SCOPE and binds none of them** — `CP12-G<n>`,
`XK-3 Gate <n>`, F-Deploy-1 `Gate 2.5`, F-Deploy-1 Rule 7 window gates (§1.4).
Rules **Gate G3's discharge INCOMPLETE, not VOID**; v2.55 §3.1 stands as to
what it covered (§2.1). Records the downstream-reliance sweep as **empty**
(§2.2) and relocates the omission's origin to **v2.53 §4** (§2.3). Records
§5.71's three-referent sentence as the collision's origin (§4). Extends v2.38
§2.2's lock **only** to admit `Gate G<n>` as an alias of `Track G<n>`. Enters
no track. Ships no code. Mints nothing. FD tail: FD-66. XK tail: XK-3.
**G3 — PARTIALLY DISCHARGED, OPEN.** G4 not enterable. G5 BLOCKED. G6 not
reached. Prod FROZEN. [skip-automerge]*
