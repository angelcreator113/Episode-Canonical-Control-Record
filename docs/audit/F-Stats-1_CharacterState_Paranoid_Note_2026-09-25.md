| **PRIME STUDIOS** **F-STATS-1 NOTE** *`F-Stats-1_Fix_Plan_v1.17.md` says "`CharacterState` is not paranoid". Until the fix in Task #1832 is deployed, the model was paranoid by inheritance. This note records that and the period it covers. It fixes nothing itself and rules nothing.* |
| --- |

**Document version**

A new standalone note: not a Fix Plan revision and not an amendment.
Basis: `origin/main` at `26e25c3776f088663961b8186ddcddd9d029c842`,
measured 2026-09-25. Every file:line below is at that basis unless a
different SHA is named.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

EVIDENCE NOTE, F-Stats-1. Filed with the code fix it describes (Task
#1832: `paranoid: false` added to `src/models/CharacterState.js`).

- Every claim is **MEASURED** (a read of this repository anyone with a
  clone can repeat) unless it is labelled otherwise.
- It does not edit `F-Stats-1_Fix_Plan_v1.17.md`. A pointer banner is
  added to the top of that file; its body is unedited.
- It mints no FD, XK or PE number and rules nothing.

---

## 1. What v1.17 says

`docs/audit/F-Stats-1_Fix_Plan_v1.17.md:64-66` (filed 2026-08-04,
`67aec76c597ace3dd980d05e6526011cb4455fea`, #980; v1.17's own basis is
`9f57b1fe`):

> - **`CharacterState` is not paranoid** -> it declares `tableName`,
>   `underscored`, `timestamps` and no `paranoid` -> **plain `findOne`
>   correct, `.unscoped()` would be wrong.**

```
$ git log --format='%H %ad %s' --date=short -- docs/audit/F-Stats-1_Fix_Plan_v1.17.md
67aec76c597ace3dd980d05e6526011cb4455fea 2026-08-04 docs(audit): F-Stats-1 Fix Plan v1.17 - PR 4 CLOSED at 6 of 6, unit 19 withdrawn (#980)
```

## 2. What the model was (MEASURED)

The observation about the declaration is correct: the model sets no
`paranoid`. The conclusion is not. A model that sets no `paranoid`
inherits the global `define`, and the global `define` sets
`paranoid: true`. That was so at v1.17's basis, at its filing commit,
and at this note's basis before the fix.

```
$ git show 9f57b1fe:src/config/sequelize.js | grep -n "paranoid"
63:    paranoid: true,
$ git show 9f57b1fe:src/models/CharacterState.js | grep -n "paranoid\|tableName\|timestamps"
33:    tableName: 'character_state',
35:    timestamps: true,
$ git show 67aec76c5:src/config/sequelize.js | grep -n "paranoid"
63:    paranoid: true,
$ git show 67aec76c5:src/models/CharacterState.js | grep -n "paranoid\|tableName"
33:    tableName: 'character_state',
$ git show 67aec76c5:src/models/index.js | grep -n "define: dbConfig.define"
40:  define: dbConfig.define,
```

The model file has changed twice since it was created, and neither
change touched its options:

```
$ git log --format='%h %ad %s' --date=short -- src/models/CharacterState.js
973c0056d 2026-09-24 fix(stats): one character key, lala, per F-Sec-3 [skip-automerge] (#1819)
30f10fe70 2026-05-15 F-Stats-1: Phase A G2 — Create CharacterState Sequelize model (#684)
$ git show 973c0056d -- src/models/CharacterState.js | grep "^[-+] "
-      // 'lala' (user-facing) | 'justawoman' (backend) | 'guest:<id>'
-      // Drift preserved per Decision #6; F-Sec-3 will consolidate.
+      // 'lala' (canonical, F-Sec-3 decision; Task #1816) | 'guest:<id>'
```

**Generated SQL.** The new test
`tests/unit/models/CharacterState.notParanoid.test.js` loads the model
with the app's `define` on a Sequelize instance whose `query()` is
stubbed, with no database. Run against the model as it is at this
basis (the fix reverted), it fails five of six tests. Below is the
"Received string" of three of those failures, copied from the jest
output with the JSON escaping removed. The findAll failure has the same
`deleted_at IS NULL` predicate and is left out here.

```
findOne:
SELECT "id", "show_id", "season_id", "character_key", "coins", "reputation", "brand_trust", "influence", "stress", "last_applied_episode_id", "created_at" AS "createdAt", "updated_at" AS "updatedAt", "deleted_at" AS "deletedAt" FROM "character_state" AS "CharacterState" WHERE ("CharacterState"."deleted_at" IS NULL AND ("CharacterState"."show_id" = 'a' AND "CharacterState"."character_key" = 'lala')) LIMIT 1;

findOne with attributes: ['coins'], raw: true:
SELECT "coins" FROM "character_state" AS "CharacterState" WHERE ("CharacterState"."deleted_at" IS NULL AND "CharacterState"."show_id" = 'a') LIMIT 1;

create:
INSERT INTO "character_state" ("id","show_id","character_key","coins","reputation","brand_trust","influence","stress","created_at","updated_at") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING "id","show_id","season_id","character_key","coins","reputation","brand_trust","influence","stress","last_applied_episode_id","created_at","updated_at","deleted_at";
```

The canon capture has twelve `character_state` columns and no
`deleted_at`
(`docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt:376-387`).
So every model read and every model create on `CharacterState` has
asked for a column that does not exist. The callers that swallow this
are listed in `docs/MIGRATION_DRIFT_READ.md` §6 and are not repeated
here.

## 3. Standing of the v1.17 line

- **As a description of the model, it was inaccurate** from filing
  (2026-08-04) until the fix is deployed. The model was paranoid by
  inheritance, and the generated SQL in §2 shows it.
- **As guidance, it holds once the fix is live.** With
  `paranoid: false` declared, a plain `findOne` on `CharacterState` adds
  no `deleted_at` predicate, which is what v1.17 says a call site
  should rely on; call sites need no `.unscoped()`. The line was
  inaccurate as a description of the model for a period. It was not
  wrong as guidance.
- **Where the period ends.** The period ends at the first production
  deploy whose SHA contains Task #1832's model commit. That deploy's
  record will name it. This note does not assert a deploy date.

## 4. What this note does not do

- It does not edit v1.17's body. The banner at the top of that file
  points here and carries nothing.
- It does not add a migration or a `deleted_at` column, and it does not
  change any caller.
- It mints no FD, XK or PE number and rules nothing.
- The filing session made no host, AWS, database or Cognito contact. The
  SQL in §2 was generated offline against a stubbed connection.

---

## Footer

*Type: F-Stats-1 evidence note (MEASURED). Rules: nothing. Mints:
nothing. Discharges: nothing. Host/AWS/DB/Cognito contact by the filing
session: none. Production's freeze is lifted
(`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch
hosts, AWS, RDS or Cognito (`CLAUDE.md`). Task: #1832.*
