# F-Stats-1 Fix Plan v1.20

## What changed in v1.20

- **§22 (new):** `episodes.integration.test.js` has never passed. §21 recorded
  that it supplies no coverage; §22 records that removing the skip guard does
  not make it supply any.
- **Open item 35 (new):** repair of that suite, unowned, scoped as its own job.
- **§21 amended in effect, not reversed.** v1.19 stated the `NODE_ENV` clause is
  not load-bearing as a safety guard. That remains true. v1.19 also implied the
  fix was a guard replacement; §22 corrects that.
- **No execution state changes.** PR 4 remains CLOSED at 6 of 6.
  `worldEvents.js` remains the next executable surface. Open items 6, 32, 34
  unchanged.
- **§11:** v1.20 row added.
- Basis: `f56aabb4`. Mints no FD.

---

## §22 - the episodes integration suite has never passed

The guard replacement from §21 was applied to a working tree and the suite run
against local postgres: **8 passed, 8 failed, 16 total.**

The suite was never wired to authenticate. Line 15 declares `let _accessToken`,
underscore-prefixed and never read. `beforeEach` calls
`TokenService.generateTokenPair(user)` and assigns `global.accessToken`. No
request in the file sets an `Authorization` header. Every failing assertion
receives 401.

The 8 passing tests pass by accident. Each asserts a 4xx rejection (invalid page,
invalid limit, page below 1, invalid status, over-long search, malformed UUID)
and receives 401. Correct status family, wrong cause. None of them exercises the
behavior it names.

**A second cause remains unidentified.** Attaching
`.set('Authorization', 'Bearer ' + global.accessToken)` to the first failing site
did not produce a 200; the response stayed 401. `TokenService.generateTokenPair`
delegates to `generateToken(user, 'access')` - the same HS256 path used by
`auth.integration.test.js`, which passes 23 tests. So the token generator is not
the discriminator. The response body was not captured; four probe attempts were
spent and the session stopped at its declared ceiling rather than continue.

Candidates not yet excluded: role or group gating on the episodes routes against
the test user's `groups: ['USER','EDITOR']`; a middleware contract difference
between the three auth implementations in `src/middleware/auth.js`; absent seed
data. Whoever takes open item 35 should print `res.body` first - the middleware
returns a `code` field that names the rejection.

## §22.1 - the §21 fix cannot ship alone

`.github/workflows/validate.yml` runs a Tests job executing `npm test` against a
migrated `episode_metadata_test`, with `DATABASE_URL`, `TEST_DATABASE_URL`,
`JWT_SECRET`, and `NODE_ENV` all set. `jest.config.js` matches
`tests/integration/**/*.test.js` and does not exclude this file. Un-skipping the
suite therefore makes CI red, and Tests is a required check under strict-mode
branch protection.

The guard replacement and the suite repair must ship in the same PR. Neither
merges alone. `--admin` bypass is not the path: landing a knowingly red required
check to satisfy a doc-driven fix would defeat the check.

The guard replacement itself was verified correct and is reproduced here so open
item 35 need not re-derive it:

    // Skip integration tests if using production database (not using test DB)
    const shouldSkip =
      process.env.DATABASE_URL?.includes('amazonaws.com') ||
      !process.env.DATABASE_URL?.includes('episode_metadata_test');

This is the guard shape already carried by `scenes.integration.test.js`.

---

## Open item 35 (new) - repair the episodes integration suite

Unowned. Scope: attach authentication to the requests in
`tests/integration/episodes.integration.test.js`, identify and resolve the
second cause of the 401s, and ship the §21 guard replacement in the same PR.
Expect assertion adjustments where the 8 accidental passes change behavior once
auth is attached.

Not a prerequisite for `worldEvents.js`. Open items 6 and 32 retain that
position per v1.18's forward statement.

---

## §11 Plan Version History (UPDATED)

| v1.20 | 2026-08-05 | §22 episodes integration suite has never passed, second cause unidentified; §22.1 §21 fix cannot ship alone under CI; open item 35 suite repair. No execution state changes. Basis `f56aabb4`. |

v1.20 supersedes v1.19 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.19.
- Mints: §22, §22.1, open item 35.
- Changes no unit disposition, no PR state, no gate.
- Corrects an implication of §21; reverses no §21 finding.
- Additive-supersede on v1.19; no destructive rewrite.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

## Method note - local-database contact, working-tree edits reverted

As in v1.19, this session departs from the standing no-live-database-contact
certification and the departure is recorded.

`episodes.integration.test.js` was executed four times against local postgres at
`localhost:5432/episode_metadata_test`. **Canon was not contacted**, on the same
basis verified in v1.19: `src/config/sequelize.js`'s `test` block consumes
`TEST_DATABASE_URL` before the discrete `DB_*` fallback, and `NODE_ENV = 'test'`
excludes the `production` block.

Two working-tree edits were made to `episodes.integration.test.js` - the guard
replacement and one `Authorization` header - and both were reverted. Nothing from
that branch was committed; the branch was deleted. Main is unmodified by this
session apart from this revision.

No prod-box contact. No dev-box contact.

---

## Forward Statement

Unchanged. `worldEvents.js` remains the next executable surface, with open items
6 and 32 deserving resolution rather than carry before it. §22 and open item 35
do not alter that order. After F-Stats-1 closes: **F-Ward-1 next**.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-05. Main at `f56aabb4` (#982). Predecessor: v1.19.*
*Minted: §22, §22.1, open item 35. Mints no FD. Tail: FD-61. [skip-automerge]*
