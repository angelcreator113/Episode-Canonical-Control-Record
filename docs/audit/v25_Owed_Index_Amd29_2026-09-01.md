| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 29** *Amd28 §AD2 records item 8's read as NOT PERFORMED. The read was performed on 2026-08-29 and is discharged. This is the second time the register has made that statement about that item, and the correction for the first is on `main` in front of the author who made the second.* |
| --- |

***Provenance:*** *route ruled by Evoni on 2026-09-01 — **chain amendment, one correction and one finding, no register number.** **Push, PR create and merge are NOT ruled and are not assumed.** Rule 7 gates each separately.*

# v25 Owed Index — Amendment 29

**FILED 2026-09-01 on Evoni's authorization.** **Push, PR create and merge UNRULED AT FILING — a reader finding this document on `main` is reading it after some of those gates were passed, and should read §AE5 for what this amendment rules rather than this line for what it did not.**

**AMENDMENT 29 to `v25_Owed_Index_2026-08-22.md`.** Adds §AE1–§AE5.

**Basis:** `origin/main` at `ac77d4c9a7fe7bea9b3ecf5ba9437d4f3ca6f2ed`, 2026-09-01.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Corrects Amd28 §AD2 and carries one finding about how the error was made.**
Mints nothing. Ships no code.

**On reads, stated precisely because the unqualified form is part of what this
amendment corrects.** **No FOLLOW-UP read against canon was performed by this
session, and none was performed on 2026-09-01 by any party. Item 8's OWN read
WAS performed on 2026-08-29 and is discharged** — see §AE1.2. The unqualified
phrase *"no canon read was performed"* appears in Amd28's Status block and would
reproduce the error here.

**No AWS call was made. No host was contacted.** Prod **FROZEN**.

**NOTATION WARNING, stated before anything else.** This amendment's sections are
lettered **§AE1–§AE5**, continuing the chain's `AA`, `AB`, `AC`, `AD` sequence.
**`AE` is ALSO the name of a security finding class** — prod box security-group
exposure — as `AD` is the name of another. **§AE3 is not finding AE. §AD2 is not
finding AD.** The collision is a property of two independent naming schemes
meeting at Amd28 and Amd29, and it is recorded here rather than resolved.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     54
grep -r  'XK-4'  docs/audit/ | wc -l     32
grep -r  'PE #69' docs/audit/ | wc -l    32
Owed Index chain tail (pre-Amd29)        v25_Owed_Index_Amd28_2026-09-01.md
```

**Amd28 predicted 54 / 32 / 32. All three read as predicted** — the arithmetic was
correct in the amendment whose substance was not, which is worth noticing.

**Note on the three instruments, carried because it is still live.** The first is
counted with `grep -o` (occurrences); the second and third with `grep -r | wc -l`
(matching lines). **They are not the same unit.**

**This amendment's own contribution, measured after the text was final: +1 to
each** — from the tails block above, its only mentions. **A successor re-deriving
once this lands should read 55 / 33 / 33.**

**Exclusivity, measured immediately before this number was taken.** Zero open
mergeable pull requests; no `Amd29` or higher on any of 169 remote tips.

---

# §AE1. **CORRECTION** — Amd28 §AD2 mis-states item 8's read

## §AE1.1 What Amd28 says

`v25_Owed_Index_Amd28_2026-09-01.md`:

```
:73  # §AD2. **DISPOSITION** — item 8 is NOT PERFORMED as a read of canon
:82  **AUTHORIZED: YES.** Evoni authorized the Addendum A/B read on 2026-09-01.
:84  **PERFORMED: NO.** **RECORDED: NOT PERFORMED as a read of canon.**
```

## §AE1.2 What is true

**`v25` Sec 6 item 8's read was PERFORMED on 2026-08-29** by the operator, over
the operator-workstation route the route finding identified at §R1.1, with
evidence at `docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt`, which
is on `main` at this basis.

`v25_Owed_Index_Amd18_2026-08-30.md` §T1, heading, verbatim:

> **`v25` Sec 6 item 8 — the read was PERFORMED. The register said it was not.**
> **Stated first because it is the register's defect, not the schema's.**

The banner on the route finding, on `main`:

> **Item 8's DISPOSITION remains OPEN and Evoni-gated:** the read is discharged,
> what remediation the reconciliation requires is not.

**THE READ IS DISCHARGED. THE DISPOSITION IS OPEN. THEY ARE DIFFERENT THINGS AND
AMD28 COLLAPSED THEM.**

## §AE1.3 What was actually not performed

**The Addendum A/B FOLLOW-UP reads.** Their filenames say so —
`EvidenceNote_Item8_Followup_Reads_Instrument_2026-08-30.sql`,
`..._Addendum_A_2026-08-30.sql`, `..._Addendum_B_2026-08-31.sql`. They are a
distinct instrument from the 2026-08-29 read, authorized separately by Evoni on
2026-09-01, and not performed against canon.

**Corrected statement of the position at this basis:**

- **Item 8's read: PERFORMED 2026-08-29. DISCHARGED.** Per Amd18 §T1.
- **The Addendum A/B follow-up reads: AUTHORIZED 2026-09-01, NOT PERFORMED
  against canon.** Blocker: credential location.
- **Item 8's DISPOSITION: OPEN and Evoni-gated** — what remediation the
  reconciliation requires.
- **Dimensions 4 and 5:** Amd28's claim that they remain unscoreable is **NOT
  corrected here.** Whether the 2026-08-29 read scores them is a question this
  amendment does not answer and does not assume.

## §AE1.4 What in Amd28 STANDS

**§AD3 stands in full.** SSM Parameter Store is unchecked; Sec 2.5 concluded
exhaustion from a check of the store its own durability plan declined. That
finding is about the follow-up reads' blocker and is unaffected.

**§AD4 stands in full.** §R1.1 established reachability and never addressed
whether the operator can authenticate. Unaffected.

**§AD5 stands in full.** The control run, the two safeguards that fired unasked,
and the committed-versus-transcript pre-registration point. Unaffected.

**§AD1's standing table stands**, except that the §AD2 row's subject is now the
follow-up reads rather than item 8's read.

**§AD2.1's reason stands as to the FOLLOW-UP reads.** Credential location is why
the follow-up reads could not be performed. It is not why item 8's read was not
performed, because item 8's read WAS performed.

**§AD2.2 and §AD2.3 stand.** The non-canon control read and what it established
are unaffected.

## §AE1.5 What is owed

**A correction banner on Amd28**, newest-first at the head, on the precedent of
the banner Amd17 carries for the identical error. **This amendment does not place
it** — Amd29 edits no file outside its own path, and whether the banner is placed
is Evoni's, as it was on 2026-08-30.

**Amd26 §AB2's owed banners on Amd23 and Amd25 remain owed and unplaced.** The
register now has three owed banners.

---

# §AE2. **MEASURED** — this is the register's second instance of the same statement

## §AE2.1 The first

`v25_Owed_Index_Amd17_2026-08-29.md` §S1 recorded item 8 as Evoni-gated and NOT
PERFORMED. Amd18 §T1 corrected it, and Amd17 now carries a banner:

> **§S1 below records `v25` Sec 6 item 8 as Evoni-gated and NOT PERFORMED, with
> no route used. That was true at this amendment's basis and is no longer true.**
> The read was performed on **2026-08-29** over the operator-workstation route
> identified at the route finding §R1.1.
>
> *Banner added 2026-08-30 on Evoni's ruling. Not a supersede.*

**Amd17's statement was TRUE WHEN WRITTEN and became false.** That is a different
thing from Amd28's, and the difference is the finding.

## §AE2.2 The second

**Amd28's statement was FALSE WHEN WRITTEN.** The correction had been on `main`
for two days. Amd18 §T1 was on `main`. The route finding's banner was on `main`.
Amd17's banner was on `main`. **All three say the read was performed, and all
three were reachable by the author of Amd28 at the moment of writing.**

## §AE2.3 The mechanism

**Item 8's four lines were read from the handoff BODY at `:614-622`. No banner
governing them was read.** The route finding's banner states in terms that every
`NOT PERFORMED` statement about item 8 in that document is stale as to the read.
It was not consulted.

**`v25` Sec 6 item 4 legislates exactly this**, and its overage names the outcome:

> **Read correction banners before body sections.** Where a banner and the body
> disagree, **the banner governs**.
>
> *Overage: this session recorded a filed conclusion resting on an unbannered
> body read. The failure is silent — a body value reads as current because
> nothing in the body says otherwise.*

**Amd28 is a filed conclusion resting on an unbannered body read.** Item 4's
overage is now true of two sessions, and the second occurred while item 4 sat
unworked on `main`.

**The failure is silent exactly as item 4 says.** Item 8's four lines read as
current. Nothing in them says otherwise. **The body cannot announce its own
staleness — that is what the banner is for, and the banner was not where the
reader was looking.**

## §AE2.4 A third source said it and was also lost

**The cold-session brief that opened this session stated it directly:** *item 8's
read is PERFORMED and discharged; its DISPOSITION is open and mine to rule.*

**It was held at the first message and lost by the last.** Recorded because it
means the failure was not a gap in available information — the information was
present in the session's own opening instruction, in three documents on `main`,
and in a banner written specifically to prevent it.

**Standing:** the brief is a session artifact and no reader of this repository
holds it. **This subsection is ATTESTED by the drafting session and corroborable
by Evoni, who wrote the brief.** §AE2.1–§AE2.3 are measured.

---

# §AE3. **MEASURED** — item 4 caught it, on the first occasion item 4 was worked

**Item 3 and item 4 were worked at this basis, after Amd28 merged.**

**Item 3: DISCHARGED.** `Cross_Keystone_Register.md` blob identity confirmed by
three independent instruments and `git diff --quiet` at exit 0:

```
git hash-object -- <path>            d277588c81cf9bedea52aa015f79311e769a57f9
git rev-parse origin/main:<path>     d277588c81cf9bedea52aa015f79311e769a57f9
git ls-tree origin/main -- <path>    d277588c81cf9bedea52aa015f79311e769a57f9
git diff --quiet origin/main -- <path>   exit 0
```

**No shell round-trip.** The comparison is between git objects, so the
re-encoding hazard item 3 names does not arise.

**Item 4: the first document read under it produced §AE1.** The route finding's
banner was read, and it contradicted a document filed twenty minutes earlier.

**This is the strongest available argument for item 4's perennial class.** It
found a live defect on its first application, in a document produced by the
session applying it, about the item the banner was written for.

**It is also the argument for working perennials before drafting.** Amd28 was
drafted without item 4 having been worked in this session. Had the order been
reversed, §AE1 would not exist because Amd28 §AD2 would not have been written.

---

# §AE4. What is NOT corrected, and what remains open

- **Item 8's DISPOSITION remains OPEN and Evoni-gated.** The read being
  discharged does not settle what remediation the reconciliation requires.
- **Items 9, 11, 12 and 13 remain as they were** and must not be inferred from
  this amendment, on the same terms the route finding's banner states.
- **The 8-A/8-B split remains undefined anywhere on `main`**, per Amd27 §AC3.5's
  search across all extensions.
- **SSM Parameter Store remains UNCHECKED**, per Amd28 §AD3, and checking it
  requires a scope ruling from Evoni.
- **Whether the 2026-08-29 read scores Dimensions 4 and 5 is NOT answered here.**
  Amd28 asserted they remain unscoreable on a premise this amendment corrects;
  the conclusion may still hold for other reasons, and it is left open rather
  than reversed by implication.

---

# §AE5. What this amendment does not do

- **Does not edit Amd28**, or any file outside its own path. §AE1.5 records the
  banner as owed, not placed.
- **Does not supersede Amd28.** §AD3, §AD4, §AD5 and the standing table stand.
- **Does not close item 8**, whose disposition remains Evoni-gated.
- **Does not score Dimensions 4 or 5**, or rule on whether the 2026-08-29 read
  scores them.
- **Does not perform, authorize or request any read, AWS call or host contact.**
- **Does not select a canon endpoint.**
- **Does not close items 5, 9, 11, 12 or 13.** Item 3 is discharged at §AE3;
  item 4 is perennial and is worked, not closed.
- **Does not resolve the `§AE` / finding-`AE` notation collision**, recorded in
  the Status block above.
- **Does not correct any predecessor other than Amd28 §AD2.** Amd17 through
  Amd27 stand as filed, with Amd26 §AB2's banners on Amd23 and Amd25 still owed.
- **Does not mint.** No FD, XK, or PE number.
- **Does not rule its own push, PR create, or merge.** Three separate confirms.

---

*Type: chain amendment. One correction to an immediate predecessor, two measured
findings, one subsection attested and marked so at §AE2.4. No follow-up read
against canon performed by this session; item 8's own read was performed
2026-08-29 and is discharged. No AWS call, no host contact. Records no closure
and no mint. Edits no file outside its own path. Prod FROZEN.*
