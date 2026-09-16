# F-Stats-1 — Compound-Predicate Site Read (v1.60 §63.5)

*Standalone note. Measurement only. Mints nothing, rules nothing, closes
nothing.*

## Purpose

Issue #1490. `F-Stats-1_Fix_Plan_v1.60.md` §63.5 names three raw-SQL
compound-predicate deletes as "unread" and "candidates" for a clean
tenancy site. This note reads all three at the current basis and records
what each predicate, its surrounding handler, and its auth middleware
actually are — against §63.5's own characterization of them. It does not
close, adopt, or rule on any of the three; it does not restate
`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md`'s Item 7 as its own finding
(that note already read the same three lines for existence and exactness;
this note reads the surrounding handler and compares the predicate shape
against §63.5's own words, which Item 7 did not do).

## H1 — Basis

```
$ git rev-parse origin/main
4831d4266c2e1082490a7c3f0813d5aa82e2e297
```

MEASURED. Date: 2026-09-16. (This SHA is `origin/main` HEAD as of the
`/wake-up` performed for this task; it is also this branch's own start
point.)

## Newest F-Stats-1 authority — confirmed by numeric scan

```
$ ls docs/audit | grep -E '^F-Stats-1_Fix_Plan_v[0-9.]+\.md$' \
  | sed -E 's/^F-Stats-1_Fix_Plan_v([0-9]+)\.([0-9]+)\.md$/\1.\2 &/' \
  | sort -t. -k1,1n -k2,2n | tail -3
1.58 F-Stats-1_Fix_Plan_v1.58.md
1.59 F-Stats-1_Fix_Plan_v1.59.md
1.60 F-Stats-1_Fix_Plan_v1.60.md
```

MEASURED. Field-numeric sort (major, then minor — lexical would rank
`v1.6` above `v1.60`). No later F-Stats-1 revision exists in the repo at
this basis.

## §63.5, quoted verbatim

`F-Stats-1_Fix_Plan_v1.60.md` lines 141–148, section header through its
four bullets:

> ### §63.5 Recorded, unminted
>
> Surfaced while discharging. **Not adopted, not minted, not admitted.**
>
> - **`worldStudio.js:1838` through `:1859` is a five-table hard-delete
>   cascade** — `character_relationships`, `registry_characters`,
>   `intimate_scenes`, `character_relationships_extended`,
>   `world_characters`, executed as five sequential raw `DELETE`
>   statements. **No transaction is visible in the surrounding lines**,
>   which were not read. **Excluded from Rule 2 by domain per v1.44 §47.2
>   and untouched by the §63.2 ruling**, which clears nothing. Recorded
>   because a partial failure mid-cascade leaves referential wreckage, and
>   that is not a tenancy question.
> - **Three raw-SQL deletes carry compound predicates including a tenant
>   term** — `worldEvents.js:570` and `:1973`, `worldStudio.js:3121`, of
>   the form `WHERE id = :id AND show_id = :showId`. **All three are in
>   the `:showId` cohort and outside this pass entirely.** Recorded
>   because the register has found no clean site since v1.55 §58.4's two,
>   and these are candidates. **No claim is made about them; they are
>   unread.**
> - **Ten route-level `model.sync()` calls across five files** (§63.1).
>   **Request-triggered DDL in a codebase whose boot path already executes
>   untransacted DDL** at `src/server.js:146-164`, PE #62. The class is
>   larger than the one site v1.58 §61.9 recorded.
> - **`memories/engine.js` calls `StoryTaskArc.sync()` at four separate
>   sites in one file.** Four entry points to the same request-triggered
>   schema create.

Only the second bullet (the three compound-predicate sites) is this
note's subject; the other three bullets are quoted above for completeness
and are out of scope here. MEASURED — quoted verbatim from the file, not
paraphrased.

**What "assessed" means: v1.60 does not say.** The word appears four
times in the document (lines 46, 139, 171, 174), always as "recorded, not
assessed" or "does not assess," always contrasted with reading/recording,
and never once defined. `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md`'s
Item 7 uses the same undefined contrast: "reading confirms what is at the
location; it does not assess it." This note does not supply a definition.
It records what a closer read of each site's surrounding code, auth
middleware, and predicate shape shows, and lets the reader judge whether
that constitutes "assessment" against a term the register has not fixed.

## Register cross-reference: what Item 7 already established

`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` Item 7 (basis
`744e7ec1612402e0831f96ca26538b71e4bb593e`, 2026-09-10) already read these
same three lines and found all three line numbers exact, no drift, at its
own basis. MEASURED, cited, not re-derived by re-reading Item 7's own
text — this note re-derives the line numbers itself, independently,
below, because the task's own basis (`4831d4266c`) postdates Item 7's
(`744e7ec161`) and the instruction is to re-derive, not carry.

## Site-by-site read, this basis

### `worldEvents.js:570`

Re-derived:

```
$ git show origin/main:src/routes/worldEvents.js > /tmp/we2.js
$ python3 -c "
lines = open('/tmp/we2.js').readlines()
for i in range(555, 580):
    print(f'{i+1}:{lines[i]}', end='')
"
556:router.delete('/world/:showId/events/:eventId', requireAuth, async (req, res) => {
557:  try {
558:    const { showId, eventId } = req.params;
559:    const models = await getModels();
560:    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
561:
562:    // Soft-delete (paranoid mode) — try UPDATE first, hard delete as fallback
563:    try {
564:      await models.sequelize.query(
565:        `UPDATE world_events SET deleted_at = NOW() WHERE id = :eventId AND show_id = :showId`,
566:        { replacements: { showId, eventId } }
567:      );
568:    } catch {
569:      await models.sequelize.query(
570:        `DELETE FROM world_events WHERE id = :eventId AND show_id = :showId`,
571:        { replacements: { showId, eventId } }
572:      );
573:    }
574:
575:    return res.json({ success: true, deleted: eventId });
576:  } catch (error) {
577:    console.error('Delete event error:', error);
578:    return res.status(500).json({ success: false, error: 'Failed to delete event', message: error.message });
579:  }
580:});
```

MEASURED. Line number **matches v1.60's citation exactly, no drift.**

- **Route:** `DELETE /world/:showId/events/:eventId`, declared line 556.
- **Auth middleware:** `requireAuth`, present on the route declaration
  itself (line 556). Per CLAUDE.md's Conventions section, writes carry
  `requireAuth` unless an F-AUTH-1 tier promotion for the route file says
  otherwise; this route already carries it, so no demotion question
  arises.
- **Handler shape:** the cited `DELETE` is not the primary path. The
  primary path (lines 563–567) is a raw `UPDATE ... SET deleted_at =
  NOW() WHERE id = :eventId AND show_id = :showId` — a soft delete. The
  cited line is the `catch` fallback: only reached if the `UPDATE`
  itself throws, at which point a raw hard `DELETE` runs with the same
  two-column predicate.
- **Raw SQL vs ORM:** both the primary `UPDATE` and the fallback `DELETE`
  are raw `sequelize.query()` calls with named replacements
  (`{ replacements: { showId, eventId } }`), not Sequelize model methods.
  Neither goes through `WorldEvent`'s ORM layer.
- **Predicate, operands, precedence:** `WHERE id = :eventId AND show_id =
  :showId`. Two equality comparisons joined by a single `AND`; no `OR`,
  no parentheses, so there is no grouping ambiguity to resolve — the
  predicate is unambiguous as written. Operands: `id` bound to the URL
  path parameter `:eventId`; `show_id` bound to the URL path parameter
  `:showId`. Both parameters come from `req.params`, not from a session,
  token claim, or an ORM-scoped lookup.
- **`deleted_at` exclusion:** the fallback `DELETE`'s `WHERE` clause does
  not test `deleted_at` at all — it targets rows by `id`/`show_id`
  regardless of whether they are already soft-deleted. MEASURED: `world_events`
  has a `deleted_at` column (added by migration
  `20260709000000-enrich-locations-and-events.js:115-116`,
  conditional `addColumn`, confirmed present in that migration file at
  this basis), and the `WorldEvent` Sequelize model declares
  `paranoid: true` / `deletedAt: 'deleted_at'` (`src/models/WorldEvent.js:249,253`)
  — but both are ORM-level facts. A raw `sequelize.query()` bypasses
  Sequelize's paranoid scoping entirely; paranoid mode only filters rows
  reached through the model's own finder/destroy methods, which this
  handler does not use. No claim is made about whether that omission is
  a defect — only that the raw SQL as written performs no `deleted_at`
  filtering.
- **Match against §63.5's characterization:** §63.5 states the form as
  `WHERE id = :id AND show_id = :showId`. This site's actual predicate is
  `WHERE id = :eventId AND show_id = :showId` — same shape, different
  bound-parameter name for the first operand (`:eventId` vs `:id`).
  MEASURED match on structure and on membership in the `:showId` cohort
  (`show_id` is one of the two conjuncts); the parameter-name difference
  is a naming detail, not a predicate-shape mismatch.

### `worldEvents.js:1973`

Re-derived:

```
$ git show origin/main:src/routes/worldEvents.js > /tmp/we.js
$ python3 -c "
lines = open('/tmp/we.js').readlines()
for i in range(1944, 1985):
    print(f'{i+1}:{lines[i]}', end='')
"
1945:// POST /world/:showId/events/bulk-delete — Delete multiple events at once
1946:router.post('/world/:showId/events/bulk-delete', requireAuth, async (req, res) => {
1947:  try {
1948:    const { showId } = req.params;
1949:    const { ids, delete_all_drafts, delete_all } = req.body;
1950:    const models = await getModels();
1951:    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
1952:
1953:    let deleted = 0;
1954:    if (delete_all) {
1955:      // Delete ALL events for this show
1956:      const [result] = await models.sequelize.query(
1957:        'DELETE FROM world_events WHERE show_id = :showId',
1958:        { replacements: { showId } }
1959:      );
1960:      deleted = result?.rowCount || 0;
1961:    } else if (delete_all_drafts) {
1962:      // Delete all draft events
1963:      const [result] = await models.sequelize.query(
1964:        "DELETE FROM world_events WHERE show_id = :showId AND status = 'draft'",
1965:        { replacements: { showId } }
1966:      );
1967:      deleted = result?.rowCount || 0;
1968:    } else if (ids && Array.isArray(ids)) {
1969:      // Delete specific IDs
1970:      for (const id of ids) {
1971:        try {
1972:          await models.sequelize.query(
1973:            'DELETE FROM world_events WHERE id = :id AND show_id = :showId',
1974:            { replacements: { id, showId } }
1975:          );
1976:          deleted++;
1977:        } catch { /* skip */ }
1978:      }
1979:    }
1980:
1981:    return res.json({ success: true, deleted });
1982:  } catch (error) {
1983:    return res.status(500).json({ success: false, error: error.message });
1984:  }
1985:});
```

Cross-checked by direct grep:

```
$ git show origin/main:src/routes/worldEvents.js | grep -n \
  "DELETE FROM world_events WHERE id = :id AND show_id = :showId"
1973:            'DELETE FROM world_events WHERE id = :id AND show_id = :showId',
```

MEASURED. Both instruments agree: the statement is at line **1973**,
**matching v1.60's citation exactly, no drift.**

- **Route:** `POST /world/:showId/events/bulk-delete`, declared line
  1946.
- **Auth middleware:** `requireAuth`, present on the route declaration
  (line 1946). Same CLAUDE.md convention as the previous site: already at
  `requireAuth`, no demotion question.
- **Handler shape:** this cited site is one of three deletion branches in
  the same handler (`delete_all`, `delete_all_drafts`, `ids`-array). Only
  the `ids`-array branch carries the two-column compound predicate v1.60
  cites; the `delete_all` branch's predicate is `show_id` alone (no
  compound), and `delete_all_drafts`'s is `show_id` plus a literal status
  check (`status = 'draft'`), not an `id` equality. v1.60 §63.5 cites only
  the `ids`-branch statement, which is the one this note reads in detail.
  It runs inside a per-`id` loop, each iteration in its own `try`/`catch`
  with a swallowing `catch { /* skip */ }` — a failed delete for one `id`
  does not abort the loop or the request, and is not surfaced to the
  caller (the response only reports a `deleted` count, not which `id`s
  failed).
- **Raw SQL vs ORM:** raw `sequelize.query()` with named replacements
  (`{ id, showId }`), not an ORM model method — same as the other two
  sites in this note.
- **Predicate, operands, precedence:** `WHERE id = :id AND show_id =
  :showId`. Two equality comparisons joined by a single `AND`; no `OR`,
  no parentheses, unambiguous as written. Operands: `id` bound per loop
  iteration to a value from `req.body.ids` (an array the caller supplies
  in the request body, not derived from any lookup); `show_id` bound to
  the URL path parameter `:showId`.
- **`deleted_at` exclusion:** no `deleted_at` test in the `WHERE` clause.
  This is a hard `DELETE`, not a soft-delete `UPDATE` — unlike
  `worldEvents.js:570`'s primary path, this branch has no soft-delete
  attempt at all; it deletes rows outright regardless of `deleted_at`
  standing. Same ORM-bypass fact applies: `world_events.deleted_at`
  exists at the schema and model level (cited above), but this raw query
  does not reference it.
- **Match against §63.5's characterization:** predicate shape and
  `:showId`-cohort membership match (`WHERE id = :id AND show_id =
  :showId`, exact operand names this time, unlike `:570`'s
  `:eventId`/`:showId`). MEASURED match.

### `worldStudio.js:3121`

Re-derived:

```
$ git show origin/main:src/routes/worldStudio.js > /tmp/ws.js
$ python3 -c "
lines = open('/tmp/ws.js').readlines()
for i in range(3108, 3135):
    print(f'{i+1}:{lines[i]}', end='')
"
3109:// DELETE /world/characters/:id/relationships/:relId
3110:router.delete('/world/characters/:id/relationships/:relId', requireAuth, async (req, res) => {
3111:  try {
3112:    const [char] = await Q(req,
3113:      'SELECT id, relationship_graph FROM world_characters WHERE id = :id',
3114:      { replacements: { id: req.params.id } }
3115:    );
3116:    if (!char) return res.status(404).json({ error: 'Not found' });
3117:
3118:    // Remove from extended table
3119:    try {
3120:      await sequelize.query(
3121:        `DELETE FROM character_relationships_extended WHERE id = :relId AND character_id = :cid`,
3122:        { replacements: { relId: req.params.relId, cid: req.params.id }, type: sequelize.QueryTypes.DELETE }
3123:      );
3124:    } catch (err) { console.warn('[world-studio] extended relationship delete error:', err?.message); }
3125:
3126:    // Remove from JSONB graph
3127:    const graph = safeJson(char.relationship_graph).filter(r => r.rel_id !== req.params.relId);
3128:    await sequelize.query(
3129:      `UPDATE world_characters SET relationship_graph = :graph, updated_at = NOW() WHERE id = :id`,
3130:      { replacements: { graph: JSON.stringify(graph), id: req.params.id }, type: sequelize.QueryTypes.UPDATE }
3131:    );
3132:
3133:    res.json({ deleted: true, graph });
3134:  } catch (err) { res.status(500).json({ error: err.message }); }
3135:});
```

MEASURED. Line number **matches v1.60's citation exactly, no drift.**

- **Route:** `DELETE /world/characters/:id/relationships/:relId`,
  declared line 3110.
- **Auth middleware:** `requireAuth`, present on the route declaration
  (line 3110). Same CLAUDE.md convention as the other two sites: already
  at `requireAuth`.
- **Handler shape:** the handler first reads the parent `world_characters`
  row by `:id` alone (line 3112–3115, via a `Q(req, ...)` helper, not
  `sequelize.query` directly — a different call wrapper than the other
  two sites in this note; this note does not read `Q`'s own definition,
  so no claim is made about what it adds beyond what its call site
  shows). The cited `DELETE` (lines 3119–3124) is wrapped in its own
  `try`/`catch` with a swallowing `catch (err) { console.warn(...) }` —
  a failure here does not abort the handler; execution continues to the
  JSONB-graph `UPDATE` at lines 3128–3131 regardless of whether the
  `DELETE` succeeded, and the response (`res.json({ deleted: true,
  graph })`) reports success unconditionally once that point is reached.
- **Raw SQL vs ORM:** raw `sequelize.query()` with named replacements
  (`{ relId: req.params.relId, cid: req.params.id }`) and an explicit
  `type: sequelize.QueryTypes.DELETE`, not an ORM model method. There is
  no Sequelize model in this repo for `character_relationships_extended`
  — confirmed by repo-wide search: `grep -rl
  "character_relationships_extended" .` (excluding `node_modules`)
  returns only `src/routes/worldStudio.js` itself, no migration file and
  no `src/models/*.js` file. MEASURED: the table's schema (including
  whether it carries a `deleted_at` column at all) cannot be established
  from anything in this repo at this basis.
- **Predicate, operands, precedence:** `WHERE id = :relId AND
  character_id = :cid`. Two equality comparisons joined by a single
  `AND`; no `OR`, no parentheses, unambiguous as written. Operands: `id`
  bound to the URL path parameter `:relId` (the relationship's own row
  id); `character_id` bound to the URL path parameter `:id` (renamed to
  `:cid` in the replacements object — same value, `req.params.id`, the
  *character's* id, not a show id).
- **`deleted_at` exclusion:** no `deleted_at` test in the `WHERE` clause,
  and — per the point above — this repo contains nothing that says
  whether `character_relationships_extended` has a `deleted_at` column to
  exclude in the first place. INFERRED (not MEASURED): given the
  `:showId`-scoped `world_events` cascade site quoted in §63.5's own
  first bullet uses the same "no transaction visible" framing for a
  cascade touching this same table, and given this table has no model
  and no migration in this repo, a `deleted_at` column on it cannot be
  ruled in or out from here; runtime/database inspection would be
  required, which this note does not perform.
- **Match against §63.5's characterization — MISMATCH, recorded, not
  reconciled:** §63.5 states all three sites are "of the form `WHERE id
  = :id AND show_id = :showId`" and that "all three are in the `:showId`
  cohort." This site's actual predicate is `WHERE id = :relId AND
  character_id = :cid` — the second conjunct is `character_id`, not
  `show_id`. There is no `show_id` anywhere in this statement, its
  replacements object, or the surrounding handler (the handler's own
  tenancy scope, if any, would have to come from `world_characters`
  lookup at lines 3112–3115, itself keyed on `id` alone with no `show_id`
  filter either). §63.5's own characterization — "a tenant term," "the
  `:showId` cohort" — does not match this site as read. **No position is
  taken on whether `character_id` functions as a tenant-equivalent scope
  for this table, whether that matters given `world_characters` itself
  is read by bare `id` with no show-scoping in this same handler, or
  whether §63.5 mischaracterized this one site or was describing the
  cohort loosely.** Both texts are quoted above; reconciling them is
  outside this note's scope, per the issue's own instruction not to
  reconcile, explain, or correct the register.

## Summary table

| Site | Auth | Raw SQL | Predicate | `AND`/`OR` | `deleted_at` excluded | `:showId` cohort per §63.5 | Matches as read |
|---|---|---|---|---|---|---|---|
| `worldEvents.js:570` | `requireAuth` | yes, `sequelize.query` | `id = :eventId AND show_id = :showId` | single `AND`, unambiguous | no (raw query bypasses model `paranoid`) | claimed | MATCH (operand-name difference only) |
| `worldEvents.js:1973` | `requireAuth` | yes, `sequelize.query` | `id = :id AND show_id = :showId` | single `AND`, unambiguous | no (hard delete, no soft-delete attempt at all) | claimed | MATCH (exact operand names) |
| `worldStudio.js:3121` | `requireAuth` | yes, `sequelize.query` | `id = :relId AND character_id = :cid` | single `AND`, unambiguous | unknown — table has no model/migration in this repo | claimed | **MISMATCH** — no `show_id` present |

## What this note does not do

- Does not adopt, mint, or rule on any of the three sites, or on the
  `worldStudio.js:1838`–`:1859` cascade, the ten `model.sync()` calls, or
  `StoryTaskArc.sync()`'s four sites — all quoted above for context only,
  per §63.5's own four bullets, and none re-assessed here.
- Does not define "assessed." Records that v1.60 uses the word four times
  without defining it, and that this note's own deeper read (predicate
  operands, auth tier, SQL-vs-ORM, `deleted_at`, cohort match) does not
  itself claim to satisfy an undefined term.
- Does not reconcile, explain, or correct the `worldStudio.js:3121`
  mismatch against §63.5's characterization. Both texts are quoted; no
  position is taken on which is right or whether either needs correction.
- Does not determine whether `character_relationships_extended` carries
  a `deleted_at` column, or any column — no model or migration for it
  exists in this repo at this basis.
- Does not assess the tenancy-check *correctness* of any of the three
  sites — whether `show_id`/`character_id` scoping as written is
  sufficient, exploitable, or defective is not addressed.
- Does not read `Q()` (the helper used at `worldStudio.js:3112`) or any
  shared query wrapper.
- Proposes no remedy, no order of work, no classification (FD/XK/PE) for
  any of the three sites.
- No live database contact. No prod-box contact. No dev-box contact. No
  AWS, Cognito, or GitHub-settings contact.

## Register tails, re-derived

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -3
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
```

MEASURED. Highest minted FD by filename is **FD-69**. **FD-70 is
next-available, unminted.**

```
$ ls docs/audit | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md
```

MEASURED: filename scan alone tops out at `XK-2`. `XK-3` is minted
without its own filename — recorded as a register entry in
`Cross_Keystone_Register.md:52`:

> `XK-3 | No authorization substrate for the tenancy root — no user↔show
> relation exists, so show_id is caller-asserted and unverifiable |
> F-AUTH-1, F-Stats-1 | OWNED (F-Stats-1 v1.57) | UNEVALUATED`

— matching `F-Stats-1_WorldStudio_Transactionality_2026-09-10.md:149`'s
own note that "the filename scan above tops out at `XK-2` because XK-3"
is not a separate `XK-3_`-prefixed file; filename scan alone would
under-count it. **XK-3 is the highest minted XK. XK-4 is next-available,
unminted.**

```
$ grep -n "PE #68" docs/audit/Session_PE_Roster.md | head -1
2146:### PE #68 — an agent harness injects a git credential that authorizes write to this repository, and whose identity was asserted and withdrawn; a live third candidate for the standing autonomous-PR pattern (P2, OPEN, NEW 2026-08-28)
```

MEASURED. `Session_PE_Roster.md` is this register's PE-minting instrument
per `Prime_Studios_Audit_Handoff_v26.md:231`. Its highest `### PE #`
heading is **PE #68**; no `### PE #69` heading exists in that file at
this basis. **PE #68 is the highest minted PE. PE #69 is next-available,
unminted.**

**All three tails — FD-70, XK-4, PE #69 — are confirmed, not corrected,
against `PROJECT_CONTEXT.md` §6.5's own statement of them.**

## Footer

**Type:** standalone read note. **Rules:** nothing. **Mints:** nothing —
no FD, no XK, no PE. **Closes:** nothing — none of §63.5's four bullets,
none of the register's owed items. **Host/AWS/DB contact:** none. **Prod
FROZEN**, untouched.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.*
*Date: 2026-09-16. Basis: `origin/main` at `4831d4266c2e1082490a7c3f0813d5aa82e2e297`.*
*Authority: `F-Stats-1_Fix_Plan_v1.60.md` §63.5, read directly, MEASURED.
`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` Item 7 read for cross-reference,
cited not re-derived except where this note's own basis postdates it.*
