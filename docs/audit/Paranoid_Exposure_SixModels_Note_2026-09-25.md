| **PRIME STUDIOS** **PARANOID EXPOSURE NOTE** *Six models were paranoid by inheritance against production tables with no `deleted_at`: CharacterTherapyProfile, CharacterArc, WardrobeContentAssignment, HairLibrary, MakeupLibrary, UniverseCharacter. This note records that, the callers, and the one behaviour change the fix makes: `destroy()` on these six becomes a real `DELETE`. It rules nothing.* |
| --- |

**Document version**

A new standalone note: not a Fix Plan revision and not an amendment.
Basis: `origin/main` at `37512e1b6c8797fe6edf56967fffb80867eb2cc1`,
measured 2026-09-25. Every file:line below is at that basis unless a
different SHA is named.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

EVIDENCE NOTE. Filed with the code fix it describes (Task #1869:
`paranoid: false` added to the six model files). The same shape as
`F-Stats-1_CharacterState_Paranoid_Note_2026-09-25.md` (Task #1832), six
more times.

- Every claim is **MEASURED** (a read of this repository anyone with a
  clone can repeat) unless it is labelled otherwise.
- It edits no filed document. It does not edit
  `Paranoid_Exposure_Inventory_2026-08-07.md` or
  `EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`.
- It mints no FD, XK or PE number and rules nothing.

---

## 1. What the models were (MEASURED)

None of the six sets `paranoid`. The global `define` sets
`paranoid: true`, so all six inherited it:

```
$ git show 37512e1b6:src/config/sequelize.js | grep -n "paranoid"
63:    paranoid: true,
$ git grep -n "paranoid" 37512e1b6 -- src/models/CharacterTherapyProfile.js src/models/CharacterArc.js src/models/WardrobeContentAssignment.js src/models/HairLibrary.js src/models/MakeupLibrary.js src/models/UniverseCharacter.js
$ echo $?
1
```

The canon capture lists 89 columns across the six tables and no
`deleted_at` among them:

```
$ grep -cE "^ (character_therapy_profiles|character_arcs|wardrobe_content_assignments|hair_library|makeup_library|universe_characters) +\|" docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
89
$ grep -cE "^ (character_therapy_profiles|character_arcs|wardrobe_content_assignments|hair_library|makeup_library|universe_characters) +\| deleted_at" docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
0
```

Capture line ranges: `character_arcs` 239-249,
`character_therapy_profiles` 399-411, `hair_library` 861-877,
`makeup_library` 941-959, `universe_characters` 2331-2346,
`wardrobe_content_assignments` 2486-2498.

**Generated SQL.** The new test
`tests/unit/models/sixModels.notParanoid.test.js` loads each real model
file with the app's `define` on a Sequelize instance that never
connects; `query()` is stubbed to record SQL. Run at this basis (before
the fix) it fails 24 of 26 tests. Three "Received string" lines, copied
from the jest output with the JSON escaping removed and the long column
lists cut (`…`):

```
CharacterArc findAll:
SELECT "id", "character_key", … "deleted_at" AS "deletedAt" FROM "character_arcs" AS "CharacterArc" WHERE ("CharacterArc"."deleted_at" IS NULL A…

UniverseCharacter create:
INSERT INTO "universe_characters" (…) VALUES ($1,…,$8) RETURNING "id","universe_id", … ,"world_exists","created_at","updated_at","deleted_at";

UniverseCharacter destroy:
UPDATE "universe_characters" SET "deleted_at"=$1 WHERE "deleted_at" IS NULL AND "id" = $2
```

The same three shapes appear for all six. That each call fails in
production is **INFERRED** from the capture plus this SQL, the same
inference `docs/SCHEMA_AGREEMENT_READ.md` §2.1 makes.

## 2. Callers (MEASURED)

Read and create callers are tabulated in `docs/SCHEMA_AGREEMENT_READ.md`
§2.1 and are not repeated here. This section counts only the callers
whose behaviour the fix changes.

```
$ git grep -nE "\b(CharacterTherapyProfile|CharacterArc|WardrobeContentAssignment|HairLibrary|MakeupLibrary|UniverseCharacter)\b[?]?\.(destroy|restore)\(" 37512e1b6 -- src scripts
37512e1b6:src/routes/hairLibraryRoutes.js:194:      await db.HairLibrary.destroy({ where: { show_id } });
37512e1b6:src/routes/makeupLibraryRoutes.js:192:      await db.MakeupLibrary.destroy({ where: { show_id } });
$ git grep -nE "\bitem\.destroy\(" 37512e1b6 -- src/routes/hairLibraryRoutes.js src/routes/makeupLibraryRoutes.js
37512e1b6:src/routes/hairLibraryRoutes.js:127:    await item.destroy();
37512e1b6:src/routes/makeupLibraryRoutes.js:125:    await item.destroy();
```

No file under `scripts/` names any of the six. No `restore()`,
`paranoid: false`, `withDeleted`, or `deleted_at` condition is applied
to any of the six anywhere in `src/` or `scripts/`, so no `restore()`
caller becomes dead. No other model declares an association to any of
the six (only their own `belongsTo`s, in `src/models/CharacterArc.js`,
`UniverseCharacter.js`, `HairLibrary.js`, `MakeupLibrary.js`), and no
migration declares a foreign key into any of the six tables, so no
cascade reaches them. `WardrobeContentAssignment` has its own removal
marker, `removed_at`, which its callers filter on directly
(`src/routes/wardrobeLibrary.js:90,99,444`,
`src/routes/memories/interview.js:253,259`); nothing writes it.

| Model | `destroy()` callers | Route (auth) | What it does after the fix |
|---|---|---|---|
| CharacterTherapyProfile | none | — | nothing changes |
| CharacterArc | none | — | nothing changes |
| WardrobeContentAssignment | none | — | nothing changes |
| UniverseCharacter | none | — | nothing changes |
| HairLibrary | `hairLibraryRoutes.js:127` `item.destroy()` | `DELETE /api/v1/hair-library/:id` (`requireAuth`) | a real `DELETE` of the row (see §3) |
| HairLibrary | `hairLibraryRoutes.js:194` `destroy({ where: { show_id } })` | `POST /api/v1/hair-library/generate` with `replace_existing: true` (`requireAuth`, `aiRateLimiter`) | a real `DELETE` of every `hair_library` row for the show, then the new rows are inserted, with no transaction (see §3) |
| MakeupLibrary | `makeupLibraryRoutes.js:125` `item.destroy()` | `DELETE /api/v1/makeup-library/:id` (`requireAuth`) | a real `DELETE` of the row (see §3) |
| MakeupLibrary | `makeupLibraryRoutes.js:192` `destroy({ where: { show_id } })` | `POST /api/v1/makeup-library/generate` with `replace_existing: true` (`requireAuth`, `aiRateLimiter`) | a real `DELETE` of every `makeup_library` row for the show, then the new rows are inserted, with no transaction (see §3) |

Mounts: `src/app.js:1085` (`/api/v1/hair-library`) and
`src/app.js:1094` (`/api/v1/makeup-library`).

None of the four callers asks for a soft delete: the two `DELETE`
routes answer `{ deleted: true }`, and `replace_existing` replaces. No
model needed to be left paranoid for a soft-delete caller.

## 3. The behaviour change, stated plainly

Before the fix, `destroy()` on any of the six issued
`UPDATE … SET "deleted_at"` against a missing column and removed
nothing. After it, `destroy()` is `DELETE FROM`. The test pins this.

For CharacterTherapyProfile, CharacterArc, WardrobeContentAssignment
and UniverseCharacter there is no caller, so the change is latent.

For HairLibrary and MakeupLibrary, `paranoid: false` was not enough on
its own. Both models mapped `is_justAWoman_style` to
`is_just_a_woman_style` (`underscored: true`), and production's column is
spelled `is_justAWoman_style` (`docs/SCHEMA_AGREEMENT_READ.md` §2.2;
capture lines 868 and 950). With only `paranoid: false`, every read and
create would still have failed, and `POST /generate` with
`replace_existing: true` would have deleted the show's rows and then
failed every insert: two dead features turned into one that destroys
rows. At Evoni's direction (option 1, 2026-09-25) the same change
therefore maps the attribute to its real column with
`field: 'is_justAWoman_style'`. MEASURED: every column the two models
map to now exists in the capture; the test pins it and fails without
the mapping.

So after this change the two libraries work for the first time:
`DELETE /:id` removes the row, and `generate` with `replace_existing`
deletes the show's rows and inserts the new ones. The delete and the
inserts are not in one transaction, so a failure part-way through
still loses the old rows; that is filed separately, not fixed here.

Whether either production table holds rows is not measured here. Every
create through the model has failed since the models were paranoid, and
no seeder under `src/seeders/` names the tables, so the tables are
**INFERRED** to be empty. The read-only count query in the PR for Task
#1869 settles it.

## 4. What this note does not do

- It edits no filed document. It does not add a migration or a
  `deleted_at` column, and it does not change any caller.
- It does not add a transaction to the replace path.
- It mints no FD, XK or PE number and rules nothing.
- The filing session made no host, AWS, database or Cognito contact. The
  SQL in §1 was generated offline against a stubbed connection.

---

## Footer

*Type: paranoid-exposure evidence note (MEASURED, two claims INFERRED
and labelled). Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Production's
freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions
still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`). Task: #1869.*
