# F-AUTH-1 — the AI-value-in-SQL read, Amendment 1: an eleventh site, MEASURED

**Amends:** `F-AUTH-1_AIValueInSQL_TierFeatures_Read_MEASURED_2026-09-23.md` (filed
by #1715, Task #1713). That document is not edited. This amendment sits beside it
and is read with it.

**Basis:** two SHAs, both named on every command below:

- **the amended read's basis:** `ab51c70100197788ceb6a8bb53e140516519629a`;
- **this amendment's own basis:** `origin/main` at
  `c7fb581711854cef2eb53b4449b494987ebcfba1` (2026-09-23), the squash merge of
  #1718.

**Standing:** MEASURED for every claim. Each is read from this repository at the
named basis, with its command and raw output. Nothing is carried from a PR body.
Nothing here is ATTESTED, INFERRED or RULED.

Task: #1719. No host, AWS, database, or Cognito contact.

---

## 1. The count being amended

The amended read gives its count in two places:

- **§5.2, heading:** "The sites, outside migrations and seeders — **10**
  unescaped, 4 escaped".
- **Summary item 4 and §5.4:** "one of 10 unescaped value sites" and "Unescaped
  value interpolation appears at 10 sites outside migrations".

**The correct count at that read's basis is 11.** One site was missed (§2). The
read's four escaped sites and its 17 migration and seeder lines (§5.3) are
unaffected.

## 2. The missed site

At the read's basis, `FilterService.searchCompositions` built its format filter
like this:

```
$ git show ab51c70100197788ceb6a8bb53e140516519629a:src/services/FilterService.js | sed -n 75p
          return `tc.selected_formats @> '["${fmt}"]'::jsonb`;
```

- **What was interpolated:** each element `fmt` of `formats`, placed directly
  inside a single-quoted JSON literal with no escaping.
- **What reached it:** `formats` is `req.query.formats` split on commas, passed by
  the `GET /search` handler in `src/routes/compositions.js`. **So it is caller
  text.**
- **Whether callers could reach it:** at that basis, `GET /search` is shadowed.
  In the same router, `GET /:id` is registered at line 454 and `GET /search` at
  line 1184:

  ```
  $ git grep -nE "^router\.get\(.(/:id|/search)." ab51c70100197788ceb6a8bb53e140516519629a -- src/routes/compositions.js
  src/routes/compositions.js:454:router.get('/:id', requireAuth, async (req, res) => {
  src/routes/compositions.js:1027:router.get('/:id/versions', requireAuth, async (req, res) => {
  src/routes/compositions.js:1051:router.get('/:id/versions/:versionNumber', requireAuth, async (req, res) => {
  src/routes/compositions.js:1080:router.get('/:id/versions/:versionA/compare/:versionB', requireAuth, async (req, res) => {
  src/routes/compositions.js:1145:router.get('/:id/version-stats', requireAuth, async (req, res) => {
  src/routes/compositions.js:1184:router.get('/search', requireAuth, async (req, res) => {
  src/routes/compositions.js:1251:router.get('/search/filters/options', requireAuth, async (req, res) => {
  src/routes/compositions.js:1273:router.get('/:id/outputs', requireAuth, async (req, res) => {
  ```

  `GET /:id` matches the one-segment path `/search`. Its handler answers the
  request itself, with `res.json` on success or 404/500 from its `catch`, and never
  calls `next`. So the `/search` handler is not reachable over HTTP at that basis.
  The same order holds at `c7fb5817`.
- **What this does to §5.4:** the amended read's sentence "only one site in it
  takes the caller's text" was written over 10 sites. The eleventh also takes
  caller text, by a route that is shadowed at that basis. This is recorded as a
  fact about the count. It does not re-open the read's conclusions (§5).
- **Fixed since:** #1718 (`c7fb5817`, Task #1717) binds each format as
  `tc.selected_formats @> $n::jsonb` with `JSON.stringify([fmt])` as the value.
  The same PR bound `getFilterOptions`' `episodeId`, which was the read's site 7.

## 3. Why the instruments missed it

The amended read's count "rests on instruments 1–3" (its §5.1, instrument 4's
closing note). Each misses this line at its basis.

- **Instrument 1**, `literal(` with an interpolation, looks only inside
  `literal(` calls. The site is not one.
- **Instrument 2** looks for a single quote immediately followed by `${`, for
  example `'${x}'`.
- **Instrument 3** looks for an SQL keyword or comparison operator followed by
  `${`.

```
$ git grep -nE 'literal\(\s*`[^`]*\$\{' ab51c70100197788ceb6a8bb53e140516519629a -- src/services/FilterService.js
EXIT: 1
$ git grep -nE "'\$\{" ab51c70100197788ceb6a8bb53e140516519629a -- src/services/FilterService.js
EXIT: 1
$ git grep -nE '(LIMIT|OFFSET|IN \(|ARRAY\[|INTERVAL|= |> |< )\s*\$\{' ab51c70100197788ceb6a8bb53e140516519629a -- src/services/FilterService.js
src/services/FilterService.js:227:      const episodeFilter = episodeId ? `AND tc.episode_id = ${episodeId}` : '';
EXIT: 0
```

**The blind spot.** Instrument 2's pattern `'\$\{` matches only when the
interpolation opens *immediately* after the quote. The missed line has `'["${`:
the value sits inside a quoted string literal, but after other literal text
(`["`). Any value placed partway into a quoted SQL literal has that shape, for
example `'%${term}%'`, `'["${x}"]'` or `'prefix-${id}'`, and the pattern cannot
see it. Instrument 3 misses it too, because `@>` is not in its operator list, and
a quote and `["` stand between the operator and the `${`.

**Instrument 4, the read's template scanner, also skipped it.** Rerun on the
basis file, it lists 13 interpolations in `FilterService.js`, and line 75 is not
among them:

```
$ (cd <scratch copy of the basis FilterService.js> && node sqltpl_one.js)
src/services/FilterService.js:136	paramIndex
src/services/FilterService.js:136	paramIndex
src/services/FilterService.js:145	whereClause
src/services/FilterService.js:151	whereClause
src/services/FilterService.js:151	sortField
src/services/FilterService.js:151	order
src/services/FilterService.js:151	paramIndex
src/services/FilterService.js:151	paramIndex + 1
src/services/FilterService.js:230	episodeFilter
src/services/FilterService.js:238	episodeFilter
src/services/FilterService.js:246	episodeFilter
src/services/FilterService.js:254	episodeFilter
src/services/FilterService.js:262	episodeFilter
interpolations: 13
```

The scanner treats a template as SQL only if it matches a regex whose
alternatives are each anchored by `\b`, a word boundary. The one SQL marker on
line 75 is `::jsonb`, and a word boundary cannot come before `::` when it follows
a quote. So the template was never classed as SQL. The read had already set this
scanner aside as unreliable ("not a JavaScript parser"), and the count did not
rest on it.

**For later reads.** A search for value interpolation that uses `'\$\{` alone
will undercount in the same way. A pattern that allows literal text between the
opening quote and the `${` does not (§4).

## 4. The count, re-derived at both bases

**The widened pattern** allows any run of characters other than a quote or a
backtick between the opening quote and `${`. This adds only lines that `'\$\{`
would miss, so the widened set still contains everything instrument 2 found. The
lines are then filtered to those that look like SQL:

```
$ git grep -nE "'[^'\`]*\$\{" ab51c70100197788ceb6a8bb53e140516519629a -- src ':!src/migrations' ':!src/seeders' | grep -E "::(jsonb|text|uuid|int|date)|@>|\?\||ILIKE|\bLIKE\b|WHERE|SET |INTERVAL|IN \(|= '|literal\(|SELECT|UPDATE|INSERT|DELETE" | cut -c1-150
src/controllers/searchController.js:247:        sql += ` AND to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || 
src/models/job.js:329:      AND completed_at < NOW() - INTERVAL '${daysOld} days'
src/routes/memories/interview.js:859:${driftType === 'full_shift' ? `They shifted significantly to talking about ${driftedTo}. FOLLOW this drift — d
src/routes/memories/planning.js:529:${healthReport?.counts?.total > 0 ? `\nBOOK HEALTH SCAN (${healthReport.counts.errors} errors, ${healthReport.coun
src/routes/memories/voice.js:45:          .map(m => `${m.role === 'character' ? character_name : 'AUTHOR'}: ${m.text}`)
src/routes/sceneSetRoutes.js:1364:        where: sequelize.literal(`event_compatibility @> '${JSON.stringify([beatNumber])}'::jsonb`),
src/routes/sceneSetRoutes.js:1368:          where: sequelize.literal(`"angles"."beat_affinity" @> '${JSON.stringify([beatNumber])}'::jsonb`),
src/routes/therapy.js:347:      .map(m => `${m.role === 'character' ? rest.character_name : 'AUTHOR'}: ${m.content}`)
src/routes/therapy.js:459:      .map(m => `${m.role === 'character' ? rest.character_name : 'AUTHOR'}: ${m.content}`)
src/routes/therapy.js:532:      session_note:            `${rest.character_name}: ${reveal_type === 'never' ? 'locked from knowing — ' : 'receive
src/routes/tierFeatures.js:90:        `characters_involved ?| ARRAY[${charIds.map(id => `'${id}'`).join(',')}]`
src/routes/tierFeatures.js:1038:          metadata: db.sequelize.literal(`COALESCE(metadata, '{}')::jsonb || '${JSON.stringify({ beat_sheet: result.be
src/routes/uiOverlayRoutes.js:811:      : `Phone ${category === 'phone_icon' || category === 'icon' ? 'icon' : 'screen'} for "${name}".`;
src/routes/worldStudio.js:2202:        { replacements: { id: targetChapterId, book_id, title: `${scene.scene_type.replace(/_/g, ' ')} — ${scene.char
src/services/ActivityIndexService.js:360:        sql += ` AND (resource_id = $${paramIndex} OR (resource_type = 'episode' AND resource_id = $${paramIn
src/services/ActivityIndexService.js:418:        countSql += ` AND (resource_id = $${countIndex} OR (resource_type = 'episode' AND resource_id = $${co
src/services/ErrorRecovery.js:92:        WHERE created_at >= NOW() - INTERVAL '${hours} hours'
src/services/FilterService.js:75:          return `tc.selected_formats @> '["${fmt}"]'::jsonb`;
src/services/ImageProcessingService.js:102:            'thumbnails', '${JSON.stringify(results.thumbnails)}'::jsonb,
src/services/ImageProcessingService.js:103:            'webp', '${JSON.stringify(results.webp)}'::jsonb,
src/services/depthEstimationService.js:104:    throw new Error(`Replicate API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail 
src/services/episodeGeneratorService.js:862:            models.sequelize.literal(`metadata->>'event_id' = '${eventId.replace(/'/g, "''")}'`),
src/services/episodeScriptWriterService.js:536:      block += `\n  SCRIPT DIRECTIVE: When this character speaks, use THEIR voice. ${p.depth_level === 
src/services/episodeScriptWriterService.js:564:    prevBlock = `═══ PREVIOUS EPISODE ═══\n"${p.title}" (Episode ${p.episode_number}) — $
src/services/feedScheduler.js:558:${layer === 'lalaverse' && spark.city ? `\nLALAVERSE: Lives in ${spark.city.replace(/_/g, ' ')} — ${CITY_CULTURE[s
src/services/imageGenerationService.js:147:  console.log(`[ImageGen] Flux ${options.quality === 'standard' ? 'dev' : 'pro'} | ${imageSize} | use: ${op
src/services/imageRestyleService.js:141:    throw new Error(`Replicate API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail : J
src/services/inpaintingService.js:192:    throw new Error(`LaMa API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail : JSON.str
src/services/inpaintingService.js:318:      throw new Error(`FLUX Fill Pro model-run error: ${status || 'unknown'} — ${typeof detail === 'string' ? 
src/services/inpaintingService.js:336:    throw new Error(`FLUX Fill Pro API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail :
src/services/inpaintingService.js:455:    throw new Error(`Replicate API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail : JSO
EXIT: 0
```

Each line was read:

- **Value sites, unescaped, in the amended read's 10:** `models/job.js:329`,
  `sceneSetRoutes.js:1364` and `:1368`, `tierFeatures.js:90` and `:1038`,
  `ErrorRecovery.js:92`, and `ImageProcessingService.js:102` and `:103`.
- **Value site, unescaped, new:** `FilterService.js:75`.
- **Value site, escaped:** `episodeGeneratorService.js:862`, already in the
  read's escaped four.
- **Placeholders or bound replacements, not value sites:**
  - `searchController.js:247` (`$${paramIndex}`, with the value pushed to `params`
    at `:248`);
  - `ActivityIndexService.js:360` and `:418` (`$${…}`);
  - `worldStudio.js:2202` (the interpolation builds a `replacements` value bound
    as `:title`).
- **Not SQL:** AI prompt text, log lines, `Error` messages and a UI label. They
  match the filter only because they contain words such as `SET` or `WHERE`, or a
  single quote before a `${`.

The two unquoted sites come from instrument 3, which the widened pattern does not
replace: `FilterService.js:227` and `worldStudio.js:1078` (§3 output above, and
the command below). Together with the nine quoted sites, the unescaped value
sites outside migrations and seeders at `ab51c701` are:

1. `tierFeatures.js:1038`
2. `tierFeatures.js:90`
3. `sceneSetRoutes.js:1364`
4. `sceneSetRoutes.js:1368`
5. `ImageProcessingService.js:102`
6. `ImageProcessingService.js:103`
7. `FilterService.js:227`
8. `models/job.js:329`
9. `ErrorRecovery.js:92`
10. `worldStudio.js:1078`
11. **`FilterService.js:75`**

**At the read's basis `ab51c701`: 11.** No site turns up beyond the eleventh.

**At this amendment's basis `c7fb5817`:** the same widened command, with the
same filter, lists every line above except `FilterService.js:75`. The two
outputs were saved and compared:

```
$ diff <(widened at ab51c701) <(widened at c7fb5817)
18d17
< src/services/FilterService.js:75:          return `tc.selected_formats @> '["${fmt}"]'::jsonb`;
EXIT: 1
```

Instrument 3 no longer finds `FilterService.js:227`:

```
$ git grep -nE "(LIMIT|OFFSET|IN \(|ARRAY\[|INTERVAL|= |> |< )\s*\$\{" c7fb581711854cef2eb53b4449b494987ebcfba1 -- src/services/FilterService.js src/routes/worldStudio.js src/routes/tierFeatures.js
src/routes/tierFeatures.js:90:        `characters_involved ?| ARRAY[${charIds.map(id => `'${id}'`).join(',')}]`
src/routes/worldStudio.js:1078:    if (intimate_eligible) { where += ` AND intimate_eligible = ${intimate_eligible === 'true'}`; }
EXIT: 0
```

**At `c7fb5817`: 9.** Between the two bases, `src/` changed only in the two files
#1718 touched:

```
$ git diff --stat ab51c70100197788ceb6a8bb53e140516519629a c7fb581711854cef2eb53b4449b494987ebcfba1 -- src
 src/routes/compositions.js    |  7 +++++++
 src/services/FilterService.js | 30 ++++++++++++++++--------------
 2 files changed, 23 insertions(+), 14 deletions(-)
```

**The difference from 11 to 9 is #1718's two fixes** (`FilterService.js:75` and
`:227`), by citation. Nothing else differs.

**Limits of the widened instrument.** It is still a text search.

- A value interpolated unquoted, after an operator that instrument 3 does not
  list, would still be missed. An example is `@> ${x}`.
- So would SQL assembled across several lines, where the quote and the `${` fall
  on different lines.

This amendment records those limits and does not claim the count is proof
against them.

## 5. What this amendment does not do

- It does **not** edit the amended read. The read's text stands as filed, and
  this amendment corrects its count beside it.
- It does **not** re-open the read's conclusions. The read's findings about
  `tierFeatures.js:1038` (§§1–4 and §6) are untouched. The §5.4 sentence is noted
  in §2 above as written over 10 sites, not re-argued.
- It **rules nothing**, opens no Fix Plan, and **mints nothing**.

---

## Footer

- **Type:** amendment (MEASURED), F-AUTH-1 family. Amendment 1 to
  `F-AUTH-1_AIValueInSQL_TierFeatures_Read_MEASURED_2026-09-23.md`.
- **Rules:** nothing.
- **Mints:** nothing — no FD, XK, or PE.
- **Host / AWS / database / Cognito contact:** none. Every claim reads this
  repository at one of the two named SHAs.
- **Production:** production's freeze is lifted
  (`F-Deploy-1_Fix_Plan_v1.53.md` §1). Agent sessions still never touch
  hosts, AWS, RDS, or Cognito (`CLAUDE.md`), unchanged by that lift or by
  this note.
