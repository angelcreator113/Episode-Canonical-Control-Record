# F-AUTH-1 Measurement v2 — the section 5 asymmetry — 2026-08-24

| | |
|---|---|
| **Purpose** | Records an asymmetry in `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` between the standard its count is held to and the standard its uncertainty band is held to, and one auditability gap between its section 1 and section 2. |
| **Basis** | `main` at `f77829fbbf26604266e68c358515b45cf49bf48b`, confirmed by `git ls-remote --heads origin main`. |
| **Standing** | **Does not dispute 129.** Does not re-derive, re-count, or re-read the record. Mints nothing. No FD, no XK, no PE. Changes no gate, severity, owner or disposition. |
| **Authority note** | Documentary reads only. No AWS call, no host contact, no workflow dispatch. Prod **FROZEN**. |

---

## §1 The asymmetry

Measurement v2 holds its **count** to a stated method and its **uncertainty band** to none.

| Claim | Standard applied |
|---|---|
| **129 recorded dispositions** | Section 1 states the method in full per §C1 — preconditions asserted before any read, both sources named per CP, and the counting rule given with its boundary ruled and worked examples. |
| **"roughly 120 to 140 under the ruled boundary, and further outside it"** | **No derivation.** No variation is enumerated, no endpoint is attributed to any variation, and no rule generates either bound. |

Both are positive quantitative claims in the same document, one section apart. Only one carries its method.

## §2 Section 5 states the principle it then does not apply

Section 5's own closing words:

> **§C1's method requirement applied to a positive claim rather than a negative one.** A count without its boundary rule is as unfalsifiable as an absence without its search.

That sentence is correct and is the reason the count is defensible. **The band in the sentence above it has no boundary rule.** A band without its derivation is unfalsifiable on exactly the argument section 5 makes: there is no stated variation a reader could apply to get 120, none to get 140, and therefore no way to disagree with either number except by asserting a different one.

The asymmetry is not that the band is wrong. **It is that the band cannot be checked, in a document whose stated purpose was correcting a claim made without a method.** Its superseded predecessor's failure was *"precisely a claim stated without one."*

## §3 The section 1 / section 2 auditability gap

Section 1 declares **two** sources per CP — *"Sources read, per CP — both, not one"* — the closure document's version block and the code commit's message body.

Section 2 reports **one** number per CP, and separately records that the two sources agree in granularity in exactly **one** of thirteen rows: *"Only CP11 is unchanged ... the sole CP where the two sources agree in granularity."*

So in the other twelve rows the two declared sources named different granularities, and a resolution was performed.

**What is recorded:** the resolution *rule*. Section 1 supplies it — *"scope taken at the finest granularity the record names."* This is a stated rule, applied uniformly, and the finding here is **not** that the ruling is missing.

**What is not recorded:** which source supplied the governing granularity, per row. The table's fourth column states what the record says; it does not state *which* record. A reader therefore cannot check any individual row against its source without re-performing section 1's two-source read for that CP.

**Stated at that strength and no higher.** This is an auditability gap in the presentation, not an unrecorded ruling and not evidence of an error in any row.

---

## §4 Why this is filed rather than corrected

The band is load-bearing. Section 5 uses it to establish that **129 is not a size for limb 1** — *"a count of recorded dispositions under one stated boundary, not a measure of work."* That conclusion does not depend on the band's exact endpoints, only on the count being boundary-sensitive, which section 1's worked examples independently establish.

So the asymmetry does not propagate into section 5's conclusion. **It weakens the evidence for a conclusion that survives on other grounds.** Correcting it means deriving the band — enumerating the defensible boundary variations and recounting under each — which is a measurement, not a banner, and is not performed here.

## §5 Bounds

- **129 is not disputed, checked, or re-derived here.** No count was performed.
- **No row of section 2 is challenged.** Section 3 is about what a reader can verify, not about whether any figure is right.
- **The band is not asserted to be wrong.** It is asserted to be underived. Those are different claims and only the second is made.
- **Whether the band is derivable at acceptable cost is unexamined**, and no estimate of that cost is offered.
- **The 120-140 figures are quoted, not adopted.** This document takes no position on limb 1's size.

## §6 What this document does not do

- Does not amend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`. It receives a pointer banner; its body is untouched.
- Does not perform limb 1, adjudicate any Tier disposition, or resolve `CP10`'s or `CP12`'s approximate counts.
- Does not reopen the withdrawn feasibility finding of that document's section 6, or rule on first-half auditability.
- Does not derive the band. §4.
- Mints nothing; closes nothing; changes no gate, disposition, owner or severity.

---

## Version block

| Field | Value |
|---|---|
| Document | `docs/audit/F-AUTH-1_Measurement_v2_Sec5_Asymmetry_2026-08-24.md` |
| Date | 2026-08-24 |
| Basis | `main` at `f77829fb` |
| Reads | `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` sections 1, 2, 4.1, 5, 7 |
| Mints | Nothing |
| Disputes | Nothing; §5 |
| Operations performed | None |
