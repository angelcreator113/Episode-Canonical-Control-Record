# Read: the three relationship tables — what each holds, who uses it, and what to decide (phase 12 part 14)

- **Basis:** `origin/main` at `321dd7863d04ed3402f4b7fb6e67e90a7a2e2c66`. Every `path:line` below is at this SHA.
- **Date:** 2026-10-13
- **Task:** #3110, phase 12 part 14. Evoni, 2026-10-13: "Relationships: read first (the three tables), then decide."
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Makes no host, AWS, database or Cognito contact. No row was counted, so every statement about data is about code.
  - Answers the question left open by `docs/reads/2026-10-12-pulse-world-depth-read.md:215` and `docs/reads/2026-10-13-pulse-gap-read.md:133`: which table is canon for "the kind of relationship", and what happens to the other two.

**Markers.**
- **MEASURED** means a `path:line` read at the basis SHA.
- **INFERRED** means reasoned from measured code, not observed running.

---

## 1. The three tables in one view

| | `character_relationships` | `social_profile_relationships` | `feed_profile_relationships` |
|---|---|---|---|
| **Between** | two Registry characters (`character_id_a`, `character_id_b`) | two Feed profiles (`source_profile_id`, `target_profile_id`) | two Feed profiles (`influencer_a_id`, `influencer_b_id`) |
| **Kind** | free text `relationship_type`, plus `role_tag` | ENUM of 15: collab, rival, couple, ex, baby_daddy, baby_mama, bestie, mentor, copycat, shade, situationship, family, management, feud, secret_link | ENUM of 9: collab, beef, copy_cat, mentor, public_shade, silent_alliance, former_friends, competitors, orbit |
| **Also holds** | tension_state, status, confirmed, family fields, the private `source_knows` / `target_knows` / `reader_knows` | direction, drama_level, public_visibility | is_public, story_position, notes |
| **Duplicates** | unique (a, b, type), one direction | unique (source, target, type), one direction | **no unique index, no duplicate check** |
| **Used by** | the Relationship Engine page, World Studio, WriteMode and the AI writing context; The Pulse for the "knows" text only | **The Pulse** (kind and closeness), Feed reactions, event guest lists, profile generation | the Feed Relationship Map page only |
| **Written by** | the Relationship Engine, World Studio, AI generators (as unconfirmed proposals) | profile generation and the Feed scheduler, automatically | the map page, by hand, and its one-off "auto-generate" copy |

**MEASURED:**
- Models: `src/models/CharacterRelationship.js:5-60`, `src/models/SocialProfileRelationship.js:20-60`, `src/models/FeedProfileRelationship.js:20-58`.
- Uniques: `src/migrations/20260312230000-add-unique-relationship-pair-index.js:20-55`, `src/migrations/20260311120000-enhanced-social-profiles-network.js:97-100`. The map's table has indexes only (`src/migrations/20260312210000-feed-relationships.js:66-69`).

---

## 2. What The Pulse reads today

**MEASURED.**
- **The kind of relationship and its closeness** come from `social_profile_relationships`:
  - `pulseCloseness` (`src/services/pulseCloseness.js:11-14`, queries at :54, :96, :201);
  - `pulseEventPosting.closenessTo` (`src/services/pulseEventPosting.js:93-104`);
  - `pulseKnowledge.closeTies` (`src/services/pulseKnowledge.js:65-74`);
  - Feed reactions (`src/services/feedCommentDrafter.js:40-56`).
- **What a character privately knows** comes from `character_relationships` (`src/services/pulseKnowledge.js:156-171`; part 5, #3092). The two are joined only through `registry_characters.feed_profile_id` (`src/utils/registryLink.js`), never compared.
- **`feed_profile_relationships` steers nothing in The Pulse.** The map route says so in its own comment: "The kind of relationship The Pulse uses is social_profile_relationships; this map's types do not steer it." (`src/routes/feedRelationshipRoutes.js:167-169`). The map shows The Pulse's closeness read-only (:170-185).
- **A fourth "relationship to Lala"**: the Feed's friends list reads `social_profiles.lala_relationship = 'direct'` (`src/services/lalaFeedProfile.js:19-22,66`), not any of the three.

---

## 3. What keeps them in agreement: nothing

**MEASURED.**
- **The only copy** is the map's POST `/api/v1/feed-relationships/auto-generate` (`src/routes/feedRelationshipRoutes.js:195-248`), `social_profile_relationships` → `feed_profile_relationships`.
  - It runs by hand, inserts only, and skips any pair that already has a map row (:224-240).
  - Its type map collapses six kinds into `orbit`, among them couple, family and baby_daddy (:196-212).
  - Edits and deletes never travel either way.
- **Nothing** copies or compares `character_relationships` with either profile table.

**INFERRED, the consequence:** an edit on the Relationship Map does not change how The Pulse treats a pair, and a Registry relationship (for example "sisters") does not tell The Pulse that the two profiles are close.

---

## 4. Defects found on the way (independent of the decision)

Each is **MEASURED** at the cited lines. The effect is **INFERRED** from the code, not run.

1. **The Relationship Engine page cannot save edits or dismiss a proposal.**
   - It sends PATCH for field and family edits (`frontend/src/pages/RelationshipEngine.jsx:44-47`) and POST for dismiss (:34-35).
   - The server has only PUT (`src/routes/relationships.js:614`, :754) and DELETE (:583). No other router or method override handles them (`src/app.js:1280-1282`).
   - The Inspector edits the private "knows" fields, but even the PUT never writes them (:620-640). The only writer of `source_knows` / `target_knows` is the create path.
2. **The Character Profile's relationships call a route that does not exist.** `frontend/src/components/CharacterProfile.jsx:13` and `frontend/src/pages/CharacterProfilePage.jsx:31` call GET `/character-registry/characters/:id/relationships`; the Registry router has `/characters/:id` (:428) and `/characters/:id/plot-threads` (:444) only.
3. **World Studio's cross-batch seed posts to a path without `/v1`:** `fetch('/api/world/characters/seed-cross-batch')` (`frontend/src/pages/WorldStudio.jsx:1168`).
4. **The map's table takes duplicates and any field:**
   - POST has no duplicate check and there is no unique index (§1).
   - PUT does `rel.update(req.body)` with no allow-list (`src/routes/feedRelationshipRoutes.js:85-90`).
5. **`character_relationships` has `deleted_at` in the database but not in its model.**
   - Raw SQL filters it (`src/routes/worldStudio.js:1125,3104,3117`); every delete is a hard DELETE.
   - `scripts/schema-agreement.baseline:136` already records the mismatch.

---

## 5. The decision

The question: **which table is canon for "the kind of relationship" between two Feed profiles**, and what the Relationship Map and the Registry do about it.

Options, smallest first:

- **(a) Keep three jobs, make the map honest.**
  - `social_profile_relationships` stays canon for The Pulse.
  - The Relationship Map reads and edits **it** (the 15 kinds) instead of `feed_profile_relationships`, so an edit on the map changes The Pulse.
  - `feed_profile_relationships` keeps only what it alone has (`story_position`, `notes`), or retires after a one-off copy of its rows.
  - The Registry stays separate (the novel's relationships and private knowledge).
  - **M.**
- **(b) Registry relationships propose Feed kinds.**
  - On top of (a): when both characters have a Feed profile (`feed_profile_id`), a confirmed Registry relationship proposes a Feed kind for the pair (sisters → family, rivals → rival), waiting in Review like other proposals.
  - Never automatic; never the other way.
  - **M–L**, and needs a Registry→Feed kind map Evoni approves.
- **(c) Leave the tables as they are**, and fix only §4. **S.**
  - The map stays a drawing that does not steer The Pulse. The code already says so, and the page already shows The Pulse's closeness read-only.

**Recommendation (INFERRED):** (a), with the §4 fixes as their own small part either way.
- (a) removes the one disagreement Evoni can see: editing the map and nothing changing.
- It touches neither the novel's Registry nor The Pulse's reads.
- (b) is worth deciding only after (a), once the map and The Pulse agree.

**Sizes and risks:**
- **(a):**
  - The map page's type list changes from 9 kinds to 15.
  - Existing map rows need a reverse map: `orbit` cannot be split back into couple, family and so on, so those rows would ask Evoni to pick.
  - Production row counts are unknown; this read counted none.
- **§4 fixes:** frontend method and path corrections, the knows fields in PUT, a duplicate check and allow-list on the map, a model `deleted_at`. **S** each.
