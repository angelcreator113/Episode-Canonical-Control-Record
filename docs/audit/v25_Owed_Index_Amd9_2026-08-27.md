| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 9** *The four inventory commits, read. A citation wrong about what its source says and right about what its source is.* |
| --- |

# v25 Owed Index — Amendment 9

**Document version**

**AMENDMENT 9 to `v25_Owed_Index_2026-08-22.md`.** One item. Adds §I0–§I6.

> **On the section letter.** The chain runs §E (Amd5), §F, §G, §H; **§I is the
> sequence position and is a capital letter I, not the digit 1.** `§I1` is not
> `§11`. Stated because the register's identifiers are read mechanically and this
> is the first letter in the sequence that collides with a digit.

**Minted rather than carried in place**, per `F-Deploy-1_Fix_Plan_v1.49.md`.
Amendment 8 receives a pointer banner that carries nothing, **placed in this
commit rather than stated as performed elsewhere** — per Amendment 8 §H6, which
records that Amendment 7 promised such a banner to Amendment 6 and it was never
placed.

**Rules nothing about any finding. Mints nothing.** Ships no code. Changes no
gate, severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**. **Gate states carried as
face reads; not re-derived here.**

**Basis:** `origin/main` at `a05fc156d7649ceba41f23654e674c5d5fb7e098`,
2026-08-27. `v25_Owed_Index_Amd8_2026-08-27.md` at
`e4a0ff988531c5f110725ea4753b559039f5defb`.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Derivation. One item discharged. Two derivations recorded, one class left
ambiguous, nothing ruled.

---

# §I0. Why this amendment exists

**`v25_Owed_Index_Amd8_2026-08-27.md` §H6 records:** *"Does not read the four
inventory commits whose contents §H1.1 makes cheap to read. **Named as runnable,
not run.**"*

**This amendment runs it.**

**Amendment 8 §H6 is not corrected and is not amended.** It is an accurate
account of what Amendment 8 did, and it stays accurate. **Discharging an item is
not the same act as correcting the statement that named it** — the pointer banner
placed on Amendment 8 by this commit says so explicitly, because the inverse
mistake would be this chain treating a truthful non-action as an error.

**Every claim below is a command against `origin/main` at `a05fc156`.** Nothing
here rests on a transcript.

---

# §I1. The four commits

`docs/audit/Paranoid_Exposure_Inventory_2026-08-07.md`, whole history on `main`:

| commit | timestamp | parents | shape | effect on the path |
|---|---|---|---|---|
| `95525f30` | 2026-08-07 16:02 -0400 | `394ca354` | **PR squash**, subject carries `(#990)` | document created, `126  0` |
| `f3b1f3d9` | 2026-08-18 18:06 -0400 | `79f9bab1` | direct to `main`, no PR marker | Correction Banner 1 added, `28  0` |
| `2a744a92` | 2026-08-19 03:27 -0400 | `803b0265` | direct to `main`, no PR marker | Correction Banner 2 added, `34  0` |
| `470ad7a1` | 2026-08-19 03:35 -0400 | `1a00e947` | direct to `main`, no PR marker | one line replaced, `1  1` |

**All four are single-parent. Three are direct commits to `main`; the creation is
a PR squash.**

**Amendment 7 §G5.1 states that this stacking "occurred off `main`."** It did not.
Amendment 8 §H1 already records that as false from ancestry alone; **§I1 records
what the commits themselves contain**, which ancestry could not show.

---

# §I2. §G5's hedge is answered — against itself

**Amendment 7 §G5.1 hedged:** unread context *"could establish that `v1.49`'s
citation points at something this reading cannot see — in which case §G5's
conclusion does not hold."*

**It does not so establish. The context confirms §G5's reading.**

Correction Banner 2, as filed at `2a744a92`, opens:

> Banners are read newest-first. Where two disagree the later governs; where a
> banner and the body disagree the banner governs. **The 2026-08-18 banner below
> is preserved exactly as merged at `76a7f1ac` and is not edited.**

And it was not. `git show --numstat 2a744a92 -- <path>` returns **`34  0`** — a
pure insertion, zero deletions, Banner 1 untouched. **Layer immutability stated
and practised**, which is exactly what Amendment 7 §G5 derived from `main` alone.

**The hedge is discharged in the direction that confirms the conclusion it was
hedging.** §G5's reading of Banner 2's content stands on evidence Amendment 7
believed it could not reach.

---

# §I3. The same four commits contain a live instance of the hazard `v1.49` invoked

`F-Deploy-1_Fix_Plan_v1.49.md` cites Banner 2 as prior art on the stated ground
that **a dated layer which changes after merging cannot be relied on for what it
said on its date.**

**Banner 2 is such a layer.**

```
2a744a92  03:27:19  Banner 2 filed on main, reading:
                    "Only its five Variant B inline-DDL literals were removed."
470ad7a1  03:35:19  that line replaced in place, eight minutes later:
                    "…are also still present… Neither variant has been retired;
                     an earlier draft of this banner said Variant B had been,
                     corrected before filing."
```

**Banner 2 was on `main` for eight minutes carrying a statement its own
correction calls false, and was then amended in place.**

**So the citation is wrong about what Banner 2 *says* and right about what Banner
2 *is*.** Amendment 7 §G5 is correct that Banner 2's stated principle is layer
immutability and does not decline in-place amendment. **The history shows Banner
2 undergoing an in-place amendment of itself, within the hour, on `main`** — the
precise property `v1.49` reached for it to name.

**Neither half is derivable from `main` alone.** A document amended in place
carries no trace of having been; the current text reads as though it always said
what it now says. **That is `Prime_Studios_Audit_Handoff_v25.md` Sec 4.1 defeater
3 seen from the reader's side rather than the deriver's.**

**Nothing is ruled here.** Whether this changes `v1.49`'s citation's standing is
**not decided**. `v1.49` is Evoni-ruled; §G5's conclusion belongs to a ratifying
revision; Amendment 7 §G5 and Amendment 8 §H6 both leave it there and **so does
this document.**

---

# §I4. "Corrected before filing" — checked, and left ambiguous

The replacement line asserts the earlier version was *"an earlier draft of this
banner… corrected before filing."* **Git shows it merged to `main` at `2a744a92`
and corrected at `470ad7a1` eight minutes later.** `470ad7a1`'s own subject calls
both versions *"drafts."*

**The register has a draft convention and it is filename-based.**

```
docs/ files with _DRAFT in the filename          52
  of which _DRAFT.md as a suffix                 50
  mid-name (…_DRAFT_2026-06-17.md and one other)  2
case-insensitive "draft"                         62
  the extra 10 are the Draft_Material family — a different instrument
Paranoid_Exposure_Inventory_2026-08-07.md         carries no draft marker
```

**By the only marker the corpus uses, the inventory was a filed document at
`2a744a92` and stayed one through the eight minutes.** **No definition of "filed"
appears anywhere in the corpus** — the term is used and never defined.

**Under the convention that exists, the claim is false. Under a banner-scoped
notion of filing — where a banner is not "filed" until some later point — it may
be true, and that notion is undefined.** **This document does not choose between
them.**

**Both counts above are basis-dependent, and the adjacency does not signal it.**
The ten-document residual includes two files created during this session; the
`_DRAFT` set last grew on 2026-08-23, four days before this basis. **A later
re-run will differ from both**, and neither number is a fixed property of the
corpus.

## §I4.1 The class is left ambiguous and counted under neither

- **Broad** — *assertions about commit history contradicted by commit history*.
  With Amendment 7 §G5.1, that is **`n = 2`**.
- **Narrow** — *a document's self-description contradicted by its own history*.
  Amendment 7's claim was about another document. That is **`n = 1`**.

**Which class is the right one is a judgment, and selecting the class that makes
the count higher is the move `v26_Draft_Material_Attention_2026-08-27.md`
withdrew four generalisations for.** **Recorded ambiguous. Counted under
neither. No class named.**

---

# §I5. Reach — two count errors inside this derivation, one from each party

**Both are recorded because this derivation's subject is claims about history
contradicted by history, and a document about that shape omitting its own two
instances would be the defect it records.**

**(a) `(#990)`.** The first report of §I1 stated that all four commits carried no
PR marker. **`95525f30` carries `(#990)`.** Three subjects were read and the
conclusion was written for four. **The marker was visible in the reporting
party's own tool output two calls earlier.** Not a miscount — a scope stated
wider than the reading that supported it.

**(b) `_DRAFT` at 50.** §I4's convention count was first given as **50**. The
scan anchored `_DRAFT` to the end of the filename and so excluded the two files
carrying it mid-name. **52 is correct.** The pattern encoded an assumption —
that `_DRAFT` is a suffix — which the corpus does not hold.

**(b) is the same family as** `Prime_Studios_Audit_Handoff_v25.md` Sec 4.3's
character-class bullet and `v26_Draft_Material_Perennials_2026-08-27.md` §5: **a
pattern that quietly cannot match what it was written to find.** **(a) is not** —
nothing prevented the match; the scope of the claim exceeded the scope of the
read.

**The case-insensitive residual is resolved at this basis, not left open.**
62 − 52 = 10, and
all ten are `Draft_Material` documents — a distinct instrument, not a third
draft-marker variant. **Stated because an unexplained residual in a count is how
the two errors above began.**

---

# §I6. What this amendment does not do

- **Does not correct Amendment 8 §H6.** *"Named as runnable, not run"* is an
  accurate account of Amendment 8 and remains one. **Discharging the item is not
  amending the statement.**
- **Does not rule on `F-Deploy-1_Fix_Plan_v1.49.md`'s prior-art citation.** §I3
  records what the four commits contain. **`v1.49` is Evoni-ruled and is not
  corrected here.**
- **Does not rule on Amendment 7 §G5's conclusion.** §I2 discharges its hedge in
  the confirming direction; **the conclusion's standing remains with a ratifying
  revision.**
- **Does not name a class at §I4.1.** Ambiguous, counted under neither.
- **Does not resolve what "filed" means** in this register. §I4 records that no
  definition exists.
- **Does not rule on Correction Banner 2's own standing**, on the inventory's
  measurement, or on the exposed-set partition. **None was read for that
  purpose.**
- **Does not reopen F-Deploy-1**, which remains **CLOSED**. Does not perform or
  size limb 1, advance Dimension 3, discharge limb 3, enter G4, or alter the
  freeze.
- **Mints nothing.**

**This amendment moves Amendment 8's blob.**
`e4a0ff988531c5f110725ea4753b559039f5defb` →
`3438cd5b218a42d04cbbcf6a1b65c3db3e685ca5`, under an unchanged filename, by the
pointer banner placed in this commit. **That is
`Prime_Studios_Audit_Handoff_v25.md` Sec 4.1 defeater 3 occurring here**, and it
is disclosed banner-forwarding in Sec 5.5's sense. **The basis line above cites
Amendment 8 at `e4a0ff98…` because that is its state at `a05fc156`, the basis
read.** A Sec 6 item 2 derivation at any later basis will find it moved and
should read this as the account. **The disclosure is here rather than in
Amendment 8's banner, which points and carries nothing** — the shape Amendment 8
§H6 established.

**On this amendment's filename.** `v25_Owed_Index_Amd9_*` inherits §C3's defect,
deliberately, per §E10, and per Amendments 7 and 8's statement of the same
choice.

---

*Type: amendment, derivation only. No host, AWS, database, or Cognito contact.
No endpoint exercised. Prod FROZEN.*
