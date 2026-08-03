# F-Stats-1 Fix Plan v1.13

## What changed in v1.13
- **§15 (new):** PR 4 execution split — **six PRs, 25 of 25 units allocated**,
  per-PR gates specified. `POST /purchase` isolated.
- **Decision #26:** the split is locked, including the ordering constraint.
- **§12.39 (new):** mixed handlers — `/select` and `/purchase` ship with a
  converted balance *read* feeding an unconverted balance *write*.
- **§12.40 (new):** **no `requireAuth`-guarded route has runtime coverage.**
  Three concealment layers, root cause architectural. Not F-Stats-1's to fix.
- **Open item 17 CLOSED** by §15. **Open items 20, 21** minted.
- **§11:** v1.13 row added.
- Basis: `5a8de23c`. Mints no FD.

Written **before** PR 4a execution. §14's inventory is unchanged; this
revision allocates it and does nothing else to it.

---

## §15 PR 4 Execution Split (NEW)

§14 inventoried 25 convertible units in `src/routes/wardrobe.js`. Twenty-five
in one PR exceeds anything F-Stats-1 has shipped — PR 1 carried 14 — and §14
flags three units (8, 18, 32) whose shapes a mechanical reading gets wrong.

### Handler map

The raw statements live exclusively in the **inline** `async (req, res)`
handlers. Routes delegating to `asyncHandler(wardrobeController.*)` carry no
raw SQL and are out of scope entirely. Derived live at `5a8de23c`.

### Allocation

| PR | Handler(s) | Units | Count |
|---|---|---|---|
| **4a** | `POST /seed` | 8, 9, 10 | 3 |
| **4b** | `GET /:id/pieces`, `POST /:id/pieces`, `DELETE /:id/pieces/:pieceId`, `PUT /:id/set` | 27, 28, 29, 30, 31, 32, 33 | 7 |
| **4c** | `POST /select` | 13, 14, 16, 18 | 4 |
| **4d** | `POST /purchase` | 19, 20, 22 | 3 |
| **4e** | `POST /browse-pool`, `GET /outfit/:episode_id`, `GET /outfit-history/:showId` | 4, 11, 12, 25 | 4 |
| **4f** | `GET /categories-audit`, `POST /bulk/sync-coin-costs`, `POST /:showId/auto-tag-event-types` | 1, 6, 7, 34 | 4 |

**3 + 7 + 4 + 3 + 4 + 4 = 25.** Reconciles against §14's 25 convert-units
with no remainder and no unit in two PRs.

A five-PR shape was considered and rejected. It folded `/select` and
`/purchase` into a single review window, coupling two independent currency
paths, and it dropped unit 34 — the allocation summed to 24 and the gap was
not visible until the arithmetic was checked. **The reconciliation line above
is mandatory in any future re-cut.**

### Ordering constraint

**4a → 4b → 4e → 4f → 4c → 4d.**

Currency paths ship last, after four PRs have exercised the conversion
patterns on non-currency surfaces. `/purchase` ships alone and last: it is
the irreversible money path, and isolating it gives clean rollback and
unambiguous blame if a coin balance moves unexpectedly.

`4a` ships first because §12.34's hard-DELETE side is contained there and is
the sharpest single hazard in the file.

### Per-PR gates

Each PR carries a gate beyond the standard `git diff --cached` review:

- **4a** — Decision #25's `.destroy()` shape verified verbatim. `Wardrobe` is
  non-paranoid, so `.destroy()` issues a physical `DELETE`. Unit 8 must not
  become a `deleted_at` write.
- **4b** — Decision #25's soft-delete shape verified verbatim on unit 32.
  `.update({ deleted_at: new Date() })`, **not** `.destroy()`. 4a and 4b carry
  the two halves of §12.34 and must not be reviewed as though they were the
  same operation.
- **4c** — §12.39. Unit 15 stays raw inside the transaction block.
- **4d** — §12.39, and §12.35's `'lala'` literals on units 19 and 20 pass
  through verbatim per Decision #12. Unit 21 stays raw. **No coin arithmetic
  changes in this PR.**
- **4e** — unit 11 requires `.unscoped()` per §12.38. Units 4, 12, 25 require
  explicit `deleted_at: null`. Both directions are live in this one PR.
- **4f** — unit 34 sits inside a transaction block whose sibling (unit 35) is
  withdrawn. Confirm unit 34 does not itself carry `transaction: t`; if it
  does, it withdraws under Decision #22 and 4f drops to 3 units.

Open item 19 (unit 18's `COALESCE` / `.increment()` NULL divergence) is
**4c's** to resolve at execution.

---

## §12.39 — mixed handlers: converted read, unconverted write (NEW)

`POST /select` and `POST /purchase` each ship **permanently mixed**. This is
a consequence of decisions already locked, not a new choice, but it was
implicit in §14's disposition column and is stated here explicitly.

| Handler | Converted | Stays raw | Why |
|---|---|---|---|
| `/select` | 13, 14, 16, 18 | 15, 17 | Decision #22 (transaction), #23 (ON CONFLICT) |
| `/purchase` | 19, 20, 22 | 21, 23, 24 | Decision #22 (transaction, modelless) |

### The asymmetry

In both handlers the **read** of the coin balance converts to the ORM while
the **write** that mutates it stays raw SQL:

- `/select` — unit 14 reads `SELECT id, coins FROM character_state`
  (converts); unit 15 writes `UPDATE character_state SET coins = coins - :cost`
  (stays raw, `transaction: t`).
- `/purchase` — unit 20 reads `SELECT * FROM character_state` (converts);
  unit 21 writes `UPDATE character_state SET coins = :newCoins` (stays raw,
  `transaction: t`).

Behavior is expected to be identical — `.findOne()` returns the same row the
raw `SELECT` returned, and the writes are untouched. **But neither handler
can be validated by "this path is ORM now."** Any future reasoning about
these two handlers must account for a converted read feeding an unconverted
write, on currency.

Both read paths carry §12.35's `'lala'` literal, and both withdrawn writes
target the same rows. **The character_key drift surface runs directly through
`/purchase`.** F-Sec-3 territory; F-Stats-1 changes nothing about it here.

Ownership: **F-Stats-1**, recorded and closed. No action follows from it
beyond the 4c and 4d gates above.

---

## §12.40 — no runtime coverage of `requireAuth`-guarded routes (NEW)

Open item 6 has stood since v1.1 as *"test coverage over converted handlers —
still unknown."* It is no longer unknown. Derived live at `5a8de23c`, and the
answer is worse than the item implies.

### What exists

A real harness: Jest + Supertest, `tests/integration/` with fourteen files,
`tests/setup.js`, and CI provisioning a Postgres at
`localhost:5432/episode_metadata_test` with migrations run and `JWT_SECRET`
supplied. The infrastructure is not the problem.

### Three concealment layers

**Layer 1 — the suite disables itself.**
`tests/integration/episodes.integration.test.js` guards on
`process.env.DATABASE_URL?.includes('amazonaws.com') || process.env.NODE_ENV
=== 'test'`. `tests/setup.js` sets `NODE_ENV = 'test'` unconditionally before
any test file loads. The clause is therefore **true in every environment** —
CI, local, everywhere. The sibling `auth.integration.test.js` carries the
correct guard (production-DB only) and does run.

**Layer 2 — the auth wiring is broken.**
The suite mints a token in `beforeEach`, assigns it to `global.accessToken`,
and then omits the `Authorization` header on most requests. A `let
_accessToken` sits unused with a lint-silencing underscore.

**Layer 3 — it cannot pass regardless.**
`requireAuth` verifies through the Cognito/JWKS verifier (F-Auth-3 /
F-Auth-4 machinery, remote key fetch, `AUTH_SERVICE_UNAVAILABLE` on infra
failure). The suite mints local JWTs via
`TokenService.generateTokenPair`. **A locally-signed token cannot satisfy a
remote verifier.** Verified empirically: with the skip removed and every
header correctly attached, all eight failures remained `401
AUTH_INVALID_TOKEN`.

`auth.integration.test.js` passes because it exercises `/api/v1/auth/*` — the
token-issuing service itself — not a `requireAuth`-guarded route.

### Root cause

Architectural, not a stale test. F-AUTH-1's migration to Cognito verification
made the pre-existing local-token integration tests unrunnable. They were
disabled rather than migrated, and the disabling mechanism hid that they were
also broken.

### Consequence for F-Stats-1

**No `requireAuth`-guarded route has runtime coverage.** Not `evaluation.js`,
not `wardrobe.js`, not any conversion target. The route tests that do exist
for these files — `tests/unit/routes/cp12-evaluation-tier.test.js`,
`wardrobe-cluster-tier-promotion.test.js` — are `fs.readFileSync` plus regex
against the **source text**. They verify that middleware declarations match a
pattern. They would pass identically if every handler threw on invocation.

That is why PRs 1, 2, 3, and #965 all shipped four green checks while
verifying nothing about behavior. The CP12 tier tests are not defective —
they do exactly what they were written to do — but they are not runtime
coverage and were never claimed to be.

### Ownership

**NOT F-Stats-1's.** Re-enabling requires a JWKS mock or a test-mode path in
`verifyToken` — a design decision in the auth stream, not a patch. Recorded
here because it explains the green-check history and bounds what any
conversion PR can claim.

A PR re-enabling the suite was opened and **closed unmerged** rather than
merged red; the diagnosis is preserved on that PR. Open item 6 is
**re-scoped, not closed** — see open item 20.

---

## §9 Decisions Locked (Decision #26 ADDED)

Decisions #1–#25 unchanged.

### Decision #26 — PR 4 splits six ways, currency last, `/purchase` alone

Per §15. The allocation, the ordering constraint, and the per-PR gates are
locked together and may not be partially adopted.

Rejected alternative: a five-PR shape folding `/select` and `/purchase` into
one PR. Rejected on two grounds — it couples two independent currency paths
inside a single review window, and the version of it that was drafted
silently dropped a unit.

**Locked: 2026-08-03.**

---

## Open items

Items 1, 2, 3, 6, 7, 8, 9, 11, 12, 13, 15, 16, 18, 19 carried from v1.12.
Item 14 closed at v1.11.

17. ~~PR 4 execution order and split unspecified~~ — **CLOSED at v1.13, §15.**
20. **NEW:** open item 6 is **re-scoped, not closed.** The question "is there
    runtime coverage" is answered (§12.40: no). The question "should
    F-Stats-1 ship conversions without it" is open and belongs at
    F-Stats-1's close-out, not at any individual PR gate.
21. **NEW:** §12.40's remediation — JWKS mock or a test-mode path in
    `verifyToken` — is unassigned and sits with the auth stream. Recorded so
    it is not rediscovered from scratch. The empirical evidence (eight
    `AUTH_INVALID_TOKEN` failures with headers correctly wired) is on the
    closed PR.

**Open item 6's original text stands** and should not be reworded to imply
resolution. Four merges shipped under unknown coverage; six more are planned
in §15. That is a deliberate, recorded position, not an oversight.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0-v1.2 | 2026-05-14 | Initial plan through S12.19; Decision #8. |
| v1.3 | 2026-07-22 | Decisions #10-#12; S12.21-S12.23; S13 PR 1 inventory (19 units). |
| v1.4 | 2026-07-24 | S13 re-cut 17/16; S12.24; Decision #13. Basis 544cb9ad. |
| v1.5 | 2026-08-01 | Decision #14; S12.25 response-shape hazard class; S12.26; S13 14/14. Basis a61d4913. |
| v1.6 | 2026-08-01 | S12.27 live-schema verification; open items 4, 5 CLOSED. Basis 4bfc3115. |
| v1.7 | 2026-08-01 | S12.28; Decision #15; S12.26 correction; PR 2 inventory. Basis 96ab0a97. |
| v1.8 | 2026-08-01 | Decisions #16, #17; PR 2 execution order. Basis 1d167277. |
| v1.9 | 2026-08-01 | S12.29 PR 2 departures; S12.25 correction; PR 2 execution record; open item 10 CLOSED. Basis 0dd0b9ff. |
| v1.10 | 2026-08-01 | S13 PR 3 inventory (10 units, 7 in scope); Decisions #18-#20; S12.28 extended to a third site; S12.30, S12.31, S12.32; open items 11-14. Basis ee5742b1. |
| v1.11 | 2026-08-02 | §12.33 paranoid-model class, owned and closed; Decision #21; §13 PR 3 execution record; open item 14 CLOSED; open items 15, 16. Basis `ce953f57`. |
| v1.12 | 2026-08-02 | §14 `wardrobe.js` inventory (35 units, 25 in scope); §12.34–§12.38; Decisions #22–#25; §13 CLOSED at 7 of 7; open items 17–19. Basis `081e0d98`. |
| v1.13 | 2026-08-03 | §15 PR 4 six-way split (25 of 25 allocated); Decision #26; §12.39 mixed handlers; §12.40 runtime-coverage finding; open item 17 CLOSED; open items 20, 21. Basis `5a8de23c`. |

v1.13 supersedes v1.12 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.12.
- Mints: Decision #26, §15 PR 4 split, §12.39, §12.40, open items 20, 21.
- Closes: open item 17, §12.39.
- Re-scopes: open item 6 (via open item 20). **Does not close it.**
- Forward-points: §12.40 to the auth stream (open item 21).
- No live-database contact. No prod-box contact. No dev-box contact.
  Conclusions derive from committed files read via `git show origin/main:`,
  from `git grep`, and from one CI execution of the disabled suite on a
  branch that was closed unmerged.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.13 is the plan-of-record. **PR 4a is gated and may execute.** 4b through
4f are allocated and gated but should not be assumed ready — each re-derives
its units at execution against live main, per standing practice.

Two things this revision establishes that bear on everything after it:

**The green checks have never meant what they appear to mean.** §12.40 is not
a reason to stop — the conversions have been verified by derivation, live
reads, and per-unit review, which is the discipline that caught §12.33 and
§12.34. But no conversion PR should be described as *tested*, and F-Stats-1's
close-out must state what verification actually consisted of.

**The currency paths ship mixed and last.** §12.39 means `/select` and
`/purchase` will carry converted reads and raw writes indefinitely. That is
the correct outcome given Decision #22, and it is the shape a future reader
will find confusing without this record.

`worldEvents.js` remains uninventoried: **144 raw statements, primary table
paranoid**, §12.28's densest surface. Larger than everything F-Stats-1 has
converted and inventoried combined. Its inventory is a session; its execution
is several more.

**No file is inventoried in the same session as its execution.** Unchanged
since v1.10.

After F-Stats-1 closes: the fix-cycle continues per the locked register
order, F-Ward-1 next.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-03. Main at `5a8de23c` (#966). Predecessor: v1.12.*
*Minted: Decision #26, §15, §12.39, §12.40, open items 20–21. Closed: open item 17, §12.39. Re-scoped: open item 6. No FD numbers. [skip-automerge]*
