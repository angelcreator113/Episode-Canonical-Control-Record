# Finding — an obligation whose stated reason dies while the obligation lives

| | |
|---|---|
| **Purpose** | Names a failure class with one confirmed instance and one negative control that isolates its mechanism. Cross-cutting; belongs to no keystone. |
| **Basis** | `main` at `3b04d821606e175ee61a75da876cdfc95df5eec2`, confirmed by `git ls-remote --heads origin main`. Instance observed in the course of F-AUTH-1 work on 2026-08-24. |
| **Standing** | Observation. **Mints nothing.** No FD, no XK, no PE. Closes no finding, changes no gate, disposition, owner or severity. |
| **Notation** | `#NNN` references wrapped in inline code throughout. |

---

## §1 The class

**An obligation's stated ground is discharged elsewhere while the obligation itself survives on ground the record does not state.**

The obligation is still owed. Its filed reason is no longer true. Both facts are invisible from the item's own text, because the item still reads exactly as it did when the reason was alive.

The mechanism is **scope**, not error. The discharge is performed by a document scoped to a **different** obligation, which therefore has no occasion to announce what it incidentally settled. Nothing is wrong in either document. Each is accurate about what it was written to cover. The defect lives in the gap between them.

This is distinct from the register's two existing classes. It is not a wrong value from a real measurement, and it is not a clean report from an instrument with no coverage. **Here the measurement was right, the report was right, and the thing being reported on moved.**

### §1.1 The defect is bidirectional, which is what makes it dangerous

Both readings are available from the filed text, and both are wrong:

- **Read forward** — the ground is dead, therefore the item closes. This retires a live obligation.
- **Read backward** — the item is open, therefore its stated ground still holds. This defends the obligation with an argument that no longer works, and any procedure built on that argument is built on nothing.

A single-directional failure prompts a second look when its conclusion feels wrong. This one produces a confident conclusion in whichever direction the reader was already leaning.

---

## §2 The confirmed instance

**`F-AUTH-1_BranchA_Costing_2026-08-24.md` section 7, the `Rollback procedure` item.**

| | |
|---|---|
| **As filed** | *"**Owed.** Branch A says the new dev pool is 'trivially disposable'; nothing covers a partial repoint."* |
| **Stated ground** | Partial repoint. |
| **What discharged it** | `F-AUTH-1_BranchA_Prerequisite_Addendum_2026-08-24.md` section 3 item 5: the loader is evaluated before the PM2 trap is armed, so `startOrRestart ... --update-env` *"receives the complete pair or is never reached."* The value-level partial repoint is unreachable under the specified design. |
| **Why it went unannounced** | That addendum's stated purpose is to *"Resolve the `prerequisite scope and sequence` item."* It was scoped to a **different** section 7 row. It had no occasion to mention this one. |
| **What the obligation now rests on** | P9: *"Failure invokes the approved rollback; no partial-credit success."* The trigger is verification failure **after a clean repoint** — a system up, internally consistent, and wrong. |
| **Interval on dead ground** | **Unmeasured.** Both documents carry the same date. How long the item stood on a discharged reason before it was read is not established and is not inferred here. |

The two grounds are not variants of one another. A half-applied pair and a fully-applied wrong pair are different system states requiring different procedures. A rollback written against the filed ground would not cover the live trigger.

### §2.1 The negative control

**The same section 7's `COGNITO_CLIENT_SECRET handling` item is not an instance, and its not being one is the evidence.**

`F-AUTH-1_BranchA_ClientSecret_Addendum_2026-08-24.md` states its purpose as *"Resolve the `COGNITO_CLIENT_SECRET` item in ... section 7"* and closes, in its section 5: *"The section 7 item `COGNITO_CLIENT_SECRET handling` is **RESOLVED**."*

It was scoped **to** the item, so it announced the discharge. Same register, same section, same day, same author, same discipline — and no defect.

**The discriminating variable is the scope of the discharging document, not the fact of discharge, not the care taken, and not the quality of either document.** A document scoped to an item announces what it settles. A document scoped elsewhere settles silently. No amount of care applied *within* either document changes this, which is why the remedy in §3 is not "be careful."

### §2.2 The control also supplies a second hazard

That same section 5 continues: *"All other section 7 items remain in their prior state, including callback and logout URLs, domain configuration, prerequisite topology work, execution authorization, and verification procedure."*

That assertion was **true when written**. It is exactly the kind of blanket clause a later reader relies on to skip re-checking, and it is silently falsified the moment any other document discharges a ground incidentally. A register that files blanket unchanged-state claims manufactures the reader's confidence that this class then defeats.

---

## §3 The remedy is to re-read ground, not status

**Status is not ground.** "Owed" tells a reader that an obligation exists. It tells them nothing about whether the reason attached to it is still true. The two are stored in the same row and go stale independently.

Two checks, and neither is "be more careful":

1. **On resolving any item, state what else it touched.** A document that discharges a hazard it was not scoped to must say which other obligations that reaches — even to say "none identified." The cost is one sentence; the alternative is that the only party who knew moves on.
2. **On relying on any open item, re-read its stated reason against the current basis, not its status.** Ask whether the reason still describes a live hazard. This is one read, and it is the read that would have caught the instance in §2.

The second check is the one that survives contact with a register nobody fully holds in mind. It does not require the discharging author to have noticed anything.

### §3.1 Blanket unchanged-state clauses should be scoped or dropped

Per §2.2: an assertion that all *other* items are unaffected is unverifiable at the time of writing against documents not yet written. Either scope it to what was checked — "no other item was examined" — or omit it. **A document should not assert the stability of things it did not look at.**

---

## §4 The three classes, kept distinct

| | stale-basis | check-cannot-fail | obligation-outlives-its-reason |
|---|---|---|---|
| **Shape** | a measurement true at its basis, cited as basis-free | an instrument that reports success because it cannot report failure | the stated ground dies, the obligation persists unexamined |
| **Measurement occurred** | yes | no | yes |
| **Was it right when made** | yes | n/a | yes |
| **What went wrong** | the basis moved | the instrument had no coverage | the subject moved |
| **Detected by** | re-deriving at the current basis | asking what the instrument examined | re-reading the ground, not the status |
| **Remedy** | restate the basis; re-derive | positive control | state incidental discharges; re-read reasons on reliance |

They share a family resemblance — each produces a confident, well-formed output that is no longer connected to the thing it describes — but the remedies do not substitute for one another. A positive control does not detect a dead ground. Re-deriving at the current basis does not either, because the item's text re-derives to exactly itself.

---

## §5 Bounds

- **One instance is not a rate, and one instance is barely a class.** It is named on its mechanism, isolated by the negative control in §2.1, not on frequency. A second confirmed instance would strengthen it; none is claimed.
- **The register sweep is NOT PERFORMED.** No search for further instances was run. The candidate surface was bounded, not examined: 9 status-bearing item rows across 3 documents under `docs/audit/` at this basis.
- **That surface figure is a floor for one format, not the register's obligation count.** The pattern matches a single table-row shape and would silently miss any obligation stated in prose. Reported with that limit attached, because a format-specific sweep reported as a count is itself a check-cannot-fail instance.
- **The instance's interval on dead ground is unmeasured.** §2.
- **Whether the class appears outside F-AUTH-1 is unexamined**, and the argument that it should be looked for elsewhere is a reason to file, not evidence that instances exist.
- **Both documents in the instance are the executing party's own.** Whether the class appears in register material of other provenance is unread.

---

## §6 What this document does not do

- Does not mint. No FD, no XK, no PE.
- Does not audit the register for further instances. §5.
- Does not amend the costing, either addendum, or any document in which the instance occurs. The instance is written up in `F-AUTH-1_Rollback_Scope_2026-08-24.md`; this document names the class only.
- Does not close, reopen, or re-scope the section 7 rollback item.
- Does not claim a rate, a trend, or an interval.
- Does not act on §3.1 by editing the blanket clause it identifies.
- Changes no gate, disposition, owner or severity. No live contact of any kind.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | §1 names the class; mechanism is scope, not error. §1.1 the defect is bidirectional and confirms whichever way the reader leans. §2 the confirmed instance, the rollback item, with filed ground, what discharged it, why unannounced, and the live ground. §2.1 the client-secret item as negative control isolating scope as the discriminating variable. §2.2 the control's blanket unchanged-state clause as a second hazard. §3 remedy is re-reading ground rather than status; two checks, neither is care. §3.1 blanket unchanged-state clauses should be scoped or dropped. §4 three-way table against stale-basis and check-cannot-fail, with remedies shown non-substitutable. §5 six bounds, including sweep NOT PERFORMED and the surface figure's format limit. §6 non-actions. |

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-08-24. Basis `main` at `3b04d821`. Observation only. Mints nothing. No live contact.*
