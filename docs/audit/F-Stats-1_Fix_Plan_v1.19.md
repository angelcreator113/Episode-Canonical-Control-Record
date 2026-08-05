# F-Stats-1 Fix Plan v1.19

## What changed in v1.19

- **§21 (new):** one integration suite is permanently disabled by its own skip
  guard. `episodes.integration.test.js` has never executed under jest.
- **Open item 34 (new):** `worldStudio.js` schedules background DDL and cleanup
  writers that outlive the test process.
- **No execution state changes.** PR 4 remains CLOSED at 6 of 6.
  `worldEvents.js` remains the next executable surface. No unit dispositions
  change. Open item 32 untouched. Open item 6 scope unchanged; its evidence is
  strengthened by §21.
- **§11:** v1.19 row added.
- Basis: `bccd58e5`. Mints no FD.

This revision records. It does not repair. §21 identifies a fix but does not
ship one, so that the interval during which the suite was disabled stays
legible in the register.

---

## §21 - integration harness: one suite permanently disabled

`tests/integration/episodes.integration.test.js:12` computes:

    const shouldSkip = process.env.DATABASE_URL?.includes('amazonaws.com')
      || process.env.NODE_ENV === 'test';

Line 14 selects `describe.skip` when true. `tests/setup.js` sets
`NODE_ENV = 'test'` unconditionally, and every `package.json` test script sets
it via `cross-env`. The right-hand clause is therefore true in every jest
invocation and the suite never runs. Confirmed by `--runTestsByPath`:
1 suite skipped, 16 tests skipped, 0 executed.

**Scope is one file.** `auth.integration.test.js:12` guards on
`amazonaws.com` alone. `scenes.integration.test.js:12-15` guards on
`amazonaws.com` OR absence of `episode_metadata_test` in the URL. Neither
carries the `NODE_ENV` clause. This is not a copy-paste class across the tier.

**The clause is not load-bearing as a safety guard.** `tests/setup.js` throws
unless `TEST_DATABASE_URL` is set, which covers the jest path independently.
Note that the guard does not extend to Sequelize CLI migrations, which do not
load `setup.js`; that pathway is unexamined here.

**Bearing on open item 6.** Item 6 states nothing exercises a request against
any converted handler. §21 shows one suite that presents as request-level
coverage and has supplied none for as long as the clause has been present.
Item 6's scope is unchanged. Its evidence is stronger.

---

## Open item 34 (new) - worldStudio background writers outlive the process

`src/routes/worldStudio.js` schedules `cleanupOrphanedPreviews` on a timer.
That handler calls `ensurePreviewsTable` (DDL, CREATE TABLE) and a subsequent
cleanup query. Both fired after jest reported completion during this revision's
session, and both failed on authentication. Jest reported lingering handles.

An unbounded background DDL writer against whatever database the process
resolves to is a hazard independent of F-Stats-1. Recorded here because it
surfaced here. No owner assigned.

---

## §11 Plan Version History (UPDATED)

| v1.19 | 2026-08-05 | §21 integration harness, one suite permanently disabled, scope one file; open item 34 worldStudio background writers. No execution state changes. Basis `bccd58e5`. |

v1.19 supersedes v1.18 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.18.
- Mints: §21, open item 34.
- Changes no unit disposition, no PR state, no gate.
- Additive-supersede on v1.18; no destructive rewrite.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

## Method note - this session made local-database contact

v1.1 through v1.18 each certify no live-database contact. This revision's
session departs from that and the departure is recorded rather than elided.

One integration suite was executed against local postgres at
`localhost:5432/episode_metadata_test`: `auth.integration.test.js`, 23 tests,
PASS. **Canon was not contacted.** Verified after the fact by reading
`src/config/sequelize.js` from main: the `test` block resolves
`parseDatabaseUrl(TEST_DATABASE_URL)` first, so the discrete `DB_*` fallback
never evaluated. `NODE_ENV = 'test'` also excludes the `production` block,
which is the only discrete-vars-only configuration.

The line `DB_HOST: episode-control-dev...amazonaws.com` appears in the run
output. It is env display sourced from `.env` and was not consumed on this
path. It is recorded because it was momentarily read as evidence of canon
contact, and the correction required reading two config files rather than one:
the failing writer used Sequelize, not the `pg` pool in `src/config/database.js`.

No prod-box contact. No dev-box contact. All other conclusions derive from
committed files read via `git show origin/main:` and from `git grep`.

---

## Forward Statement

Unchanged from v1.18. `worldEvents.js` remains the next executable surface,
with open items 6 and 32 deserving resolution rather than carry before it.
§21 does not alter that order. After F-Stats-1 closes: **F-Ward-1 next**.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-05. Main at `bccd58e5` (#981). Predecessor: v1.18.*
*Minted: §21, open item 34. Mints no FD. Tail: FD-61. [skip-automerge]*
