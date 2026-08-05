# F-Stats-1 Fix Plan v1.21

## What changed in v1.21

- **§23 (new):** §22's claim that no request in `episodes.integration.test.js`
  sets an `Authorization` header is **false**. Two sites did. The correction
  matters because those two sites are what make the real cause legible.
- **§23 also closes the §22 question.** The second cause is identified: the test
  user object carries no `id`, so the signed token has no `sub` claim and
  verification rejects it. Both of v1.20's surviving hypotheses are excluded.
- **§23.1 (new):** no local test database exists. Local verification of any
  integration suite was unavailable this session and remains so.
- **Open item 36 (new):** canon `DB_PASSWORD` exposed in a session transcript.
  Folds into open item 32's rotation scope.
- **Open item 35 remains OPEN.** Its code fix is prepared and unverified; it
  ships in its own PR with CI as the verifying signal.
- **No execution state changes.** PR 4 remains CLOSED at 6 of 6.
  `worldEvents.js` remains the next executable surface.
- **§11:** v1.21 row added.
- Basis: `6e351681`. Mints no FD.

---

## §23 - §22's header claim was false; root cause identified

**The false claim.** §22 states: "No request in the file sets an `Authorization`
header." Two sites did, at the time v1.20 was written:

- `should filter by status`
- `should filter and browse episodes`

Both used the explicit three-line form with
`.set('Authorization', 'Bearer ' + global.accessToken)`. §22 was written from
jest failure snippets rather than from a read of the file, and the snippets
happened to elide those lines. The error was mine and is corrected here rather
than left standing.

**Why the correction matters.** Those two sites were sending valid-looking
Bearer tokens and still returning 401. That fact, had it been noticed, points
directly at the token rather than at the request wiring - which is where §22's
three candidate hypotheses went instead.

**The root cause.** `TokenService.generateToken` builds:

    sub: user.id || user.userId,

The `beforeEach` user object in this suite carries neither `id` nor `userId`.
`jwt.sign` silently omits keys whose value is `undefined`, so the token signs
successfully with no `sub` claim. `TokenService.verifyToken` then reaches:

    if (!decoded.sub || !decoded.email) {
      throw new Error('Missing required token claims');
    }

and throws. The token is well-formed HS256, decodes cleanly, and fails only the
claim check - which is why the defect survived undetected.

**Diagnosis chain, recorded so it need not be re-derived:**

1. Probe on an unauthenticated site: 401, `code: AUTH_REQUIRED`.
2. Header attached: 401, `code: AUTH_INVALID_TOKEN`, server log
   `Token verification failed: Missing required token claims`.
3. `id` added to the user object: **500**, `Failed to list episodes`, underlying
   `password authentication failed for user "postgres"`.

Step 3 is the proof of fix. A 500 from the handler means the request
authenticated and reached application code; the remaining failure is
environmental, per §23.1.

**Hypotheses excluded.** §22 listed three candidates. Role or group gating and a
contract difference among the three auth implementations in
`src/middleware/auth.js` are both excluded - the 401 was a claim check, not an
authorization decision. Absent seed data is not excluded and may still affect
assertions, but is not the cause of the 401s.

## §23.1 - no local test database exists

`localhost:5432` accepts TCP connections and rejects user `postgres` under both
`test` and `postgres` passwords. `%APPDATA%\postgresql\pgpass.conf` does not
exist. `.env` contains no `localhost` reference; its `DB_*` entries point at the
canon host.

Local verification of any integration suite was therefore unavailable for the
whole of this session, including the four `episodes.integration.test.js` runs
recorded in v1.20's method note. Those runs executed - the app started, requests
were served, auth ran - but every database-touching path returned an error.

**Bearing on open item 6.** Wardrobe money-path coverage (`POST /select`,
`POST /purchase`) will meet the same wall. Until a local test database is
provisioned or the credential recovered, **CI is the only environment in which
these suites can be verified.** Whoever takes item 6 should plan for that rather
than discover it.

---

## Open item 36 (new) - canon DB_PASSWORD exposed in session transcript

While searching `.env` for a local postgres credential, the canon `DB_PASSWORD`
value was printed in full to a session transcript. The command was chosen
without a redaction filter; the exposure was avoidable.

The credential is already recorded as stale by open item 32. This adds exposure
to staleness. It does not create a new rotation driver - it folds into open item
32's existing rotation scope, which already requires blast-radius mapping across
the prod-box PM2 process, CI, and the dev box.

No action is taken here. Recorded so the rotation session accounts for it.

---

## Open item 35 status - fix prepared, unverified

Not closed. The following changes exist and are held pending their own PR:

- Guard replacement per §22.1, matching the `scenes.integration.test.js` shape.
- `id: 'test-user-episodes'` added to the `beforeEach` user object.
- All request sites routed through a single `authGet` helper that attaches the
  Authorization header.
- Dead `let _accessToken` removed.
- An `Array.isArray` guard proposed around `listRes.body.data.length` was
  **rejected** and replaced with an explicit `expect(listRes.status).toBe(200)`.
  The guard would have let a 500 pass silently; the assertion fails loudly.

Local run after these changes: 7 failed, 9 passed, 16 total, with every failure
a 500 from §23.1's cause. The suite has still never been observed green.

---

## §11 Plan Version History (UPDATED)

| v1.21 | 2026-08-05 | §23 corrects §22's false header claim and identifies the root cause (missing `sub` claim); §23.1 no local test database; open item 36 credential exposure; open item 35 fix prepared, unverified. No execution state changes. Basis `6e351681`. |

v1.21 supersedes v1.20 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.20.
- Mints: §23, §23.1, open item 36.
- **Corrects a factual error in §22.** v1.20's body is not modified; the
  correction lives here, per the additive-supersede convention.
- Changes no unit disposition, no PR state, no gate.
- Open item 35 remains open.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

## Method note

Local test executions continued as recorded in v1.20. Canon was not contacted.
No prod-box contact. No dev-box contact. One `psql` connection attempt was made
to `localhost:5432` and failed on authentication; no query executed.

The `episodes.integration.test.js` changes described above are stashed, not
committed. Main carries no code change from this session.

---

## Forward Statement

Unchanged. `worldEvents.js` remains the next executable surface, with open items
6 and 32 deserving resolution rather than carry before it. §23.1 adds a
precondition to open item 6: a verifiable test database. After F-Stats-1 closes:
**F-Ward-1 next**.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-05. Main at `6e351681` (#983). Predecessor: v1.20.*
*Minted: §23, §23.1, open item 36. Corrects: §22. Mints no FD. Tail: FD-61. [skip-automerge]*
