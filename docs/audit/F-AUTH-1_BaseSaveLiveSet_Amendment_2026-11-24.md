| **PRIME STUDIOS** **F-AUTH-1 — A BASE IS SAVED ONLY ONTO A LIVE SET; GENERATE-VENUE ANSWERS FROM WHAT WAS SAVED (AMENDMENT)** *A generated base whose scene set was removed while the provider was working is no longer reported saved when nothing was written: it is the existing "generated, not saved" refusal, logged, with its status put back. generate-venue no longer reads the set again after its save, so a delete that commits just after the save no longer turns a paid, saved picture into a 500 with the ORM's text.* |
| --- |

**Document version**

v1.1 (v1.0 plus Evoni's ruling on the claim overwrite, §7; edited before merge). This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `e286cfdd2e4a5edb2ebf34112a0890de9c9d7901` (2026-11-24), plus branch `claude/base-save-live-set`. The branch does not contain C1 PR 1 (`claude/scene-set-delete-lock-order`), which is a separate, unmerged change. Every `file:line` below is on the branch unless it says "at the basis".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's authorization of 2026-11-24, whose terms are set out in §2 as they were given to this work. Merging this file with the change it describes is her approval of the text. It is not an authorization to deploy.

**Standings used:** RULED (§2); MEASURED (the repository reads and local test runs of §1 and §3 to §8, each with its file or command); INFERRED (marked where used).

**Follows:** `F-AUTH-1_PlaceLockGenerationB1_Amendment_2026-11-23.md` (`generated_not_saved`, `PlaceFinalizeRefusal`, the `[GeneratedNotSaved]` line, `restoreBaseAfterRefusal`) and `F-AUTH-1_PlaceLockGenerationB2_Amendment_2026-11-23.md` (`SET_NOT_FOUND` for a set gone at a finalization).

---

# §1. The two defects (MEASURED at the basis)

Removing a scene set is a soft delete (`deleted_at`): the row stays.

**(1) generate-venue's reload.** `POST /world/:showId/events/:eventId/generate-venue` (`src/routes/worldEvents/venue.js:148-161` at the basis), for an event whose own set has no base: `generateBaseScene` saves the base through the Place finalizer, and then the route ran `await attached.reload()` and read `base_still_url` from the reloaded row. A delete of the set that commits between the save's commit and the reload makes the reload (live rows only) throw `SequelizeInstanceError`. The route answered 500 `{ outcome: 'failed', error: 'Instance could not be reloaded because it does not exist anymore (find call returned null)' }`. The base had been generated, paid for, stored and saved.

**(2) A base "saved" onto a removed set.** `generateBaseScene` (`src/services/sceneGenerationService.js`), in its save: the set row was locked with `SELECT id FROM scene_sets WHERE id = :id FOR NO KEY UPDATE`, with no `deleted_at` filter, so a removed row was locked; then `SceneSet.update(finalWrite, { where: { id } })`, which is the model's and so writes live rows only: on a removed set it matched no row and threw nothing. The save was reported `OK`. On `POST /scene-sets/:id/generate-base` nothing was logged and no row held the picture; on generate-venue the reload of (1) then threw.

**Evidence.** The new tests run against the basis's two files (put back for one run, then restored): 6 of 15 fail. generate-venue with the delete after the save's commit: 500 where 200 is expected. generate-venue with "delete anyway" during the provider call: 500 where 409 is expected. The three generate-base cases with a delete during the provider call and the claim case: the run resolved as saved. (1) was first seen as an intermittent failure of C1 PR 1's suite under CPU load (3 of 10 runs).

# §2. The decisions (RULED)

Evoni authorized this change on 2026-11-24 as a small, separate one. Her terms, as given to this work:

**Part A, generate-venue.** Remove the dependency on the reload after the finalization. Answer `outcome: 'generated'` from the committed result `generateBaseScene` returns (its `stillUrl`), in the same body. No new lock or transaction in the route.

**Part B, the shared final save.** Inside `generateBaseScene`'s existing work, for both the finalizer path and the plain-transaction path: require a live set at the final write, reusing the existing transaction and the existing set-row lock (`AND deleted_at IS NULL` added to that locking read); "no live row", and as a second line of defence a final update that changes no row, is the existing generated-not-saved refusal: `PlaceFinalizeRefusal`, code `SET_NOT_FOUND`, 409, `generated_not_saved`, the existing message, and the existing `[GeneratedNotSaved]` line. One implementation for both paths. The provider is never called again. The previous image is preserved: nothing that follows a save runs after a refusal.

**The Scene Sets route.** A late base on a removed set is a logged, recorded generated-not-saved outcome, by what B1 already does for a refusal there. No new status.

**Safeguards to inspect and test.** Each step that follows a successful save, with a delete committing inside it. The status and claim after `SET_NOT_FOUND` on a removed row: the row is not revived, its status is not left as an active claim when the run can clear its own, another run's newer claim is not overwritten, the reason is recorded where the convention records it. The database's scene generation guard must not refuse the refusal path's status write in the fixtures.

**Standing terms.** No migration, no new claim table, no change to the finalizer or `placeLock.js`, no worker change, no frontend redesign: anything needing one is to be handed back, not built.

# §3. What the change does (MEASURED on the branch)

## Part B (`generateBaseScene`, `src/services/sceneGenerationService.js`)

In the save's `work`:
- The locking read is `SELECT id FROM scene_sets WHERE id = :id AND deleted_at IS NULL FOR NO KEY UPDATE` (`NOWAIT` under a caller's finalizer, as before). No row: `PlaceFinalizeRefusal({ code: 'SET_NOT_FOUND', message: 'That scene set no longer exists.' })` is thrown.
- The final write's result is read: the model's update that changed no row throws the same refusal.
- Thrown inside the work, so the transaction is rolled back. It is not a lock conflict: the finalizer does not try it again.

Where the save's errors are caught, a `PlaceFinalizeRefusal` is handled as the refusals a finalizer returns already were: `restoreBaseAfterRefusal` (status and reason), the `[GeneratedNotSaved]` line, and the refusal thrown on. The function's last catch already leaves a `PlaceFinalizeRefusal` unmarked (not `failed`). `SET_NOT_FOUND` and its sentence are the ones `venueLookImageService`'s `takeSetRow` answers for a set gone at a finalization.

One implementation: both paths run the same `work`. The plain-transaction path (no `finalize` given) is `POST /scene-sets/:id/generate-base`, the cascade, the worker and the model comparison; the finalizer path is generate-venue and the venue-look base step.

## Part A (`src/routes/worldEvents/venue.js`)

`generateBaseScene`'s result is kept, and the answer's `venue_image_url` is its `stillUrl`. `attached.reload()` is removed. The "No base image was stored" guard is kept with the meaning it can still have: `generateBaseScene` resolved with no image in its result. With Part B it resolves only when the save committed on a live set.

## The response contract

| Route | Case | Before | Now |
|---|---|---|---|
| generate-venue | the set deleted after the save committed, before the answer | 500 `{ success: false, outcome: 'failed', error: <ORM text> }` | 200 `{ success: true, outcome: 'generated', data: { kind: 'base', scene_set_id, venue_image_url, venue_name }, message }`, the image the save committed |
| generate-venue | "delete anyway" committed during the provider call | 500 with the ORM text (the save reported OK, the reload threw) | 409 `{ success: false, outcome: 'generated_not_saved', code: 'SET_NOT_FOUND', error: 'That scene set no longer exists.', message: 'The image was generated but it was not saved. Generating it again costs again.' }` |
| generate-venue | a delete with a replacement during the provider call | 409 `generated_not_saved` / `STALE_SOURCE_SET` | the same |
| generate-venue | the set deleted before it starts | a new venue is generated (200, `kind: 'venue'`) | the same |
| generate-venue | nothing in its way | 200 `generated` | the same body; the image is the one saved |
| `POST /scene-sets/:id/generate-base` | any | 202 | 202, unchanged (the base is made in the background) |
| its background run | the set deleted during the provider call | resolved as saved; nothing written, nothing logged | `PlaceFinalizeRefusal` `SET_NOT_FOUND`; one `[GeneratedNotSaved]` line; the status put back; the reason in `base_generation.last_error` |

# §4. The steps that follow a save (MEASURED: read, and each run with a delete committing inside it)

They run only after the save committed. After a refusal none runs: the refusal is thrown before them (tested: no storage delete, no review written).

| Step | What it does | On a set removed meanwhile | Errors |
|---|---|---|---|
| `repointBaseAngles` | one raw update of the set's angles that are the old base picture | filters the angles' own `deleted_at`, not the set's: the angles are moved to the new base | logged, returns 0 |
| `deleteOldBaseImage` | deletes the **previous** image from storage unless something still shows it | the same: the previous image goes; the new one is the removed row's base | swallowed (`imageStillUsed` failing keeps the image) |
| `noteBaseChanged` | reads the set and writes or clears `visual_language.description_review` | raw statements with no `deleted_at` filter: written on the removed row | logged |
| the style lock and `analyzeBaseImage` | the model's reading of the new image, merged into `visual_language` | `mergeVisualLanguage` is a raw update: written on the removed row | logged; the analysis is not awaited |

None writes `deleted_at`: a removed row is never restored by them. None deletes the new image. In all four, with the real delete committing inside the step, the run resolved as saved, with the saved image, and nothing threw.

# §5. The status and the claim on a removed row (MEASURED)

- `restoreBaseAfterRefusal` is a raw `UPDATE scene_sets … WHERE id = :id AND generation_status = 'generating'`: it matches a removed row. After `SET_NOT_FOUND` the removed row's status is back to what it was (`pending`, or `complete` over a previous image), `base_generation.last_error` holds "That scene set no longer exists. The image was generated but it was not saved. Generating it again costs again." with `failed_at`, and `deleted_at` is as the delete left it. The previous image's column is not written.
- The marker before the paid call and the "failed" write of the last catch are the model's: on a removed row they change nothing.
- The Scene Sets route does not mark a refusal failed (B1): observed.
- **The database's scene generation guard** (migration `20261108210100`) refused none of these writes in the fixtures, which have no generation attempt rows. With attempt rows its rules apply as they do to every status write; that was not exercised.
- **A newer claim IS overwritten: the required outcome is not met by the existing statement.** The row carries no owner of its claim: `claimRow` and `restoreBaseAfterRefusal` both key on `generation_status = 'generating'` alone. Observed: a first run's claim left for two hours, a second claim taken on the row, then the first run refused: the status is put back to `complete` over the second claim. This is as it was at the basis for every B1 refusal; this change adds no statement to it and makes it reachable for one more refusal. Not overwriting it needs an owner on the claim, which is a redesign this work was told to hand back, not build (§7).

# §6. What is not covered (held work)

- A plain angle's result landing on a removed set's angle; a dressed angle's; a look's; location look variants.
- The claim-side rules (a removed set, or an angle of one, can still be claimed) and the refusal of a delete while a generation is running.
- The generation worker's handling: it is not changed. For this refusal its job fails with the refusal's sentence, as any thrown error does there, and its own "failed" write is the model's (live rows only) and guarded on `generating` (INFERRED from reading; the worker was not run).
- The model comparison marks a copy `failed` on any error, a refusal included, by the model (live rows only): unchanged.

# §7. Limits and open points

- **A newer claim can be overwritten (§5).** Ruled by Evoni, 2026-11-24 (as relayed through the coordinating session): accepted as a recorded limitation of this change, which stays narrow and takes no claim-ownership redesign. This change does **not** provide ownership-safe status restoration and must not be read as doing so. The overwrite predates it (every B1 refusal); the new `SET_NOT_FOUND` refusal makes it reachable in one more case. It is added as a required dependency of the held generation-protection design, whose invariant is: an older generation run must never restore, clear, complete or overwrite the status or saved image belonging to a newer generation run. No claim-ownership implementation is authorized.
- **The stored picture of a refusal stays in storage**, referenced by no row and named in the log line, as for every generated-not-saved outcome. No cleanup exists.
- **A delete that commits after the save** is answered as saved, because it was: the picture is on the removed row. With "delete anyway" the event still points at that removed set; with a replacement the event is moved and the picture stays behind on the removed set (the "look row left on a removed set" kind of gap, for a base).
- **The venue-look base step** shares the same work through its own finalizer and its own handling of `PlaceFinalizeRefusal` (`venueLookImageService`); it was read, and Generation B2's suite passes, but no new case drives a delete through it.
- **The live schema and the running processes were not verified.** No server was contacted. **No migration; no stored row is changed.**

# §8. Tests (MEASURED, local)

On a private, migrated local PostgreSQL test database, through the real app. The image provider, the storage and the model are doubles; no paid call. The deletes are the real `DELETE /api/v1/scene-sets/:id`, placed by a latch on a double or by the lock trace's gate on a statement. No test sends DDL. The network guard reports 0 external attempts.

`tests/integration/baseSaveLiveSet.integration.test.js` (15 cases):
- *generate-venue (5).* The delete after the save's commit and before the answer: 200 with the image on the row at commit, the delete 200, no ORM text, one provider call, one stored picture. "Delete anyway" during the provider call: the 409 above, one `[GeneratedNotSaved]` line (stored key, event, set, cost, estimate, usage ids), no base on any row, the event unchanged, no venue made in its place, one provider call. A delete with a replacement during the provider call: `STALE_SOURCE_SET` as before. Deleted before it starts: a new venue. Nothing in its way.
- *generate-base (5).* Nothing in its way (the previous image deleted only after the save). A first base and a regenerate, each with "delete anyway" during the provider call: the refusal, logged once; the row not restored, not left generating; the previous image on the row and no delete call to storage. The second line of defence [injected: the locking read made to see the removed row]. The claim case of §5.
- *After a save (4).* A delete committing inside `repointBaseAngles`, `deleteOldBaseImage`, `noteBaseChanged`, and the style lock with the analysis: §4.
- The network guard.

**Before the fix:** against the basis's `venue.js` and `sceneGenerationService.js`, 6 of these 15 fail (§1); with the fix, 15 pass.

Unchanged and passing on that database: `placeLockGenerationB1` (56), `placeLockGenerationB2` (69), `placeLockGenerationB3` (59), `placeLockFinalizer` (52), `placeLockStrict` (53), `p2bSceneSetAdmin` (243), `looksFixes4` (6, 1 skipped as before). The unit directory: 745 suites, 11287 tests.

**Not run locally, by the rule that a local run sends no DDL** (CI runs them): `lookBaseFixes`, `venueLookImage`, `approvedBase`, `baseDescriptionReview`, `sceneBrief`, `sceneBriefShown`, `sceneEventChoice`, `sceneBaseModelComparison`, `sceneGenerationPlannedFlows`, `sceneGenerationLegacyCompat`, `workerRestrictedRole`. They were read for a pin this change touches: each generates on a live, stored set with the real model, and none stubs the set's update or asserts the locking statement's text or generate-venue's reload. None was edited (INFERRED from reading, not run).

**Evidence for C1 PR 1 (not part of this change).** On a throwaway local merge of this branch into `claude/scene-set-delete-lock-order` (never committed; discarded), that change's suite ran 10 times under CPU load: 10 passed. In 3 of the 10 the delete got through before generate-venue answered (the ordering that failed there in 3 of 10 runs before): generate-venue answered 200.

---

**Type:** amendment.
**Rules:** a generated base is saved only onto a live set, and a set removed meanwhile is the existing generated-not-saved refusal (`SET_NOT_FOUND`); generate-venue answers from the committed save; on Evoni's authorization and terms set out in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
