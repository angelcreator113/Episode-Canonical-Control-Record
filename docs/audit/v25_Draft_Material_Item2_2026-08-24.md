# v25 Draft Material — Item 2: Authority Derivation Reproduced

| | |
|---|---|
| **Purpose** | Discharge of item 2 (authority table) at basis `7c508189`. Draft material for the v25 author. |
| **Created** | 2026-08-24 |
| **Basis** | `7c508189c369a5a384d55cc2bea371d9ebec56f3` (`origin/main`, established by remote read — see §2). |
| **Absorption condition** | **This document is draft material, not a chain link.** It is void on v25 landing. It supersedes nothing, is superseded by nothing, and holds no place in any Fix Plan chain. |
| **Sibling** | `docs/audit/v25_Draft_Material_2026-08-24.md`, at commit `2354f7ab6f0f1deee42007f449c74c7e82048a15` on branch `claude/v25-sec6-prep-1cu9c0`. **That file does not point back to this one.** The pointer is one-way; both are v25 draft material from consecutive sessions and neither is on `main`. |
| **Authority note** | Mints nothing. No FD, no XK, no PE. Register tails recorded below are **derived-at-basis readings taken from document faces**, not stamps. Closes no finding, reopens none, changes no gate, disposition, owner or severity. No live database contact. |

---

## §1 What this discharges

Item 2 is not a lookup. Audit Handoff v24 Sec 1 states its own standing:

> **Derived at `fec15be6` by numeric sort and live reads. This table is a
> snapshot of a derivation, not authority. Sec 6 requires reproducing it.**

Item 2 is that reproduction, performed at `7c508189`. Two halves, both run:
the **numeric sort** half (chain tails) and the **live read** half (does the
tail hold a face).

---

## §2 Basis, and how it was established

The basis was **not** taken from a local remote-tracking ref. §9.1 records why.

| Step | Instrument | Result |
|---|---|---|
| Remote head | `git ls-remote --heads origin main` | `7c508189c369a5a384d55cc2bea371d9ebec56f3` |
| Local position | `git rev-list --left-right --count origin/main...HEAD` | `0 0` — identical |
| Graph completeness | `git rev-parse --is-shallow-repository` | `false`, after `git fetch --unshallow origin` |

All reads below are `git show origin/main:<path>` — ref-explicit by path.
Checkout position is not consulted.

---

## §3 Sec 1 reproduced at `7c508189`

| Layer | v24 (at `fec15be6`) | Reproduced (at `7c508189`) | Δ |
|---|---|---|---|
| F-AUTH-1 | `F-AUTH-1_Fix_Plan_v2.61.md` | **`F-AUTH-1_Fix_Plan_v2.68.md`** | **+7 revisions** |
| F-Deploy-1 | `F-Deploy-1_Fix_Plan_v1.48.md` | **`F-Deploy-1_Fix_Plan_v1.49.md`** | **+1 revision** |
| F-Stats-1 | `F-Stats-1_Fix_Plan_v1.60.md` | `F-Stats-1_Fix_Plan_v1.60.md` | none |
| F-App-1 | `F-App-1_Fix_Plan_v1.1.md` | `F-App-1_Fix_Plan_v1.1.md` | none |
| Cross-keystone | `Cross_Keystone_Register.md` | same; blob `d277588c81cf9bedea52aa015f79311e769a57f9` | none |
| Handoff | `Prime_Studios_Audit_Handoff_v24.md` | same | none |

**Rows NOT reproduced — aged, carrying v24's values:** `Paranoid_Exposure_Inventory_2026-08-07.md`,
`Session_PE_Roster.md`, `F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md`.
These were not re-read at this basis. Their v24 values are recorded as aged, not confirmed.

### §3.1 Register tails at this basis

**FD-69 · XK-3 · PE #67.**

Read from v2.68's face, which records FD-69 spent on a duplicate and retired at
PR #1102. v24 recorded the global FD tail at FD-68; it has moved.

F-Stats-1 v1.60's face records **FD-62** as *its own register's* tail. v24
recorded the same. This is a per-register tail, not the global tail, and the
agreement between the two is agreement — not drift, and not a contradiction of
FD-69.

### §3.2 Cross-Keystone integrity blob

`d277588c81cf9bedea52aa015f79311e769a57f9`, unchanged from v24 Sec 1.1's
recorded value. Path last touched `470ad7a1` on 2026-08-19, three days before
v24's check. Read via `git rev-parse origin/main:<path>` — Git blob identity,
per v24 Sec 1.1's own remedy, not a shell round-trip.

---

## §4 Live-read half — dispositions of the four tails

"Holds a face" was operationalized **before** the reads, four ways, with the
failing modes kept distinct because they have different consequences:

| Disposition | Test | Consequence |
|---|---|---|
| HOLDS FACE | asserts operative status for its keystone, at a stated basis, not self-negated | is the authority |
| DRAFT | self-marks draft in filename or front matter | not authority; prior non-draft is |
| SUPERSEDED | banner ceding to a later or other revision | not authority; banner names successor |
| STUB | exists, asserts no keystone status | not authority; **no successor named** — a gap, not a pointer |

DRAFT and SUPERSEDED point somewhere. STUB does not, and would leave a chain
faceless. All four tails resolved to HOLDS FACE.

| Chain | Tail | Disposition | Face | Basis on face |
|---|---|---|---|---|
| F-AUTH-1 | `v2.68` | **HOLDS FACE** | "Ruling. Five dispositions, all definitional." Limb 1 OPEN; Dimension 3 NOT PERFORMED; limb 3 open; G4 not enterable; ASSESSMENT NOT COMPLETED; Prod FROZEN. | `29cee698`, 2026-08-22 |
| F-Deploy-1 | `v1.49` | **HOLDS FACE** | "Correction of carriage." F-Deploy-1 remains CLOSED. | `29cee698`, 2026-08-22 |
| F-Stats-1 | `v1.60` | **HOLDS FACE** | Additive-supersede on v1.59; Phase B; shape 40 sites / 39 handlers / 20 files, unminted. | `5f7ee6b4` |
| F-App-1 | `v1.1` | **HOLDS FACE** | Supersedes v1.0; SHIPPED; G1–G3 complete, G4 skipped, G5 via incident, G6 soak; Path A locked. | supersedes `v1.0` at `8cc2590` |

Negatives on DRAFT / SUPERSEDED / STUB were established by **exhaustive
vocabulary match** over each document, not by absence of notice.

---

## §5 THIS TABLE'S BLIND SPOT — travels with the table

**The numeric-sort half detects chain tails. It cannot detect a non-tail
document amended in place after merge.**

F-Deploy-1 v1.48 was exactly that. The amendment became visible to sorting only
when v1.49 was minted for that purpose. If any other chain carries an in-place
amendment, §3 above is stale in precisely that way, **with no signal available
from the instrument used**.

Detecting it requires blob-level comparison across each chain's history. That
was not run. §3 is correct on tails and **silent on in-place amendment**.

This clause is not a caveat to be dropped in transcription. It states what the
table cannot see, and any use of §3 that omits it overclaims.

---

## §6 Family enumeration at basis, and its two-way limit

369 entries in `docs/audit/` at `7c508189`, read from the commit object via
`git ls-tree` — not the filesystem.

| # | Family | Count |
|---|---|---|
| 01 | Owed-Index chain | 8 |
| 02 | Handoff register | 27 |
| 03 | F-AUTH-1 | 61 |
| 04 | F-Deploy-1 | 161 |
| 05 | F-Deploy-G1 (pre-keystone) | 4 |
| 06 | F-Stats-1 | 70 |
| 07 | F-App-1 | 5 |
| 08 | F-Sec-3 | 2 |
| 09 | F-CW-1 | 1 |
| 10 | F-Tools-1 | 1 |
| 11 | Frontend-IA | 9 |
| 12 | FD-numbered standalone | 4 |
| 13 | Cross-cutting set | 16 |
| | **Total** | **369** |

**v24's five families (F-AUTH-1, F-Deploy-1, F-Stats-1, F-App-1, Handoff) cover
324 of 369.** Forty-five files sit outside them — including the entire
owed-index chain.

### §6.1 The limit runs both ways

The locked fix-cycle sequence names **nine** keystones (v24 Sec 2): F-AUTH-1,
F-Deploy-1, F-App-1, F-Stats-1, F-Ward-1, F-Reg-2, F-Ward-3, F-Franchise-1,
F-Sec-3.

- **Four sequence keystones have zero repository presence** — `F-Ward-1`,
  `F-Reg-2`, `F-Ward-3`, `F-Franchise-1`. Zero path matches tree-wide. Any
  enumeration derived from `docs/audit/` is structurally blind to them.
- **Three documented families are not sequence keystones** — `F-CW-1`,
  `F-Tools-1`, `F-Deploy-G1`.

**Neither set contains the other.** An enumeration stating only the first
direction overclaims.

v24 Sec 2 records F-Ward-1 and F-Ward-3 as **Queued**, and independently records
the same zero-artifact negative, at basis `fec15be6`. The negative is confirmed
to persist at `7c508189`; the *status* is v24's claim at its own basis and does
not travel.

### §6.2 Family 13 has two membership rules, not one

Called "unfiled residual" on first derivation. That framing was wrong and is
retired. Two distinct rules produce its membership:

1. **Cross-cutting documents** — belong to no workstream *because* they serve
   several. `Cross_Keystone_Register.md`, `Paranoid_Exposure_Inventory_2026-08-07.md`,
   `Session_PE_Roster.md`. All three are cited by v24 Sec 1 as authorities.
2. **Documents belonging to keystones with no prefix yet** —
   `DirectorBrain_FrontendLeg_ScopingNote_2026-07-03.md`, where v24 Sec 2 records
   "F-Franchise-1 | Queued; Director Brain remains this keystone's resolution."

A reader deriving family 13 from rule 1 alone will mis-scope it.

### §6.3 The sort unit is the chain, not the family

A family may hold several chains, and version-ordering a mixed set has no
referent — there is no supersession relation between members of different
chains to get right.

Demonstrated: the Handoff register holds three chains
(`Audit_Handoff_vNN`, `Session_Handoff_<date>`, `Audit_Handoff_Delta_<date>`).
`sort -V` over the whole family returns
`Prime_Studios_Session_Handoff_v20_2026-06-15_FD40.md` — a June document —
while the newest member is `Prime_Studios_Audit_Handoff_v24.md`.

**This is not fixable with a comparator flag.** Derivation is three steps:
enumerate families → decompose into chains → sort within a chain.

### §6.4 Prefix is not family

Demonstrated in both directions:

- `F-AUTH-1_v2.55_Owed_Index_2026-08-19.md` carries the F-AUTH-1 prefix and
  belongs to the owed-index chain. Prefix-keying files it into a 61-entry
  family where it will not be found. (It also establishes that the owed-index
  pattern predates the v25 chain.)
- `f-auth-1_preflight_grep.ps1` is F-AUTH-1 by content, lowercase by name.
- Converse: `F-Deploy-1_Phase2A-Step3_Complete_Handoff_2026-06-25.md` and
  `F-Deploy-1_[3]_Cold_Adoption_Handoff_NAVIGATION-ONLY.md` contain "Handoff"
  and are **not** Handoff-register documents.

Family membership is a filing fact. It cannot be derived lexically.

---

## §7 Merge-order resolution — F-Deploy-1 v1.49 before F-AUTH-1 v2.68

v2.68 states a dependency on F-Deploy-1 v1.49 and warns: *"That PR should merge
first; if this one lands ahead of it, §7 cites a rule the register does not yet
hold."* Outcomes were fixed before the read. The result is that **v1.49 landed
first**, confirmed three independent ways:

| Check | Result |
|---|---|
| `merge-base --is-ancestor` | v1.49's commit IS an ancestor of v2.68's; not the reverse |
| First-parent order on `origin/main` | `4998ac91` (#1107, v1.49) precedes `16c3a36e` (#1108, v2.68) |
| Tree presence at v2.68's commit | `F-Deploy-1_Fix_Plan_v1.49.md` EXISTS in that tree |

The third answers the question as v2.68 posed it: the register held the rule at
the moment v2.68 was committed against it. **§7's citation was valid when made.**
The hazard v2.68 flagged was well-founded as a concern and did not materialize.

### §7.1 v2.68's dependency SHA does not resolve on `main`

v2.68 names `a4460f25` as F-Deploy-1 v1.49. That commit exists but is **not on
`origin/main`** — it is the pre-merge branch commit. The squash-merge at #1107
rewrote it to `4998ac91`. A reader following v2.68's dependency SHA against
`main` finds nothing.

Recorded, not corrected. Correcting a merged Fix Plan revision is not this
document's business.

---

## §8 Findings carried forward

### §8.1 A documented principle, with a known remedy, not applied at the site that needed it

F-Deploy-1 v1.49 exists because of this, and states it:

> **The defect is in the carriage, not the content:** v24 Sec 6 derives document
> authority by numeric sort, and an in-place amendment is invisible to that
> instrument — the document changed (`d4f382ba` → `0a31b603`), the number did
> not. A reader deriving authority by sorting revisions gets a stale answer with
> no signal that it is stale.

and:

> **This is the mechanism XK-1's Correction Banner 2 already declines to use**,
> on the stated grounds that a dated layer which changes after merging cannot be
> relied on for what it said on its date. **The register held the principle; it
> was not applied here.**

This is distinct from an instrument that cannot see its own blind spot, and
distinct from one that publishes it. The principle was **held, written down, and
not reached for**. It is its own class.

### §8.2 The axis is failure visibility, not precision

Two citation instruments in this register fail in opposite directions:

| Instrument | Failure mode |
|---|---|
| Cite-by-SHA across a squash-merge (§7.1) | **Fails loud.** Unresolvable, detected on first check. |
| Authority-by-numeric-sort over in-place amendment (§8.1) | **Fails silent.** Plausible, stale, no signal. |

The SHA citation is cosmetically wrong and is the safer of the two. **An
instrument that cannot silently mislead is safer than a more accurate one that
can.** This generalizes past this register and is offered as the contrast case
that gives §8.1 its edge.

---

## §9 Method findings from this session

### §9.1 A silent fetch establishes nothing about ref currency

`git fetch` printed no output. That silence was read as "remote-tracking refs
are current." It was not: `origin/main` stood at `6b0900be` while the remote was
at `7c508189`, and the ref advanced only under `git fetch --unshallow`.

Absence of output is not signal. It covers both "nothing changed" and "something
was not reported."

**Remedy: a POSITION read's remote input is `git ls-remote --heads origin main`,
not `git rev-parse origin/main`. The local ref is a cache; `ls-remote` is the
read.** This is retroactive — any POSITION reading that took a remote-tracking
ref as current on the strength of a quiet fetch inherits the defect. Such
readings may have been correct; nothing established that they were.

Corroboration that `6b0900be` was a genuine stale value rather than corruption:
F-Deploy-1 v1.49 records v1.48 as "already merged at `6b0900be`."

### §9.2 An instrument's safety can be contingent on an absence

`git status -sb` was described as a ref read. It is not, categorically: the
`[ahead N, behind M]` bracket is range-derived and carries the same shallow-clone
exposure as any graph walk. It printed safely here **only because no upstream is
configured on the branch**. That reason evaporates the moment one is set.

### §9.3 Shallow-clone interaction — OPEN, do not resolve by reasoning

Whether the shallow state **caused** §9.1's silent fetch is **unestablished**.
Two outcomes with different blast radii:

- If shallowness caused it: a shallow clone degrades a read that is not a graph
  walk — wider than the known range-read hazard.
- If not: §9.1 stands on its own and applies to full clones equally.

Distinguishing them requires a constructed control. Not attempted here.

### §9.4 Prior art, and a recurrence rate

v24 Sec 1.1 already records an instance of the "instrument reports the state it
can name" class: a PowerShell round-trip whose `Get-FileHash` mismatch
*"measured PowerShell's output encoding, not repository divergence."* Its remedy
— Git blob identity or `git diff --quiet`, never a shell round-trip — is the
instrument used at §3.2.

The class is not new. This session found further instances of something v24 named
once. What is being recorded is a recurrence rate, not a discovery.

---

## §10 Open, unresolved, carried

| Item | Status |
|---|---|
| Locked-sequence **order** | Unasserted in both documents read. Membership is nine; F-Sec-3 is last; no ordering among the remainder. Two documents assert *about* the sequence without defining it. Not hunted further. |
| In-place amendments elsewhere | Undetectable by the instrument used (§5). Scope unknown. |
| `F-AUTH-1` `.docx`-only revisions | `v2.9`, `v2.17`, `v2.19` exist as `.docx` with no `.md` sibling. Whether they carry content absent from the md chain is unread. Bears on §3's F-AUTH-1 tail claim. |
| F-Ward-1 / F-Ward-3 / F-Reg-2 / F-Franchise-1 | Zero repository presence confirmed at this basis. v24 records "Queued" at `fec15be6`; that status does not travel. |
| Shallow-clone causation | §9.3. Needs a constructed control. |
| v2.68's dangling dependency SHA | §7.1. Recorded, not corrected. |

---

## §11 What this document does not do

- Does not mint. No FD, no XK, no PE. FD-69 / XK-3 / PE #67 at §3.1 are
  derived-at-basis readings taken from document faces, not stamps.
- Does not close, reopen, or re-dispose any finding.
- Does not change any gate, severity, owner, or PR state.
- Does not supersede or amend any document it cites.
- Does not rule on the locked sequence's order.
- Does not correct v2.68's dependency SHA.
- Does not confer authority on itself. It is draft material, void on v25 landing.
- No live database contact. Prod untouched.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | §1 item 2's mandate, quoted from v24 Sec 1. §2 basis `7c508189` established by `ls-remote`, `0 0` divergence, `--is-shallow-repository false`. §3 Sec 1 reproduced, six rows, three aged rows marked. §3.1 register tails FD-69 / XK-3 / PE #67 derived at basis. §3.2 Cross-Keystone blob `d277588c` unchanged. §4 four dispositions, criterion fixed before reading, all HOLDS FACE. §5 blind-spot clause: correct on tails, silent on in-place amendment. §6 thirteen families over 369 entries. §6.1 two-way non-containment, nine sequence keystones, four with zero presence, three documented families outside. §6.2 family 13's two membership rules. §6.3 sort unit is the chain. §6.4 prefix is not family, both directions. §7 merge order resolved, three checks, v1.49 first. §7.1 v2.68's dependency SHA unresolvable on main. §8.1 documented principle not applied at the site that needed it. §8.2 failure visibility as the axis. §9.1 silent fetch establishes no ref currency. §9.2 instrument safety contingent on an absence. §9.3 shallow causation OPEN. §9.4 v24 Sec 1.1 as prior art. §10 six carried items. §11 non-actions. |

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-24. `origin/main` at `7c508189`.*
*v25 draft material. Void on v25 landing. Mints nothing. Evaluates no fix. No live database contact.*
*Sibling: `docs/audit/v25_Draft_Material_2026-08-24.md` at `2354f7ab6f0f1deee42007f449c74c7e82048a15` on `claude/v25-sec6-prep-1cu9c0`.*
