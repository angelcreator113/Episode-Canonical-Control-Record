| **PRIME STUDIOS** **F-AUTH-1 — AN OLD BASE IMAGE A SAVED SCENE STILL SHOWS IS NOT DELETED (AMENDMENT)** *When a scene set's base is replaced, the previous image's file is deleted unless something still shows it. That check did not look at saved scenes, whose background is a copy of the base's address. It now does: a file any live saved scene still shows is kept. One race remains and is written down: a scene made to show the old image after the check has run.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `e286cfdd2e4a5edb2ebf34112a0890de9c9d7901` (2026-11-24), plus branch `claude/base-image-still-used-by-scenes`. The branch contains neither the Scene Set delete lock order change nor the base-save-on-a-live-set change, which are separate and unmerged. Every `file:line` below is on the branch unless it says "at the basis".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's authorization of 2026-11-24 of one narrow safety correction, whose terms are set out in §2 as they were given to this work. Merging this file with the change it describes is her approval of the text. It is not an authorization to deploy.

**Standings used:** RULED (§2); MEASURED (the repository reads and local test runs of §1 and §3 to §7, each with its file or command); INFERRED (marked where used).

---

# §1. The defect (MEASURED at the basis)

`deleteOldBaseImage` (`src/services/sceneGenerationService.js`) deletes a replaced base's file from storage unless `imageStillUsed` says something still shows it. `imageStillUsed` asked three things: a live angle whose `still_image_url` is that URL; a live location whose `approved_base_image_url` is that URL; another live set whose `base_still_url` is that URL. It did not ask about saved scenes.

A saved scene keeps a copy of the picture's address in `scenes.background_url`: `beatScenesService` writes the set's `base_still_url` there for a beat shot on the base, and Scene Studio's save writes the background it was shown. So a scene still on the old base lost its file when the base was replaced.

**Was the consequence reproduced?** Yes, to the extent a storage double shows it: with the basis's check, both real replacement paths asked the storage to delete the old file while a live scene's `background_url` was that file (an accepted episode's, a filmed draft's, an ordinary draft's). 14 of the new 30 tests fail on the basis's code (§7). No real object was deleted and no page was loaded: a broken image in a browser was not observed.

# §2. The decisions (RULED)

Evoni authorized one narrow correction on 2026-11-24. Her terms, as given to this work:
- Verify first: every caller of the deletion decision and its siblings; how saved scenes store images; whether the comparison identifies the same stored asset; the concurrency between a new scene reference and the cleanup; the failure semantics. Stop and hand back if the race cannot be prevented by a small compatible change, or if anything needs a registry, a garbage collector, a new table, a replacement storage service or a transaction redesign.
- Extend the existing usage check to saved scenes, and only to what the verification shows is the same class of durable reference. A file any live saved scene references is retained. Decide and state the treatment of soft-deleted scenes.
- A file with no verified reference follows the existing cleanup rules unchanged.
- A lookup failure or an unresolved race must not be read as "unused": on a usage-query error, do not delete, and log by the error's class.
- Do not rewrite scenes or image URLs. No registry, garbage collector, new table or new service. Keep the change inside the existing functions; callers see no change but "retains more".
- This does not implement S1, the protection of an accepted or filmed episode's base against replacement (C2), or any cleanup of orphaned files.

# §3. What was verified (MEASURED by reading, unless marked)

**a. Who decides a deletion.**

| Deleter | Called from | "Still used" check |
|---|---|---|
| `deleteOldBaseImage` → `imageStillUsed` → `deleteOldS3Asset` | `generateBaseScene` (after its save commits, after `repointBaseAngles`); `POST /scene-sets/:id/upload-base` (after `set.update`, after `repointBaseAngles`) | the check this change extends |
| `deleteOldS3Asset`, directly | `generateAngleVideo` (`sceneGenerationService.js`): a video not kept, and an angle's previous video clip | none. Videos; not this correction. |
| `deleteStoredPhoto` | `POST` and `DELETE /scene-sets/:id/venue-photo` (`sceneSetRoutes.js`) | none. The venue's own photo, a location's column; not this correction. |

No other deleter of scene-set images exists: a replaced angle still, a look image, a dressed angle and a location look variant are not deleted from storage at all (their old files stay), and Scene Studio's restyle replaces a set's base without calling the cleanup. So the blind spot was in the one shared function, and both of its callers get the correction. The two unchecked deleters above are siblings of another kind (they never asked "still used"); they are not changed.

**b. How saved scenes store images.**
- `scenes.background_url`: written by `beatScenesService` (`beatBackground`: the beat's angle image, else the event look's image, else the set's base URL, copied as stored); by Scene Studio's canvas save, restyle and inpaint (`sceneStudioController.js`: a URL from the request, or a newly stored result); by scene create and update (`sceneController.js`: a URL from the request).
- The form a base has: `https://<bucket>.s3.<region>.amazonaws.com/<key>`, built where the picture is stored, with no query string. A beat's scene row holds exactly that string. A URL that came from a request is whatever the client sent: normally the string it was given, but nothing in the route fixes its form.
- Other places an image address is kept and that this change does **not** read: `scenes.canvas_settings` (JSON); `episode_scripts.scene_angles_used` (a JSON snapshot of the beats' angles with their image URLs, which can be the base's for an angle that is the base picture); `scene_set_looks.image_url` (a look's own file, not the base); the lookbook, which reads the set's current base when it is built.

**c. The comparison.** The three existing relations compare by exact URL. Scenes are compared by the stored object: the exact URL, or a `background_url` whose path, with a query string or fragment left off, ends with `/<key>` (the raw path of the old URL, and the decoded key `storageKeyOf` gives). So a signed or cache-busting copy, and the same key behind another host, are recognised; a different key is not (another set's file of the same name, a key that only starts or only ends like this one, the key named only inside a query string: all tested). The existing three comparisons are left as they were.

**d. Concurrency.**
- *Order.* In both callers the new base is committed before the cleanup runs (`generateBaseScene`: the save's transaction, then `repointBaseAngles`, then `deleteOldBaseImage`; upload-base: `set.update`, an autocommit statement, then the same two). Confirmed by reading and by the tests' gates.
- *What that order gives.* Once the new base is committed, no reader of the set gets the old URL from it any more. A new reference to the old URL can come only from a writer holding a value it read before the commit (`syncBeatScenes` reads the plan and writes the scene rows as separate statements, with no lock on the set), or from a client that sends the old URL (Scene Studio's save, a scene update).
- *The window.* Between the usage query and the storage delete nothing is locked, and the storage delete is outside any transaction. A reference written in that window is not seen: the file is deleted and that scene shows a file that is gone. Observed (§7).
- *Can a small compatible change close it?* **No.** A client can send the old URL at any later time, long after the delete; and making the cleanup and every scene writer exclude each other needs a lock those writers do not take. That is a redesign, and it was not built. What bounds it in practice: for a beat's scene row, the next `syncBeatScenes` writes the set's current base over it, so that reference is to a missing file only until the next sync (INFERRED from reading `syncBeatScenes`; not tested here). A background a client sent stays as sent.
- A reference made after the commit and **before** the check is seen, and the file is kept (tested).

**e. Failure semantics at the basis.** `imageStillUsed` already answered "used" when its query threw or when it had no database handle: a failed check never deleted. Its warning carried the URL and the database's message. A storage delete that fails is caught and logged in `deleteOldS3Asset`; the base's save is not undone. Both kept; the warning now names the set, the stored key and the error's class instead of the URL and the database's text.

# §4. What the change does (MEASURED on the branch)

One function, `imageStillUsed` (`src/services/sceneGenerationService.js`): a fourth `EXISTS` in its one query, over `scenes` with `deleted_at IS NULL`, matching `background_url` as §3 c describes; and its warning's text. Nothing else.

- **Added:** live saved scenes' `background_url`.
- **Soft-deleted scenes are not counted.** Nothing in the code restores a removed scene (the only restore in the scene controllers is of a scene's assets), so a removed scene cannot come back showing a missing file.
- **Deliberately not added:** `scenes.canvas_settings`, `episode_scripts.scene_angles_used`, and anything else in §3 b. They are JSON documents or snapshots whose protection is the saved-scene and snapshot work (S1), and reading them is not a small extension of this query.
- **Unchanged:** the three existing relations, the function's answers ("used" on any failure), `deleteOldBaseImage`, `deleteOldS3Asset`, both callers. No scene and no URL is rewritten.

**The behaviour change, exactly:** a replaced base's file is no longer deleted while a live scene's background is that file. Every other case is as before.

**A consequence to know.** No route comes back for a file it kept. A file kept because a scene showed it stays in storage after that scene stops showing it, as a file kept for an angle already did. There is no cleanup of such files, and none was added.

# §5. What this does not do

- It does not stop the base of an accepted or filmed episode's set from being replaced (C2), nor freeze a saved scene (S1): after a replacement, the next sync still writes the new base over a beat's scene row, whatever the episode's state. This change only keeps the old file while a scene row still names it.
- It does not close the race of §3 d.
- It does not protect the other image addresses of §3 b, nor change the two deleters that ask nothing (§3 a).
- No migration; no stored row is changed.

# §6. Limits

- **The remaining race (§3 d)**, tested as it is and named as known.
- **Kept files are never revisited (§4).**
- **A scene whose background is the same object under a form not tested** (an encoded path, a path-style bucket URL where the key follows the bucket's name) is matched when its path ends with `/<key>`; a form that does not end so is not matched. The forms tested are in §7.
- **The live schema and the running processes were not verified.** No server and no real storage was contacted.

# §7. Tests (MEASURED, local)

On a private, migrated local PostgreSQL test database, through the real app. The storage is a double that records each delete by key; the provider is a double; no file exists anywhere and no paid call is made. No test sends DDL. The network guard reports 0 external attempts.

`tests/integration/baseImageStillUsed.integration.test.js` (30 cases):
- *Through each real replacement* (`POST /scene-sets/:id/upload-base`, and `POST /scene-sets/:id/generate-base` with `generateBaseScene`), 5 each: the old base is the background of a scene of an accepted episode, of a filmed draft, of an ordinary draft: not deleted, and the scene not rewritten; nothing shows it: deleted as before; only a removed scene shows it: deleted as before.
- *Several scenes:* kept while either shows it; deleted by the cleanup only once neither does (the cleanup's own function is asked again: no route returns to a kept file).
- *What already kept a file* (3): an angle, an approved location base, another set's base.
- *Forms* (11): kept for the exact URL, with a query string, with a fragment, the same key behind another host, and that with a query string; deleted for another set's file of the same name, a key that only starts like it, a key that only ends like it, the key only inside a query string, a scene with no background; and an old base outside the bucket is matched by exact URL only and nothing is deleted for it, as before.
- *The race* (2): a scene made after the new base is saved and before the check (the upload held at its save): kept. **KNOWN REMAINING RACE:** a scene made after the check and before the storage delete (the storage double held at the delete): the file is deleted and the scene names a file that is gone.
- *Failures* (2): the usage query failing: nothing deleted, the upload answers 200, the warning is the set, the key and the error's class; the storage delete failing: the upload answers 200 and the new base stays.
- The network guard.

**Before the change:** against the basis's `sceneGenerationService.js` (put back for one run, then restored), 14 of the 30 fail: the six scene cases through the two replacements, the several-scenes case, the five "kept" forms, the reference made before the check, and the failing-check case (for its warning's text). With the change, 30 pass.

Also run on that database and passing: `placeLockGenerationB1` (56), `placeLockGenerationB2` (69), `placeLockGenerationB3` (59), `placeLockFinalizer` (52), `p2bSceneSetAdmin` (243), `looksFixes4` (6, 1 skipped as before). The unit directory: 745 suites, 11287 tests, among them `tests/unit/services/sceneBaseImageKept.test.js`, which pins the cleanup and passes unchanged.

**Not run locally, by the rule that a local run sends no DDL** (CI runs them): `sceneRoutesAudit3` (it pins "an old base another set still uses is kept; one nothing uses is deleted", with no scene in its fixture: unaffected), `lookBaseFixes`, `approvedBase`, `venuePhoto`. They were read for a pin this change touches; none was found and none was edited (INFERRED from reading, not run).

---

**Type:** amendment.
**Rules:** the old-base cleanup's "still used" check includes live saved scenes; a failed check keeps the file; on Evoni's authorization and terms set out in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider or real storage was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
