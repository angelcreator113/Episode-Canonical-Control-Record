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
> Sec 6 item 3; Sec 6 item 6; Sec 5.2 (PE #63); Sec 4.5 (facts that close
> correctly with no route back to the checklist carrying them).
> **This banner points and carries nothing.**
>
> **Retained rather than deleted** so the in-body author line survives at HEAD
> and forward pointers to this path continue to resolve.
> `Finding_Authorship_Record_Preservation_2026-08-24.md` §7; that finding
> requests retention of nothing and this is not filed under it.
>
> Mints nothing. Changes no gate, finding, severity, owner, or disposition.
> Prod FROZEN.

# v25 Draft Material — Items 3 and 6: Perennial Discharges

| | |
|---|---|
| **Purpose** | Discharge of item 3 (Cross-Keystone Register integrity) and item 6 (PE #63) at basis `7c508189`. Draft material for the v25 author. |
| **Created** | 2026-08-24 |
| **Basis** | Reads against `origin/main` at `7c508189c369a5a384d55cc2bea371d9ebec56f3`. Working-tree comparison at local `f26da3eb`. |
| **Absorption condition** | **Draft material, not a chain link.** Void on v25 landing. Supersedes nothing, superseded by nothing, holds no place in any chain. |
| **Companion** | `docs/audit/v25_Draft_Material_Item2_2026-08-24.md` — same branch, item 2's discharge. §5 below is the mirror of that document's §8.1 and should be read with it. **That file does not point here** (see §4.3). |
| **Sibling** | `docs/audit/v25_Draft_Material_2026-08-24.md`, at `2354f7ab6f0f1deee42007f449c74c7e82048a15` on branch `claude/v25-sec6-prep-1cu9c0`. Pointer remains one-way. This branch now carries two files; that branch carries one; none is on `main`. |
| **Authority note** | Mints nothing. No FD, no XK, no PE. Closes no finding, reopens none, changes no gate, disposition, owner or severity. No live database contact. No live GitHub API contact (see §3.3). |

---

## §1 What this discharges

Two perennials from Audit Handoff v24 Sec 6. Both were **answered in advance** by
prior reads. Neither was **discharged** by them. A perennial answered in advance
is still a perennial; the discharge is the performance, not the transcription.

---

## §2 Item 3 — Cross-Keystone Register integrity

### §2.1 Result

| Check | Result |
|---|---|
| Blob at `origin/main` | `d277588c81cf9bedea52aa015f79311e769a57f9` |
| Working-tree file, `git hash-object` off disk | `d277588c81cf9bedea52aa015f79311e769a57f9` |
| `git diff --quiet origin/main -- <path>` | exit 0 |
| Non-zero, working tree | 29155 bytes |
| Non-zero, ref blob | 29155 bytes |

Byte-identity confirmed. Matches the value v24 Sec 1.1 recorded on 2026-08-22;
the register has not moved on the remote across the intervening two days.

Non-zero was asserted independently on both sides. Identity between two
zero-length files hashes consistently and establishes nothing.

### §2.2 Instrument discipline

No content was routed through a shell. `git hash-object` reads the file directly
off disk; `git rev-parse <ref>:<path>` reads blob identity at the ref. Neither
passes bytes through a redirect that can re-encode them.

v24 Sec 1.1's warning is stated in PowerShell terms — its first attempt hashed a
`git show` redirect and *"measured PowerShell's output encoding, not repository
divergence."* **The general form is not PowerShell-specific:** do not round-trip
repository content through anything that can re-encode it. Blob identity or
`git diff --quiet`, nothing in between. This session ran in bash, where the
specific hazard does not reach, and observed the general rule anyway.

### §2.3 What this discharge is, and is not

Two failure modes could have produced divergence. **They were not equally at risk.**

- **Ruled out by construction.** `git diff --name-only origin/main..HEAD` returns
  exactly one path — `docs/audit/v25_Draft_Material_Item2_2026-08-24.md`. The
  register is not in that set. This session's commit could not have moved it.
- **Genuinely exercised.** The working-tree axis was tested and clean. An
  uncommitted local edit would have produced a `hash-object` mismatch and a
  nonzero `diff --quiet`. There was none.

**One axis was untestable here.** A session that had edited the register would
exercise a path this one structurally could not. Recording that is what makes
this a discharge rather than a claim of full-strength verification.

---

## §3 Item 6 — PE #63

### §3.1 Already discharged, by v24's second option

v24 Sec 6 offers two routes: re-measure against the population where the token
acts, **or** land an explicit retirement/supersession.

**The retirement landed 2026-08-22, at basis `36f11156`, before this session
opened.** `Session_PE_Roster.md` PE #63 carries *Amendment 1 — PE #63 RETIRED;
CLOSED BY RULING*. Its ruling:

> **Ruling:** retire the standing rate and close PE #63. **Do not re-run a
> rolling `main`-commit metric.**

No measurement was performed. For the `main`-commit population it is ruled
against; for the `claude/**` population it is gated behind an unfired
reactivation condition (§3.3).

### §3.2 "The population where the token acts" — already authoritatively defined

v24 does not define the phrase. The amendment does, and the definition is the
reason for the retirement:

`auto-merge-to-dev.yml` reads `github.event.head_commit.message` on pushes to
`claude/**`. Squash-merged `main` commits are **different objects in a different
ref population**. A token present or absent on `main` never participated in the
workflow decision the metric purported to measure.

The amendment is precise that this is **method retirement, not finding
retraction**: the convention's compliance was not disproved; the instrument
could not see it.

This is the morning's recurring class from the other side — an instrument
measuring the population it could reach rather than the population that mattered.

### §3.3 Reactivation condition — checked, not assumed

> if `Auto-merge to Dev` is proposed for API re-enablement, **or its trigger
> scope is changed**, the re-enablement instrument must re-open measurement
> against the actual eligible branch-head push population

| Limb | Status | Basis |
|---|---|---|
| Trigger scope changed | **NOT FIRED** | At `7c508189` the workflow reads `on: push: branches: - 'claude/**'`. Last touched by `5067b976`, 2026-05-28 — three months before the ruling. |
| Proposed for API re-enablement | **NOT ESTABLISHABLE HERE** | Not a repository fact. The amendment recorded `disabled_manually` via GitHub's API at its own basis. Current state not read. |

**Limb 1 is not asserted in either direction.** It requires a live GitHub read,
which this register gates. **The gating is itself the reason the limb cannot
close from here** — the condition is written against a system the discharge
procedure is not permitted to query. Recorded as a structural limit on how far
this item can be discharged from the tree alone.

### §3.4 Observer contamination, and what it demonstrates

This session pushed `f26da3eb` to `claude/git-head-origin-main-i9yqsn` with
`[skip-automerge]` in its subject. That is a `claude/**` push head and it is in
the eligible population.

Two consequences:

1. **Any rate computed here would include a data point created by the party
   computing it**, added while aware the metric existed.
2. **It demonstrates the amendment's own argument rather than restating it.** The
   amendment found **2 of 13** heads eligible across PRs #1070–#1082 and called
   2-of-2 *"true and too small to sustain a rate."* Adding one observation to a
   population of two moves the rate by 33 percentage points. That is not a small
   sample; it is a metric with no stable referent. The eligible population is
   small enough that one session's routine filing dominates it, which is the
   structural emptying the amendment describes.

### §3.5 The underlying convention survives

The ruling withdrew the metric, not the requirement. F-Deploy-1 v1.26 §3.4's
rule stands: *"the token remains a cost-free future guard on eligible `claude/**`
pushes."* F-Deploy-1 v1.48 leaves the push-trigger decision gated.

Workflow semantics, from the file's own comment: `[skip-automerge]` anywhere in
the most recent commit message, case-insensitive; an opt-out per FD-4 Change
A-2.1 / FD-13.

---

## §4 FINDING — a class: facts that close correctly with no route back to the checklist that carries them

Three instances, none of which is a misreport. Every step in each is correct.
The defect is in the aggregate, and no participant is positioned to see it.

### §4.1 Instance 1 — PE #63

The retirement landed at `36f11156` on 2026-08-22. Audit Handoff v24's basis is
`fec15be6`; the item was live when Sec 6 was written and closed shortly after.
The subsequent owed-index amendment then declared PE #63 an **omission rather
than an absence** — a true and careful statement that the derivation made no
claim about it.

Each layer correct. **Aggregate effect: a closed item travelled to 2026-08-24
looking open**, and was opened as live work.

### §4.2 Instance 2 — item 10's discharge

Recorded on Evoni's statement: item 10's discharge lives in a banner that the
superseding document does not point at. **Not independently verified in this
session** — no read was performed against it here. Recorded as attributed, not
derived, and flagged for confirmation by whoever next touches that chain.

### §4.3 Instance 3 — §9.1's remedy, and this document's own pointer

`v25_Draft_Material_Item2_2026-08-24.md` §9.1 establishes that a POSITION read's
remote input must be `git ls-remote --heads origin main`, because a silent fetch
establishes nothing about ref currency. **A cold session opening on `main` is
exactly the session that needs that remedy, and has no route to the branch it is
filed on.** The correction sits behind the gap it corrects.

The same shape recurs one level down, in this document. §5 below is the mirror of
the item 2 document's §8.1 and points at it. **The item 2 document does not point
here.** Adding that pointer would require editing a filed document in place —
which is precisely the carriage defect recorded at its §8.1, committed in the act
of cross-referencing it. The pointer is therefore absent by decision rather than
by oversight, and is recorded here as an open instance.

### §4.4 Why this is its own class

It is not the "instrument reports the state it can name" family: nothing here
misreports. It is not disclosed lag: no participant published a blind spot,
because no participant has one. It is not the third bin of a documented principle
left unapplied: the principle would be new.

**A fact closes correctly, and the artifact that would send a reader to it never
learns.** The routing is missing, not the information. Every instance is
discoverable only from outside all the documents involved.

---

## §5 The `Status: OPEN` trailer — carriage hazard, mirror image

*Companion to `v25_Draft_Material_Item2_2026-08-24.md` §8.1.*

**Flagged for whoever next reads `Session_PE_Roster.md`.**

PE #63's header reads `(P2, OPEN, NEW 2026-08-19)` and its trailer reads
`**Status:** OPEN`. Both are the **preserved original body** under
additive-supersede. Amendment 1 prepends above them and closes the item.
**The banner is operative; the body's `OPEN` is historical.**

A reader keying on the trailer — the conventional place to look for status —
reports PE #63 open. This is not hypothetical: it is how the item reached this
session's docket as live work.

Set against the in-place-amendment defect recorded at the companion document's
§8.1:

| | F-Deploy-1 v1.48 | PE #63 |
|---|---|---|
| What moved | the content | the banner |
| What did not | the revision number | the body's status line |
| Where the stale value sits | in the identifier a reader sorts on | in the field a reader keys on |
| Failure mode | **silent** | **silent** |

Opposite mechanisms, identical outcome. **Neither announces itself.** Per the
companion's §8.2, the axis that separates safe instruments from dangerous ones is
failure visibility, not accuracy — and both of these fail invisibly.

---

## §6 Open, carried

| Item | Status |
|---|---|
| PE #63 reactivation limb 1 | Not establishable from the tree; requires a live GitHub read this register gates. §3.3. |
| Item 10's discharge banner | Attributed, unverified here. §4.2. |
| Forward pointer, item 2 document → this document | Absent by decision. §4.3. |
| Two-branch draft material, one-way pointer | Unchanged. Decision owed on co-location or both landing on `main`. |
| `Status: OPEN` trailer on PE #63 | Flagged, uncorrected. Correcting a roster body is not this document's business. |

---

## §7 What this document does not do

- Does not mint. No FD, no XK, no PE.
- Does not measure PE #63's compliance, in any population.
- Does not read, enable, disable, or edit any workflow.
- Does not contact GitHub's API, any deployed host, or any database.
- Does not close, reopen, or re-dispose any finding.
- Does not correct `Session_PE_Roster.md`'s trailer or any other document's body.
- Does not verify §4.2's attributed instance.
- Does not confer authority on itself. Draft material, void on v25 landing.
- Prod untouched.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | §1 discharge-versus-transcription distinction. §2 item 3 discharged: blob `d277588c` byte-identity, five checks, non-zero both sides. §2.2 instrument discipline, general form of v24 Sec 1.1's warning. §2.3 one failure mode ruled out by construction, one exercised, one untestable. §3 item 6 discharged by pre-existing retirement at `36f11156`. §3.2 population authoritatively defined by the amendment; method retirement not finding retraction. §3.3 reactivation limb 2 not fired, limb 1 not establishable and not asserted. §3.4 observer contamination and the 33-point demonstration. §3.5 surviving convention. §4 the class: facts that close with no route back. §4.1 PE #63. §4.2 item 10, attributed and unverified. §4.3 §9.1's remedy, and this document's own missing forward pointer. §4.4 why it is distinct from three prior classes. §5 `Status: OPEN` trailer as mirror of the companion's §8.1. §6 five carried items. §7 non-actions. |

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-24. `origin/main` at `7c508189`.*
*v25 draft material. Void on v25 landing. Mints nothing. Evaluates no fix. No live database contact. No live GitHub API contact.*
*Companion: `docs/audit/v25_Draft_Material_Item2_2026-08-24.md`, same branch.*
*Sibling: `docs/audit/v25_Draft_Material_2026-08-24.md` at `2354f7ab6f0f1deee42007f449c74c7e82048a15` on `claude/v25-sec6-prep-1cu9c0`.*
