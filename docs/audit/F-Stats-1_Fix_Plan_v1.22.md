# F-Stats-1 Fix Plan v1.22

## What changed in v1.22

- **Open item 35 CLOSED.** The episodes integration suite is repaired and
  verified in CI. First closure by verification in this revision series.
- **§21 RESOLVED.** The `NODE_ENV === 'test'` skip clause is gone from main.
- **§22 RESOLVED.** "Has never passed" ceased to be true at `af3a85d4`.
- **§24 (new):** the CI-as-verifier method, recorded because it worked and open
  item 6 will need it.
- **Mints no open item.** This revision only closes.
- **No execution state changes.** PR 4 remains CLOSED at 6 of 6.
  `worldEvents.js` remains the next executable surface.
- **§11:** v1.22 row added.
- Basis: `af3a85d4`. Mints no FD.

---

## Open item 35 CLOSED - verified in CI

Merged as #985 at `af3a85d4`. The changes are those listed in v1.21's status
section, unaltered.

**Verification.** CI's Tests job on #984 (doc-only, immediately prior, same code)
reported:

    Tests: 16 skipped, 2414 passed, 2430 total

CI's Tests job on #985 reported:

    Tests: 2430 passed, 2430 total

Identical totals, sixteen tests moved from skipped to passing, no change
elsewhere in the suite. The skipped count is the discriminator: had the guard
still rejected CI's `DATABASE_URL`, the sixteen would have remained in the
skipped column and the check would have gone green for the wrong reason. It did
not.

This is the first time the suite has executed against a migrated database in its
history. All sixteen assertions hold as written. No assertion was relaxed to
achieve the result - the one proposed relaxation, an `Array.isArray` guard around
`listRes.body.data.length`, was rejected during review and replaced with a
stricter explicit status assertion.

**§21 RESOLVED.** The guard clause that skipped the suite unconditionally under
jest no longer exists on main.

**§22 RESOLVED.** The suite's coverage is real as of `af3a85d4`. §22's finding
stands as a historical record of the interval; it no longer describes the file.

## §24 - CI as the verifying environment

§23.1 recorded that no local test database exists and concluded CI was the only
environment in which integration suites could be verified. That was framed as a
constraint. #985 demonstrates it is also a workable method.

The loop: derive the defect from committed files and targeted local probes,
prepare the change, ship it with the verification status stated plainly in the
commit and PR body, and read the CI Tests job as the signal. Cost: one PR cycle.

**The discriminator matters.** A green Tests check alone does not establish that
a suite ran - a skipped suite also produces green. The comparison that
establishes execution is the skipped count against an immediately prior run on
the same code. Anyone using this method should capture that baseline before
shipping, not after.

**Bearing on open item 6.** Wardrobe money-path coverage can proceed by this
method. §23.1's constraint is unchanged - the local database gap is real and
still worth closing - but it is no longer blocking. Item 6 does not wait on a
local postgres.

---

## §11 Plan Version History (UPDATED)

| v1.22 | 2026-08-05 | Open item 35 CLOSED, verified in CI at `af3a85d4`; §21 and §22 RESOLVED; §24 CI-as-verifier method recorded. Mints no open item. No execution state changes. Basis `af3a85d4`. |

v1.22 supersedes v1.21 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.21.
- Mints: §24.
- Closes: open item 35. Resolves: §21, §22.
- Mints no open item.
- Changes no unit disposition, no PR state, no gate.
- Additive-supersede on v1.21; no destructive rewrite.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

**Open items after this revision:** 6, 31, 32, 33, 34, 36. Item 35 closed.

## Method note

No local test execution in this revision's session beyond what v1.21 recorded.
No live-database contact. No prod-box contact. No dev-box contact. Conclusions
derive from CI job logs read via `gh run view` and from committed files.

---

## Forward Statement

`worldEvents.js` remains the next executable surface. Open items 6 and 32 still
deserve resolution rather than carry before it, and §24 removes the local-database
precondition §23.1 placed on item 6. After F-Stats-1 closes: **F-Ward-1 next**.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-05. Main at `af3a85d4` (#985). Predecessor: v1.21.*
*Minted: §24. Closed: open item 35. Resolved: §21, §22. Mints no FD. Tail: FD-61. [skip-automerge]*
