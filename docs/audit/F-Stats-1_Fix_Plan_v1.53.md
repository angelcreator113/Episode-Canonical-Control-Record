# F-Stats-1 Fix Plan v1.53
*Additive-supersede on v1.52. Mints §56. Completes `storyteller.js` under Rule 2. Mints no finding.*

## What changed in v1.53

**`storyteller.js` is complete under Rule 2 — 8 destructive sites, 8 handlers, all
instances.** The shape now stands at **18 sites, 17 handlers, 7 files.**

**Seven of eight handlers perform a lookup, and every lookup exists to produce a
404 rather than to authorize** — §56.3. The file's own comment states it:
*"Verify chapter exists."*

**The file is uniform.** One handler shape, no variation across eight sites.
**That is evidence the omission is per-file convention rather than per-handler
oversight** — §56.4, recorded as an observation about one file and **not
generalised.**

**`storyteller.js` spans two variants** — §56.2. `:280` is tenancy-on-model-
unfetched; the other seven carry no tenant column, at join depths from one to
unestablished.

**A miscount was caught mid-pass** — §56.5. Two sites sharing identical statement
text were counted as one.

**Rule 2's remaining population: 67.**

---

## §56 — `storyteller.js`, complete

### §56.1 The eight sites

All eight are `requireAuth`, none carries a tenant parameter, and none reads one.

| Line | Route | Call | Model |
|---|---|---|---|
| 280 | `DELETE /books/:id` | `book.destroy()` | `StorytellerBook` |
| 387 | `DELETE /chapters/:id` | `chapter.destroy()` | `StorytellerChapter` |
| 889 | `DELETE /chapters/:id/lines` | `StorytellerLine.destroy({ where: { chapter_id } })` | `StorytellerLine` |
| 909 | `DELETE /lines/:id` | `line.destroy()` | `StorytellerLine` |
| 1000 | `POST /chapters/:chapterId/import` | `StorytellerLine.destroy({ where: { chapter_id } })` | `StorytellerLine` |
| 1174 | `DELETE /echoes/:echoId` | `echo.destroy()` | `StorytellerEcho` |
| 1378 | `PATCH /memories/:id/reject` | `mem.destroy()` | `StorytellerMemory` |
| 1521 | `DELETE /threads/:id` | `thread.destroy()` | `StoryThread` |

**`:280` was recorded at v1.52 §55.5.** The other seven are read here.

### §56.2 Two variants in one file

Per v1.52 §55.3's taxonomy:

| Variant | Sites | Tenancy path |
|---|---|---|
| Tenancy on model, never fetched | `:280` | `StorytellerBook.show_id`, direct |
| No tenant column | `:387` | `chapter → book`, one join |
| No tenant column | `:889`, `:909`, `:1000` | `line → chapter → book`, two joins |
| No tenant column | `:1174`, `:1378`, `:1521` | **path unestablished** |

**`StorytellerEcho`, `StorytellerMemory` and `StoryThread` carry no `show_id`**,
verified against model files confirmed present in `src/models/`. **Whether each
reaches tenancy at all, and by what path, was not established and is not
asserted.** They may hang off a book, off a chapter, or off nothing.

**`StoryThread` is a different model family** from the `Storyteller*` models and
was checked separately rather than assumed to follow the file's pattern — the
check v1.52 §55.6 exists because it was skipped seven times.

### §56.3 The lookup that is not a guard

Seven of eight handlers fetch the target before destroying it. **Every one of
those fetches is `findByPk` on a caller-supplied id, followed by a 404 on
absence.** The canonical form:

```
const chapter = await models.StorytellerChapter.findByPk(req.params.id);
if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
await chapter.destroy();
```

**`:1000`'s handler states the intent in a comment: `// Verify chapter exists`.**
That is precisely and only what it does.

**`:889` is the sharpest illustration.** It fetches the chapter solely to read
`chapter.id` back — a value already held in `req.params.id` — and then bulk-deletes
every line under it. **The lookup contributes a 404 and nothing else.**

**This is worth recording as its own observation.** A reader scanning these
handlers sees a fetch, a conditional, and an error return, and may read that as an
access check. **It is an existence check.** The two are structurally identical and
answer different questions.

### §56.4 The file is uniform — recorded, not generalised

Eight sites, one shape, **no variation**. Every handler that guards, guards
existence. Every handler omits tenancy. There is no handler in this file that
scopes and no handler that fails to 404.

**That uniformity is itself evidence.** Scattered instances across seven files
(v1.48, v1.49) are consistent with per-handler oversight. **Eight consecutive
identical omissions in one file are more consistent with a convention that was
never established than with eight independent lapses.**

**This is a claim about `storyteller.js` and about no other file.** Whether
per-file uniformity holds elsewhere is **untested** — `sceneSetRoutes.js` (6
destructive sites) would be the natural test and **was not read.**

**It bears on remedy shape and is recorded as bearing on it, not as selecting
one.** A file whose every handler makes the same omission is not addressed by
eight patches in the way eight scattered defects would be. **Both shapes' remedies
remain UNEVALUATED**, per CKR §5 and v1.48 §51.5.

### §56.5 Method note — a miscount caught mid-pass

`:889` and `:1000` carry **identical statement text** —
`StorytellerLine.destroy({ where: { chapter_id } })` — in different handlers.
During the pass they were treated as one site, and `storyteller.js` was twice
stated as "complete at 8 sites" while **seven had been read.**

The error was caught by reconciling the read count against the original
`git grep -n` listing, which had shown eight distinct line numbers.

**The generalisable form: identical text at different line numbers is different
sites**, and a pass that tracks statements by their content rather than their
position will merge them. **The listing was correct throughout; the tracking was
not.**

This joins the accumulated hazard family — §28's `Measure-Object -Line`, §43.7's
null controls, §46.4's shape-without-model, §47.6's malformed probe, §52.5's
partial population, §53.5's three counts, §54.5's `-c`/`-n`, §55.6's unread model
layer. **Eighth position.** Every one has been a count or a claim that described
the instrument, the tracking, or the assumption rather than the subject.

### §56.6 Recorded, unminted

- **`PATCH /memories/:id/reject` performs a hard `destroy()`.** The route's
  contract says reject; the effect is deletion. **Rejected memories are neither
  recoverable nor auditable.** Not a tenancy issue; recorded because
  `storyteller_memories` is canon.
- **Cascade behaviour is unread** on every model in this file. `:280` deletes a
  book; whether chapters and lines follow, and whether by database constraint or
  Sequelize association, **was not established at v1.52 §55.5 and is not
  established here.**
- **`StorytellerStory.js` exists** alongside the modelless `stories` table
  recorded at v1.43 §46.2. **Two story concepts with different model coverage.**
  Recorded for the modelless-tables thread; not examined.

---

## What this revision does not do

- **Does not mint any finding.** The shape remains unminted, unowned, unnumbered
  across all 18 sites; v1.48 §51.5's option 3 stands.
- Does not generalise §56.4's uniformity claim beyond `storyteller.js`.
- Does not read `sceneSetRoutes.js` or any other Rule 2 file. **67 sites remain
  unread and are not asserted clean.**
- Does not establish the tenancy path for `StorytellerEcho`,
  `StorytellerMemory`, or `StoryThread`.
- Does not examine cascade behaviour on any model.
- Does not amend XK-2's Cross-Keystone Register entry.
- Does not measure the reads surface; v1.51 §54.4's instrument question stands.
- Does not measure XK-2's ORM-surface extent.
- Does not propose or evaluate a remedy. **§56.4 bears on remedy shape and selects
  none. Both shapes' remedies remain UNEVALUATED.**
- Does not disposition any statement. **No file other than `worldEvents.js` is
  dispositioned.**
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.53 | 2026-08-15 | **`storyteller.js` complete under Rule 2 — 8 destructive sites, 8 handlers, all instances.** Shape now **18 sites / 17 handlers / 7 files**; Rule 2's remaining population **67**. Sites: `:280` (`book.destroy()`), `:387` (`chapter.destroy()`), `:889` and `:1000` (`StorytellerLine.destroy({where:{chapter_id}})`), `:909` (`line.destroy()`), `:1174` (`echo.destroy()`), `:1378` (`mem.destroy()`), `:1521` (`thread.destroy()`). **Two variants per v1.52 §55.3:** `:280` is tenancy-on-model-unfetched (`StorytellerBook.show_id`); the other seven carry no tenant column, at depths one join (`chapter → book`), two joins (`line → chapter → book`), and **unestablished** for `StorytellerEcho` / `StorytellerMemory` / `StoryThread` — each verified against a model file confirmed present, and `StoryThread` checked separately as a different model family rather than assumed to follow the file's pattern. **§56.3: seven of eight handlers fetch the target before destroying it, and every fetch is `findByPk` on a caller-supplied id followed by a 404** — the file's own comment reads `// Verify chapter exists`, which is precisely and only what it does. **`:889` fetches the chapter solely to read back `chapter.id`, a value already in `req.params.id`, then bulk-deletes every line under it — the lookup contributes a 404 and nothing else.** An existence check and an access check are structurally identical and answer different questions. **§56.4: the file is uniform — eight sites, one shape, no variation**, which is more consistent with a convention never established than with eight independent lapses; **claim scoped to this file only**, `sceneSetRoutes.js` untested; bears on remedy shape, selects none. **§56.5 method note: `:889` and `:1000` carry identical statement text in different handlers and were tracked as one site**, so the file was twice stated complete at 8 while 7 had been read; caught by reconciling against the original `git grep -n` listing, which was correct throughout. **Identical text at different line numbers is different sites.** Eighth position in the hazard family. Recorded unminted: `PATCH /memories/:id/reject` performs a hard `destroy()` on canon; cascade behaviour unread on every model; `StorytellerStory.js` exists alongside the modelless `stories` table of v1.43 §46.2. Mints no FD, no XK. No live DB contact. Prod FROZEN, untouched. §56 minted. Basis `0fbed757`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.52. Tail: **FD-61**.
  **XK tail: XK-2**, unchanged.
- Mints: **§56**.
- Closes: **nothing**.
- Extends: the shape's instance record to **18 sites / 17 handlers / 7 files**.
  `storyteller.js` complete at 8. Still **unminted, unowned, unnumbered.**
- Records: §56.3's existence-check-is-not-an-access-check observation; §56.4's
  per-file uniformity, **scoped to `storyteller.js` alone**; §56.5's method note;
  §56.6's three unminted observations.
- Owes: `StorytellerEcho` / `StorytellerMemory` / `StoryThread` tenancy paths;
  cascade behaviour across this file's models; whether per-file uniformity holds
  elsewhere.
- Carries: XK-2's owed amendments; **67 unread destructive sites**; the reads
  surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and
  homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3
  instance report at `wardrobe.js:1233`; the eleven-router collision surface and
  fail-open mount pattern; `feedPipelineRoutes.js`'s unexplained zero; the three
  unread write sites from v1.48; open items 22, 24, 6; all other items carried
  from v1.52. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: all three variants' homing; XK-2's ORM-surface extent, remedy and
  sequence position; classes 2–6's reach; §39.4 defect 1 and defect 3; §44.8;
  XK-1's remedy and population question.
- Forward-points: `sceneSetRoutes.js` as the natural test of §56.4's uniformity
  claim. Recorded, not adopted.
- Changes no unit disposition, no PR state, no gate. **The Cross-Keystone Register
  is not modified.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.52; no destructive rewrite.
- **Numeral disambiguation:** *XK-1 and XK-2 (Cross-Keystone Register)* are
  unrelated to FD-1/FD-2, §1/§2, or any open item 1/2. §56 is minted in v1.53;
  section numbers and their minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

Eight destructive handlers in one file, and **eight identical omissions.** Seven
of them fetch the row first, check it exists, return 404 if it does not, and then
delete it for whoever asked. **The guard is present. It guards the wrong thing.**

The file says so itself, at `:986`: **`// Verify chapter exists`.** That comment is
accurate, and the gap between what it verifies and what a delete on a
caller-supplied id requires is the entire finding — restated across eight
handlers without variation.

**The uniformity is the part worth carrying forward.** Seven files of scattered
instances read as oversight. **One file where every handler makes the same
omission reads as a convention that was never written down** — and a convention
that was never written down is not repaired by patching its instances.

That claim is scoped to this file and stated as scoped. `sceneSetRoutes.js` sits
at six destructive sites and would test it in one pass. **It was not read**, and
generalising from one file is the failure this plan has recorded eight times in
eight costumes.

**Sixty-seven destructive sites remain unread.** They are not clean; they are
unexamined, and the difference is the only thing this register is for.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-15. Main at `0fbed757` (#1026). Predecessor: v1.52.*
*Minted: §56. Completed: `storyteller.js` under Rule 2, 8 sites. Closed: nothing. Mints no FD, no XK. Tail: FD-61. XK tail: XK-2. [skip-automerge]*
