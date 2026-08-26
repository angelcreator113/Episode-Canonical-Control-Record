> **ABSORBED — VOID ON v25 LANDING (added 2026-08-26, additive; nothing below is
> removed or edited).**
>
> **`Prime_Studios_Audit_Handoff_v25.md` exists in this tree and carries this
> document's material.** Both are created in one commit, so a reader of this
> banner always has v25 in the same tree. **That is co-location, not
> authority.**
>
> **The absorption condition fires on v25 landing on `main`, which has NOT
> occurred at this commit.** This document is VOID on that landing, **not
> before**, and v25 is not authority until then.
>
> **It is not authority and was never a chain link.** It supersedes nothing and
> holds no place in any Fix Plan chain. **This banner marks absorption, not
> supersession** — the distinction is `v25_Draft_Material_Item2_2026-08-24.md`
> §4's, and is kept because three of the eight state they are superseded by
> nothing.
>
> **The material lives at `Prime_Studios_Audit_Handoff_v25.md`:**
> Sec 5.5 (the in-place-amendment population, reconciled); Sec 4.5 (the
> carriage principle applied once while the practice continued; the handoff
> reading pre-amendment content under identical revision numbers).
> **This banner points and carries nothing.**
>
> **Retained rather than deleted** so the in-body author line survives at HEAD
> and forward pointers to this path continue to resolve.
> `Finding_Authorship_Record_Preservation_2026-08-24.md` §7; that finding
> requests retention of nothing and this is not filed under it.
>
> Mints nothing. Changes no gate, finding, severity, owner, or disposition.
> Prod FROZEN.

# v25 Draft Material — In-Place Amendment Sweep

| | |
|---|---|
| **Purpose** | Converts the blind-spot clause carried with item 2's authority table from an admission of ignorance into a measurement. Draft material for the v25 author. |
| **Created** | 2026-08-24 |
| **Basis** | `origin/main` at `7c508189c369a5a384d55cc2bea371d9ebec56f3`. |
| **Absorption condition** | **Draft material, not a chain link.** Void on v25 landing. Supersedes nothing, superseded by nothing. |
| **Companions** | `docs/audit/v25_Draft_Material_Item2_2026-08-24.md` and `docs/audit/v25_Draft_Material_Perennials_2026-08-24.md`, same branch. **Neither points here.** Adding a forward pointer would require editing a filed document in place — the exact defect this document measures. Absent by decision. |
| **Sibling** | `docs/audit/v25_Draft_Material_2026-08-24.md` at `2354f7ab6f0f1deee42007f449c74c7e82048a15` on `claude/v25-sec6-prep-1cu9c0`. |
| **Authority note** | Mints nothing. No FD, no XK, no PE. Closes no finding, reopens none, changes no gate, disposition, owner or severity. No live database contact. No live GitHub API contact. |

---

## §1 What this measures

The item 2 discharge ships with a clause: its table is *correct on tails, silent
on in-place amendment*. That silence is convertible into a number. This document
converts it.

**The hazard, as F-Deploy-1 v1.49 states it:** an in-place amendment after merge
changes the document without changing the revision number. *"A reader deriving
authority by sorting revisions gets a stale answer with no signal that it is
stale."*

---

## §2 METHOD — including a premise that was stated, tested, and found false

### §2.1 The first filter was wrong

**Detection principle, first attempt:** a document introduced and never touched
again has one commit in its path history; more than one means amended after
introduction.

**That rests on an unstated premise: that `main` is squash-only.** Under a true
merge, branch-side edits enter `main`'s path history and are entirely benign, so
the filter over-collects.

**The premise was tested rather than assumed:**

```
commits on origin/main: 5204
merge commits:          1295
```

**The premise is false.** The filter as built was invalid.

### §2.2 The corrected discriminator

`git log --first-parent` — each first-parent commit touching a path is one
*landing* on `main`, regardless of merge style. More than one landing = amended
after introduction.

Re-running moved the count 69 → 66 across all `docs/audit/` markdown, and dropped
one Fix Plan (`F-Deploy-1_Fix_Plan_v1.20.md`) from the hit list. **The conclusion
survived; the reasoning that produced it did not.**

### §2.3 Unseeded positive control

`F-Deploy-1_Fix_Plan_v1.48.md` surfaced at **3 landings without being seeded** —
the one case independently known to be a true in-place amendment. It was not
searched for; it fell out of the sweep.

That is what licenses reading anything from the other hits. Without it this is a
list, not a measurement.

### §2.4 What a hit does and does not mean

A hit means the file changed after its introducing landing. **It does not mean
the change was substantive** — a typo fix and a ruling amendment both show as 2.
The count is a filter. Every hit named below was inspected for size and subject.

---

## §3 Result

| | |
|---|---|
| Fix Plan `.md` at basis | **153** |
| Amended after landing | **14** (9.2%) |
| Amended during 2026-08 | **9** |
| Of those nine, F-AUTH-1 | **8** |
| **The four current authorities** | **0 — all single-landing** |
| All `docs/audit/` `.md` | 344, of which 66 have >1 landing |

### §3.1 Item 2's table is unaffected

`F-AUTH-1_Fix_Plan_v2.68.md`, `F-Deploy-1_Fix_Plan_v1.49.md`,
`F-Stats-1_Fix_Plan_v1.60.md`, `F-App-1_Fix_Plan_v1.1.md` each landed once and
were never touched again.

**The reproduced authority table does not rest on a document that moved under
it.** This negative is worth as much as the positive result: the clause it
discharges was about the table's own reliability.

### §3.2 The practice is current, not residual

Nine of fourteen amendments landed in **2026-08**; eight are in the **active
F-AUTH-1 chain**. Ordered by size:

| Revision | Amendment | Subject |
|---|---|---|
| `v2.59` | **+132** | withdraw v2.59 Dimension 2 FAIL |
| `v2.65` | **+91** | correct FD-67 population to eight |
| `v1.48` | **+74** | SSM rewrite also closed cross-environment write (#1105) |
| `v2.45` | **+65**, then **+25** | compositions.js route order; route shadowing class |
| `v1.48` | **+28** | carriage note added when v1.49 was minted (#1107) |
| `v2.55` | +14 | §3.2 withdrawal banner |
| `v2.52` | +12 | §1 row 4 citation banner |
| `v2.37` | +11 | PE #14 scope banner |
| `v2.56`, `v1.5` | +10 each | v2.57 namespace ruling, landed into both |

**A disposition withdrawal and a population correction were appended to already-
merged revisions in place.** Neither is a typo. Both are the *"dated layer which
changes after merging"* that XK-1's Correction Banner 2 declines to rely on.

---

## §4 FINDING — the carriage principle was applied once; the practice continued

Recorded previously: a documented principle, with a known remedy, not applied at
the site that needed it. **The measurement makes it structural.**

F-Deploy-1 v1.49 was minted to restore sort visibility for v1.48's amendment —
established from v1.49's own text. **It is the only revision found minted for
carriage.** Eight further August amendments carry no equivalent.

**Bound, and it is not to be closed by inference:** what is established is that
v1.49 is the only revision *found minted for carriage*. Whether the other eight
received chain-visible treatment by some other route is **unread**. Nine cases
were not opened.

The shape is therefore not "a principle held and forgotten once." It is a
principle **held, applied at exactly one site, and the practice continued around
it.**

---

## §5 The handoff read pre-amendment content under identical revision numbers

Audit Handoff v24 Sec 1 is derived at `fec15be6` — which is itself the F-AUTH-1
v2.61 landing, 2026-08-22 06:55 -0400.

**Outcomes were fixed before this check ran**, and one anticipated case came back
against the anticipation.

### §5.1 Anticipated case, and it did not hold

`v2.59`'s +132 *withdraw Dimension 2 FAIL* **is** an ancestor of `fec15be6`. v24
read the amended v2.59. Its statement *"v2.60 re-scores Dimension 2 only"* was
made against the post-withdrawal document.

The case named in advance as most likely to matter did not materialize. Recording
that is the only thing that makes advance naming worth doing.

### §5.2 Two real instances, and one non-instance

| Document | At `fec15be6` | At `7c508189` | Verdict |
|---|---|---|---|
| `F-Deploy-1_Fix_Plan_v1.48` | **8118 b** | **13313 b** | **v24 read a document 5195 b smaller** |
| `F-AUTH-1_Fix_Plan_v2.45` | **16436 b** | **21450 b** | **v24 read a document 5014 b smaller** |
| `F-AUTH-1_Fix_Plan_v2.65` | ABSENT | present | **not an instance** — postdates v24 entirely |
| `F-Deploy-1_Fix_Plan_v1.49` | ABSENT | present | postdates v24; the remedy did not yet exist |
| `F-AUTH-1_Fix_Plan_v2.61` | 15706 b | 15706 b | unchanged — v24's F-AUTH-1 authority is stable |

**"Amendment postdates v24" and "v24 read pre-amendment content" are different
claims.** For a document absent at v24's basis, v24 read nothing. `v2.65` is a
non-instance and is recorded as one.

### §5.3 Both diverged documents are load-bearing in v24

```
line  27  > Method and full environment contact are recorded in F-AUTH-1 v2.45's
line  74  | F-Deploy-1 | F-Deploy-1_Fix_Plan_v1.48.md | KEYSTONE CLOSED...
line 109  | F-Deploy-1 | CLOSED at v1.48...
line 142  5. v2.60 reads v1.30 -> v1.48 plus live workflow state
```

- **`v1.48` is v24's named F-Deploy-1 authority**, cited three times.
- **Line 27 delegates v24's own method record to `v2.45`.** A reader following
  that delegation today reads 5014 bytes v24 never saw. The pointer resolves; the
  target moved. Routing failure and carriage failure in one sentence.

### §5.4 v24 is not careless here — it is the reader v1.49 describes

`v1.49`, the revision minted to make v1.48's amendment visible to sorting, **did
not exist at v24's basis.** v24 had no instrument that could have detected the
divergence.

The handoff that mandates reproducing the authority table contains, inside that
table, a citation the carriage mechanism guaranteed would go stale without
signal.

### §5.5 Bound — measured in bytes, not in disposition

v1.49 states the #1105 amendment *"changes no gate, severity, owner or
disposition"* and *"records a second rationale for a control this plan already
shipped."* If that holds, v24's `KEYSTONE CLOSED` face remains correct.

**That is v1.49's claim about itself, carried attributed and not verified here.**
No content comparison of the two v1.48 texts was performed, and none of v2.45's.

**The hazard stands independently of whether this instance had teeth.** It fired
silently; only the subject matter kept it harmless.

---

## §6 The positive case

Every class recorded across these sittings is an unexamined premise about an
instrument: an instrument reporting the state it can name; a principle documented
and unapplied; a fact closing with no route back.

**§2.1 is the same setup with the test performed.** A filter was built on an
unstated premise, the premise was stated, tested, and found false, and the
instrument was rebuilt before its output was used.

The class is not *"instruments mislead."* It is ***"instrument premises go
unstated."*** §2.1 is what it looks like when one gets stated and checked, and it
is recorded here as the positive case rather than as an incident.

---

## §7 Open, carried

| Item | Status |
|---|---|
| Nine August amendments other than v1.48's | Not opened. Whether any received chain-visible treatment is unread. §4. |
| Content divergence of `v1.48` and `v2.45` | Measured in bytes only. No text comparison performed. §5.5. |
| Second-order: `v2.60` reads `v1.30`→`v1.48` | v2.60's own read of v1.48 was at some basis; whether pre- or post-amendment is unchecked. §5.3 line 142. |
| The other 52 non-Fix-Plan documents with >1 landing | Counted, not inspected. §3. |
| `.docx` chain members | Excluded from this sweep entirely — it covers `.md` only. |

---

## §8 What this document does not do

- Does not mint. No FD, no XK, no PE.
- Does not compare the text of any amended document against its earlier form.
- Does not open the nine uninspected amendment cases.
- Does not correct, amend, or annotate any document it measures.
- Does not edit its companions to point here (see front matter).
- Does not assert that v24's stated faces are wrong. §5.5.
- Does not confer authority on itself. Draft material, void on v25 landing.
- No live database contact, no live GitHub API contact. Prod untouched.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | §1 the clause being converted. §2.1 squash-only premise stated, tested against 1295 merges of 5204, found false. §2.2 first-parent as corrected discriminator, 69 to 66. §2.3 unseeded positive control at v1.48. §2.4 hit semantics. §3 result: 14 of 153 Fix Plans, 9 in August, 8 F-AUTH-1. §3.1 four current authorities single-landing, table unaffected. §3.2 amendment sizes and subjects. §4 carriage principle applied once, practice continued, with the nine-unread bound. §5 v24 at fec15be6. §5.1 anticipated v2.59 case did not hold. §5.2 two instances, one non-instance, existence separated from amendment. §5.3 both diverged documents load-bearing, line 27 delegation. §5.4 v24 as the reader v1.49 describes. §5.5 divergence measured in bytes not disposition. §6 the positive case: instrument premises go unstated. §7 five carried items. §8 non-actions. |

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-24. `origin/main` at `7c508189`.*
*v25 draft material. Void on v25 landing. Mints nothing. Evaluates no fix. No live database contact.*
