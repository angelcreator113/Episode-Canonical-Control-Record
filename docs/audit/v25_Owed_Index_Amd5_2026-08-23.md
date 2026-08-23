| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 5** *Carries a cold session's derivations. Five standings, not three. Rules nothing. Mints nothing.* |
| --- |

# v25 Owed Index — Amendment 5

**Document version**

**AMENDMENT 5 to `v25_Owed_Index_2026-08-22.md`.** Carries the derivations of a
cold session that reconstructed register authority from nothing. **Adds
§E1–§E10. Rules on none of them.**

**Minted rather than carried in place**, per `F-Deploy-1_Fix_Plan_v1.49.md`.
Amendment 4 receives a pointer banner that carries nothing.

**Rules nothing about any finding. Mints nothing.** Ships no code. Changes no
gate, severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**. **These gate states are
carried as face reads and were not re-derived by this session — see §E1.**

**Basis:** `origin/main` at `4187f78d`, 2026-08-23.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

Carriage. Nine items, five standings, no ruling.

---

# §E0. Why this amendment exists

**A cold session derived register authority from a clean container and produced
nine items that reached no file.** At the moment this amendment was proposed, all
nine were transcript-only and the container had not died.

**That is §B3's condition exactly** — rulings and observations given in the
course of other work, accepted, unfiled. Amendment 4 §D4 counts six occurrences
across three sessions. **This is the seventh, and the largest by volume.**

**What surfaced it is recorded, not credited.** Nothing routed it. The executing
party raised the unfiled state in the course of answering a question about
session pacing — **incidental, prompted by something else, and arriving one day
after Amendment 4 ruled that this mechanism must not be relied upon.** It is
§C5's mechanism and §D2.1's class. **Recorded because §D3 requires that §C5
stand as written, and because a seventh occurrence arrested by the mechanism the
register has just declined to credit is evidence about the register, not about
the mechanism.** No procedure is proposed.

**Filed before drafting v25, not after.** The reads that produced these items are
cheap to repeat — this session reconstructed all of them cold in roughly an hour.
**The derivations are not.** They exist because a particular sequence of
instrument failures occurred in a particular order, and nothing reproduces that.

**Recorded as the reason, not as an aside**, per §0 of the index: an index that
does not say why it was needed reads as housekeeping.

---

# §E1. The authority derivation, with five standings

**Derived at `4187f78d`. This table is a snapshot of a derivation, not
authority**, per v24 Sec 1.

**The standing column is the substance of this section.** A prior draft carried
three standings — verified, face read, not read. **Reading the chain established
a fourth**, produced by §E4's failure: items reported verified in-session whose
raw output never reached the drafting party. **Review of that draft established a
fifth** (§E1.1).

| item | value at `4187f78d` | standing |
|---|---|---|
| F-AUTH-1 tail | `v2.68` | **verified — output seen** |
| F-Deploy-1 tail | `v1.49` | **verified — output seen** |
| F-Stats-1 tail | `v1.60` | **verified — output seen** |
| F-App-1 tail | `v1.1` | **verified — output seen** |
| Handoff tail | `v24`. **No `v25` handoff was ever added, in any commit reachable from any ref** | **verified — output seen** |
| `Cross_Keystone_Register.md` blob | `d277588c`, unchanged since v24 | **reported verified; output not relayed** |
| FD-69 retirement conditions (both) | discharged at v2.67 and the provenance draft §4 | **reported verified; output not relayed** |
| FD tail | FD-69, retired; next available FD-70 | **face read** |
| XK tail | XK-3 | **face read** |
| PE tail | PE #67 | **face read** |
| Limb 1 count | 129, superseding 25 | **face read** |
| Gate states; prod freeze | as stated in the version block | **face read** |
| PE #63 | — | **not read this session; no claim is made about its status** |

**The last row is stated as an omission, not an absence**, per §C1. No read was
performed, so no negative existence claim is available.

**The handoff row is stated with its method, per §C1**, because it is a negative
existence claim and the tree cannot answer it. `git log --all --diff-filter=A
--name-only` across every commit reachable from every ref, filtered
case-insensitively on `handoff_v25`, returned nothing; **the same instrument run
as a positive control returned `docs/audit/Prime_Studios_Audit_Handoff_v24.md`.**
**This forecloses §B1's retrievability case** — the document was not added and
later deleted; it was never added. **Without the control, no match is
indistinguishable from a defective pattern.**

**The two `output not relayed` rows are not doubted.** They are almost certainly
correct. They are separated because Sec 4.3 holds that a claim about a read is
not the read, and because collapsing them into the verified rows would erase the
only evidence §E4 produced.

## §E1.1 The fifth standing — the asymmetry runs both ways

**Every marked row above records something the drafting party did not witness.
That is only half the population.**

**Two sections are the mirror case: events witnessed only by the drafting
party**, which the executing party cannot witness or re-derive from any artifact.
In the first draft both were stated flat and unmarked.

> **Drafting-party-observed, unwitnessed by the executing party — a fifth
> standing, and the one the provenance table was structurally unable to see.**

- **§E3.1** carries a `Method:` line for a command the executing party never ran.
- **§E4's** account of how the failure was caught is testimony about the drafting
  party's own noticing. **The record contains direct evidence that it is
  inaccessible from outside:** the executing party attempted to characterise the
  catch, described it as a claim checked against its content, and was corrected.

**Recorded because the omission was the draft failing its own test in the one
place it did not look.** A provenance instrument built to catch what one party
missed will not mark what the other party alone saw, and the gap presents as a
complete table.

---

# §E2. §C2's prediction was confirmed, in an unrelated session

**§C2 states that a fresh container would very likely fail COMPLETENESS**, and
that 2026-08-23's PASS was container continuity rather than provisioning.

**A fresh container opened later the same day failed it.** POSITION passed;
`git rev-parse --is-shallow-repository` returned `true`. The clone was
unshallowed before any historical read was performed.

**This is a confirmed prediction, not a fresh observation**, and the distinction
is why it is recorded separately. §C2 was reasoning about a mechanism; the
mechanism then behaved as reasoned, in a session that did not know it was
testing anything.

**Consequence for v25's Sec 6:** the COMPLETENESS assertion is owed at the start
of every session, and a session that opens with a PASS owes an account of why it
passed.

---

# §E3. Two extensions to §C3

**§C3 stands as filed and is correct about what it describes.** These are
extensions, not corrections.

## §E3.1 §C3's fallback is defeated by the instrument item 2 names

**Standing: drafting-party-observed; unwitnessed by the executing party
(§E1.1).**

**§C3 concedes that Sec 6 item 2's family sort misses the chain, then offers a
consolation:** the files *sort adjacently by filename, so the chain is
discoverable — but only by someone already looking for it.*

**That family claim is sound and is not disturbed here.** A family-scoped sort —
prefix stripped, ordered on the version tuple — returns `v2.68`, `v1.49`,
`v1.60`, `v1.1`, `v24` correctly. Item 2 names its five families explicitly and
the instrument works within them.

**The fallback is what breaks.** A cold session ran item 2 as a directory-wide
numeric sort over `docs/audit/`, keyed on the first digit run in each filename.
**Every name contains `2026`**, so every entry tied and the sort returned an
arbitrary tail. The chain surfaced only when the sort was abandoned for a raw
full listing.

> **§C3's fallback discoverability rests on filename-alphabetical adjacency, and
> the numeric-keyed instrument item 2 actually names destroys it. The consolation
> is defeated by the procedure it consoles for.**

**Method:** PowerShell `Sort-Object` over `git ls-tree --name-only origin/main
docs/audit/`, keyed on the first digit run, tail 15.

## §E3.2 A stale checkout removes the chain from the tree

At the same basis, `git status -sb` reported local `main` at `6b0900be` (#1097),
**17 commits behind `origin/main`**, with the working branch cut clean from
`origin/main` and never pushed. Re-confirmed unchanged at the time of drafting.

**#1097 predates the entire chain.** An author who runs `git checkout main` on
that container and follows the documented procedure works in a tree where the
chain does not exist — so §E3.1's failure mode has nothing left to fail at.

**These stack and are independently remediable.** Naming the chain by path in
v25's Sec 6 addresses §E3.1. It does nothing for §E3.2, because a path cannot be
read out of a tree that does not contain the file.

---

# §E4. A layer §B2 does not cover

**§B2's two layers are classification and retrieval.** Both describe a blind spot
**inside the reading instrument** — a classifier that cannot resolve what a thing
is, a retriever that cannot reach whether it exists.

**This session produced a failure with the same signature and no such property.**

For several consecutive turns, tool results rendered to the executing party and
**did not reach the drafting party.** What arrived was coherent, well-reasoned
analysis of text the drafting party had never seen, presented as verbatim
delivery.

| | instrument | record | result | failure sits |
|---|---|---|---|---|
| classification | blind | reached | definite category | in the instrument |
| retrieval | blind | unreachable | definite absence | in the instrument |
| **this** | **sound** | **reached** | **correct** | **in the channel to the party who needed it** |

> **An unreceived read looks exactly like a received one, from the receiving
> end.**

**That is §D2.2's form relocated**, and it is why this is recorded beside §B2
rather than inside it. **Filing it as a retrieval instance would place it in a
taxonomy it does not belong to.**

**How it was caught, stated precisely. Standing: drafting-party-observed;
unwitnessed by the executing party (§E1.1).** Not by checking a delivery claim
against its content. **The drafting party was expecting a specific shape —
verbatim document text — and received a different one**, and only afterward
noticed that the message had claimed verbatim delivery. **The claim-checking was
reconstruction after the fact.**

**This is an unrouted noticing, not a check.** It is the §D2.1 class: nothing
routed it, and its rate and conditions are unknown. **Two messages carried the
defect before it fired. No drafting was performed against the unreceived spans**
— the defect was caught at the point of drafting, not after it, and this section
records a near-miss rather than a realized failure. **No procedure is proposed**,
per §D3 and §D5.

---

# §E5. §B1's third retrievability mechanism — demonstrated, not realized

**§B1 states retrievability as a property with no single command.** Its instances
are deleted records and a shallow boundary.

**This session demonstrates a third mechanism:** a record present on
`origin/main`, complete in the object graph, and **absent from the checkout** —
not deleted, not beyond a boundary, simply not fetched into the working tree.

**No instance was realized this session, and stating one would be false.** The
working checkout stood at `4187f78d`; POSITION passed; all six chain documents
were read out of it. **What is 17 commits behind is the local `main` branch,
which nobody checked out** (§E3.2). **The mechanism was present and latent
throughout.**

**Recorded as a mechanism rather than an instance**, because promoting a latent
mechanism to a realized failure is the overstatement §E4 was corrected for, and
repeating it in the section that follows would be the same breach.

**It is the mechanism most resembling normal operation.** Deletion and shallow
clones are anomalies. **A worktree behind its remote is the ordinary state of
every checkout between fetches**, which means this mechanism arms itself without
anything having gone wrong.

---

# §E6. v24 Sec 7's F-Ward obligation has no test

**v24 Sec 7 defers an obligation with a stated trigger:** no F-Ward artifact
exists, so there is nothing to amend yet, and *when one appears, Sec 6 must test
the XK-1 reference.*

**No item in v24's Sec 6 asks whether one has appeared.** The obligation fires
only if a reader of Sec 7 happens to notice it.

**It has not been missed.** Per §C1, with its method: `git ls-tree -r
--name-only origin/main` filtered case-insensitively on `f-ward` returns nothing.
**The read is tree-wide, not scoped to `docs/audit/`**, so an F-Ward artifact
landing anywhere in the repository would have surfaced. **Standing: verified —
output seen.**

**The mechanism is §C3's shape in miniature: an obligation discoverable only by
someone already looking for it.** Owed to v25's Sec 6 as a one-line item with a
stated default, per the `do not infer from` convention.

---

# §E7. FD-69's retirement rests on a condition whose trigger has not fired

**FD-69 was retired as duplicative of FD-65.** The retirement carried two
conditions; both are reported discharged (§E1).

**The second condition's wording is conditional on an event that has not
occurred.** It holds the retirement premature *if the deployment evidence is not
carried by the provenance instrument **when that instrument is filed***.

**`Production_State_Provenance_2026-08-22_DRAFT.md` is still DRAFT.** The
evidence is carried in it. **The instrument is arguably not yet filed, so the
condition has not been tested by the event it names.**

**Recorded, not ruled.** The underlying defect — a production variant taking
`groups` from the request body, permitting an unauthenticated caller to mint
ADMIN — is reported remediated at `e5215a66` / #1100. **What survives is a
retired P0 whose retirement stands on an unfired condition attached to an
unfiled draft.**

---

# §E8. FD-67 Class A may have been unblocked as a side effect

**FD-69 §5 held FD-67's Class A blocked**, on the reasoning that v2.66's
constitutive argument — that an authentication endpoint cannot require
authentication to reach it — presupposes the endpoint authenticates, and `/login`
did not.

**`/login` has since been disabled, and v2.67 closed FD-65 as CLOSED-BY-REMOVAL.**

**The premise that blocked Class A may therefore no longer hold.**

**This is raised as an open question and is not ruled.** v2.66 §4.1 was not read
by either party this session, and FD-69 §5 separately warns that Class A moves
only when it moves together.

**Recorded because the closure and the block live in different documents**, which
is the condition under which a consequence goes unnoticed indefinitely.

---

# §E9. Three carriage defects owed to v25, deliberately not amended here

**§2 of the index forbids amending a revision cited by more than one obligation
in service of one of them.** All three of the following sit in documents serving
other obligations. **None is amended by this amendment.** Each is owed to v25,
which supersedes v24's snapshot and checklist wholesale rather than editing them.

| defect | where | why not amended here |
|---|---|---|
| Sec 6 item 1 names `gh pr list` — a binary, not a capability | v24 Sec 6 | §C4's shape: an instruction resolving through one tool is not reproducible by a reader holding another. v24 is superseded by v25, not edited. |
| `~700 disposition judgments` withdrawn at v2.68 | v24 Sec 5.2(3) | The figure is superseded; **the scoping ruling attached to it — that limb 1 is its own program, not a grep or a ride-along — is not.** v25 must replace the number without discarding the ruling. |
| Tails stamped in five places | v24 banner, Sec 1 table, Sec 1 summary, Sec 8, footer | All five agree at v24's basis and all five are now stale. **v25 stamping five times is five chances at internal inconsistency**, and it is the first thing a reader cross-checks. |

**v24's stale FD-68 stamps are not an error.** Sec 1 states in advance that the
table is a snapshot of a derivation rather than authority. **They are that
statement's worked example**, and v25 should cite them as such rather than
merely comply.

---

# §E10. What this amendment does not do

- **Does not rule on any of §E1–§E9.** They are carried, not adjudicated.
- **Does not amend v24, `F-AUTH-1_Fix_Plan_v2.68.md`, or any revision named in
  §E9.** §2 is the reason.
- **Does not withdraw, weaken, or supersede §C3.** §E3 extends it; **§C3's family
  claim is affirmed, not disturbed.**
- **Does not propose a procedure for §E4 or for §E0's unrouted catch**, per §D3
  and §D5.
- **Does not rule on FD-67 Class A** (§E8) or on FD-69's retirement (§E7).
- **Does not read PE #63**, and makes no claim about its status.
- **Does not draft, prefigure, or constrain v25's authority table** beyond
  recording the derivation at this basis.
- Does not perform or size limb 1, advance Dimension 3, discharge limb 3, enter
  G4, or alter the freeze.
- **Mints nothing.**

**On §4 of the index.** §4 states that the index does not add a fourth
derivation. **That constraint binds the index at its own basis, not its
amendments** — Amendments 1 through 4 added §A, §B, §C and §D respectively.
Amendment 5 is on-convention. Stated because a reader reaching §4 will ask.

**On this amendment's own filename.** `v25_Owed_Index_Amd5_*` inherits §C3's
defect: it sits outside every sorted family and is invisible to Sec 6 item 2.
**This is deliberate.** Renaming for discoverability would strand the chain from
its own base document, and consistency is worth more than the sort. **Recorded so
that a reader meets the acknowledgement rather than the discovery.**

---

*Type: carriage only. Rules nothing, mints nothing, recommends nothing. No host,
AWS, database, or Cognito contact. No endpoint exercised. Prod FROZEN. Not
merged — v24 Sec 4.6.*
