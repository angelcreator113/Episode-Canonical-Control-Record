# Finding — checks that cannot fail report success

| | |
|---|---|
| **Purpose** | Names a failure class with five instances observed in one working session, five distinct mechanisms, one shape. Cross-cutting; belongs to no keystone. |
| **Basis** | `main` at `af67f110`. All instances observed in the course of F-AUTH-1 and register work on 2026-08-24. |
| **Standing** | Observation. **Mints nothing.** No FD, no XK, no PE. Closes no finding, changes no gate, disposition, owner or severity. |
| **Notation** | `#NNN` references wrapped in inline code throughout. |

---

## §1 The class

**A check that cannot fail reports success, and success from a check with no coverage is indistinguishable from success from a check that passed.**

This is distinct from the register's stale-basis class. Stale-basis produces a **wrong value from a real measurement**. This produces a **right-looking value from a measurement that never occurred**. The remedies differ: stale-basis needs re-derivation at the current basis; this needs a positive control.

---

## §2 The five instances

| # | Mechanism | What it reported | Why it could not fail |
|---|---|---|---|
| 1 | **Inert scan** | `raw 0, bare 0 → ALL WRAPPED` | The document contained no references. "All wrapped" was true of the empty set. |
| 2 | **Tuned detector** | three references still bare, after wrapping | The pattern tested the character preceding `#`, which is a space inside an inline code span. It would report identical failure whether or not the wrap succeeded. |
| 3 | **Nonexistent pathspec** | no matches in `frontend/src/context/` | The directory is `contexts/`. `git grep` reports no error for a pathspec matching nothing, so the search silently under-covered. |
| 4 | **Wrong-document citation** | a `§7` that exists but is the wrong `§7` | `F-Deploy-1_Fix_Plan_v1.5.md` §7 is an unblock table; the target was `F-AUTH-1_Fix_Plan_v1.5.md` §7, the Post-Deploy Verification Checklist. Reading the cited document returns a confident answer about the wrong thing. |
| 5 | **Encoding-defeated symbol** | zero hits for `§7` | `F-AUTH-1_Fix_Plan_v1.5.md` carries UTF-8/CP1252 mojibake — `§` renders as `┬º`, em dash as `ΓÇö`. A search by symbol returns zero and invites the conclusion that the section is absent. |

**Five mechanisms. One outcome: a clean report from an instrument that was not looking at the thing.**

### §2.1 Instance 4 is the dangerous one

Instances 1, 3 and 5 return **nothing**, which at least prompts a second look. Instance 2 returned a **false negative** that was caught because it contradicted a known-true fact.

**Instance 4 returns a substantive, well-formed, wrong answer.** The cited document exists, contains a section with the cited number, and reading it produces a coherent result. Nothing in the output signals that the citation pointed elsewhere. It was caught only because the document's section title did not match what the citation claimed it contained.

---

## §3 The remedy is a positive control, not more care

**A control that only demonstrates no-false-positive is not a control.** A detector that always returns zero passes it.

Both halves are required:

- **Negative control** — the instrument reports clean on input known to be clean.
- **Positive control** — the instrument reports a hit on input known to contain one.

Instance 1 was caught by asking what the scan had actually examined. Instance 2 was caught by re-verifying with a test constructed so it could fail. Instance 3 was caught by listing the directory. Instance 4 was caught by checking the cited section's title against the claim. Instance 5 was caught by the symbol's absence being implausible.

**Every catch came from asking what the instrument looked at, not from looking harder at its output.**

### §3.1 For citations specifically

A citation to `<document> <section>` is checkable before it is relied on: **confirm the section's own title matches what the citation claims it contains.** Instance 4 would not have survived that check, and it costs one read.

---

## §4 Relationship to the session's other dominant class

The stale-basis class — a measurement true at its basis, cited later as though basis-free — accumulated a comparable number of instances in the same period.

**They are not the same failure and should not be merged.**

| | Stale-basis | Check-cannot-fail |
|---|---|---|
| Measurement occurred | **yes** | **no** |
| Output | wrong value | right-looking value, no coverage |
| Detected by | re-deriving at the current basis | asking what the instrument examined |
| Remedy | restate the basis; re-derive | positive control |

---

## §5 Bounds

- **Five instances in one session is not a rate.** No sampling was performed and no prior session was examined for the same shape. The class is named on its mechanism, not on a frequency claim.
- **All five were observed in the executing party's own instruments.** Whether the class appears in the register's filed instruments is unexamined.
- **Instance 5's mojibake is recorded as observed**, not diagnosed. Whether other register documents carry the same encoding damage is unread.

---

## §6 What this document does not do

- Does not mint. No FD, no XK, no PE.
- Does not audit the register for further instances.
- Does not amend any document in which an instance occurred.
- Does not claim a rate or a trend. §5.
- Does not repair the mojibake in `F-AUTH-1_Fix_Plan_v1.5.md`.
- Changes no gate, disposition, owner or severity. No live contact of any kind.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | §1 names the class and distinguishes it from stale-basis. §2 five instances with mechanism and reason each could not fail. §2.1 the wrong-document citation as the most dangerous, because it returns a coherent substantive answer. §3 the remedy is a positive control; both halves required; every catch came from asking what the instrument examined. §3.1 the one-read check for citations. §4 side-by-side against stale-basis, with the two kept distinct. §5 three bounds, including that five instances is not a rate. §6 non-actions. |

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-08-24. Basis `main` at `af67f110`. Observation only. Mints nothing. No live contact.*
