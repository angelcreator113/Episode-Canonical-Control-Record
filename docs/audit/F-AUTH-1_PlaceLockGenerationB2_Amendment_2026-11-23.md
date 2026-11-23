| **PRIME STUDIOS** **F-AUTH-1 — THE PLACE LOCK, GENERATION B2: THE EVENT LOOK, ITS UPLOAD, DRESSED ANGLES AND THE VENUE-LOOK DRAFT SAVE THROUGH THE FINALIZER (AMENDMENT)** *"Generate this look", an uploaded look, dressed angles and the venue-look draft now commit their writes in the Foundation A finalizer's transaction, with Generation B1's contract for a picture that was made and not saved. The event look read says when a base was generated and not saved. The Locations save and Start Episode are not changed.* |
| --- |

**Document version**

v1.1 (v1.0 was this file before Evoni's review of the same day, on the same unmerged branch; §2 "Her review", the meaning of `generated_at` in §4, §8 and the test lists of §9 are what changed). This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `8d27a502ce6e4396df68d1e2b33d37f858637261` (2026-11-23), plus branch `claude/place-lock-generation-b2`. Every `file:line` below is on the branch unless it says "at the basis".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's approval of Generation B2 of 2026-11-23, whose terms are set out in §2. Merging this file with the change it describes is her approval of the text. It is not an authorization to deploy (§7).

**Standings used:** RULED (§2); MEASURED (the repository reads and local test runs of §1, §3 to §6 and §9, each with its file or command); INFERRED (marked where used).

**Follows:** `F-AUTH-1_PlaceLockFoundationA_Amendment_2026-11-23.md` (the strict rule and `finalizePlaceWrite`) and `F-AUTH-1_PlaceLockGenerationB1_Amendment_2026-11-23.md` (`generate-venue`, `generated_not_saved`, `GENERATED_SAVE_FAILED`, the pause between tries).

---

# §1. What was there (MEASURED at the basis)

Four paid or stored Place paths read the Place lock and then wrote, each statement on its own:

| Path | At the basis | How it wrote |
|---|---|---|
| "Generate this look" | `startLook`, `src/services/venueLookImageService.js:201-291` | Before the answer: `createVenueSet` (an autocommit insert, kept even when the run was then refused), the base or look claim, `linkEvent` (`UPDATE world_events`, then the episode sync, with no transaction). After the paid call: the look's completion `UPDATE` and `dropDressedAngles`, each autocommit. The base step called `generateBaseScene` with no finalizer. |
| An uploaded look | `uploadLook`, `:301-325` | `createVenueSet`, the storage write, the look upsert, `linkEvent`, `dropDressedAngles`: five separate commits. |
| Dressed angles | `startDressedAngle` and `saveUploadedDressedAngle`, `src/services/dressedAngleService.js:216-250`; the upload route, `src/routes/episodeBriefRoutes.js:603-630` | **No Place check at all.** A dressed angle could be generated or replaced on an accepted episode. |
| The venue-look draft | `draftVenueLook`, `src/services/venueLookService.js:301-327` | The model call and the save shared one retry loop: a save that failed called the paid model again, and the final 502 carried the database's own message. |

An acceptance that committed while a provider was being paid, a file stored or the model writing was not seen by any of them.

The event look read (`eventLook`, `:378-423`) sent a base's `error` only when the set was `failed`, and no timestamps: a base that Generation B1 left "generated and not saved" read as an ordinary pending or complete base.

# §2. The decisions (RULED)

Evoni approved Generation B2 on 2026-11-23 as one change. The terms she approved, as given to this work:

**Scope.**
1. Event look generation: two finalizations through `finalizePlaceWrite`. Before the 202: the set created if needed, the claim and the event link together. After generation: the completion update and the dressed-angle drop. The base step passes the real finalizer to `generateBaseScene`.
2. Event look upload: the storage write outside; one finalization for the set created if needed, the upsert, the event link and the dressed-angle drop.
3. Dressed-angle generation and upload: an early Place check before the claim and the provider, and before the upload's storage write; the completion inside one finalization. An episode with no event keeps the existing `NO_LOOK`.
4. Venue-look draft: the model-call loop first, with its retry on a genuine provider failure unchanged, then one finalization for the save, with no source set. A save failure must never rerun the paid model call, and no raw database message in the response.
5. Event look read: additive fields (`failed_at`, `generated_at`, `error` for a generated-but-not-saved base) and a server-computed not-saved indication from the existing generation, failure and upload timestamps; a later successful upload or generation clears it. Generation B1's frontend handling is reused.

**Rulings.**
- Foundation A and B1 only are reused. No new finalizer, retry service, locking framework, error vocabulary, table, migration, route or endpoint. No change to authorization: the venue-look save and draft stay as they are (that is C2).
- Targeted `FOR NO KEY UPDATE NOWAIT` set-row locks wherever an existing-set operation (the base claim, a link to an existing set) can meet the opposing order. `PLACE_FINALIZE_RETRY_DELAY_MS` (250 ms) and at most three attempts are reused. No pause inside a transaction.
- A stale source set at finalization is refused. Existing rows and images are preserved; a generated image is never relinked to another set.
- Before any provider call, retry exhaustion answers 409 with the established code `PLACE_FINALIZE_RETRY_EXHAUSTED` and no "not saved" wording. The `BASE_GENERATING` and `LOOK_GENERATING` responses are unchanged.
- After paid generation, a refusal uses B1's contract where it applies; for the look step the existing failure statement, which keeps the previous image and sets the error text, is used. No stuck generating or claim status after any refusal.
- Venue-look draft: a known finalization lock exhaustion is a 409. Genuine provider failure behaviour is unchanged.
- Upload refusals keep the established 409 contract, with no `outcome` field. The message must distinguish "the file was stored but not attached" from a successful attachment. Stored objects are not deleted automatically.
- Work callbacks are rollback-safe database work only; never a provider, storage or model call inside the finalizer; a database transaction is never held across paid generation.
- No SQL, stack traces or storage credentials in responses.
- Every existing response not named above is preserved.

## Her review of the change (RULED, 2026-11-23)

She reviewed the change and accepted its architecture. Her rulings, as given to this work:
1. The dressed-angle 409 `PLACE_LOCKED` is approved; previously saved images are preserved.
2. `SET_NOT_FOUND` as a 409 from the finalization's set-row lock is approved; ordinary lookups that answer 404 are unchanged.
3. An upload's unexpected save failure as a 500 without a code is accepted on condition that the frontend handles it, that no database record changes, and that the stored-but-unattached file is logged (verified, §9).
4. `generated_at` in the read is kept as it is, and its meaning is to be stated: the last save of the base, generated or uploaded (§4).

# §3. What was verified before the callbacks were written (MEASURED)

Nothing found stopped the work. `src/utils/placeLock.js` and `src/services/sceneGenerationService.js` are not changed.

**a. The unsaved-draft flow.** `lookBrief` already plans a look on a set that does not exist yet (`venueDraftSet`, with `id: null`), so a brief on a row whose id is made beforehand is the same flow. `linkEvent` was `UPDATE world_events SET scene_set_id` followed by `syncEpisodeEventLocation`, which for a draft episode whose event this is moves its Event location row and its free beats (Generation B1 amendment §3: every statement of the sync takes the transaction it is given).

**b. Every write that had to take the transaction.**

| Write | At the basis | Now |
|---|---|---|
| `createVenueSet` (`models.SceneSet.create`; the model has no hooks, B1 §3) | autocommit, then a read back | the row is built first with its id and timestamp (`newVenueSetRow`, `venueLookImageService.js:213-228`); `takeSetRow` creates it with `{ transaction, silent: true }` |
| `linkEvent` (two statements and the sync) | no transaction; it read the event's set itself | takes `{ transaction, fromSetId }` (`:256-260`); the set the event had is the one the finalizer verified |
| the base claim, the look claim | autocommit | given the transaction (`:328-335`, `:362-377`); a refused claim throws inside it, so a set made for the run is rolled back with it |
| the look's completion (`OWN_LOOK_RUN`) and `dropDressedAngles` | autocommit | one finalization (`:399-413`); `dropDressedAngles` takes a transaction (`:524`) |
| the upload's upsert, link and drop | autocommit | one finalization (`:467-486`) |
| `upsertRow` (dressed angles) | autocommit | takes an optional transaction (`dressedAngleService.js:208`); the claim before the paid call stays autocommit, as ruled |
| the dressed angle's completion (`OWN_ANGLE_RUN`) | autocommit | one finalization (`:274-281`) |
| the draft's merge and `writeLook` | its own transaction inside the model's retry loop | the finalizer's (`venueLookService.js:335-344`); `writeLook` already took a transaction |

`resolveTarget`, `planLook`, `resolveLookSet`, `loadLocation` and `episodeLooks` are reads and stay outside. `generateDressedStill` logs its cost on its own connection, before any finalization.

**c. Readers of the event look read.** One route (`GET …/look`, `src/routes/worldEvents/looks.js`). Frontend: `EventLookImage.jsx` reads `scene_set`; `frontend/src/lib/eventLook.js`, `EventPackagePage.jsx`, `EpisodeLocationsStep.jsx`, `EpisodeWardrobeGameplay.jsx` and `SceneSetsTab.jsx` read `look`, `approved_base` or the set's id and name. No test asserts the exact shape of `scene_set` (`grep -rn "scene_set).toEqual" tests` finds another endpoint only). The new fields are additive.

**d. Row locks.** Inside the finalizer the event row is held. An existing set's row is then needed by: the base claim (`UPDATE scene_sets`), and, through foreign keys (`FOR KEY SHARE` on the set row), the look claim and the upload's upsert (`scene_set_looks.scene_set_id`), the event's move (`world_events.scene_set_id`) and the sync's insert (`scene_set_episodes.scene_set_id`). `makeEventVersion` and `makeEveryday` hold a set row `FOR UPDATE` and then wait for the event row; `FOR UPDATE` blocks `FOR KEY SHARE` as well as an update, so each of those writes could wait for a set row while holding the event row and close the circle B1 §5 describes. So `takeSetRow` locks an existing set's row `FOR NO KEY UPDATE NOWAIT` first, in every finalization that touches one (`:244-253`); the later statements then find the row already theirs. A set made in the transaction has no other holder. The completions touch only `scene_set_looks` and `scene_set_look_angles` rows, whose other writers are these same finalizations (event row first). The event `PUT` takes the event row first and waits for the finalizer holding nothing of its.

# §4. What the change does (MEASURED on the branch)

## "Generate this look" (`startLook`, `venueLookImageService.js:269-436`)

1. The early `isPlaceLocked` check is where it was.
2. A set that would be made is not made yet: its whole row, id included (`crypto.randomUUID`), is ready; the brief is planned on it.
3. **Before the answer**, one finalization (`begin`, `:296-314`), with `sourceSetId` the set the event had when it was read: the set (made, or its row taken without waiting), the claim, and the event's move with its draft episode's sync. A step that writes nothing (a base waiting for approval on the event's own set) opens no transaction.
4. Refused there, nothing was generated: 409 with the outcome's own code and text (`PLACE_LOCKED`, `STALE_SOURCE_SET`, `EVENT_DELETED`, `PLACE_FINALIZE_RETRY_EXHAUSTED`), `{ success, code, error }`, no `outcome` and no "not saved". `BASE_GENERATING` and `LOOK_GENERATING` are thrown from inside the work and answered as before. A database error that is none of these is a 500 `{ success: false, error: "This could not be saved. Nothing was generated and nothing was changed." }`, everything rolled back, so no set is left behind.
5. **The base step** calls `generateBaseScene` with `finalize` (the Place finalizer, source set the set itself) and `priorStatus`; B1's contract applies whole. A save that fails for another reason marks the base failed with B1's fixed sentence, not the database's message.
6. **The look step**: the provider call, then one finalization (`:399-413`, source set the look's set) with the completion `UPDATE` and the dressed-angle drop. Refused, or failing for another reason: the existing statement that keeps the previous image (`KEEP_PREVIOUS_IMAGE`) writes the reason on this run's row: the outcome's text followed by B1's "The image was generated but it was not saved. Generating it again costs again.", or B1's `GENERATED_SAVE_FAILED` sentence. One `[GeneratedNotSaved]` log line (B1's) names the stored key, the event, the set, the outcome and the cost. The provider is not called again; nothing is deleted from storage; the picture is not attached to any other set.

## An uploaded look (`uploadLook`, `:445-497`)

The file is stored first, outside any transaction, under the id of the set it will be on. Then one finalization: the set, the upsert, the event's move, the dressed-angle drop.
- Refused after the file was stored: 409 `{ success: false, code, error }`, the established shape with no `outcome`; `error` is the outcome's text followed by "The file was stored, but it was not attached. Nothing was changed."
- Failing for another reason: 500 `{ success: false, error: "The file was stored, but attaching it failed. Nothing was changed." }`.
- Either way one error line names the storage key, the event, the set and the outcome; nothing is deleted from storage.

## Dressed angles (`dressedAngleService.js:188-323`; `episodeBriefRoutes.js:616`)

- **New refusal.** Generate and upload now answer 409 `PLACE_LOCKED` (the established code and text) when the episode's event is locked: before the claim and the provider, and, for an upload, before the file is stored. An episode with no event, or no look, answers `NO_LOOK` as before, first.
- The claim stays an autocommit statement, as ruled. The generated picture's row, and an uploaded one's, are saved in one finalization on the episode's event, with the set the event had as source.
- Refused or failing after the picture was made: the existing failure statement keeps the previous image with the reason; the row is never left generating. An upload refused after the file was stored: 409 with the not-attached sentence; failing otherwise, the 500 above.

## The venue-look draft (`draftVenueLook`, `venueLookService.js:301-362`)

The model loop is first and alone: two tries on a model or parse failure, 502 `VENUE_LOOK_DRAFT_FAILED` and 429 `AI_BUDGET_EXCEEDED` as before. Then one finalization with no source set: the look read in the transaction, the draft merged into it, written.
- The Place locked meanwhile: 409 `VENUE_LOOK_LOCKED`, this route's own code, "This event's episode is accepted: its venue look is locked. The draft was written, but it was not saved. Drafting again costs again."
- Another refusal (retry exhaustion, the event deleted): 409 with its own code and that last sentence.
- The save failing for another reason: 500 `{ success: false, code: "GENERATED_SAVE_FAILED", error: "The draft was written, but saving it failed. Nothing was saved. Drafting again costs again." }`. The model is not called again.

## The event look read (`eventLook`, `:575-623`; `baseSaveState`, `:549-570`)

`scene_set` gains three fields, and `error` one more case:

| Field | Value |
|---|---|
| `not_saved` | `true` when the set is neither generating nor failed, has a `base_generation.last_error`, and its `failed_at` is newer than its last save (`generated_at` or `uploaded_at`, whichever is later) |
| `failed_at` | `base_generation.failed_at`, ISO, or `null` |
| `generated_at` | **The last time the set's base was saved, whether it was generated or uploaded**: the later of `base_generation.generated_at` and `base_generation.uploaded_at`, ISO, or `null` when the set never had a base saved. It is not "when a picture was last generated": after an upload it is the upload's time, and a run that was generated and not saved does not move it. It is what `failed_at` is read against (ruled kept under this name, §2). |
| `error` | `last_error` when the set is `failed` (as before) or `not_saved`; else `null` |

A later generation or upload makes the last save newer than the failure: `not_saved` is false and `error` null, with nothing rewritten. `EventLookImage.jsx` is not changed: B1's `baseNotSaved` reads exactly `error`, `failed_at` and `generated_at`.

# §5. The lock order

Unchanged from Foundation A and B1: the linked episodes `FOR SHARE` in id order, the event row `FOR UPDATE`, then the work. Within the work an existing set's row is taken first and never waited for (§3 d); a held row is 55P03, rolled back and tried again after the 250 ms pause, three tries at most. The pause is between transactions (B1 §5a). The statement traces of §9 read `E:episodes:share, W:world_events:update, X:scene_sets:update` and then the writes.

# §6. After a refusal

- Before anything was paid for or stored: nothing is written, and a set that was to be made is not there.
- After a picture was made: the look or the dressed angle keeps its previous image, source and dressed angles; its row is `complete` with that image or `failed` without one, never `generating`; the base goes back to the status it had (B1 §6).
- After a file was stored: no row is written or changed.
- The stored object stays, referenced by no row, and is named in one error-log line. No table records it and no cleanup exists (B1 §6).

# §7. What B2 does NOT do

- **The Locations save and Start Episode are not changed (B3).** Until B3, a Locations save can still deadlock with a finalization, and a Start Episode can still write the set an event had before a finalization moved it.
- **The venue-look save (`PUT …/venue-look`) is not changed**, nor who may save or draft (C2).
- **The acceptance-against-event-writer deadlocks remain (C1). Saved scenes are not frozen (S1).**
- **`placeLock.js`, `sceneGenerationService.js`, the acceptance code, the worker and `EventLookImage.jsx` are not changed.**
- **Deployment.** The unit is Foundation A, B1, B2 and B3 together. This amendment authorizes no deployment.

# §8. Limits and open points

- **Dressed angles on an accepted episode are now refused.** That is the ruling (§2, 3); it is also a behaviour a user can meet: "Generate angle" and "Upload image" on a beat at the look's set answer 409 `PLACE_LOCKED` once the episode is accepted.
- **A dressed angle's claim is not inside a finalization** (as ruled). The Place check before it is a read, and the claim is an autocommit statement that takes no lock on the episode or the event. So an acceptance that commits between the check and the claim is not seen: the claim is taken, the answer is 202, the provider is paid, and the save then refuses under the locks; the row keeps its previous image (or reads failed) with the reason and is not left generating, and the picture is not kept. The window is the few statements between the check and the claim. An acceptance does not wait for a claim either (it is a committed row, not a lock). Both sequences are held open and tested (§9).
- **An upload's unexpected failure has no code** (the route's existing 500 shape with a fixed sentence): no code for it exists, and none was to be invented. Accepted on conditions (§2), each tested: both panels show the sentence as an error; no record changes; the stored key is logged and nothing is deleted.
- **A set that is gone when the finalization takes its row** answers 409 `SET_NOT_FOUND` ("That scene set no longer exists."), with the not-attached sentence after an upload. The code exists in `dressedAngleService.js` as a 404 for an ordinary lookup, which is unchanged.
- **`generated_at` in the read is the base's last save**, an upload included (§4). It is named for B1's frontend check, which reads that field.
- **A set row held for longer than three tries and two pauses** still ends `PLACE_FINALIZE_RETRY_EXHAUSTED`.
- **The doubles.** The provider, the storage and the model are test doubles in every run here.
- **The live schema and the running processes were not verified.** No server was contacted. **No migration; no stored row is changed.**

# §9. Tests (MEASURED, local)

On a private, migrated local PostgreSQL test database, through the real app. The image provider (`axios`), the object storage (`S3Client`) and the model (`Anthropic`) are doubles. No test sends DDL. The network guard reports 0 external attempts.

`tests/integration/placeLockGenerationB2.integration.test.js` (69 cases; the 14 added on her review are listed after the first six groups), against the real `completeEpisode`, a real two-part completion and the real event `PUT`:

- **The look step.** Saved with the same 202; the claim in one transaction (episodes, event row, set row `FOR NO KEY UPDATE NOWAIT`), the completion in another, none spanning the provider call. Accepted during generation, for a primary event and for an event linked by its stamp alone: not kept, the reason on the row, never left generating, one provider call, nothing deleted, the key logged; a look that had an image keeps it, its source and its dressed angles. Both orders against a real acceptance at the save and at the claim (at the claim, acceptance first: 409 `PLACE_LOCKED`, nothing generated, no claim, no "not saved"). A real two-part window. The event moved by a real `PUT` during generation: not attached to either set. The save failing at the look's row and at the dressed-angle drop: rolled back, the previous image kept with the fixed sentence. A provider failure and `LOOK_GENERATING` as before.
- **The set row.** Held when the claim is saved and let go during the pause: 202 on try two, one pause, no session but the holder's inside a transaction while it waits. Held throughout: three tries, two pauses, 409 `PLACE_FINALIZE_RETRY_EXHAUSTED` with its established text and nothing generated. Held when a generated base is saved: saved on try two, the provider and storage used once.
- **The base step.** A set made for the venue: the insert, the claim, the event's move and the episode's Event location in one transaction; the base then saved through the finalizer. The start failing at each of the four writes: 500 with the fixed sentence, every row as it was, no set left behind, nothing generated. An existing set claimed and linked together; `BASE_GENERATING` as before. Accepted during the base's generation: not saved, `pending` again, not failed; the read says `not_saved` with the reason and `failed_at`; a base then uploaded through Scene Sets' own route clears it. The read for a base never refused, failed, and generated after an older failure.
- **An uploaded look.** Attached as before; a set made under the id the file was stored with. Accepted while the file was being stored (both kinds of event): 409 `PLACE_LOCKED` with the not-attached sentence, no `outcome`, the previous look and every row as they were, nothing deleted, the key logged. Already accepted: the early 409 and no storage write. No set left behind. A stale set. The save failing at each of the five writes: 500 with the fixed sentence, rolled back. The set row held throughout: 409 after two pauses.
- **Dressed angles.** Before acceptance: generated and uploaded as before, the completion in one finalization. After acceptance (both kinds of event): both refused before the claim, the provider and the storage write. Accepted during generation: not kept, the previous image stays, not left generating. Accepted while an upload was being stored. Both orders against a real acceptance. The save failing. An episode with no event: `NO_LOOK`.
- **The venue-look draft.** Saved after one model call. The model failing: two tries and 502, or one failure then saved, as before. The save failing: 500 `GENERATED_SAVE_FAILED`, the model called once, nothing of the database's in the answer. Accepted while the model was writing: 409 `VENUE_LOOK_LOCKED`. A conflict on every try: 409 `PLACE_FINALIZE_RETRY_EXHAUSTED`, the model called once. Already accepted: the early 409 and no model call.

**Added on her review:**
- *A dressed angle's claim.* The acceptance committed between the Place check and the claim (the check's read held open just after it answered): 202, one paid call, then the save refuses and the row reads failed with the reason, not generating. The claim first, then the acceptance, which does not wait for it. `ANGLE_GENERATING` for a second start, and a claim untouched for twenty minutes taken again.
- *A set gone at the finalization.* Soft-deleted while the finalizer holds the event row: "Generate this look" answers 409 `SET_NOT_FOUND`, no claim, the event not moved, nothing generated; an upload answers it with the not-attached sentence, the key logged. A deleted set the event points at still reads as none in the read and the brief.
- *A set that would be made, refused.* The acceptance first on the create path: 409 `PLACE_LOCKED`, no set, no look, no episode location, the event not moved.
- *A lock conflict inside a save* (55P03 once, at the statement): the look's completion, a dressed angle's completion and upload, an uploaded look with its set row really held and let go during the pause, and the draft: each saved on the second try after one pause, with one provider call, one storage write or one model call.
- *The claim rules.* A base claim and a look claim stuck past the window are taken again through the finalization, and a recent one is `BASE_GENERATING` / `LOOK_GENERATING`; the read still marks a stuck base or look failed with "Timed out: no image after … minutes" and leaves a recent one.
- A refusal before generation logs no `[GeneratedNotSaved]` line; an unattached upload's line names its storage key for the 500 too; a dressed upload's refusal and 500 are logged with the key, change no record and delete nothing.

A failure at the last write of each flow leaves none of the earlier ones: the start (the sync, after the set, the claim and the move), the look's completion (the dressed-angle drop, after the look's row), an upload (the drop, after the set, the look and the move) are the cases above; a dressed angle's completion and upload and the draft are each one statement.

Also run on that database, unchanged and passing: `placeLockGenerationB1` (56), `placeLockFinalizer` (52), `placeLockStrict` (53), `p1PlanAdmin` (85), `p2aSceneAdmin` (335), `p2bSceneSetAdmin` (243), `eventPlaceSync` (6), `worldLocationAdmin` (79), `looksFixes4` (6, 1 skipped as before).

Frontend (Vitest): `DressedAngles.test.jsx` gains four cases and `EventLookImage.upload.test.jsx` four (her review): a 409 `PLACE_LOCKED` on generate, an upload's 409 "stored and not attached" and its 500, each shown as an error toast with the server's sentence and never as a success; and a run refused after the picture was made, shown as "last try failed" beside the previous image. Both components already showed `error` from any refused request; they are not changed. `EventLookImage.notSaved.test.jsx` gains three cases with the read as B2 sends it (a not-saved base shown and toasted; a later upload clearing it; a failed base as before); `EventLookImage.todaysPayload.test.jsx` is reworded, not changed in what it asserts: it described the read "today" as lacking the new fields, and now says "before B2".

**One existing assertion was changed, by reading:** `tests/integration/venueLookImage.integration.test.js` pinned the exact options the base step gives `generateBaseScene`; it now expects `priorStatus: 'pending'` and `finalize: expect.any(Function)` beside the three it had.

**Not run locally, by the rule that a local run sends no DDL** (CI runs them): `venueLookImage`, `looksRaces`, `eventLookUpload`, `lookBaseFixes`, `dressedAngles`, `venueLook`, `placeLock`, `l14Zones`, `plannerAngles`, `beatScenes`, `sceneRouteFixes4`, `sceneRoutesAudit3`, `locationLookVariants`. They were read against this change; apart from the assertion above none asserts something this change alters (INFERRED from reading, not run).

---

**Type:** amendment.
**Rules:** the event look, its upload, dressed angles and the venue-look draft save through `finalizePlaceWrite`; dressed angles are refused on a locked Place; the event look read reports a base generated and not saved; on Evoni's approval and rulings set out in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
