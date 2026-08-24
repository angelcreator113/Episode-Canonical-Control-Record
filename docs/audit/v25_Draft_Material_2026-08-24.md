| **PRIME STUDIOS** **V25 DRAFT MATERIAL** *Not a chain link. v25 absorbs this and it is void on v25 landing.* |
| --- |

# v25 — Draft Material

**Document version**

**DRAFT MATERIAL FOR v25.** Carries **Sec 0, Sec 1, Sec 2, Sec 3, Sec 4, Sec 5,
and Sec 6.** Sections are enumerated and no range is stated — three consecutive
documents have misstated their own contents by range in their own version block
(Sec 2.1), and this is the fourth document in that position.

**This is not an amendment to `v25_Owed_Index_2026-08-22.md` and does not join
its chain.** Reaching for Amendment 7 is the v25 signal. The material below is
v25's own Sec 4 case material and v25's own Sec 6 item 1 — v25 content existing
before v25 does. Filing it as a chain link would strand it behind §C3
permanently; filing it as draft material makes it transient by construction.

**Rules nothing. Mints nothing. Recommends nothing.** Ships no code. Changes no
gate, finding, severity, owner, or disposition. **No tail is stamped here** —
FD, XK and PE tails derive at v25's basis, not at this one. Limb 1 **OPEN**;
limb 3 open; G4 not enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**.
**These gate states are carried as face reads and were not re-derived here.**

**Basis:** `origin/main` at `7c508189`, 2026-08-24. Asserted, not narrated:

```
$ git rev-parse HEAD
7c508189c369a5a384d55cc2bea371d9ebec56f3
$ git rev-parse origin/main
7c508189c369a5a384d55cc2bea371d9ebec56f3
$ git rev-parse --is-shallow-repository
false
```

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Internal attribution is stated, following §F0's precedent.** The findings in
Sec 2 were derived by the executing party; the rulings in Sec 3 and the
authorization to file are Evoni's. §E1.1 established that unmarked provenance is
the failure a provenance instrument cannot see.

**Status**

Draft material. Void on absorption — see Sec 0.

---

# Sec 0. What this is, and when it is void

**This document exists because a session produced v25 content before v25
existed, and §B3 holds that a ruling given in the course of other work is filed
at the moment it is given or it is transcript-only.**

Amendment 4 §D4 counts the sixth occurrence of that condition; Amendment 5 §E0
the seventh; Amendment 6 §F0 would have been the eighth and was filed
immediately, alone, to prevent it. **The material below would have been the
eighth, and is larger by volume than §E0's nine items.** It is filed for the
same reason and by the same method.

## Sec 0.1 The absorption condition

> **v25 absorbs this document. On v25 landing, this document is VOID and should
> be deleted or marked superseded in the same commit that lands v25.**

**Stated in-band as the condition of its own authorization.** Two register facts
already rest on unfiled drafts (Sec 5). This is a third, authorized knowingly,
and a draft that carries its own retirement instruction is bounded where one
that does not becomes §E7's shape in a year.

**Nothing here is intended to survive as an independent authority.** Sec 1 is
v25's Sec 6 header rules and item 1. Sec 2 and Sec 3 are v25's Sec 4 case
material. Sec 4 extends §E1's standings vocabulary. Sec 5 is docket.

## Sec 0.2 Filename

`v25_Draft_Material_*` sits outside every family named by v24 Sec 6 item 2 and
is invisible to that sort (§C3), deliberately, for the reason §E10 and §F5 give.
**The absorption condition bounds the exposure**: the document is not intended
to be discovered by a later authority derivation, because it is not intended to
outlive v25.

---

# Sec 1. v25 Sec 6 — header rules and item 1

**Drafted and closed this session. Reproduced for v25's author to lift.**

## Sec 1.1 Header rules (govern all of v25 Sec 6)

> **H1 — A precondition asserted in prose is not asserted.** Paste the command
> line and its raw output for every check, tail stamp, and negative existence
> claim in this section.
>
> **H2 — Read `origin/main` explicitly.** Regardless of what POSITION returned,
> any read that must reflect `origin/main` uses `git show origin/main:path`.
> PASS guarantees you are not reading content **older** than `origin/main`; it
> does not guarantee you are reading `origin/main`, because ahead-commits shadow
> it with a clean tree throughout (Amd6 §F1 clause 2 — the load-bearing half).

## Sec 1.2 Item 1

> **1. Establish position before any local read.** Class: **perennial** —
> discharge does not close; re-run at every basis.
>
> *Stated as one item because these are properties of a single readiness
> question. Splitting them invites running the first and treating the tree as
> cleared (§A1).* **The clause order is execution order and is forced, not
> stylistic**, except where marked inherited.
>
> **(a)** `git fetch origin --prune`. **Read its output.** Prune is silent when
> it removes nothing and prints `- [deleted]` when it does. A remote-tracking
> ref surviving a deleted or unborn branch answers *present* for something
> absent (§A3). An author who runs this without reading it gets the hygiene and
> misses the finding.
>
> **(b)** `git log -1 origin/main`. **Do not carry a prior handoff's basis as an
> expected answer.**
>
> **(c) Enumerate open pull requests** — purpose: unmerged work bearing on this
> basis. **Placement inherited from v24 item 1, not forced** — this is an API
> read and nothing downstream in this item depends on it; a later author may
> move it. **By whatever capability this environment provides**; `gh` is one
> such capability and may be absent, and a GitHub API read satisfies this
> identically. An instruction resolving through exactly one tool is not
> reproducible by a reader holding another (§C4; §E9 defect 1). **State the
> method inline.** An empty result is a negative existence claim and is governed
> by §C1. **If no capability is available, record NOT PERFORMED** — an
> unperformed enumeration is an omission, not an absence (§E1's PE #63 row is
> the model).
>
> **(d) POSITION.** `git rev-parse HEAD`; `git rev-parse origin/main`. Point
> lookups, depth-independent, safe before COMPLETENESS.
>
> **(e) COMPLETENESS.** `git rev-parse --is-shallow-repository`. If `true`,
> `git fetch --unshallow` before any ancestry, range, or history read, **then
> re-assert and paste the result** — the post-unshallow state is itself a
> precondition and H1 governs it. If `false`, **state why it is false** — a pass
> is a property of container continuity, not of provisioning (§C2, confirmed
> §E2). Tree reads via `git show origin/main:path` are depth-independent; graph
> reads are not.
>
> **(f) On POSITION FAIL only, and only after (e) reads `false`:**
> `git rev-list --left-right --count origin/main...HEAD`. Nonzero *behind* is
> the stale-worktree hazard. Nonzero *ahead* with zero *behind* is ordinary
> unmerged work, and the prescribed response to FAIL — bringing the worktree to
> `origin/main` — **discards it** (§F1 clause 1; §F2).
>
> > **This is a range read and must not precede (e).** The shallow-graph
> > behavior of `git rev-list --left-right --count` was established by
> > construction — a synthetic ten-commit repository with a branch diverging at
> > c2, truth `8 behind / 2 ahead`, cloned at depth 2 and depth 1, returning
> > `2 2` and `1 1` respectively, exit 0, no warning. **Magnitude, not sign:**
> > neither figure could be driven to zero, and cannot be, since HEAD and
> > `origin/main`'s tip are both always present in the grafted graph. **Not
> > observed on this repository.** Standing: **demonstrated against a
> > constructed control** (Sec 4), 2026-08-24, first recorded here; case at
> > Sec 2.4. §F2's procedure keys off which number is nonzero and how large.
>
> **(g) RETRIEVABILITY.** A property to establish, not a command to run; no
> discharging invocation exists (§B4). The mechanism most resembling normal
> operation: a record present on `origin/main` and complete in the object graph,
> **absent from the checkout** — *a worktree behind its remote is the ordinary
> state of every checkout between fetches* (§E5). Live instance: local `main` at
> `6b0900be` (#1097) predates the entire owed-index chain (§E3.2), so
> `git checkout main` in such a container yields a tree with no chain in it.
> **Mitigated by header rule H2.**

## Sec 1.3 Item 10 splits

**Ruled this session.** v24 Sec 6 item 10's read is permanently discharged and
its disposition is permanently open. **The two-class scheme cannot label one
item that is both**, so item 10 becomes two entries in v25's Sec 6.

**The split is grounded on §C3's shape, not on destruction.** v24 supersedes
*"v23 Sec 1, Sec 2, Sec 6, and the tail/status portions of Sec 7"*, and states
twice that analysis sections and correction banners stand (Sec 3.1 below).
v24's completion banner therefore survives v25. **What fails is reachability:** a
reader handed *"v25's Sec 6 supersedes v24's"* has no pointer back to a banner on
the superseded document. Discoverable only by someone already looking for it.

- **Closed entry, one-time.** Carries the finding at `6b0900be` sourced to
  `Route_Shadowing_Survey_2026-08-22_DRAFT.md`: **six shadowed declarations in
  four files, five previously unknown, two distinct mechanisms** — an exact
  duplicate `(method, path)`, and a literal path declared after a parameterized
  path that matches it. **All six dead.** `next('route')` occurs **zero times in
  all of `src/`**. **No shadowed declaration carries authentication or ownership
  its live twin lacks.** Method for `/search` specifically is at
  `F-AUTH-1_Fix_Plan_v2.45.md` Banner 1, in more detail than v24 carries.
- **Open entry, gated.** **Whether a class of six dead request-path routes
  warrants an FD.** Derived from the survey, not inherited from v24's one-route
  framing. Remains open under limb 1 for that disposition.
- **v25 must state that v24's banner is scope-stale** (Sec 2.1). The banner
  survives supersession, so v25 is the only place that correction can live.

## Sec 1.4 Overage justification, for v25's Sec 6 foot

> **v24 justified its overage in aggregate; v25 justifies per item. That is a
> stricture v25 adopts, not one v24 imposed.**

---

# Sec 2. Findings this session produced that the chain does not carry

## Sec 2.1 Banner assertion decay — a class, not three instances

> **A banner asserts a fact about a document — its own or a neighbour's — and
> has no mechanism to re-check that fact. The document it sits on has no
> mechanism to notice it has been overtaken.**

**A surviving banner is worse than a destroyed one, because it reads as
current.**

| # | banner | asserted | overtaken by | gap |
|---|---|---|---|---|
| 1 | v24 completion banner, `3f2e20e1` | *"FD tail remains **FD-68**"* | FD-69 minted and retired at `a5dfe467` (#1102) | 5h51m, same day |
| 2 | v24 completion banner, `3f2e20e1` | route-order hazard is **one** route | `Route_Shadowing_Survey_2026-08-22_DRAFT.md` + v2.45 Banner 2, `6b0900be` (#1097): **six** in four files | 3h11m, same day |
| 3 | Amd4 and Amd6 pointer banners | *"Amendment 5 adds **§E1–§E10**"* | §E0 exists and both banners cite it by name | born wrong, not overtaken |

**Instance 3 differs in origin and is recorded as a variation, not forced into
the same shape.** Instances 1 and 2 were true when written and were overtaken.
Instance 3 was never true: the error originates in **Amendment 5's own version
block** — *"Adds §E1–§E10"* — and Amd4's and Amd6's banners inherit it
faithfully. Amendment 6 repeats it (*"Adds §F1–§F5"* while carrying §F0). **The
propagation mechanism is identical; the origin is not.**

**Mechanism for instance 3, stated because it is benign and therefore likely to
recur:** the chain adopted a `§X0` *"why this exists"* convention beginning at
Amendment 5. The range notation predates the convention and was never widened.
The chain simultaneously depends on §E0 and denies it.

**Owed to v25:** enumerate sections in the version block; never state a range.
Sec 6 line, not a footnote.

**Method for instance 2.** Wrap-tolerant read, newlines stripped before
matching:

```
$ git log -S'COMPLETION BANNER — SEC 6 ITEM 10' -- docs/audit/Prime_Studios_Audit_Handoff_v24.md
2026-08-22 07:43:19 -0400 3f2e20e1 docs(audit): verify compositions.js route order at runtime [skip-automerge] (#1084)
$ git log -S'CORRECTION BANNER 2' -- docs/audit/F-AUTH-1_Fix_Plan_v2.45.md
2026-08-22 10:54:41 -0400 6b0900be docs(audit): route shadowing survey - a class of six, not one [skip-automerge] (#1097)
$ git show origin/main:docs/audit/Prime_Studios_Audit_Handoff_v24.md | tr '\n' ' ' \
    | grep -oiE '.{50}(shadow|route.order|Route_Shadowing).{50}'
```

The scan returns only v24's own banner text and its Sec 5.1 / Sec 6 item-10
lines. **No reference to the survey, the class of six, or the second mechanism
exists anywhere in v24.**

## Sec 2.2 §E9 defect (3)'s enumeration is wrong; its substance is confirmed

**§E9 names five tail-stamp sites in v24 — banner, Sec 1 table, Sec 1 summary,
Sec 8, footer. Four carry register-tail stamps. Sec 8 carries none.**

Sec 8's only FD reference is *"Does not choose PE #65's topology branch or
reclassify FD-68"* — a finding reference, not a tail assertion. **There is no
reading on which the list is correct:** counting the Sec 1 table as one site
gives four, counting its three rows separately gives six, and neither includes
Sec 8.

**The defect survives its bad count and is arguably strengthened.** v24 Sec 1's
F-Stats-1 row reads *"FD tail on its face FD-62"* eight lines above the summary's
*"Register tails at this basis: FD-68"*, reconciled only by the words *on its
face*. **That is §E9's own point, live inside the document it describes.**

**Owed to v25:** file defect (3) as substance confirmed, enumeration corrected to
four, **Sec 8 struck**. The corrected count must not read as the defect weakening.

**Method.** Wrap-tolerant enumeration of every occurrence of *tail* in v24:

```
$ git show origin/main:docs/audit/Prime_Studios_Audit_Handoff_v24.md | tr '\n' ' ' \
    | grep -oiE '.{60}tail.{60}'
```

Two of the eight hits are not tail stamps: *"the tail/status portions of Sec 7"*
is a supersession scope, and *"F-App-1 v1.1 remains the numeric tail"* is a
revision tail, not FD/XK/PE.

## Sec 2.3 A precondition reported PASS while the property was false

**On 2026-08-24 a COMPLETENESS PASS was reported in-session with
`is-shallow false` as its stated reading, on a clone that was shallow, with a
narrated cause — an earlier `git fetch --unshallow` in the same container —
that the filesystem contradicts.**

`.git/` subdirectories date to 2026-08-22 15:17 UTC; the reflog shows a checkout
to `main` at 15:17:05 and nothing until 2026-08-24 02:12:50; **`.git/shallow`
cannot return once removed.** No unshallow occurred in this container before
02:19 on 2026-08-24.

**This is not §C2's case and not a completeness finding at all.** §C2 explains
why a fresh container fails; §E2 records a fresh container failing. **Neither
explains a check reported passing while the property was false.** The failure is
in **reporting**, not in the check and not in the clone.

**It is also the second of two claims sourced this session to a remembered action
the record does not support** — the first being the narrated unshallow, the
second an assertion that no such PASS had been reported. **Both were
reconstructions. §C1 holds that a claim travels with its method or it is not
checkable; narration is not a method.**

**Remedy, and it is narrow.** Header rule H1. `git rev-parse
--is-shallow-repository` prints `true` or `false`; pasting it is a check that
fires without a second party. **This converts one failure mode — precondition
misreporting — from §D2.1's event class to a routed mechanism. It touches
nothing else.** §D3 stands: no procedure presumes the second party, and this
does not reach ruling-in-passing, deferral, or partial reads.

**How it was caught is recorded, not credited.** A second party pursuing a
regression that did not exist. **Unrouted, incidental, §D2.1's class.** It must
not be counted as evidence the mechanism works — §D2.2 forbids it, and the
population it would join excludes every instance where a narrated PASS was read
and passed over.

## Sec 2.4 The left-right count is unreliable on a shallow graph

**Established by construction.** Synthetic ten-commit repository, branch
diverging at c2 with two commits. Truth from the full repository:

```
$ git rev-list --left-right --count main...feat
8	2
```

Same measurement from a depth-2 and a depth-1 clone of the same source:

```
$ git rev-parse --is-shallow-repository
true
$ git rev-list --left-right --count origin/main...HEAD
2	2                          # depth 2

$ git rev-parse --is-shallow-repository
true
$ git rev-list --left-right --count origin/main...HEAD
1	1                          # depth 1
```

**Exit 0 both times. No warning, no error, a clean plausible number.**

**Magnitude, not sign.** Neither figure could be driven to zero, and cannot be:
HEAD and `origin/main`'s tip are both always present in the grafted graph, so
each side is at least 1 whenever they differ. **The count will not falsely report
`behind 0` and bless a stale worktree, nor falsely report `ahead 0` and invite
discarding real work.**

**Not observed on this repository.** The demonstration is against a constructed
control and establishes git's behavior, not a fact about this register.

**Why it matters anyway.** §A1 requires COMPLETENESS before any ancestry, range,
or history read. §F1 clause 1 introduced a range read *into the POSITION step*,
eighteen days after §A1 was written. **Neither document is wrong; the composition
is** — and a naive Sec 6 item 1 that follows §A1's clause order while adopting
§F1's discriminator violates §A1 on its face. Sec 1.2 (f) orders around it.

**This is §2 of the index in a new place:** a rule amended for one obligation,
landing inside another.

## Sec 2.5 The handoff row now holds two independent derivations

**§E1's handoff row — *"No `v25` handoff was ever added, in any commit reachable
from any ref"* — was re-derived independently at `7c508189`, one basis later,
with the same result and the same control structure.**

```
$ git log --all --oneline --name-only --diff-filter=A | grep -iE 'handoff.*v25|v25.*handoff'
                                                    # (no output)
$ git log --all --oneline --diff-filter=A -- 'docs/audit/Prime_Studios_Audit_Handoff_v2*.md'
36f11156 Handoff v24 (#1082)
f214cece Handoff v23 (#1069)
0f400313 Handoff v23
5ed3a839 Handoff v22 (#1000)
baa2f10d handoff v21 (#998)
b5789ca9 handoff v20 (#786)
```

Positive control returns six additions across five versions; the negative control
(`v99`) returns nothing. **Run post-`--unshallow`, wrap-tolerant, across all refs
and full history.**

**Recorded because it is the only row in the chain with two independent
derivations at different bases**, which is a stronger standing than either alone
and which §E1's vocabulary has no name for. **It does not generalize:** the other
`verified — output seen` rows in §E1 remain verified at `4187f78d` only.

---

# Sec 3. Premises inverted this session

## Sec 3.1 v24's supersession is narrower than "wholesale"

**§E9 describes v25 as superseding *"v24's snapshot and checklist."* That
shorthand was read as wholesale supersession and it is not.** v24 states its own
convention twice:

- Predecessor row: *"v24 supersedes v23 Sec 1, Sec 2, Sec 6, and the tail/status
  portions of Sec 7. **v23's analysis and correction banners stand.**"*
- Sec 8: *"**Does not supersede v23's analysis sections or correction
  banners.** It supersedes v23's state snapshot and checklist only."*

**So v25 supersedes v24's Sec 1, Sec 2, Sec 6, and Sec 7's tail/status. Sec 0,
Sec 3, Sec 4, Sec 5, Sec 8 and every banner survive.**

**Two consequences.** v24's item-10 completion banner is not destroyed by v25 and
never was — the split at Sec 1.3 is grounded on reachability, not destruction.
And **a §E9-style summary reads as complete and is not**; the register's own
shorthand was the source of the error.

## Sec 3.2 The sweep for facts destroyed by supersession

**Obligation:** if a read's sole record lives in a document v25 supersedes, the
read must be carried in-band or the evidence dies with the supersession.

**Method.** Wrap-tolerant scan of v24's *superseded sections only* — Sec 1,
Sec 1.1, Sec 2, Sec 6, Sec 7 — for performed-read language:

```
$ git show origin/main:docs/audit/Prime_Studios_Audit_Handoff_v24.md \
    | sed -n '66,127p;335,400p' | tr '\n' ' ' \
    | grep -oiE '.{45}(was run|were run|verified|confirmed|observed|measured|exited 0|re-derived|first attempt).{45}'
```

**One hit: Sec 1.1's Cross-Keystone integrity check** — blob
`d277588c81cf9bedea52aa015f79311e769a57f9`, `git diff --quiet` exit 0, and the
invalid PowerShell first attempt.

**Dispositioned as not-a-split, with reasons rather than by omission.** The blob
value survives at Amd5 §E1 (*reported verified; output not relayed*); the method
finding survives at v24 Sec 4.4, which is **not superseded**; and the operational
rule is v24 Sec 6 item 3, which is **perennial** — v25's author re-runs the
comparison at v25's basis. What supersession would remove is a historical
measurement nothing depends on.

**Everything else in the superseded sections cites its source and is
re-derivable:** Sec 1's table rows each name an authority document; Sec 2's items
23/36 cite v1.43 and v1.35 and are already carried by item 14; the namespace
resolution cites v2.57; the no-track-entered derivation cites v2.58–v2.61 and is
re-derived by item 5.

**Limit, stated.** This scan covers v24's superseded sections at `7c508189`. It
establishes nothing about the register beyond v24, and makes no claim about
documents v25 does not supersede.

---

# Sec 4. A sixth standing

**§E1 carries five standings.** Amendment 5 §E1.1 named the fifth and recorded
why the table could not see it.

> **Sixth standing: DEMONSTRATED AGAINST A CONSTRUCTED CONTROL.** A claim about
> an instrument's behavior, supported by a synthetic system built with known
> truth rather than by a read of the register.

**It extends §E1's five rather than joining them, and the axis is different.**
The five describe **how a recorder came to hold a fact about the register**. This
describes **how a claim about an instrument's behavior was supported**, and the
support is not the register at all.

**The standing therefore carries a mandatory bound:** a claim at this standing
establishes instrument behavior and **must state that it was not observed on the
subject repository.** Sec 2.4 is its first instance and carries that clause.

---

# Sec 5. Docket — unruled

## Sec 5.1 Three register facts now rest on unfiled drafts

**Named because two were already the case and this document authorizes a third.**

| # | fact | draft |
|---|---|---|
| 1 | FD-69's second retirement condition turns on evidence *"carried by the provenance instrument **when that instrument is filed**"* | `Production_State_Provenance_2026-08-22_DRAFT.md` (§E7) |
| 2 | The route-shadowing class of six, and Sec 1.3's closed entry | `Route_Shadowing_Survey_2026-08-22_DRAFT.md` |
| 3 | This document | itself — bounded by Sec 0.1 |

**Not ruled here.** #3 carries its own retirement instruction; #1 and #2 do not.
**§E7's shape is what an unbounded draft becomes**, and it is already one
instance.

## Sec 5.2 Carried unruled from the chain

- **§E7** — a retired P0 whose retirement stands on an unfired condition
  attached to an unfiled draft. Requires FD-69's retirement text read against
  the provenance draft's filing state.
- **§E8** — FD-67's Class A may have been unblocked as a side effect of
  `/login`'s disablement and v2.67's CLOSED-BY-REMOVAL. Requires **v2.66 §4.1**,
  which §E10 states neither party read.
- **§F5's PE #67 encounter** — the owed-index chain's own branch entered PE
  #67's condition on #1116's squash merge. Recorded as encountered, not
  adjudicated.

---

# Sec 6. What this document does not do

- **Does not rule on any finding in Sec 2**, which is case material for v25's
  Sec 4, not adjudication.
- **Does not amend v24, `F-AUTH-1_Fix_Plan_v2.45.md`, `v25_Owed_Index_*`, or any
  revision named above.** §2 of the index is the reason.
- **Does not join the owed-index chain** and is not Amendment 7. Reaching for
  Amendment 7 is the v25 signal.
- **Does not stamp any tail.** FD, XK and PE tails derive at v25's basis. §E1's
  tails are `face read` at `4187f78d` and do not transfer.
- **Does not draft v25's Sec 6 items 2 through 14**, and does not constrain
  v25's authority table.
- **Does not rule on §E7, §E8, PE #67, or the draft-dependency in Sec 5.1.**
- **Does not propose a procedure** for ruling-in-passing, per §D3 and §D5. Sec
  2.3's remedy is bounded to precondition reporting and claims nothing wider.
- Does not perform or size limb 1, advance Dimension 3, discharge limb 3, enter
  G4, or alter the freeze.
- **Mints nothing.** Closes and reopens nothing.

---

*Type: draft material. Rules nothing, mints nothing, recommends nothing. Void on
v25 landing — Sec 0.1. No host, AWS, database, or Cognito contact. No endpoint
exercised. Prod FROZEN. Not merged — v24 Sec 4.6.*
