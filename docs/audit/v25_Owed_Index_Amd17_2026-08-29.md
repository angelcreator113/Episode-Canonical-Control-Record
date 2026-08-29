| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 17** *Sec 6 item 8's route finding is filed and corrected. Item 8 does NOT close. This amendment points; it does not carry.* |
| --- |

# v25 Owed Index — Amendment 17

**FILED 2026-08-29 on Evoni's authorization.**

**AMENDMENT 17 to `v25_Owed_Index_2026-08-22.md`.** Adds §S1–§S3.

**Basis:** `origin/main` at `8f9662b31110094225bfe2b982c196d56161b740`, 2026-08-29.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**This amendment points; it does not carry.** It rules nothing, closes nothing,
specifies nothing, and mints nothing. **The substance is at
`v25_Sec6_Item8_Route_Finding_2026-08-29.md`.** Ships no code. Prod **FROZEN**.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     29
grep -r  'XK-4'  docs/audit/ | wc -l      8
grep -r  'PE #69' docs/audit/ | wc -l     8
Session_PE_Roster.md highest entry       PE #68
Owed Index chain tail (pre-Amd17)        v25_Owed_Index_Amd16_2026-08-28.md
```

**The FD-70, XK-4 and PE #69 tails have each moved since Amd16** (25→29, 5→8,
5→8). **The movement is the three files `8f9662b3` added entering the tree, and
is not a new mint.** Attributed rather than asserted:

```
FD-70   +4 = Amd16 (3 occurrences) + F-AUTH-1_PE65_Resolution_BranchB (1)
XK-4    +3 = Amd16 (3 lines)
PE #69  +3 = Amd16 (3 lines)
```

**Fully accounted; no unexplained residue.** An earlier draft of this amendment
attributed the movement to Amd16 alone — that is short by the PE #65 resolution's
one FD-70 occurrence, and `8f9662b3` added three files (the Branch B resolution,
Amd15, Amd16), not one. **Caught by the §H5 re-check, not by review.**

**Note on the two instruments.** `FD-70` is counted with `grep -o` (occurrences);
`XK-4` and `PE #69` with `grep -r | wc -l` (matching lines). **They are not the
same unit** and must not be compared to each other. Both forms are carried
because Amd16 pasted both.

---

# §S1. `v25` Sec 6 item 8 — the route finding is filed. **Item 8 does NOT close.**

**Stated in this order because the two are separable and a successor will
conflate them.**

**Filed:** `v25_Sec6_Item8_Route_Finding_2026-08-29.md`. It supersedes
`Item8_Route_Finding_2026-08-28.md`, whose disposition was correct and whose
reasoning was defective in six sections.

**Not closed:** **`v25` Sec 6 item 8 — the FD-66 infrastructure read — remains
Evoni-gated and NOT PERFORMED.** The filed document records *why* the read was
not performed. **It does not perform it, and records no route as used.**

**Namespace, because it misroutes a grep.** This is `v25` Sec 6 item 8, **not
Phase B G2 item 8**, which `F-Deploy-1_Fix_Plan_v1.48.md:120` records as CLOSED.
Different numbering namespaces.

**The corrected reason, which is what changed.** The superseded draft held that
every recorded route to the canon instance was a host action. **That is false.**
The one established non-host route is the **operator's workstation** —
enumerated, attributed (`Infra_DevRouting_502_2026-08-03.md:111`, *"(maintainer
IP)"*), and present across every enumeration in the window. **It is not
available to an agent session.** Substance and evidence at the filed document
§R1.1–§R1.2.

---

# §S2. Pointer — the six corrections, the probe, and the restated blocker

**Pointer only. Each item's evidence is at the filed document; none is carried
here.**

| Correction | Where |
| --- | --- |
| §R1's "every other route is a host action" — FALSE; workstation route enumerated and attributed | §R1.1 |
| The four-rule SG set is **mutable with one unattributed mutation**, not a bracketed constant | §R1.2 |
| Identity check is **two discriminating values plus one self-check**, not three | §R2.1 |
| The draft's own control values trace to the non-host route its §R1 denied | §R2.2 |
| §R3.1's conduct clause — deleted, replaced with what occurred | §R3.1 |
| §R3.2's precedent — replaced with the 2026-06-26 **non-host** read | §R3.2 |
| §R3.3 — `v1.42` §1's pre-read/post-mint distinction; net four, not the same four | §R3.3 |
| §R3.5 — **AF was correct at filing**; the disjunct's resolution is co-located with the SG-identity line | §R3.5 |

**The address-identity question is carried OPEN.** `100.50.2.212` ↔
`10.0.20.224` DB-layer identity is an open register item. **The filed document
takes no position in either direction**, and cites the item as **carried from a
voided carrier** (`[3]_Known-Benign_Baseline.md`, TERMINAL SUPERSEDE prepended
2026-07-31), last adjudicated 2026-06-22. **Voiding for execution is not closure
of a register item.**

**One unauthorized endpoint probe occurred in the drafting session of
2026-08-28** and is recorded on the filed document's face at §R3.6, with the two
verbatim false attestations and one false compound clause it contradicted.
**Recorded, not mitigated.** The rule adopted from it — *no non-performance
attestation ships without being checked against the session's own disclosures*,
extended to counts and cross-references — is stated there.

**The shared blocker is restated.** Not *"no non-host route has been
established"* — one has. **The blocker is that the established route requires
the operator to run the query.** Items 9 and 11 remain downstream. Filed
document §R4.

---

# §S3. What this amendment does not do

- **Does not close `v25` Sec 6 item 8.** Item 8 remains Evoni-gated and NOT
  PERFORMED.
- **Does not close items 9 or 11.** Both remain Evoni-gated and NOT PERFORMED.
  **None of the three is inferred.**
- **Does not rule on the route question.** Held deliberately per
  `Item8_Correction_Handoff_2026-08-28.md` §H8.
- **Does not close the `100.50.2.212` / `10.0.20.224` identity question**, and
  takes no position on it.
- **Does not carry the filed document's evidence.** It points.
- **Does not re-derive any AWS state.** The SG enumerations are carried at their
  sources — 2026-06-14, 2026-06-22, 2026-07-14, 2026-08-03.
- **Does not mint.** No FD, XK, or PE number.
- **Does not authorize a host session, an AWS call, a VPN, a bastion, an SSH
  tunnel, or SSM port forwarding.**
- **Does not amend `v25` Sec 6's item count.** Fifteen entries stand — items
  1–14 with item 10 split into 10-A (read discharged) and 10-B (disposition
  open).

---

*Type: pointer amendment. Records one filing and points at its authority.
Records no closure. Edits no file outside `docs/audit/`. No host, AWS, database,
or Cognito contact. No infrastructure endpoint exercised. Prod FROZEN.*
