# F-Stats-1 Fix Plan v1.18

## What changed in v1.18

- **Open item 32 REFINED, still OPEN.** v1.17 recorded the blocker as stale
  local `.env` credentials from a single failed connection. Confirmed by
  direct test, with a distinct latent trap found alongside it.
- **No execution state changes.** PR 4 remains CLOSED at 6 of 6.
  `worldEvents.js` remains the next executable surface. No unit dispositions
  change.
- **§11:** v1.18 row added.
- Basis: `67aec76c`. Mints no FD. Mints no section. Mints no open item.

This revision exists because the diagnosis has a shelf life. The credential
is stale as of 2026-08-04; a rotation would make this text history. Recorded
now rather than held for a fuller revision.

---

## Open item 32 REFINED - diagnosis, not resolution

**Open item 32 - diagnosis refined 2026-08-04.** v1.17 recorded the blocker
as stale local `.env` credentials, observed from a single failed connection.
Confirmed by direct test, with a distinct latent trap found alongside it.

`DB_PASSWORD` in local `.env` carries an unquoted `#`. dotenv 17 strips
inline comments from unquoted values, so the delivered value was 33
characters where the file holds 39. Single-quoting the value raised the
delivered length to 39 with the `#` intact. Both forms were rejected by
`episode-control-dev` with `password authentication failed for user
"postgres"`. The credential is therefore genuinely stale, not mis-parsed.
`.env` was restored to its original state; no AWS-side action was taken.

The truncation is a real trap independent of the stale credential: when the
correct password is restored, it must be single-quoted in `.env` if it
contains a `#`, or dotenv will silently truncate it and reproduce this exact
failure signature, making a successful rotation look like a failed one.

Because delivery was truncated, whether the true password is 33 characters
followed by a comment or 39 characters containing a `#` is undetermined.
Immaterial to the diagnosis; material to whoever restores it.

Resolving open item 32 means reading the credential from Secrets Manager or
rotating it via `modify-db-instance` against canon. A rotation breaks every
consumer still holding the old value: the prod box PM2 process, CI, and the
dev box. That is deferred `db_password` rotation, not a quick unblock, and
needs its own session with blast radius mapped first.

No identity confirmation was possible: no connection was established, so
`current_database()` and `inet_server_addr()` were never read. Canon was
aimed at, never reached.

### Status

**OPEN, narrowed.** v1.17 stated the blocker as *database credentials*, cause
unknown. It is now *the deferred `db_password` rotation*, with a named next
action and a named trap. Unit 19 remains withdrawn and unconvertible until
the rotation is done.

### Method note

No live-database contact. No prod-box contact. No dev-box contact. Two
connection attempts were made from the local workstation against
`episode-control-dev`; both failed at credential rejection, so no session was
established and no query executed. `.env` was edited and restored; the file
is untracked and ignored at `.gitignore:8`. The temporary backup was covered
by `.gitignore:133` and has been deleted. No credential value appears in this
revision, in any commit, or in any command output produced during the
diagnosis - only character counts and boolean predicates.

---

## §11 Plan Version History (UPDATED)

| v1.16 | 2026-08-03 | §19 PR 4 execution record (4a, 4b, 4e merged); §15 amended, unit 25 withdrawn, re-cut to 24; §12.39 extended to three handlers; §12.40 corroborated; open items 29, 30. Basis `d5746ca7`. |
| v1.17 | 2026-08-04 | §19 restated complete, PR 4 CLOSED at 6 of 6; §15 amended, unit 19 withdrawn, re-cut to 23; open item 19 RESOLVED; §12.39 extended to four handlers; §20 register overstatements; open item 29 CLOSED; open items 31-33. Basis `9f57b1fe`. |
| v1.18 | 2026-08-04 | Open item 32 refined, still open - dotenv truncation trap identified and excluded as cause; stale credential confirmed. No execution state changes. Basis `67aec76c`. |

v1.18 supersedes v1.17 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.17.
- Mints nothing: no section, no decision, no open item.
- Refines: open item 32. **Does not close it.**
- Changes no unit disposition, no PR state, no gate.
- Additive-supersede on v1.17; no destructive rewrite.
- No live-database contact. No prod-box contact. No dev-box contact. See the
  method note above for the two failed connection attempts.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.18 is the plan-of-record. **v1.17's Forward Statement is restated
unchanged** - this revision moves nothing forward and introduces no new
direction.

**PR 4 is CLOSED.** `wardrobe.js` is converted at 23 of 25 allocated units,
with units 19 and 25 withdrawn and dispositioned.

**`worldEvents.js` is the next executable surface** and the largest remaining
in F-Stats-1: **112 statements across 48 handlers in 9 groups** per §16, with
§12.42 requiring group-level splitting and §12.38 **inverted** there -
`.unscoped()` is the majority case, not the exception. §16.1 and §16.2 hold
dispositions for Core CRUD and Overlays; seven groups carry forward
un-dispositioned.

Per the standing rule, **no file is inventoried in the same session as its
execution**. §16's inventory exists; execution is a separate session.

Before `worldEvents.js` execution, two items deserve resolution rather than
carry: **open item 6** (no runtime coverage, nine merges old) and **open item
32**, which v1.18 narrows but does not close.

After F-Stats-1 closes: the fix-cycle continues per the locked register
order, **F-Ward-1 next**.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-04. Main at `67aec76c` (#980). Predecessor: v1.17.*
*Refined: open item 32. Mints nothing. No FD numbers. [skip-automerge]*