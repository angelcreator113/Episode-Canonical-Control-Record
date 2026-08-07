# F-Stats-1 Fix Plan v1.25

| | |
|---|---|
| **Predecessor** | v1.24 (`394ca354`, #990). |
| **Basis** | `95525f30` (#990 squash-merged). |
| **Author date** | 2026-08-07 |
| **Gate effect** | Open items 6 and 32 CARRIED with recorded rationale. Neither closes. v1.24's resolution-before-carry Forward Statement is superseded. `worldEvents.js` execution unblocked for a future session. |

## What changed in v1.25

- **Open item 6 CARRIED.** Not closed. Its remainder gates on open item 40,
  which v1.24 re-homed to an external artifact with **owner unassigned**.
- **Open item 32 CARRIED.** Not closed. Its resolution is the deferred
  `db_password` rotation, which v1.18 records as requiring its own session
  with blast radius mapped first.
- **v1.24's Forward Statement is superseded on one point only:** the
  requirement that items 32 and 6 be resolved rather than carried before
  `worldEvents.js`. §27 records why carry is now the correct disposition.
- **§27 (new):** carry rationale for both items, and the rotation gate
  obligation.
- **No execution state changes.** PR 4 remains CLOSED at 6 of 6. Item 6
  remains open at five of seven. Item 32 remains open, narrowed. Unit 19
  remains withdrawn. `worldEvents.js` remains the next executable surface.
- **§11:** v1.25 row added.
- Basis `95525f30`. Mints no FD. Tail: FD-61.

## §27 - carry rationale and rotation gate obligation

### Why carry rather than resolve

v1.18 and v1.24 both state that items 6 and 32 *deserve resolution rather
than carry* before `worldEvents.js`. That was a preference recorded when both
items looked resolvable within the track. Neither is, and the reasons are now
external to F-Stats-1's control.

**Open item 6 - CARRY; rationale: remainder gates on item 40, owner
unassigned.**

Item 6 executed to five of seven at v1.23. v1.23 ruled that closing it at
five of seven would record coverage that does not exist. v1.24 placed the
remaining two assertions behind open item 40, whose authority now sits in
`Paranoid_Exposure_Inventory_2026-08-07.md` with **no owner assigned**.
F-Stats-1 retains a dependency on item 40, not ownership of it.

A second precondition is also unmet: §23.1 requires a verifiable test
database before the wardrobe money-path suites can be verified (v1.21,
v1.22).

An item cannot be resolved while its blocker has no owner. Item 6 carries.

**Open item 32 - CARRY; rationale: deferred `db_password` rotation.**

v1.18 narrowed item 32 from *database credentials, cause unknown* to *the
deferred `db_password` rotation*, and stated in its own words that this is
**not a quick unblock** and **needs its own session with blast radius mapped
first**.

No such session has been held. No gate for it exists. The rotation is
therefore not available to this revision, and item 32 carries.

Unit 19 remains withdrawn and unconvertible until the rotation is done. That
disposition is unchanged.

### Rotation gate obligation

The `db_password` rotation is recorded here as an obligation with named
preconditions, so that it is not attempted opportunistically from inside an
unrelated session.

**Preconditions, all required before any rotation action:**

1. **Its own session.** Not folded into a conversion or register session.
2. **Blast radius mapped first.** v1.18 names the consumers that break on
   rotation: the prod box PM2 process, CI, and the dev box. The map is a
   precondition, not a deliverable of the rotation session.
3. **Freeze-respecting.** The prod box is FROZEN. The F-Deploy-1 keystone
   close does not lift the freeze; freeze posture for prod actions outside
   ratified gates is UNCHANGED. This revision confers no authority to
   reboot, restart, or alter the prod box, and no authority to issue any
   freeze-lift.
4. **Live identity confirmation before any DB-touching action.** v1.18
   records that identity was never confirmed during diagnosis - no session
   was established, so `current_database()` and `inet_server_addr()` were
   never read. Instance names are not authority.

**Carried trap - `.env` single-quoting.** This is elevated out of v1.18
because a rotation session that misses it will misread its own success.

`DB_PASSWORD` in local `.env` carries an unquoted `#`. dotenv 17 strips
inline comments from unquoted values. When the correct password is restored
it **must be single-quoted** if it contains a `#`, or dotenv will silently
truncate it and reproduce the exact `password authentication failed for user
"postgres"` signature - **making a successful rotation look like a failed
one.**

Related and unresolved: because delivery was truncated during diagnosis,
whether the true password is 33 characters followed by a comment or 39
characters containing a `#` is **undetermined**. Immaterial to the
diagnosis; material to whoever restores it.

### Effect on `worldEvents.js`

With both items carried, `worldEvents.js` is unblocked for execution in a
future session.

Per the standing rule, **no file is inventoried in the same session as its
execution.** §16's inventory exists. Execution is a separate session, and is
not performed by this revision.

## §11 Plan Version History (UPDATED)

| v1.25 | 2026-08-07 | Open items 6 and 32 CARRIED with recorded rationale; neither closed. v1.24 Forward Statement superseded on resolution-before-carry. §27 minted: carry rationale, `db_password` rotation gate obligation, `.env` single-quote trap elevated. No execution state changes. Basis `95525f30`. |

v1.25 supersedes v1.24 **on the resolution-before-carry point only**. All
other v1.24 forward direction stands unchanged, including §26, the item 40
re-homing, and the item 37 closure.

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.24. Tail: FD-61.
- Mints: §27. Closes: nothing.
- Carries: open items 6 and 32, with rationale. **Closes neither.**
- Supersedes: v1.24 Forward Statement, on the resolution-before-carry point
  only. All other v1.24 forward direction stands.
- Changes no unit disposition, no PR state, no gate.
- Additive-supersede on v1.24; no destructive rewrite.
- No live-database contact. No prod-box contact. No dev-box contact.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

v1.25 is the plan-of-record.

**`worldEvents.js` is the next executable surface** and the largest remaining
in F-Stats-1: 112 statements across 48 handlers in 9 groups per §16, with
§12.42 requiring group-level splitting and §12.38 **inverted** there -
`.unscoped()` is the majority case, not the exception.

**Open items 6 and 32 no longer block it.** Both are carried with recorded
rationale per §27. This supersedes v1.24's statement that they deserve
resolution rather than carry first.

Item 6's remainder resumes when open item 40 receives an owner. Item 32
resolves only in a dedicated, gated `db_password` rotation session meeting
the §27 preconditions.

After F-Stats-1 closes: **F-Ward-1 next** - which inherits two tables from
the §26 inventory.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-07. Main at `95525f30` (#990). Predecessor: v1.24.*
*Minted: §27. Closed: nothing. Carried: open items 6 and 32. Mints no FD. Tail: FD-61. [skip-automerge]*