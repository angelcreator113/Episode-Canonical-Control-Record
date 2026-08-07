# F-Stats-1 Fix Plan v1.23

| | |
|---|---|
| **Predecessor** | v1.22 (`30fba75d`, #986). |
| **Basis** | `7e33b189` (#987 squash-merged). |
| **Author date** | 2026-08-07 |
| **Gate effect** | None. Mints six open items. Item 6 partially shipped, stays open. |

## What changed in v1.23

- **Item 6 PARTIALLY SHIPPED.** Five of seven assertions live on main at `7e33b189`. Two skipped, blocked on new item 40. **Item 6 stays open.**
- **§25 (new):** the item-6 partial-ship record and the diagnostic trail that produced items 37-42.
- **Mints open items 37, 38, 39, 40, 41, 42.**
- **Ownership TBD on 37-40.** Discovered by F-Stats-1; not F-Stats-1 surfaces. Owner assigned at a future revision. Precedent: F-App-1 §12.11 residue as PE #62.
- **No execution state changes.** PR 4 remains CLOSED at 6 of 6. `worldEvents.js` remains the next executable surface.
- **§11:** v1.23 row added.
- Basis `7e33b189`. Mints no FD. Tail: FD-61.

## Item 6 PARTIALLY SHIPPED - five of seven

Merged as #987 at `7e33b189`.

**Passing, on main:** 401 without auth on both routes; 400 for missing `wardrobe_id`; 400 for missing `show_id`; 404 for unknown `wardrobe_id`.

This is the first runtime evidence that any PR 4 converted handler holds its contracts under a real request. v1.17 named the absence of exactly this the largest unaddressed risk in the keystone. Units 4c and 4d (`POST /wardrobe/purchase`, `POST /wardrobe/select`) had never been called by a test.

**Skipped:** purchase-below-cost, purchase-covered. Both depend on `POST /characters/lala/state/update`. Blocked on item 40. `describe.skip` carries an in-file reason naming the cause.

**Item 6 stays open.** The purchase behaviour it was written to verify has never executed. v1.12 ruled item 6 should not be open when F-Stats-1 closes; F-Stats-1 is not closing at this revision, and closing item 6 on five of seven would record coverage that does not exist.

## §25 - what the item 6 execution surfaced

Item 6 was the first F-Stats-1 artifact to drive real requests against a
migration-built database. Four defects surfaced that code inspection had
not, plus two harness/pipeline gaps found while getting it to run.

**Item 37 - `validate.yml` has no `workflow_dispatch`.** No manual re-run
lever. During the 2026-08-06 Actions incident (`qcvjkzcs7j74`, webhook
throttling to ~15%), #987 received no dispatch across two pushes. The only
available recovery was pushing a commit, which fails when the failure is
the trigger path. Recovered by PR close/reopen. Ownership TBD.

**Item 38 - §24 has no liveness check.** §24 made CI the sole verifier and
removed §23.1's local-database precondition. It does not require
confirming a run exists. Dropped webhooks do not replay, so a PR that
triggered nothing is visually identical to a PR awaiting results. #987 sat
four hours in that state. Compounding: the pre-push hook runs the cost
audit and route validation but not the test suite, so CI is the only test
signal with nothing local behind it. Ownership TBD.

**Item 39 - global uuid mock caps integration coverage.**
`tests/setup.js:21` mocks `uuid` for every suite, returning
`'test-uuid-' + random`. Any route generating its own primary key via
`uuidv4()` and inserting into a `uuid` column 500s against real Postgres.
`POST /wardrobe/seed` (`wardrobe.js:881`) is the instance found.
Worked around in #987 by file-scoped `jest.unmock('uuid')`.
`jest.config.js` also carries `transformIgnorePatterns:
['node_modules/(?!(uuid)/)']`, suggesting the mock was added for ESM
packaging reasons that may no longer apply. Ownership TBD.

**Item 40 - global `paranoid: true` against an enumerated `deleted_at`
migration.** `src/config/sequelize.js` sets `paranoid: true` in `define`,
inherited by every model. Sequelize therefore writes `deleted_at` on every
INSERT. `character_state` has no such column: migration
`20260309130000-add-deleted-at-to-all-tables.js` is a hardcoded 14-table
list and omits it. Failure observed at
`evaluation.js:64` (`getOrCreateCharacterState` -> `CharacterState.create`)
as `column "deleted_at" does not exist`.

The Phase A `CharacterState` model (PR #684) declares neither `paranoid`
nor `deleted_at`; it inherits both. **Phase A's model was never exercised
against a migrated database.** Any table outside the 14-entry list that a
Sequelize model inserts into carries the same latent failure. Blast radius
not yet enumerated. Ownership TBD.

**Item 41 - `evaluation.js` masks schema errors as success.** The GET
character-state handler catches `error.message.includes('does not exist')`
and returns 200 with `DEFAULT_STATS` and `note: 'Table not yet created'`.
A schema defect is served as plausible data. This is why item 40 survived
undetected: reads look healthy. The write path has no equivalent catch,
which is why item 6 surfaced it. F-Stats-1 surface.

**Item 42 - `getOrCreateCharacterState` returns a fabricated literal.**
After `CharacterState.create`, the function returns a hand-built object
rather than the created row. Callers receive a shape that was never read
back from the database. Relevant to Phase B's conversion of
`character_state` writers. F-Stats-1 surface.

## §11 Plan Version History (UPDATED)

| v1.23 | 2026-08-07 | Item 6 PARTIALLY SHIPPED (five of seven, #987 at `7e33b189`), stays open; §25 minted; open items 37-42 minted, ownership TBD on 37-40. No execution state changes. Basis `7e33b189`. |

v1.23 supersedes v1.22 for all forward references.

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.22. Tail: FD-61.
- Mints: §25. Mints open items: 37, 38, 39, 40, 41, 42.
- Closes nothing. Resolves nothing.
- Changes no unit disposition, no PR state, no gate.
- Additive-supersede on v1.22; no destructive rewrite.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

**Open items after this revision:** 6, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 42.

## Method note

Items 40, 41, and 42 were found by execution, not by reading. Items 40 and
41 in particular are invisible to inspection: the model file, the config
block, and the migration are each individually correct, and the read path
returns 200. Only a write against a migration-built database exposes the
composition. §24's CI-as-verifier method is what made that possible, and
item 38 is its own gap found the same way.

## Forward Statement

`worldEvents.js` remains the next executable surface. Item 6 is now
partially shipped but not closed; its remainder gates on item 40. Items 32
and 6 still deserve resolution rather than carry before `worldEvents.js`.
After F-Stats-1 closes: **F-Ward-1 next.**

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-07. Main at `7e33b189` (#987). Predecessor: v1.22.*
*Minted: §25; open items 37-42. Closes nothing. Mints no FD. Tail: FD-61. [skip-automerge]*