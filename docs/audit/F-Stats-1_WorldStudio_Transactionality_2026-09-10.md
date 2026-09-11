# F-Stats-1 — `worldStudio.js:1838`–`:1859` Transactionality Read

*Standalone note. Measurement only. Rules nothing, mints nothing, closes
nothing.*

## Basis

```
$ git rev-parse origin/main
0a0ff3ed4609cff66861d9479665c412d646f320
```

MEASURED. Date: 2026-09-10.

## Source citation — v1.60 §63.5, verbatim

`F-Stats-1_Fix_Plan_v1.60.md` §63.5 ("Recorded, unminted"), first bullet,
quoted verbatim from lines 141–145 of that file at `origin/main`:

> **`worldStudio.js:1838` through `:1859` is a five-table hard-delete
> cascade** — `character_relationships`, `registry_characters`,
> `intimate_scenes`, `character_relationships_extended`, `world_characters`,
> executed as five sequential raw `DELETE` statements. **No transaction is
> visible in the surrounding lines**, which were not read. **Excluded from
> Rule 2 by domain per v1.44 §47.2 and untouched by the §63.2 ruling**, which
> clears nothing. Recorded because a partial failure mid-cascade leaves
> referential wreckage, and that is not a tenancy question.

v1.60's "What this revision does not do" section (line 172) states directly:
"Does not read the lines surrounding `worldStudio.js:1838`-`:1859`, and
**makes no claim about whether that cascade is transactional**." No citation
defect: v1.60's own wording exists and is quoted above without paraphrase.

## Raw range read at basis — `worldStudio.js:1828`–`:1864`

```
$ git show 0a0ff3ed4609cff66861d9479665c412d646f320:src/routes/worldStudio.js | sed -n '1828,1864p'
1828: // DELETE /world/characters/:id
1829: router.delete('/world/characters/:id', requireAuth, async (req, res) => {
1830:   try {
1831:     // Remove linked relationship rows (via registry_characters)
1832:     const [rc] = await Q(req,
1833:       `SELECT id FROM registry_characters WHERE world_character_id = :id`,
1834:       { replacements: { id: req.params.id } }
1835:     ).catch(() => []);
1836:     if (rc) {
1837:       await sequelize.query(
1838:         `DELETE FROM character_relationships WHERE character_id_a = :rcId OR character_id_b = :rcId`,
1839:         { replacements: { rcId: rc.id }, type: sequelize.QueryTypes.DELETE }
1840:       ).catch(e => console.warn('[world-studio] delete character relationships error:', e?.message));
1841:     }
1842:     // Remove linked registry character
1843:     await sequelize.query(
1844:       `DELETE FROM registry_characters WHERE world_character_id = :id`,
1845:       { replacements: { id: req.params.id }, type: sequelize.QueryTypes.DELETE }
1846:     ).catch(e => console.warn('[world-studio] delete registry character error:', e?.message));
1847:     // Remove linked scenes
1848:     await sequelize.query(
1849:       `DELETE FROM intimate_scenes WHERE character_a_id = :id OR character_b_id = :id`,
1850:       { replacements: { id: req.params.id }, type: sequelize.QueryTypes.DELETE }
1851:     ).catch(e => console.warn('[world-studio] delete intimate scenes error:', e?.message));
1852:     // Remove extended relationships
1853:     await sequelize.query(
1854:       `DELETE FROM character_relationships_extended WHERE character_id = :id OR related_character_id = :id`,
1855:       { replacements: { id: req.params.id }, type: sequelize.QueryTypes.DELETE }
1856:     ).catch(e => console.warn('[world-studio] delete extended relationships error:', e?.message));
1857:     // Delete the character
1858:     await sequelize.query(
1859:       `DELETE FROM world_characters WHERE id = :id`,
1860:       { replacements: { id: req.params.id }, type: sequelize.QueryTypes.DELETE }
1861:     );
1862:     res.json({ deleted: true });
1863:   } catch (err) { res.status(500).json({ error: err.message }); }
1864: });
```

MEASURED. **Line numbers 1838 and 1859 confirmed exact** — no drift from
v1.60's citation. Line 1838 is the `character_relationships` DELETE's SQL
text; line 1859 is the `world_characters` DELETE's SQL text, matching v1.60
§63.5's cited range precisely.

## Every write call in the cited block, by line

All five are raw `sequelize.query()` calls (no Sequelize model method — no
`Model.destroy()` anywhere in this block); none passes a `{ transaction }`
option; none is preceded by `sequelize.transaction()`, `BEGIN`, or any shared
transaction object.

| # | SQL text line | Table | Call | Conditional | `{ transaction }` passed | Error handling |
|---|---|---|---|---|---|---|
| 1 | `:1838` | `character_relationships` | `sequelize.query(..., { type: sequelize.QueryTypes.DELETE })` | Yes — inside `if (rc)` (line 1836), `rc` from the prior `SELECT` | No | `.catch(e => console.warn(...))` — swallowed, execution continues |
| 2 | `:1844` | `registry_characters` | `sequelize.query(..., { type: sequelize.QueryTypes.DELETE })` | No | No | `.catch(e => console.warn(...))` — swallowed, execution continues |
| 3 | `:1849` | `intimate_scenes` | `sequelize.query(..., { type: sequelize.QueryTypes.DELETE })` | No | No | `.catch(e => console.warn(...))` — swallowed, execution continues |
| 4 | `:1854` | `character_relationships_extended` | `sequelize.query(..., { type: sequelize.QueryTypes.DELETE })` | No | No | `.catch(e => console.warn(...))` — swallowed, execution continues |
| 5 | `:1859` | `world_characters` | `sequelize.query(..., { type: sequelize.QueryTypes.DELETE })` | No | No | None — no `.catch()` on this call; a rejection propagates to the handler's own `try/catch` (line 1863), which responds HTTP 500 |

**Transaction question, answered per write:** no — for all five. No
`sequelize.transaction()` call, no `BEGIN`, no shared transaction variable,
and no `commit`/`rollback` token appears anywhere in the handler body (lines
1829–1864) as read.

**Asymmetry recorded, not assessed:** writes 1–4 swallow their own errors
via `.catch(e => console.warn(...))` and let the cascade continue regardless
of whether the delete succeeded; write 5 (`world_characters`) has no
`.catch()` of its own, so only its failure reaches the outer `try/catch` and
produces a non-200 response. No position is taken on whether this asymmetry
is a defect.

## Enclosing handler

- **HTTP method / path:** `DELETE /world/characters/:id`
- **Middleware:** `requireAuth` (line 1829)
- **Start line:** `1829` (`router.delete(...)`)
- **End line:** `1864` (closing `});`)
- **Preceding read:** line 1832–1835, a `SELECT` via the local `Q()` helper
  (`worldStudio.js:40`, `sequelize.query(sql, { type: sequelize.QueryTypes.SELECT, ...opts })`)
  — itself not a write, gates only write #1's conditional.

## What this note does not do

- Does not assess whether the cascade *should* be transactional, or propose
  a remedy. Recording only.
- Does not read `Q()` or any other shared helper beyond confirming (from the
  cited lines themselves) that none of the five writes route through it —
  all five call `sequelize.query()` directly.
- Does not rule on the asymmetric error-handling recorded above.
- Does not mint FD-70, XK-4, or PE #69.
- Does not edit `F-Stats-1_Fix_Plan_v1.60.md`,
  `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md`, or any other filed document.
- Does not change any file under `src/`.
- **Does not close this owed item or declare it closed.** v1.60 §63.5's
  question — whether the cascade is transactional — is answered MEASURED-no
  for the five writes as read; whether that absence constitutes a defect,
  and any remedy, remain open.
- No host, AWS, database, or Cognito contact. No live DB contact.

## Tails — re-derived at this basis

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -3
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit | grep -E '^XK-[0-9]+_' | sort -t- -k2 -n | tail -3
XK-2_Extent_Census_2026-09-05.md
```

**FD tail: FD-69** (FD-70 next-available, unminted — not minted here).
**XK tail: XK-3** — the filename scan above tops out at `XK-2` because XK-3
is carried in `Cross_Keystone_Register.md` itself (an F-AUTH-1 row against
`src/middleware/auth.js`, per `F-AUTH-1_Fix_Plan_v2.43.md:145`), not under a
separate `XK-3_`-prefixed file; filename scan alone would under-count it.

**PE tail: PE #68** — per the audit-file skill, PE numbers are minted by
`Session_PE_Roster.md`, not by filename or mention count:

```
$ grep -n '^### PE #6[4-9]' docs/audit/Session_PE_Roster.md
1631:### PE #64 — Cognito User Pool shared between dev and prod: ...
1813:### PE #65 — F-AUTH-1 v1.5 §9.10's remedy is unspecifiable as written: ...
1920:### PE #66 — `docs/cognito-ids.txt` names two Cognito pools that do not exist, ...
2026:### PE #67 — feature branch cut from a squash-merged predecessor branch ...
2146:### PE #68 — an agent harness injects a git credential that authorizes ...
```

Highest minted heading is `PE #68` (`NEW 2026-08-28`); no `### PE #69`
heading exists in the roster. **Method note:** a bare-mention grep filtered
for the words "next-available"/"unminted" on the same line was tried first
and discarded — it is line-scoped and unreliable, because those qualifying
words often sit on a different line of the same sentence than the `PE #69`
citation, so the filter passes through citations it should have excluded.
`PROJECT_CONTEXT.md` (line 249) already warns against deriving a tail by
mention count for exactly this reason. The roster-heading scan above is the
correct instrument and is not subject to that flaw.

All three tails agree with `PROJECT_CONTEXT.md`'s Task #1252 re-derivation
(2026-09-04) and are unchanged at this basis. No FD, XK, or PE is minted by
this note.

## Footer

**Type:** standalone measurement note. **Rules:** nothing. **Mints:**
nothing — no FD, no XK, no PE. **Host/AWS/DB contact:** none. **Prod
FROZEN**, untouched. **Closes:** nothing — the transactionality question is
recorded MEASURED-no for the cited block; no disposition, defect ruling, or
remedy is made.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-10. Basis: `origin/main` at
`0a0ff3ed4609cff66861d9479665c412d646f320`.*
*Authority: `F-Stats-1_Fix_Plan_v1.60.md` §63.5, read directly, MEASURED, and
`src/routes/worldStudio.js:1828`–`:1864`, read directly, MEASURED.*
