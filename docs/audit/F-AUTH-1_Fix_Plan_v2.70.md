| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Rules the three itemization deltas. Mints nothing. Limb 1 remains DISCHARGED.* |
| --- |

**Document version**

**v2.70 — FIX PLAN REVISION. Mints nothing. Rules on the three itemization
deltas recorded across CP2's, CP3's, and CP12's itemization documents.**
This document lands Evoni's ruling, given directly in session and filed
at issue #1236, transcribed verbatim below — see §3. **The register tail
moves from `v2.69` to `v2.70` as of this filing.**

**Predecessor:** `F-AUTH-1_Fix_Plan_v2.69.md`. **v2.69's five rulings
stand and are not re-ruled here** — this document adds a sixth matter:
disposition of the three itemization deltas that v2.69 Ruling 1 and §7
item 1 left open pending the itemized audit's completion. **What v2.70
supersedes:** v2.69 §7 item 1's framing of the itemized audit as owed in
full — CP12's itemization (the third and last of the three instruments)
has since landed (PR #1231), and `PROJECT_CONTEXT.md`'s refresh (Task
#1234) already recorded itemization work as complete; this document is
the first Fix Plan revision to rule on what the resulting deltas mean.
**What stands unchanged:** limb 1's discharge (v2.69 §6 Ruling 1), the
FD-64 and PE #65 closures (Rulings 2 and 4), FD-67's open status (Ruling
3), and FD-70's unminted status alongside the two CP6 disagrees'
disposition (Ruling 5) — none of these is re-ruled or touched here.

**Basis:** `origin/main` at `641fcacea6b7ef3e4ece3003dd84f4760b7366a9`,
2026-09-04.

```
$ ls docs/audit | grep -E '^F-AUTH-1_Fix_Plan_v[0-9.]+' | sort -V | tail -3
F-AUTH-1_Fix_Plan_v2.68.md
F-AUTH-1_Fix_Plan_v2.69.md
F-AUTH-1_Fix_Plan_v2.69_SCAFFOLD.md
```

No `F-AUTH-1_Fix_Plan_v2.70.md` existed on `main` before this document.
`v2.69` was the newest Fix Plan revision; this document supersedes it as
tail.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.
**Ruling by Evoni**, given directly in session and filed at issue #1236,
transcribed verbatim below — see §3.

**Status**

**Revision. Rules one matter, on Evoni's word.** Three itemization deltas
— CP2 (+23 on ~144), CP3 (+4 on ~65), CP12 rows 1/7/9 (+27/0/0 on
~115/~28/~25) — recorded; **none minted**. Limb 1 remains **DISCHARGED**,
unchanged from `v2.69`. FD tail remains **FD-69** (retired; FD-70
next-available, unminted); XK tail **XK-3**; PE tail **PE #68**. Prod
**FROZEN**.

---

# §1. Register tails, re-derived with both instruments

**Onboarding §4 rule 4, both instruments, re-run at this basis:**

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ for f in v2.67 v2.68 v2.69; do
    echo "$f: $(grep -oE 'FD-[0-9]+' docs/audit/F-AUTH-1_Fix_Plan_$f.md | sort -t- -k2 -n -u | tail -1)"
  done
v2.67: FD-69
v2.68: FD-69
v2.69: FD-70

$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md
56:### XK-1 — `paranoid` exposure
207:### XK-2 — row-scope not enforced in SQL
288:### XK-3 — no authorization substrate for the tenancy root

$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -3
66
67
68
```

**The cross-revision instrument's raw output names `FD-70` for `v2.69`;
this is not a second mint.** `v2.69`'s own text mentions `FD-70` six
times — Ruling 5's title, its "do not mint" ruling, and §7/§8's
references — all "next-available, unminted" citations, the same
distinction `v2.69` §2 and `PROJECT_CONTEXT.md` §6.3 already draw. Both
instruments agree the tail is **FD-69**, retired; **FD-70 remains
next-available and unminted**, unchanged by this document. XK tail
**XK-3**. PE tail **PE #68**. All three unchanged from `v2.69`'s own
re-derivation.

---

# §2. Evidence this ruling cites

**Verified present at this basis; cited, not restated as this document's
own findings.**

```
$ git show origin/main:docs/audit/F-AUTH-1_Limb1_CP2_Itemization_2026-09-03.md | head -3
| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP2 ITEMIZATION** *Itemizes CP2's row 9 aggregate cannot-tell to real addresses. Does not confirm, re-derive, or rule. Does not reopen limb 1.* |
| --- |

$ git show origin/main:docs/audit/F-AUTH-1_Limb1_CP3_Itemization_2026-09-04.md | head -3
| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP3 ITEMIZATION** *Itemizes CP3's row 7 aggregate cannot-tell to real addresses. Does not confirm, re-derive, or rule. Does not reopen limb 1.* |
| --- |

$ git show origin/main:docs/audit/F-AUTH-1_Limb1_CP12_Itemization_2026-09-04.md | head -3
> **BANNER — §7 AND §8 CARRY THIS DOCUMENT'S OWN INFERENCE, NOT CP12'S
> RECORD** (added 2026-09-04, additive). This document's task authorization —
> issue #1230's Do-not list — was to record the three measured deltas and

$ git show origin/main:docs/audit/F-AUTH-1_Limb1_CP12_Itemization_2026-09-04.md | grep -c "^> \*\*BANNER"
1
```

Four documents: **CP2's itemization** (`F-AUTH-1_Limb1_CP2_Itemization_2026-09-03.md`,
PR #1219) — 121 addressed handlers against a recorded ~144. **CP3's
itemization** (`F-AUTH-1_Limb1_CP3_Itemization_2026-09-04.md`, PR #1227)
— 61 addressed handlers against a recorded ~65. **CP12's itemization**
(`F-AUTH-1_Limb1_CP12_Itemization_2026-09-04.md`, PR #1231) — rows 1/7/9:
142/28/25 addressed against ~115/~28/~25 recorded. **CP12's additive
inference banner** (same file, PR #1233) — discloses that the document's
own §7 and §8 connect the delta pattern to a causal account as the
drafting session's inference, not a statement CP12's own confirmation
document makes.

**CP12's own accounting, re-verified here:**

```
$ git show origin/main:docs/audit/F-AUTH-1_Limb1_CP12_Itemization_2026-09-04.md | grep -n "^# §6" -A 8
450:# §6. Accounting for all 212
451-
452-```
453-Row 1 (Tier 1):                  142
454-Row 7 (Tier 4 PUBLIC):             28
455-Row 9 (AI POST remainder):         25
456-Excluded (rows 2/3/4/5/6/8):       17
457-                                  ---
458-TOTAL:                            212
459-```
```

142+28+25+17=212 confirmed against the merged document — every route in
CP12's cluster is accounted for in a named class. **CP2's and CP3's own
accounting sections were NOT re-verified for this document or for the
ruling at §3** — their itemizations are cited as filed, not re-checked.
This limitation is part of the ruling's own rationale, not an omission.

---

# §3. The ruling

**Filed by Evoni, transcribed verbatim. No word altered.**

> **Ruling.** The three itemization deltas are recorded and none is
> minted. No FD, XK, or PE follows from any of them.
>
> **Rationale.** Each delta is a counting error in a recorded total, not
> a coverage gap. Every route in the CP12 cluster is accounted for in a
> named class — §6's 142+28+25+17=212 matches the cluster's route count
> exactly — and CP2's and CP3's itemizations record their own accounting
> as filed, not re-verified for this ruling. The magnitude of a counting
> error does not change what kind of error it is: +27 and +4 are the same
> species — same disposition, not the same diagnostic story; the three
> deltas arose differently and this ruling makes no claim otherwise. The
> larger figure gets no different treatment than the smaller. This is
> consistent with the CP6 counting errors ruled at
> `F-AUTH-1_Fix_Plan_v2.69.md` §6 Ruling 5, though it rests on a different
> instrument and does not adopt that ruling's phrasing. Whether each
> route's class assignment is correct is a separate question the
> itemizations were barred from reaching, and this ruling does not reach
> it either. `F-AUTH-1_Limb1_CP12_Itemization_2026-09-04.md`'s §7/§8
> offer a causal account of row 1's delta; that account is on record as
> argument (per its 2026-09-04 banner) and this ruling neither adopts nor
> rejects it — it is unnecessary either way, since the ruling does not
> turn on why the delta exists.
>
> *Provenance: this ruling's wording was proposed by the drafting session
> and approved by Evoni, not composed by her. The decision it records —
> that the magnitude of a counting error does not change its disposition
> — is Evoni's, given in response to the question of whether the deltas'
> size changed her earlier reasoning. Disclosed per the same test
> `F-AUTH-1_Fix_Plan_v2.69.md`'s Ruling 2 note and correction banner
> apply.*

---

# §4. Owed carried forward — none minted here

**v2.69 §7 item 1 (the itemized audit) is complete as of `PR #1231`; this
document is its disposition — see §3.** Items 2 and 3 continue
unchanged, carried forward, not addressed here:

1. **`src/models/index.js`'s hand-maintained `models` subset omitting
   `AssetRole`** (and possibly others, unevaluated) — unchanged from
   `v2.69` §7 item 2.
2. **Per-item Tier adjudication of the 40 declarations touched by
   FD-67's remedy** — unchanged from `v2.69` §7 item 3.

None of the two mints an FD, XK, or PE number. Neither is closed by this
revision.

---

# §5. What this revision does not do

- **Does not adopt, reject, or characterize CP12 §7/§8's causal
  account.** The ruling (§3) explicitly leaves it undecided — unnecessary
  to the ruling either way.
- **Does not mint FD-70 or any number**, and does not state that any of
  the three deltas warrants a finding.
- **Does not rule on class-assignment correctness** for any route in any
  of the three itemizations. That question is separate and unreached
  (§3).
- **Does not reopen limb 1.** Limb 1 remains DISCHARGED per `v2.69` §6
  Ruling 1, unchanged.
- **Does not touch FD-63, FD-67, or the FD-68/FD-65 severity
  adjudication.** All carried unchanged from `v2.69`.
- **Does not re-verify CP2's or CP3's own accounting sections.** Cited as
  filed (§2); the ruling's rationale states this limitation on its face.
- **Does not edit `v2.69`, the three itemization documents, or any other
  filed document.** All stay on `main`, unedited, as filed.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---
