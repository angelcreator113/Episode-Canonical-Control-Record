# F-Stats-1 Fix Plan v1.16

## What changed in v1.16

- **§19 (new):** PR 4 execution record. **4a, 4b, 4e merged; 3 of 6 shipped.**
  No prior revision recorded 4b or 4e.
- **§15 AMENDED:** **unit 25 WITHDRAWN.** Reconciliation re-cut to
  **24 of 25 allocated**. 4e drops from 4 units to 3 and from three
  handlers to two.
- **§12.39 EXTENDED:** `GET /outfit/:episode_id` is a **third**
  permanently-mixed handler. The v1.13 table listed only `/select` and
  `/purchase`.
- **§12.40 CORROBORATED:** a live instance observed on PR #972. Mints
  nothing; forward-points to open item 21.
- **v1.15 Forward Statement CORRECTED:** it names PR 4b as next executable
  work. 4b merged at `467f94cd` (#974) and 4e at `d5746ca7` (#975).
- **Open items 29, 30.**
- **§11:** v1.16 row added.
- Basis: `d5746ca7`. Mints no FD.

Written **after** PR 4e execution, unlike v1.12 and v1.14. §19 records
outcomes rather than predicting them.

---

## §19 PR 4 execution record (NEW)

Per §15's six-way split and Decision #26. Ordering constraint
**4a -> 4b -> 4e -> 4f -> 4c -> 4d** held without deviation.

| PR | Handlers | Units | Merged at |
|---|---|---|---|
| **4a** | `POST /seed` | 8, 9, 10 | `7eb81b77` (#971) |
| **4b** | `GET /:id/pieces`, `POST /:id/pieces`, `DELETE /:id/pieces/:pieceId`, `PUT /:id/set` | 27-33 | `467f94cd` (#974) |
| **4e** | `POST /browse-pool`, `GET /outfit/:episode_id` | 4, 11, 12 | `d5746ca7` (#975) |
| 4f | `GET /categories-audit`, `POST /bulk/sync-coin-costs`, `POST /:showId/auto-tag-event-types` | 1, 6, 7, 34 | pending |
| 4c | `POST /select` | 13, 14, 16, 18 | pending |
| 4d | `POST /purchase` | 19, 20, 22 | pending |

**Shipped: 13 units across 3 PRs. Remaining: 11 units across 3 PRs.**

### 4e gate outcome

§15 named 4e as the PR carrying both §12.38 directions simultaneously.
The gate held. Unit 11 was converted and reviewed in isolation from
units 4 and 12.

Verifications executed against `origin/main` before editing:

- `WorldEvent` carries `paranoid: true` and **no other scope** - no
  `defaultScope`, no named `scopes`. `.unscoped()` therefore strips only
  the soft-delete predicate. The §12.29a manual-attribute replacement
  that unit 3 required does **not** apply.
- All seven `WorldEvent` attributes in unit 11 declared without `field:`
  remapping.
- All six `Wardrobe` columns consumed by the browse-pool scoring loop
  (`is_visible`, `is_owned`, `tier`, `lock_type`, `outfit_match_weight`,
  `season_unlock_episode`) declared as model attributes. The
  `SELECT *` -> `findAll()` narrowing drops nothing.
- `Op` accessed as `models.Sequelize.Op` per the in-file convention
  established at line 851 (unit 8, PR 4a). No import hunk.

**Open item 29 (new):** the `SELECT *` -> `findAll()` narrowing risk was
verified per-unit at 4e and is not a standing check. Units 6, 19, and any
`SELECT *` in `worldEvents.js` carry it. It belongs in §15's per-PR gates
rather than being rediscovered each execution.

---

## §15 AMENDED - unit 25 withdrawn

Unit 25 (`GET /outfit-history/:showId`, `wardrobe.js:1575`) is
**WITHDRAWN**. Its §14 disposition read *Convert - declared
belongsToMany*, which accounts for the `episode_wardrobe` join and omits
the statement's third join entirely.

The statement carries:
```

LEFT JOIN world_events we ON we.used_in_episode_id = e.id

```
**Direction B.** This is the same construct withdrawn as unit 5 under
Decision #24. No `Episode.hasMany(WorldEvent)` inverse is declared; only
`WorldEvent.belongsTo(Episode)`. The join cannot be traversed from
`Episode` through `include`.

**Direction A.** The join carries no `deleted_at` predicate while its
sibling joins at lines 1573-1574 filter `deleted_at IS NULL` explicitly.
`WorldEvent` is paranoid, so an `include` would append one and drop rows
the raw query returns.

Both §12.38 directions in one statement, not separable by half-conversion.
Withdrawn rather than deferred, consistent with Decision #24's stated
reasoning: the finding is determinate, and a deferral leaves a unit with
no disposition for a future session to rediscover.

The `Episode.belongsToMany(Wardrobe)` declaration at `Episode.js:246` is
present and correct in the traversed direction. It is not the reason for
withdrawal.

### Reconciliation re-cut (mandatory per §15)

**3 + 7 + 4 + 3 + 3 + 4 = 24 of 25 allocated.**

No unit in two PRs. Unit 25 is the sole withdrawal from the §15
allocation and is now dispositioned WITHDRAWN in §14 terms.

4e therefore touches **two handlers, not three**.
`GET /outfit-history/:showId` retains no in-scope unit and drops out of
PR 4 entirely.

**Open item 30 (new):** `GET /outfit-history/:showId` is now a
fully-unconverted handler with no PR owning it. Whether it is
permanently raw or is deferred to a later keystone is unresolved. It is
not a §12.39 mixed handler - nothing in it converts.

---

## §12.39 EXTENDED - third mixed handler

The v1.13 table listed two permanently-mixed handlers. There are three.

| Handler | Converted | Stays raw | Why |
|---|---|---|---|
| `/select` | 13, 14, 16, 18 | 15, 17 | Decision #22, #23 |
| `/purchase` | 19, 20, 22 | 21, 23, 24 | Decision #22 |
| **`GET /outfit/:episode_id`** | **4** | **2, 3** | **Decision #23** |

Unit 2 (`information_schema` table-existence probe) and unit 3
(`episode_wardrobe` join with correlated subquery) were withdrawn under
Decision #23 at v1.12 while unit 4 in the same handler converts. This was
implicit in §14's disposition column and is stated here explicitly, on
the same reasoning v1.13 gave for the original two.

This is a consequence of decisions already locked. It is **not** a new
choice and mints no decision.

---

## §12.40 CORROBORATED - live instance

§12.40 (v1.13) recorded that `requireAuth`-guarded routes have no runtime
coverage. A live instance was observed 2026-08-03 on PR **#972**, an
agent-authored PR that changed `requireAuth` to `optionalAuth` on
`GET /episodes` and `GET /episodes/:id`.

**`Validate/Route Validation` passed green through the change.** The
check does not assert auth posture, so a middleware downgrade is
invisible to it.

Two further facts recorded, neither owned by F-Stats-1:

- Neither handler scopes results by `req.user`. The only `req.user`
  references in `listEpisodes` and `getEpisode` sit inside commented-out
  logging blocks. `requireAuth` is the sole access limit on those
  endpoints.
- The PR was closed unmerged. Its `Validate/Tests` failure was an
  `idx_stories_status` migration-idempotency error arising from a stale
  branch base; `origin/main` was green across five consecutive runs at
  the time and PR #975 subsequently passed all four checks. Rejection
  reasoning is recorded on #972.

**Mints nothing.** Forward-points to open item 21 (auth stream), which
already owns §12.40. Recorded here because the instance is concrete and
would otherwise be lost.

---

## §11 Plan Version History (UPDATED)

| v1.14 | 2026-08-03 | §16 `worldEvents.js` inventory (112 statements, 48 handlers); §16.1-§16.2; §12.41-§12.43; §12.35 extended; §12.38 inverted; open items 22-24. Basis `5d9be42b`. |
| v1.15 | 2026-08-03 | §17 canon-write scan, clean; §18 infrastructure forward-pointers; open items 25-28. Basis `7eb81b77`. |
| v1.16 | 2026-08-03 | §19 PR 4 execution record (4a, 4b, 4e merged); §15 amended, unit 25 withdrawn, reconciliation re-cut to 24; §12.39 extended to a third handler; §12.40 corroborated; v1.15 Forward Statement corrected; open items 29, 30. Basis `d5746ca7`. |

v1.16 supersedes v1.15 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.15.
- Mints: §19, open items 29, 30.
- Amends: §15 allocation and reconciliation (unit 25 withdrawn).
- Extends: §12.39 to a third handler.
- Corroborates: §12.40. Mints nothing there.
- Corrects: v1.15 Forward Statement.
- Closes: nothing.
- Forward-points: §12.40 instance to open item 21.
- No live-database contact. No prod-box contact. No dev-box contact.
  Conclusions derive from committed files read via `git show origin/main:`,
  from `git grep`, and from CI results on PRs #972 and #975.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.16 is the plan-of-record. **PR 4f is the next executable work** -
units 1, 6, 7, 34 across `GET /categories-audit`,
`POST /bulk/sync-coin-costs`, `POST /:showId/auto-tag-event-types`.

4f carries a gate: confirm unit 34 does not itself carry
`transaction: t`. If it does, it withdraws under Decision #22 and 4f
drops to 3 units. Open item 29 additionally applies - units 6 and 34
should be checked for `SELECT *` narrowing before conversion.

After 4f: 4c, then 4d alone and last.

`worldEvents.js` remains inventoried at §16 and unexecuted: 112
statements, 48 handlers, primary table paranoid, §12.42 requiring
group-level splitting. It is the largest remaining surface in F-Stats-1.

**No file is inventoried in the same session as its execution.**
Unchanged since v1.10.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-03. Main at `d5746ca7` (#975). Predecessor: v1.15.*
*Minted: §19, open items 29, 30. Amended: §15. Extended: §12.39. No FD numbers. [skip-automerge]*