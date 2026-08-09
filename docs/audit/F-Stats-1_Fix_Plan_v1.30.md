# F-Stats-1 Fix Plan v1.30

| | |
|---|---|
| **Predecessor** | v1.29 (`79b8e142`, #995). |
| **Basis** | `79b8e142`. |
| **Author date** | 2026-08-08 |
| **Gate effect** | Item 6's second precondition is WITHDRAWN as inherited on a miscitation. Section 24 restored as controlling. Item 6 remains open, blocked on open item 40 alone. Item 40 ownership ESCALATED. No dispositions, no closures, no gate lifted. |

## What changed in v1.30

- **§23.1's local-database precondition on open item 6 is WITHDRAWN.** v1.25
  reinstated it citing "(v1.21, v1.22)". v1.22 §24 is the revision that
  *removed* it. The citation does not support the claim it is offered for.
- **§24 is restored as controlling.** CI is the verifying environment for the
  wardrobe money-path suites. This was v1.22's conclusion, was the method by
  which item 6's five passing assertions actually executed at v1.23, and was
  re-derived independently by v1.28.
- **Open item 6 is blocked on open item 40 alone.** One precondition, not two.
  Item 6 does not close at this revision — five of seven stands, and v1.23's
  ruling that closing at five of seven would record coverage that does not
  exist is unchanged.
- **Open item 40 ownership ESCALATED.** Sole blocker on a money-path
  assertion; unowned; spans three keystones.
- **§32 minted:** the inheritance-failure record.
- **Deliberately out of scope:** open item 23's mint status. Under separate
  derivation; see §32.3.

## §32 — inherited claim without support

### §32.1 The citation chain

v1.22 §24 (*CI as the verifying environment*) states that §23.1's constraint,
while real, **is no longer blocking**, and that item 6 does not wait on a local
postgres. The method was demonstrated live by #985.

v1.23 executed item 6 by that method. Five of seven assertions passed on main
at `7e33b189` (#987). The two skipped assertions are the wardrobe money-path
purchase cases — purchase-below-cost and purchase-covered — which depend on
`POST /characters/lala/state/update` and are blocked on open item 40 through
that dependency. §23.1 is not cited as a blocker at v1.23. v1.23's hygiene
credits §24's method with surfacing items 40, 41, and 42, which inspection had
not found.

v1.25 states: *"A second precondition is also unmet: §23.1 requires a verifiable
test database before the wardrobe money-path suites can be verified (v1.21,
v1.22)."* One of the two cited revisions is the revision that lifted the
requirement. §24 is not mentioned, and no argument is offered that the two
remaining assertions differ from the five that passed.

v1.27, v1.28, and v1.29 inherit the two-precondition framing. v1.28 provisions a
local test database against it, finds the wardrobe tables absent from a
migration-built schema, and concludes that CI is the only environment in which
these suites can be verified — §24's conclusion, reached again without reference
to §24.

### §32.2 Disposition

The reinstatement is withdrawn. v1.25's body is not modified; the correction
lives here, per additive-supersede.

Open item 6's live blocker is open item 40's ownership. v1.25's own ruling
applies unchanged and now applies singly: **an item cannot be resolved while its
blocker has no owner.**

v1.28's §30 findings are unaffected. The 49-table divergence, the boot-path DDL
under §31, and the migration set's status as a partial record all stand on their
own evidence and are not consequences of the withdrawn precondition. v1.28's
work was not wasted; it was undertaken against a precondition that had already
been lifted.

### §32.3 Mechanism, and an item held back

Both this finding and the item 40 re-homing share a shape: a claim enters the
tail once and each subsequent revision carries it as settled on the
predecessor's authority. §16's handler count was the same mechanism, caught by
v1.26 at one revision's distance. This one ran five.

A second candidate of the same class — **open item 23, asserted as standing in
v1.26, v1.28, and v1.29, absent from the open-items lists at v1.22, v1.23, and
v1.24** — is recorded here as *under derivation only*. It is not minted, not
carried, and not dispositioned at this revision. Three revisions out of
twenty-nine have been checked; a section-collision with §23.1 has been ruled
out. Nothing in the F-Stats-1 forward path may rely on open item 23's identity
until that derivation completes. This explicitly includes the characterisation
of `worldEvents.js` group dispositions as the largest remaining F-Stats-1 work.

## §11 Plan Version History (UPDATED)

| v1.30 | 2026-08-08 | §23.1's local-database precondition on open item 6 WITHDRAWN — reinstated at v1.25 on a citation to v1.22, the revision that lifted it. §24 restored as controlling; CI is the verifying environment. Open item 6 blocked on open item 40 alone, remains open at five of seven. Open item 40 ownership ESCALATED — sole blocker on a money-path assertion, unowned, spans F-Stats-1 / F-Ward-1 / F-Ward-3. Open item 23 mint status recorded as under derivation; forward path may not rely on its identity. §32 minted. Basis `79b8e142`. |

v1.30 supersedes v1.25 **on open item 6's precondition count only**, and
supersedes v1.27, v1.28, and v1.29 where they inherit it. All other v1.29,
v1.28, v1.27, v1.26, and v1.25 forward direction stands unchanged, including
item 32's resolution, §27's dissolution, the item 40 re-homing, §16 as corrected
by v1.26, §30's divergence findings, and §31's boot-path DDL record.

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.29. Tail: FD-61.
- Mints: §32.
- Closes: nothing.
- Carries: open item 6 (blocker reduced to one), open item 36, and all other
  items carried from v1.29.
- Withdraws: §23.1's precondition on open item 6, as reinstated at v1.25.
- Restores: §24 as controlling on the verifying environment.
- Escalates: open item 40 ownership. No ownership claimed by F-Stats-1.
- Records under derivation: open item 23's mint status. No disposition.
- Corrects: this revision's own draft carried v1.28's two-hazard framing past
  v1.29's reduction to one. Recorded because it is an instance of §32's
  mechanism.
- Changes no unit disposition, no PR state, no gate.
- Additive-supersede on v1.29; no destructive rewrite.
- **No live database contact.** This revision is source- and register-derived
  entirely.

## Forward Statement

v1.30 is the plan-of-record.

**Open item 6 stands at five of seven, blocked on open item 40's ownership
alone.** The environment question is settled: CI verifies, per §24.

**Open item 40 is the escalation.** It is unowned at source —
`Paranoid_Exposure_Inventory_2026-08-07.md` states *Owner: UNASSIGNED* and its
§6 declines both to assign an owner and to propose a fix. It blocks a money-path
assertion in the active keystone and it spans F-Ward-1 and F-Ward-3. It does not
resolve by further F-Stats-1 work.

**`worldEvents.js` is unblocked but is not opened at this revision.** Its
remaining-work characterisation depends on open item 23, whose identity is
unestablished per §32.3.

**One workstation hazard remains live**, per v1.29: the boot-path inline DDL
under §31 makes `npm start` and `npm run dev` unsafe pending PE #62 resolution.
The startup path can perform inline DDL before service readiness.

The development migrate path is **contained on this workstation only**. v1.29
recorded the containment as an environment change — `DB_*` repointed to
`127.0.0.1:5434/episode_metadata_test`, canon preserved under `CANON_DB_*` —
and explicitly recorded that no repository file changed. The scripts still
hardcode `NODE_ENV=development` and resolve to whatever `DB_*` names. The
hazard is unremedied for every other environment.

After F-Stats-1 closes: **F-Ward-1 next** — which inherits the §26 inventory's
two tables, eight of §30's canon-only wardrobe tables, and a share of item 40.

---
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-08. Main at `79b8e142`. Predecessor: v1.29.*
*Minted: §32. Closed: nothing. Carried: open items 6 and 36. Withdrawn: §23.1's precondition on item 6. Mints no FD. Tail: FD-61. [skip-automerge]*
