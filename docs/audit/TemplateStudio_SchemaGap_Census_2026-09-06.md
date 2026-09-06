# `template_studio` schema-gap census

**Basis:** `origin/main` at `8642533e07151a3f9991b362e4466a8615b4cc83`, read live 2026-09-06.

**Type.** Standalone census. **Mints nothing.** No FD or PE number is minted by
this document — the next Fix Plan revision mints if it chooses to. **Rules
nothing** — the remedy is Evoni's to choose, per issue #1289.

**Host/AWS/DB contact:** none by this session. §3 below cites a database read
performed by a *prior*, separately-authorized session (2026-08-29) and already
filed on `main`; this session made no new host, AWS, database, or Cognito
contact. **Prod FROZEN.**

---

## §1. Query-side census — MEASURED

```
$ grep -rn "template_studio" src/
```
raw output (45 hits, all in `src/`, `$ grep -rn "template_studio" src/ | wc -l` confirms 45):

```
src/constants/canonicalRoles.js:14: * - template_studio.required_roles[]
src/constants/canonicalRoles.js:15: * - template_studio.optional_roles[]
src/services/CompositionService.js:381:        attributes: ['id', 'episode_id', 'template_id', 'template_studio_id', 'composition_config'],
src/services/CompositionService.js:389:      if (composition.template_studio_id) {
src/services/CompositionService.js:440:   * NEW: Uses template_studio table for pixel-perfect layouts
src/services/CompositionService.js:529:      // Update template if provided (accept both template_id and template_studio_id)
src/services/CompositionService.js:530:      if (updateData.template_studio_id !== undefined) {
src/services/CompositionService.js:531:        composition.template_id = updateData.template_studio_id;
src/services/ThumbnailGeneratorService.js:360:   * @param {Object} composition - Composition record with template_studio_id
src/services/ThumbnailGeneratorService.js:368:      if (!composition.template_studio_id) {
src/services/ThumbnailGeneratorService.js:369:        console.warn('⚠️  No template_studio_id, falling back to legacy generator');
src/services/ThumbnailGeneratorService.js:378:        SELECT * FROM template_studio WHERE id = $1
src/services/ThumbnailGeneratorService.js:380:        { bind: [composition.template_studio_id] }
src/services/ThumbnailGeneratorService.js:384:        console.error('❌ Template not found:', composition.template_studio_id);
src/routes/compositions.js:156:      template_studio_id,
src/routes/compositions.js:176:    // Check for template_studio_id OR asset_map/assets to determine format
src/routes/compositions.js:178:      template_studio_id ||
src/routes/compositions.js:183:      template_studio_id,
src/routes/compositions.js:231:    if (!template_id && !template_studio_id) {
src/routes/compositions.js:257:      // If template_studio_id is provided, validate it and skip old template validation
src/routes/compositions.js:258:      if (template_studio_id) {
src/routes/compositions.js:259:        console.log('🎨 Using Template Studio template:', template_studio_id);
src/routes/compositions.js:261:        // Fetch template from template_studio through the shared connection.
src/routes/compositions.js:266:          SELECT * FROM template_studio WHERE id = $1
src/routes/compositions.js:268:          { bind: [template_studio_id] }
src/routes/compositions.js:273:            error: 'Invalid template_studio_id',
src/routes/compositions.js:274:            message: `Template ${template_studio_id} not found`,
src/routes/compositions.js:316:        template_studio_id, // NEW: Store template_studio_id
src/routes/templateStudio.js:73:      FROM template_studio
src/routes/templateStudio.js:83:      FROM template_studio
src/routes/templateStudio.js:121:      SELECT * FROM template_studio WHERE id = $1
src/routes/templateStudio.js:189:      INSERT INTO template_studio (
src/routes/templateStudio.js:252:      SELECT id, status, locked FROM template_studio WHERE id = $1
src/routes/templateStudio.js:329:      UPDATE template_studio
src/routes/templateStudio.js:364:      SELECT id, status, locked FROM template_studio WHERE id = $1
src/routes/templateStudio.js:383:      DELETE FROM template_studio WHERE id = $1
src/routes/templateStudio.js:414:      SELECT * FROM template_studio WHERE id = $1
src/routes/templateStudio.js:431:      FROM template_studio
src/routes/templateStudio.js:441:      INSERT INTO template_studio (
src/routes/templateStudio.js:497:      SELECT id, status FROM template_studio WHERE id = $1
src/routes/templateStudio.js:516:      UPDATE template_studio
src/routes/templateStudio.js:551:      SELECT id, locked FROM template_studio WHERE id = $1
src/routes/templateStudio.js:570:      UPDATE template_studio
src/routes/templateStudio.js:605:      SELECT id, status FROM template_studio WHERE id = $1
src/routes/templateStudio.js:624:      UPDATE template_studio
```

### §1.1 Separated: table queries vs. field/column mentions

**Queries the `template_studio` table directly (raw SQL, `sequelize.query`):**

| File:line | Statement |
|---|---|
| `src/routes/templateStudio.js:73` | `SELECT ... FROM template_studio` (list) |
| `src/routes/templateStudio.js:83` | `SELECT COUNT(*) ... FROM template_studio` (count) |
| `src/routes/templateStudio.js:121` | `SELECT * FROM template_studio WHERE id = $1` (get by id) |
| `src/routes/templateStudio.js:189` | `INSERT INTO template_studio (...)` (create) |
| `src/routes/templateStudio.js:252` | `SELECT id, status, locked FROM template_studio WHERE id = $1` (update precheck) |
| `src/routes/templateStudio.js:329` | `UPDATE template_studio ...` (update) |
| `src/routes/templateStudio.js:364` | `SELECT id, status, locked FROM template_studio WHERE id = $1` (delete precheck) |
| `src/routes/templateStudio.js:383` | `DELETE FROM template_studio WHERE id = $1` (delete) |
| `src/routes/templateStudio.js:414` | `SELECT * FROM template_studio WHERE id = $1` (clone source) |
| `src/routes/templateStudio.js:431` | `SELECT MAX(version) ... FROM template_studio` (clone version calc) |
| `src/routes/templateStudio.js:441` | `INSERT INTO template_studio (...)` (clone insert) |
| `src/routes/templateStudio.js:497` | `SELECT id, status FROM template_studio WHERE id = $1` (publish precheck) |
| `src/routes/templateStudio.js:516` | `UPDATE template_studio ...` (publish) |
| `src/routes/templateStudio.js:551` | `SELECT id, locked FROM template_studio WHERE id = $1` (lock precheck) |
| `src/routes/templateStudio.js:570` | `UPDATE template_studio ...` (lock) |
| `src/routes/templateStudio.js:605` | `SELECT id, status FROM template_studio WHERE id = $1` (archive precheck) |
| `src/routes/templateStudio.js:624` | `UPDATE template_studio ...` (archive) |
| `src/routes/compositions.js:266` | `SELECT * FROM template_studio WHERE id = $1` (composition create, role-based path, only when `template_studio_id` is supplied in the request body) |
| `src/services/ThumbnailGeneratorService.js:378` | `SELECT * FROM template_studio WHERE id = $1` (thumbnail render, only when `composition.template_studio_id` is set) |

**Every route in `src/routes/templateStudio.js` queries the table** — the file
has no route that does not. It is mounted whole; there is no route in it that
survives the table's absence.

**Names a column or request field only — does not query the table:**

| File:line | What it names |
|---|---|
| `src/constants/canonicalRoles.js:14-15` | Doc comment describing `template_studio.required_roles[]` / `.optional_roles[]` as a *conceptual* source, not a query |
| `src/services/CompositionService.js:381,389,529,530,531` | `template_studio_id` — a column on `ThumbnailComposition` (a different table), read/written via the Sequelize model, not raw SQL against `template_studio` |
| `src/services/ThumbnailGeneratorService.js:360,368,369,384` | `template_studio_id` field on a `composition` object (doc comment, presence check, warning log, not-found log) |
| `src/routes/compositions.js:156,176,178,183,231,257,258,259,273,274,316` | `template_studio_id` as a request-body field / format-detection flag; the request-time question "was this field sent," not the table |

**Where `src/routes/templateStudio.js` is mounted (repo-derivable, not part of
the `template_studio` grep above):**

```
$ grep -rn "templateStudio" src/app.js
```
raw output:
```
542:let templateStudioRoutes;
544:  templateStudioRoutes = require('./routes/templateStudio');
548:  templateStudioRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
884:app.use('/api/v1/template-studio', templateStudioRoutes);
```

**Note on line 548's caveat:** this fallback fires only if `require('./routes/templateStudio')`
itself throws — a module-load-time failure (bad syntax, a missing import).
It does not fire on a per-query database error; those are caught inside each
route handler (§3.1), not at the `require` in `app.js`. The module loads
successfully regardless of whether `template_studio` exists as a table — the
table is only touched when a request actually reaches a route.

---

## §2. Create-side census — MEASURED, both negative

```
$ grep -rn "template_studio" src/migrations/
```
raw output:
```
(no output — exit code 1, zero matches)
```

```
$ grep -rn "template_studio" src/models/
```
raw output:
```
(no output — exit code 1, zero matches)
```

**No migration in `src/migrations/` (211 files, the only migration tree that
runs per `CLAUDE.md`) creates, alters, or references `template_studio`. No
model in `src/models/` (151 files) defines it.** A fresh environment run
through `npm run migrate` against an empty database — this repo's migration
tree and only this repo's migration tree — ends with no `template_studio`
relation. This is a negative result and is the finding, not an omission from
this document.

---

## §3. What a fresh (locally-migrated) environment does when these paths run

**Not independently re-run by this session — this container has no Docker
daemon:**

```
$ docker ps
failed to connect to the docker API at unix:///var/run/docker.sock: check if
the path is correct and if the daemon is running: dial unix
/var/run/docker.sock: connect: no such file or directory
```

So the empirical run PR #1288's session performed (migrate fresh, hit the
route, observe the failure) is **not re-derivable by this session** the same
way. Per the issue's own instruction, PR #1288's report is not repeated here
as fact on that basis alone. What follows instead is derived a different way
— by reading the code's own error handling, which is repo-derivable without
running anything:

**§3.1 `src/routes/templateStudio.js` — every route wraps its query in its own
`try { ... } catch (error) { console.error(...); res.status(500).json({...
message: error.message }); }`.** Confirmed for the list, create, and clone
handlers by direct read (lines 28-108, 149-226, 402-479 as read at this
basis); the same `try`/`catch (error)` shape recurs at every remaining route
in the file per `grep -n "catch (error)" src/routes/templateStudio.js`. A
query against a `template_studio` relation that does not exist raises a
Postgres `relation "template_studio" does not exist` error; Sequelize
surfaces raised query errors to the caller rather than swallowing them (no
code in this file catches and continues past a query error). **On the code's
own logic, every route in this file returns HTTP 500 with that error's
message on a freshly migrated database — not silently empty, not a 200.**
This is inferred from the error-handling shape actually in the file, not
measured by running it; labelled INFERRED, not MEASURED, for that reason.

**§3.2 `src/routes/compositions.js:266`** sits inside the `POST /` handler's
own `try { ... } catch (error) { ...; res.status(500).json({ error: 'Failed
to create composition', message: error.message, ... }); }` (catch at lines
416-423 as read at this basis). Reached only when the request body carries
`template_studio_id`. **INFERRED: HTTP 500 on that path, when reached; the
legacy and `template_id`-based paths in the same handler do not reach this
query and are unaffected.**

**§3.3 `src/services/ThumbnailGeneratorService.js:364-529`**
(`generateFromTemplateStudio`) wraps its query in `try { ... } catch (error)
{ console.error(...); throw error; }` (catch at lines 525-528 as read at this
basis) — it re-throws rather than returning a value, so the failure mode
depends on its caller's own handling, which this census did not trace
further; **CANNOT-TELL beyond "the error propagates uncaught past this
method."**

---

## §4. Canon RDS — repo-derivable evidence exists; not re-verified live by this session

**The issue that scoped this census names this Evoni-gated and asks it be
recorded as STILL OWED. That is not quite what the repo shows.** A prior,
separately-authorized session already performed a live canon-RDS schema read
on 2026-08-29, filed on `main` at
`docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt` (2760 rows, 143
tables, `public` schema; commit `6fb8a07b5e372908ce462c99dd01120f1a62b23f`,
PR #1151, merged on Evoni's ruling per
`v25_Sec6_Item8_Route_Finding_2026-08-29.md`'s banner — "no agent session
touched the instance," read performed by the operator over the
operator-workstation route). **That capture contains a `template_studio`
entry:**

```
$ grep -n "^ template_studio " docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt
```
raw output:
```
2194: template_studio                  | id                                | uuid                        | NO
2195: template_studio                  | name                              | character varying           | NO
2196: template_studio                  | description                       | text                        | YES
2197: template_studio                  | version                           | integer                     | NO
2198: template_studio                  | status                            | character varying           | YES
2199: template_studio                  | locked                            | boolean                     | YES
2200: template_studio                  | canvas_config                     | jsonb                       | NO
2201: template_studio                  | role_slots                        | jsonb                       | NO
2202: template_studio                  | safe_zones                        | jsonb                       | YES
2203: template_studio                  | required_roles                    | ARRAY                       | YES
2204: template_studio                  | optional_roles                    | ARRAY                       | YES
2205: template_studio                  | formats_supported                 | ARRAY                       | YES
2206: template_studio                  | created_by                        | uuid                        | YES
2207: template_studio                  | published_at                      | timestamp without time zone | YES
2208: template_studio                  | locked_at                         | timestamp without time zone | YES
2209: template_studio                  | parent_template_id                | uuid                        | YES
2210: template_studio                  | created_at                        | timestamp without time zone | YES
2211: template_studio                  | updated_at                        | timestamp without time zone | YES
```

**MEASURED (repo-derivable — a document already filed on `main`), not
re-verified live by this session.** Standing caveats, stated plainly:

- **This is a 2026-08-29 point-in-time capture, eight days old at this
  document's basis.** Whether canon RDS still has this table, unchanged, on
  the date this census is read is **not** established here — that would be a
  new live read, which this session did not perform and is not authorized to
  perform on its own initiative.
- **Every column this repo's code queries or inserts is present in the
  capture** — `id, name, description, version, status, locked, canvas_config,
  role_slots, safe_zones, required_roles, optional_roles, formats_supported,
  created_by, published_at, locked_at, parent_template_id, created_at,
  updated_at` matches the `SELECT`/`INSERT` column lists at
  `templateStudio.js:66-76,189-197,441-450` exactly, column for column, by
  direct comparison. **No column-level drift is evident between the code and
  the captured canon schema**, on this one table, at this one snapshot date.
- **How the table came to exist in canon without a migration in this repo's
  tree is not established by this census.** `EvidenceNote_Canon_pgmigrations_2026-08-29.txt`
  (the companion capture, same commit) lists only 14 rows, all dated
  2026-01-20 to 2026-01-22, none naming `template_studio` — that is a
  different, legacy migration ledger (`pgmigrations`, not this repo's
  `SequelizeMeta`) and does not account for the table either. **CANNOT-TELL**
  how or when `template_studio` was created on canon, from repo evidence
  alone.
- **A fresh local/dev database, migrated only from `src/migrations/`, will
  not have this table** (§2). **Canon, per an eight-day-old capture, does.**
  The gap this census was scoped to describe is a gap between this repo's
  migration tree and canon's actual state — not, on this evidence, a case
  where the table may not exist anywhere.

**Recorded per the issue's instruction regardless of the above: whether canon
RDS has this table *right now*, re-verified fresh, is a live-database read
and remains Evoni-gated and STILL OWED** — the 2026-08-29 capture answers the
historical question, not the current one, and this session performed no new
database contact of any kind.

---

## §5. Candidate remedies — named, none chosen

Per the issue's scope, this census does not choose among these. What each
turns on:

1. **Write a migration to match canon.** Needs the canon read in §4 refreshed
   (or accepted as current) first, plus the `pgmigrations`-vs-`SequelizeMeta`
   question resolved enough to know whether a new `SequelizeMeta`-tracked
   migration creating `template_studio` would collide with a table that
   already exists on canon (a `CREATE TABLE` migration run against canon
   would fail on a table that's already there, unless written
   idempotently or gated). Turns on Evoni's authorization for the live
   read and on a decision about how the migration should behave against an
   environment where the table already exists out-of-band.
2. **Remove the dead/at-risk paths.** Every route in `templateStudio.js`, the
   `template_studio_id` branch in `compositions.js`, and
   `generateFromTemplateStudio` in `ThumbnailGeneratorService.js` would need
   to go, or be replaced with the legacy/`template_id` path already present
   alongside each. Turns on whether Template Studio is still an active
   feature Evoni wants, which this census cannot determine from the repo.
3. **Gate the paths.** Feature-flag or environment-check the Template Studio
   surface so it fails predictably (a named "not available in this
   environment" response) rather than a raw 500 with a Postgres error
   message, without removing or migrating anything yet. Turns on whether a
   clearer failure mode alone is enough for now, pending a decision on (1) or
   (2).

Any of the three obsoletes different parts of §3's INFERRED failure-mode
analysis; none is chosen here.

---

## §6. Footer

- **Rules:** nothing.
- **Mints:** nothing — no FD, no PE, no XK.
- **Host/AWS/DB contact by this session:** none. §4 cites, and does not
  repeat as a new read, a database contact made by a prior, separately
  authorized session and already filed on `main`.
- **Does not:** touch `src/`, add `template_studio` to any model, or write a
  migration.
- **Prod FROZEN.**
