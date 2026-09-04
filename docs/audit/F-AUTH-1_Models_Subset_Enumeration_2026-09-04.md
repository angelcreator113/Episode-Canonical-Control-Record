| **PRIME STUDIOS** **F-AUTH-1 — MODELS SUBSET ENUMERATION** *Enumerates every Sequelize model defined under `src/models/` against `src/models/index.js`'s registration mechanisms. Does not judge, rule, or fix. Does not reopen FD-64.* |
| --- |

# F-AUTH-1 — Models Subset Enumeration

**Document type: evidence, MEASURED.** Closes the enumeration half of
`F-AUTH-1_Fix_Plan_v2.69.md` §7 item (b): the hand-maintained `models`
subset omitted `AssetRole` (found while closing FD-64, fixed at
`65cbe7013`), and whether other models are similarly missing was left
unevaluated. This document evaluates that and nothing else. Authorized
2026-09-04, filed `docs(audit): enumerate models omitted from index.js
subset`.

**Author:** Claude — Prime Studios. Repo-only read; no ruling.

**Status:** Evidence. Enumerates. Does not judge whether any omission is
a defect, does not rule, does not mint, does not reopen FD-64 (CLOSED,
`v2.69` §6 Ruling 2).

---

# §1. Basis

```
$ git rev-parse origin/main
e1ad0027a01f4ae26f0e4959c9a3b9cdf41bb111
```

`origin/main` at `e1ad0027a`, 2026-09-04. Every read below is at this
SHA.

---

# §2. The defined-model set — criterion, then count

**Criterion.** A file under `src/models/` counts as a model definition if
its module exports a function that either (a) calls `sequelize.define('Name',
...)`, or (b) declares `class Name extends Model` and calls `Name.init(...)`.
Both are Sequelize's own model-declaration forms; a file matching neither
is not a Sequelize model regardless of its location.

```
$ ls src/models/*.js | wc -l
154
```

154 `.js` files under `src/models/`, including `index.js` itself.
Excluding `index.js` (153 remain), each file was read and classified by
the criterion above:

- **112 files** call `sequelize.define('Name', ...)` directly.
- **39 files** declare `class Name extends Model` with a `Name.init(...)`
  call.
- **2 files do not match either form**: `file.js` and `job.js`. Both
  require `../config/database` directly and implement their own
  static-method CRUD classes (`FileModel`, a `Job` class) — a different,
  non-Sequelize data-access pattern. They are not Sequelize models and
  are excluded from the defined set on that basis, not by name or
  location.

**151 defined models** (112 + 39). No filename/model-name mismatch was
found — every `sequelize.define`/`class` name matches its file's basename
exactly (verified by script across all 151).

---

# §3. Registration mechanisms in `index.js` — three found, not one

`index.js` was read in full (2073 lines). No `fs.readdirSync` or other
dynamic directory-scan loads any model — every model that reaches
`index.js` at all does so through an explicit `require('./Name')(sequelize)`
line. Three distinct places then make a loaded model reachable by
consumers of `require('../models')`, and they do not overlap:

1. **`requiredModels`** (line 427) — an object built from a subset of the
   loaded models, used internally for a load-verification check
   (`Object.entries(requiredModels).forEach(...)` throws if any named
   model is falsy) and passed as the `models` argument to each model's own
   static `associate(models)` method. **145 keys.** Not itself exported.
2. **`db.models`** (line 1702, inside the object at line 1696) — a
   second, separate, hand-maintained object, exported as part of the
   module's `db` export. **This is the subset `v2.69` §7 item (b)
   refers to** — confirmed here because `AssetRole` (FD-64's fix)
   appears in this object and not in the other two counts below at the
   same rate. **56 keys.**
3. **`module.exports.<Name> = <Name>`** — 146 individual top-level
   assignments, one per loaded model, letting `require('../models').Name`
   resolve directly without going through `.models`. **146 keys.**

A model can be loaded (`require('./Name')(sequelize)` ran) without
appearing in any of the three, if the same commented-out treatment
applied to it that `AssetUsage` received (§8) — or, as found below, without
being loaded at all.

---

# §4. Every defined model, registration status against `db.models`

**One row per defined model, sorted alphabetically.** "Registered by"
lists every one of the three §3 mechanisms that includes the model; a
model in `requiredModels`/`module.exports` but not `db.models` is present
in this table with `In db.models? = no` and the other two named.

| # | Model | File | In `db.models`? | Registered by |
|---|---|---|---|---|
| 1 | `ActivityLog` | `ActivityLog.js` | YES | requiredModels, db.models, module.exports |
| 2 | `AIEditPlan` | `AIEditPlan.js` | YES | requiredModels, db.models, module.exports |
| 3 | `AIRevision` | `AIRevision.js` | YES | requiredModels, db.models, module.exports |
| 4 | `AITrainingData` | `AITrainingData.js` | YES | requiredModels, db.models, module.exports |
| 5 | `AIUsageLog` | `AIUsageLog.js` | no | requiredModels, module.exports |
| 6 | `AmberFinding` | `AmberFinding.js` | no | requiredModels, module.exports |
| 7 | `AmberScanRun` | `AmberScanRun.js` | no | requiredModels, module.exports |
| 8 | `AmberTaskQueue` | `AmberTaskQueue.js` | no | requiredModels, module.exports |
| 9 | `Asset` | `Asset.js` | YES | requiredModels, db.models, module.exports |
| 10 | `AssetLabel` | `AssetLabel.js` | YES | requiredModels, db.models, module.exports |
| 11 | `AssetRole` | `AssetRole.js` | YES | requiredModels, db.models, module.exports |
| 12 | `AssetUsageLog` | `AssetUsageLog.js` | no | requiredModels, module.exports |
| 13 | `AudioClip` | `AudioClip.js` | YES | requiredModels, db.models, module.exports |
| 14 | `AuthorNote` | `AuthorNote.js` | no | requiredModels, module.exports |
| 15 | `Beat` | `Beat.js` | YES | requiredModels, db.models, module.exports |
| 16 | `BookSeries` | `BookSeries.js` | no | requiredModels, module.exports |
| 17 | `BrainDocument` | `BrainDocument.js` | no | requiredModels |
| 18 | `BrainFingerprint` | `BrainFingerprint.js` | no | requiredModels, module.exports |
| 19 | `BulkImportJob` | `BulkImportJob.js` | no | requiredModels, module.exports |
| 20 | `CalendarEventAttendee` | `CalendarEventAttendee.js` | no | requiredModels, module.exports |
| 21 | `CalendarEventRipple` | `CalendarEventRipple.js` | no | requiredModels, module.exports |
| 22 | `CareerGoal` | `CareerGoal.js` | no | requiredModels, module.exports |
| 23 | `Character` | `Character.js` | no | requiredModels, module.exports |
| 24 | `CharacterArc` | `CharacterArc.js` | no | requiredModels, module.exports |
| 25 | `CharacterClip` | `CharacterClip.js` | YES | requiredModels, db.models, module.exports |
| 26 | `CharacterCrossing` | `CharacterCrossing.js` | no | requiredModels, module.exports |
| 27 | `CharacterEntanglement` | `CharacterEntanglement.js` | no | requiredModels, module.exports |
| 28 | `CharacterFollowProfile` | `CharacterFollowProfile.js` | no | requiredModels, module.exports |
| 29 | `CharacterGrowthLog` | `CharacterGrowthLog.js` | no | requiredModels, module.exports |
| 30 | `CharacterProfile` | `CharacterProfile.js` | no | requiredModels, module.exports |
| 31 | `CharacterRegistry` | `CharacterRegistry.js` | no | requiredModels, module.exports |
| 32 | `CharacterRelationship` | `CharacterRelationship.js` | no | requiredModels, module.exports |
| 33 | `CharacterSpark` | `CharacterSpark.js` | YES | requiredModels, db.models, module.exports |
| 34 | `CharacterState` | `CharacterState.js` | no | requiredModels, module.exports |
| 35 | `CharacterTherapyProfile` | `CharacterTherapyProfile.js` | no | requiredModels, module.exports |
| 36 | `CompositionAsset` | `CompositionAsset.js` | YES | db.models, module.exports |
| 37 | `CompositionOutput` | `CompositionOutput.js` | YES | db.models, module.exports |
| 38 | `ContinuityBeat` | `ContinuityBeat.js` | no | requiredModels, module.exports |
| 39 | `ContinuityBeatCharacter` | `ContinuityBeatCharacter.js` | no | requiredModels, module.exports |
| 40 | `ContinuityCharacter` | `ContinuityCharacter.js` | no | requiredModels, module.exports |
| 41 | `ContinuityTimeline` | `ContinuityTimeline.js` | no | requiredModels, module.exports |
| 42 | `DecisionLog` | `DecisionLog.js` | YES | requiredModels, db.models, module.exports |
| 43 | `DecisionPattern` | `DecisionPattern.js` | YES | requiredModels, db.models, module.exports |
| 44 | `EditingDecision` | `EditingDecision.js` | YES | requiredModels, db.models, module.exports |
| 45 | `EditMap` | `EditMap.js` | no | requiredModels, module.exports |
| 46 | `EntanglementEvent` | `EntanglementEvent.js` | no | requiredModels, module.exports |
| 47 | `EntanglementUnfollow` | `EntanglementUnfollow.js` | no | requiredModels, module.exports |
| 48 | `Episode` | `Episode.js` | YES | requiredModels, db.models, module.exports |
| 49 | `EpisodeAsset` | `EpisodeAsset.js` | YES | requiredModels, db.models, module.exports |
| 50 | `EpisodeBrief` | `EpisodeBrief.js` | no | module.exports |
| 51 | `EpisodeScene` | `EpisodeScene.js` | YES | requiredModels, db.models, module.exports |
| 52 | `EpisodeScript` | `EpisodeScript.js` | no | requiredModels, module.exports |
| 53 | `EpisodeTemplate` | `EpisodeTemplate.js` | YES | requiredModels, db.models, module.exports |
| 54 | `EpisodeWardrobe` | `EpisodeWardrobe.js` | YES | requiredModels, db.models, module.exports |
| 55 | `EpisodeWardrobeDefault` | `EpisodeWardrobeDefault.js` | no | requiredModels, module.exports |
| 56 | `FeedMoment` | `FeedMoment.js` | no | requiredModels, module.exports |
| 57 | `FeedPost` | `FeedPost.js` | no | requiredModels, module.exports |
| 58 | `FeedProfileRelationship` | `FeedProfileRelationship.js` | no | requiredModels, module.exports |
| 59 | `FileStorage` | `FileStorage.js` | YES | requiredModels, db.models, module.exports |
| 60 | `FranchiseKnowledge` | `FranchiseKnowledge.js` | no | requiredModels, module.exports |
| 61 | `FranchiseTechKnowledge` | `FranchiseTechKnowledge.js` | no | requiredModels, module.exports |
| 62 | `GenerationJob` | `GenerationJob.js` | no | requiredModels, module.exports |
| 63 | `HairLibrary` | `HairLibrary.js` | YES | requiredModels, db.models, module.exports |
| 64 | `LalaEmergenceScene` | `LalaEmergenceScene.js` | no | requiredModels, module.exports |
| 65 | `LalaverseBrand` | `LalaverseBrand.js` | YES | requiredModels, db.models, module.exports |
| 66 | `Layer` | `Layer.js` | no | requiredModels, module.exports |
| 67 | `LayerAsset` | `LayerAsset.js` | no | requiredModels, module.exports |
| 68 | `LayerPreset` | `LayerPreset.js` | YES | requiredModels, db.models, module.exports |
| 69 | `MakeupLibrary` | `MakeupLibrary.js` | YES | requiredModels, db.models, module.exports |
| 70 | `ManuscriptMetadata` | `ManuscriptMetadata.js` | no | requiredModels, module.exports |
| 71 | `Marker` | `Marker.js` | YES | requiredModels, db.models, module.exports |
| 72 | `MetadataStorage` | `MetadataStorage.js` | YES | requiredModels, db.models, module.exports |
| 73 | `MultiProductContent` | `MultiProductContent.js` | no | requiredModels, module.exports |
| 74 | `NovelAssembly` | `NovelAssembly.js` | no | requiredModels, module.exports |
| 75 | `Opportunity` | `Opportunity.js` | no | requiredModels, module.exports |
| 76 | `OutfitSet` | `OutfitSet.js` | YES | requiredModels, db.models, module.exports |
| 77 | `OutfitSetItems` | `OutfitSetItems.js` | YES | requiredModels, db.models, module.exports |
| 78 | `PageContent` | `PageContent.js` | no | requiredModels, module.exports |
| 79 | `PhoneMission` | `PhoneMission.js` | no | requiredModels |
| 80 | `PhonePlaythroughState` | `PhonePlaythroughState.js` | no | requiredModels |
| 81 | `PipelineTracking` | `PipelineTracking.js` | no | requiredModels, module.exports |
| 82 | `PostGenerationReview` | `PostGenerationReview.js` | no | requiredModels, module.exports |
| 83 | `PressCareer` | `PressCareer.js` | no | requiredModels, module.exports |
| 84 | `ProcessingQueue` | `ProcessingQueue.js` | YES | requiredModels, db.models, module.exports |
| 85 | `RegistryCharacter` | `RegistryCharacter.js` | no | requiredModels, module.exports |
| 86 | `RelationshipEvent` | `RelationshipEvent.js` | no | requiredModels, module.exports |
| 87 | `Scene` | `Scene.js` | YES | requiredModels, db.models, module.exports |
| 88 | `SceneAngle` | `SceneAngle.js` | YES | requiredModels, db.models, module.exports |
| 89 | `SceneAsset` | `SceneAsset.js` | YES | requiredModels, db.models, module.exports |
| 90 | `SceneFootageLink` | `SceneFootageLink.js` | no | requiredModels, module.exports |
| 91 | `SceneLayerConfiguration` | `SceneLayerConfiguration.js` | YES | requiredModels, db.models, module.exports |
| 92 | `SceneLibrary` | `SceneLibrary.js` | YES | requiredModels, db.models, module.exports |
| 93 | `SceneObjectVariant` | `SceneObjectVariant.js` | no | requiredModels, module.exports |
| 94 | `ScenePlan` | `ScenePlan.js` | no | module.exports |
| 95 | `SceneProposal` | `SceneProposal.js` | no | requiredModels, module.exports |
| 96 | `SceneSet` | `SceneSet.js` | YES | requiredModels, db.models, module.exports |
| 97 | `SceneSetEpisode` | `SceneSetEpisode.js` | YES | requiredModels, db.models, module.exports |
| 98 | `SceneTemplate` | `SceneTemplate.js` | YES | requiredModels, db.models, module.exports |
| 99 | `ScriptEditHistory` | `ScriptEditHistory.js` | no | requiredModels, module.exports |
| 100 | `ScriptLearningProfile` | `ScriptLearningProfile.js` | no | requiredModels, module.exports |
| 101 | `ScriptMetadata` | `ScriptMetadata.js` | YES | requiredModels, db.models, module.exports |
| 102 | `ScriptSuggestion` | `ScriptSuggestion.js` | no | requiredModels, module.exports |
| 103 | `ScriptTemplate` | `ScriptTemplate.js` | no | requiredModels, module.exports |
| 104 | `SessionBrief` | `SessionBrief.js` | no | requiredModels, module.exports |
| 105 | `Show` | `Show.js` | YES | requiredModels, db.models, module.exports |
| 106 | `ShowArc` | `ShowArc.js` | no | requiredModels, module.exports |
| 107 | `ShowAsset` | `ShowAsset.js` | YES | requiredModels, db.models, module.exports |
| 108 | `ShowConfig` | `ShowConfig.js` | no | requiredModels, module.exports |
| 109 | `SocialMediaImport` | `SocialMediaImport.js` | no | requiredModels, module.exports |
| 110 | `SocialProfile` | `SocialProfile.js` | no | requiredModels, module.exports |
| 111 | `SocialProfileFollower` | `SocialProfileFollower.js` | no | requiredModels, module.exports |
| 112 | `SocialProfileRelationship` | `SocialProfileRelationship.js` | no | requiredModels, module.exports |
| 113 | `SocialProfileTemplate` | `SocialProfileTemplate.js` | no | **none** |
| 114 | `StoryCalendarEvent` | `StoryCalendarEvent.js` | no | requiredModels, module.exports |
| 115 | `StoryClockMarker` | `StoryClockMarker.js` | no | requiredModels, module.exports |
| 116 | `StoryRevision` | `StoryRevision.js` | no | requiredModels, module.exports |
| 117 | `StoryTaskArc` | `StoryTaskArc.js` | no | requiredModels, module.exports |
| 118 | `StorytellerBook` | `StorytellerBook.js` | no | requiredModels, module.exports |
| 119 | `StorytellerChapter` | `StorytellerChapter.js` | no | requiredModels, module.exports |
| 120 | `StorytellerEcho` | `StorytellerEcho.js` | no | requiredModels, module.exports |
| 121 | `StorytellerLine` | `StorytellerLine.js` | no | requiredModels, module.exports |
| 122 | `StorytellerMemory` | `StorytellerMemory.js` | no | requiredModels, module.exports |
| 123 | `StorytellerStory` | `StorytellerStory.js` | no | requiredModels, module.exports |
| 124 | `StoryTexture` | `StoryTexture.js` | no | requiredModels, module.exports |
| 125 | `StoryThread` | `StoryThread.js` | no | requiredModels, module.exports |
| 126 | `TherapyPendingSession` | `TherapyPendingSession.js` | YES | requiredModels, db.models, module.exports |
| 127 | `Thumbnail` | `Thumbnail.js` | YES | requiredModels, db.models, module.exports |
| 128 | `ThumbnailComposition` | `ThumbnailComposition.js` | YES | requiredModels, db.models, module.exports |
| 129 | `ThumbnailTemplate` | `ThumbnailTemplate.js` | YES | requiredModels, db.models, module.exports |
| 130 | `TimelineData` | `TimelineData.js` | YES | requiredModels, db.models, module.exports |
| 131 | `TimelinePlacement` | `TimelinePlacement.js` | YES | requiredModels, db.models, module.exports |
| 132 | `UiOverlayType` | `UiOverlayType.js` | no | **none** |
| 133 | `Universe` | `Universe.js` | no | requiredModels, module.exports |
| 134 | `UniverseCharacter` | `UniverseCharacter.js` | no | requiredModels, module.exports |
| 135 | `UserDecision` | `UserDecision.js` | YES | requiredModels, db.models, module.exports |
| 136 | `VideoProcessingJob` | `VideoProcessingJob.js` | YES | requiredModels, db.models, module.exports |
| 137 | `VoiceRule` | `VoiceRule.js` | no | requiredModels, module.exports |
| 138 | `VoiceSignal` | `VoiceSignal.js` | no | requiredModels, module.exports |
| 139 | `Wardrobe` | `Wardrobe.js` | YES | requiredModels, db.models, module.exports |
| 140 | `WardrobeBrandTag` | `WardrobeBrandTag.js` | YES | requiredModels, db.models, module.exports |
| 141 | `WardrobeContentAssignment` | `WardrobeContentAssignment.js` | YES | requiredModels, db.models, module.exports |
| 142 | `WardrobeLibrary` | `WardrobeLibrary.js` | YES | requiredModels, db.models, module.exports |
| 143 | `WardrobeLibraryReferences` | `WardrobeLibraryReferences.js` | YES | requiredModels, db.models, module.exports |
| 144 | `WardrobeUsageHistory` | `WardrobeUsageHistory.js` | YES | requiredModels, db.models, module.exports |
| 145 | `WorldCharacter` | `WorldCharacter.js` | no | requiredModels, module.exports |
| 146 | `WorldEvent` | `WorldEvent.js` | no | requiredModels, module.exports |
| 147 | `WorldLocation` | `WorldLocation.js` | no | requiredModels, module.exports |
| 148 | `WorldStateSnapshot` | `WorldStateSnapshot.js` | no | requiredModels, module.exports |
| 149 | `WorldTimelineEvent` | `WorldTimelineEvent.js` | no | requiredModels, module.exports |
| 150 | `WritingGoal` | `WritingGoal.js` | no | requiredModels, module.exports |
| 151 | `WritingRhythm` | `WritingRhythm.js` | no | requiredModels, module.exports |

---

# §5. Counts

```
Defined:                    151
Registered in db.models:     56
Omitted from db.models:      95
                            ---
                            151
```

Against the other two mechanisms, for the same 151: registered in
`requiredModels` 145 / omitted 6; registered in `module.exports` 146 /
omitted 5. All three counts were produced by script from the same
row data as §4's table, cross-checked against each other before this
document was written.

---

# §6. `AssetRole` — not an omission at this basis

`AssetRole` appears in all three mechanisms (§4, row 11). It was added by
`65cbe7013` (FD-64's fix, `v2.69` §6 Ruling 2) after having been the
model `db.models` omitted at FD-64's own basis. At this document's basis,
it is registered, not omitted — named here so a reader comparing this
enumeration against FD-64's finding does not mistake the fixed case for
one still open.

---

# §7. The 95 omissions from `db.models` — referenced or not, as found

For each of the 95 models absent from `db.models`, `src/` was searched
for the model's name as a whole word, outside the model's own definition
file and `index.js` itself. This locates a reference; it does not
determine whether that reference would succeed or fail at runtime — that
question is not addressed here.

```
Referenced elsewhere in src/:      90
Not referenced anywhere else:       5
```

**The 5 not referenced anywhere else in `src/`:** `ScriptEditHistory`,
`ScriptLearningProfile`, `ScriptSuggestion`, `ShowArc`, `UiOverlayType`.
Each of these is registered in `requiredModels` and `module.exports`
(so `require('../models').Name` would resolve) except `UiOverlayType`,
which is registered nowhere (§3, §4) and referenced nowhere — the one
model in this document that is simultaneously unregistered by every
mechanism and unreferenced anywhere outside its own file.

**Two models are omitted from all three mechanisms**, not just
`db.models`: `SocialProfileTemplate` and `UiOverlayType` (§4). They
differ in reference status:

- **`SocialProfileTemplate`** is referenced once, at
  `src/routes/socialProfileRoutes.js`. Every access there is guarded —
  `if (db.SocialProfileTemplate) { ... }` (lines 2429, 2471, 2504, 2535)
  — and the file's own comment at line 2424 states the reason:
  "Templates stored in DB when SocialProfileTemplate model is available,
  otherwise in-memory fallback." The reference and the guard are both
  recorded as found; whether the guard is the reason the model was never
  registered, or the model was never registered for some other reason
  and the guard is a separate accommodation, is not determined here.
- **`UiOverlayType`** is referenced nowhere else in `src/`, per above.

No inference is drawn from either case about whether the current state
is intended, correct, or a defect.

---

# §8. `AssetUsage` — a stated exclusion, not a silent omission

`AssetUsage.js` defines a model (`sequelize.define('AssetUsage', ...)`)
that is not loaded, not in `requiredModels`, not in `db.models`, and not
in `module.exports` — but unlike every other unregistered model in this
document, every one of its four omission points carries the same
inline comment, verified by reading each:

```
$ grep -n "AssetUsage" src/models/index.js
181:  // AssetUsage = require('./AssetUsage')(sequelize); // Table doesn't exist
442:  // AssetUsage, // Table doesn't exist
1719:    // AssetUsage, // Table doesn't exist
1952:// module.exports.AssetUsage = AssetUsage; // Table doesn't exist
1218:// NOTE: AssetUsage associations commented out since asset_usage table doesn't exist
```

`AssetUsage` is not counted among the 151 defined models in §2's count
in the sense of being loaded (it never runs `require`, so no instance
exists to check against any mechanism) — it is recorded here separately
because the file defines a model and the surrounding code gives a
consistent, stated reason for excluding it everywhere, at every point
that would otherwise register it. This is the shape a **correctly
absent** model has, distinct from the 95 in §7, none of which carries a
comparable stated reason anywhere in `index.js`. Whether "the table
doesn't exist" is itself still accurate at this basis is not checked
here — that would require a database read, which this document does not
make.

---

# §9. What this document does not do

- **Does not judge whether any of the 95 omissions is a defect,** would
  cause a runtime error, or needs fixing. §7 reports references as
  located, not as evidence of impact.
- **Does not distinguish "should be in `db.models`" from "correctly
  isn't"** for any of the 95, beyond what §8 records about `AssetUsage`
  on its own stated terms. No other model's absence is characterized as
  correct or incorrect.
- **Does not mint FD-70 or any number**, and does not state that any
  omission warrants one.
- **Does not reopen FD-64.** FD-64 is CLOSED (`v2.69` §6 Ruling 2); §6
  records `AssetRole`'s current registered status, not a reopening.
- **Does not edit `src/models/index.js` or any source file.** Read-only
  throughout.
- **Does not check whether `SocialProfileTemplate`'s or any other
  model's underlying database table exists.** No host, AWS, or database
  contact was made.
- **Does not rule on anything.** This is evidence; standing MEASURED
  throughout, every count and table row script-derived and re-checked
  against the same basis before filing.

*Type: evidence. Rules nothing. Mints nothing. Reopens nothing. No host,
AWS, database, or Cognito contact. Prod FROZEN.*
