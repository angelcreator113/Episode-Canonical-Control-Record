'use strict';

/**
 * The cast's review of the old system (the Characters page, Evoni's mock,
 * 2026-10-08; frontend pages/CharacterRegistryPage). Its own file, not
 * routes/characterRegistry.js (F-Reg-2): each write here is one row.
 *
 *   GET    /api/v1/cast/cross-check?registry_id=   contradictions between characters: a post
 *                                                  putting someone at an event they were
 *                                                  not at, or naming one they could not
 *                                                  know; one character's text giving
 *                                                  another the wrong follower count or
 *                                                  status (flag-only; services/castCrossCheck)
 *   GET    /api/v1/cast/flag-log?registry_id=      every flag the check has raised, resolved
 *                                                  ones too, by check, field and character
 *                                                  (services/flagLog)
 *   GET    /api/v1/cast/consistency?registry_id=   the cast rollout: each live character's
 *                                                  facts, check findings, voice and next
 *                                                  step (services/castConsistency; one id,
 *                                                  or several comma-separated)
 *   GET    /api/v1/cast/review?registry_id=        live characters' review state and
 *                                                  feed link, the archived ones, and
 *                                                  how many episodes use each
 *   POST   /api/v1/cast/characters/:id/keep         { kept: true|false }
 *   PUT    /api/v1/cast/characters/:id/feed-profile { feed_profile_id }: Match to feed person
 *   POST   /api/v1/cast/characters/:id/restore      bring an archived character back
 *   DELETE /api/v1/cast/characters/:id/permanent    delete an archived one for good
 *   GET    /api/v1/cast/characters/:id/appearances  where the character shows up (the
 *                                                  character page's "Where they show up")
 *   GET    /api/v1/cast/characters/:id/story-trail their Pulse posts, and the short
 *                                                  stories and chapters they are in
 *   GET    /api/v1/cast/characters/:id/facts        their facts: handle, followers (the
 *                                                  follower ledger), account status, income,
 *                                                  occupation, possessions, affordability
 *                                                  (services/characterFacts)
 *   PUT    /api/v1/cast/characters/:id/facts        change them (ADMIN: followers write a
 *                                                  follower-ledger row with a reason)
 *   POST   /api/v1/cast/characters/:id/facts/suggest  one AI call proposes their missing
 *                                                  occupation, income and possessions from
 *                                                  what is written about them; saves nothing
 *                                                  (ADMIN; services/factsSuggest)
 *   POST   /api/v1/cast/characters/:id/pressure-test  one AI call asks the hard questions a
 *                                                  fact-checker would and answers each from
 *                                                  their character file: answers, gap or
 *                                                  contradiction; saves nothing (ADMIN;
 *                                                  services/characterPressure)
 *   GET    /api/v1/cast/characters/:id/facts/history  when and why each fact changed, with
 *                                                  the follower ledger (services/factHistory)
 *   GET    /api/v1/cast/characters/:id/check        flag-only check of their profile's text
 *                                                  against their facts (services/characterConsistency)
 *   POST   /api/v1/cast/characters/:id/check/intentional        { flag_id, note? }: ADMIN
 *   DELETE /api/v1/cast/characters/:id/check/intentional/:flagId  unmark it: ADMIN
 *   GET    /api/v1/cast/characters/:id/typology     their typology seed (Enneagram type and
 *                                                  wing, MBTI, why) and its label
 *   PUT    /api/v1/cast/characters/:id/typology     set it (ADMIN), or { clear: true }
 *   POST   /api/v1/cast/characters/:id/typology/suggest  one AI call that reads their
 *                                                  writing and proposes one; saves nothing (ADMIN)
 *   GET    /api/v1/cast/characters/:id/content-type  what they are known for on The Pulse
 *                                                  (a Society archetype on their feed
 *                                                  profile), the list, and their job
 *   PUT    /api/v1/cast/characters/:id/content-type  { name?, gap? }: a name or null,
 *                                                  and the job-vs-content gap line (ADMIN)
 *   POST   /api/v1/cast/characters/:id/content-type/suggest  one AI call over their
 *                                                  character file; saves nothing (ADMIN)
 *   POST   /api/v1/cast/content-types/suggest-unset  { limit?, profile_ids? }: suggestions for LalaVerse
 *                                                  feed profiles with none; saves nothing (ADMIN)
 *   GET    /api/v1/cast/content-pillars          each content type's mix: pillars with
 *                                                  shares and an example (services/contentPillars)
 *   PUT    /api/v1/cast/content-pillars          { name, pillars } or { name, pillars: null }
 *                                                  to go back to the default (ADMIN)
 *   POST   /api/v1/cast/content-pillars/suggest  { name }: one AI call; saves nothing (ADMIN)
 *   POST   /api/v1/cast/content-types/apply      { items: [{ profile_id, name, character_id?, gap? }] } (ADMIN)
 *   GET    /api/v1/cast/characters/:id/posts/ideas  what to post about, from their own
 *                                                  story (no AI call), and whether
 *                                                  they can post yet
 *   POST   /api/v1/cast/characters/:id/posts/generate  { count?, about? }: ADMIN; drafts
 *                                                  their Pulse posts for Review, each
 *                                                  load-bearing or ambient (services/characterPosts)
 *   GET    /api/v1/cast/characters/:id/places       their home, closet and other places
 *                                                  (#3228), with each set's picture
 *   POST   /api/v1/cast/characters/:id/places/share { scene_set_id, caption? }: a draft
 *                                                  Pulse post of that place from their
 *                                                  feed profile (services/characterPlaceShare)
 *   POST   /api/v1/cast/characters/:id/places/describe { scene_set_id }: one AI
 *                                                  call that writes the place's description
 *                                                  from their profile; saves nothing
 *                                                  (services/placeDescriptionService)
 *
 * Archived is the registry's soft delete (registry_characters.deleted_at).
 *
 * "An episode uses a character" (episodeUseCounts): the character's feed
 * profile hosts or is a guest of an event tied to the episode, by
 * world_events.used_in_episode_id or the episode brief's event_id. The
 * host is world_events.source_profile_id, else the automation copy's
 * host_profile_id (utils/eventOrganizer); guests are the automation
 * copy's guest_profiles (profile_id, or id on older rows). Episodes reach
 * characters no other way (scene and beat character fields hold names or
 * character_profiles ids).
 *
 * Delete permanently is refused while an episode uses the character, and
 * while it has relationships, growth notes, entanglements, unfollows or
 * crossings: those rows reference it ON DELETE CASCADE and would go with it.
 */

const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getModels() {
  return require('../models');
}

// The rows that go with a character on a hard delete (ON DELETE CASCADE).
const CASCADE_REFS = [
  { table: 'character_relationships', columns: ['character_id_a', 'character_id_b'], label: 'relationships' },
  { table: 'character_growth_log', columns: ['character_id'], label: 'growth notes' },
  { table: 'character_entanglements', columns: ['character_id'], label: 'entanglements' },
  { table: 'entanglement_unfollows', columns: ['character_id'], label: 'unfollows' },
  { table: 'character_crossings', columns: ['character_id'], label: 'crossings' },
];

/** How many live episodes use each of the given characters, by id (0 when none). */
async function episodeUseCounts(sequelize, characterIds, { paranoid = true } = {}) {
  const counts = Object.fromEntries(characterIds.map((id) => [id, 0]));
  if (!characterIds.length) return counts;
  const [rows] = await sequelize.query(`
    WITH ep_events AS (
      SELECT we.used_in_episode_id AS episode_id, we.source_profile_id, we.canon_consequences
        FROM world_events we
       WHERE we.used_in_episode_id IS NOT NULL AND we.deleted_at IS NULL
      UNION ALL
      SELECT eb.episode_id, we.source_profile_id, we.canon_consequences
        FROM episode_briefs eb
        JOIN world_events we ON we.id = eb.event_id AND we.deleted_at IS NULL
       WHERE eb.deleted_at IS NULL AND eb.episode_id IS NOT NULL
    ),
    ep_profiles AS (
      SELECT episode_id,
             COALESCE(source_profile_id,
                      CASE WHEN canon_consequences->'automation'->>'host_profile_id' ~ '^[0-9]+$'
                           THEN (canon_consequences->'automation'->>'host_profile_id')::int END) AS profile_id
        FROM ep_events
      UNION
      SELECT e.episode_id,
             CASE WHEN COALESCE(g->>'profile_id', g->>'id') ~ '^[0-9]+$'
                  THEN COALESCE(g->>'profile_id', g->>'id')::int END
        FROM ep_events e
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(e.canon_consequences->'automation'->'guest_profiles') = 'array'
               THEN e.canon_consequences->'automation'->'guest_profiles' ELSE '[]'::jsonb END) g
    )
    SELECT rc.id, COUNT(DISTINCT ep.episode_id) AS n
      FROM registry_characters rc
      JOIN ep_profiles ep ON ep.profile_id = rc.feed_profile_id
      JOIN episodes e ON e.id = ep.episode_id AND e.deleted_at IS NULL
     WHERE rc.id IN (:ids) ${paranoid ? 'AND rc.deleted_at IS NULL' : ''}
     GROUP BY rc.id`, { replacements: { ids: characterIds } });
  for (const r of rows) counts[r.id] = Number(r.n) || 0;
  return counts;
}

/** The rows a hard delete would take with it, by label (only those with any). */
async function cascadeRows(sequelize, characterId) {
  const found = {};
  for (const ref of CASCADE_REFS) {
    const [[reg]] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${ref.table}` } });
    if (!reg || !reg.reg) continue;
    const where = ref.columns.map((c) => `"${c}" = :id`).join(' OR ');
    const [[row]] = await sequelize.query(`SELECT COUNT(*)::int AS n FROM "${ref.table}" WHERE ${where}`, { replacements: { id: characterId } });
    if (row && row.n > 0) found[ref.label] = row.n;
  }
  return found;
}

router.get('/consistency', requireAuth, async (req, res) => {
  try {
    const ids = String(req.query.registry_id || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length || ids.length > 20 || !ids.every((id) => UUID_RE.test(id))) {
      return res.status(400).json({ success: false, error: 'registry_id must be one or more registry ids (UUIDs), comma-separated' });
    }
    const result = await require('../services/castConsistency').castOverview(getModels(), ids);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Cast] GET /consistency error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/cast/cross-check?registry_id= (the spec's #2; Evoni, 2026-10-17):
// contradictions between characters, flag-only (services/castCrossCheck).
router.get('/cross-check', requireAuth, async (req, res) => {
  try {
    const ids = String(req.query.registry_id || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length || ids.length > 20 || !ids.every((id) => UUID_RE.test(id))) {
      return res.status(400).json({ success: false, error: 'registry_id must be one or more registry ids (UUIDs), comma-separated' });
    }
    const result = await require('../services/castCrossCheck').crossCheck(getModels(), ids);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Cast] GET /cross-check error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/cast/flag-log?registry_id= (the spec's #4; Evoni, 2026-10-17):
// every flag the check has raised, resolved ones too, counted by check, by
// field and by character: where the generators break most (services/flagLog).
router.get('/flag-log', requireAuth, async (req, res) => {
  try {
    const ids = String(req.query.registry_id || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length || ids.length > 20 || !ids.every((id) => UUID_RE.test(id))) {
      return res.status(400).json({ success: false, error: 'registry_id must be one or more registry ids (UUIDs), comma-separated' });
    }
    const result = await require('../services/flagLog').flagLogSummary(getModels(), ids);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Cast] GET /flag-log error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/review', requireAuth, async (req, res) => {
  try {
    const registryId = String(req.query.registry_id || '');
    if (!UUID_RE.test(registryId)) return res.status(400).json({ success: false, error: 'registry_id must be a registry id (UUID)' });
    const { RegistryCharacter, sequelize } = getModels();
    const attributes = ['id', 'display_name', 'character_key', 'role_type', 'feed_profile_id', 'cast_review', 'cast_reviewed_at'];
    const live = await RegistryCharacter.findAll({ where: { registry_id: registryId }, attributes, raw: true });
    const all = await RegistryCharacter.findAll({ where: { registry_id: registryId }, attributes: [...attributes, 'deleted_at'], paranoid: false, raw: true });
    const archived = all.filter((c) => c.deleted_at).sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || '')));
    const episodeCounts = await episodeUseCounts(sequelize, all.map((c) => c.id), { paranoid: false });
    return res.json({
      success: true,
      characters: live,
      archived,
      episode_counts: episodeCounts,
    });
  } catch (err) {
    console.error('[Cast] GET /review error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/characters/:id/keep', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const kept = req.body?.kept;
    if (typeof kept !== 'boolean') return res.status(400).json({ success: false, error: 'kept must be true or false' });
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    await RegistryCharacter.update(
      { cast_review: kept ? 'kept' : null, cast_reviewed_at: kept ? new Date() : null },
      { where: { id: character.id } },
    );
    return res.json({ success: true, id: character.id, cast_review: kept ? 'kept' : null });
  } catch (err) {
    console.error('[Cast] POST /characters/:id/keep error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/characters/:id/feed-profile', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const profileId = Number(req.body?.feed_profile_id);
    if (!Number.isInteger(profileId) || profileId <= 0) return res.status(400).json({ success: false, error: 'feed_profile_id must be a feed profile id' });
    const { RegistryCharacter, SocialProfile } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    const profile = await SocialProfile.findByPk(profileId, { attributes: ['id', 'handle', 'display_name', 'feed_layer'] });
    if (!profile) return res.status(404).json({ success: false, error: 'Feed profile not found' });
    if (profile.feed_layer !== 'lalaverse') return res.status(400).json({ success: false, error: 'Only a LalaVerse feed profile can be matched' });
    // One character per profile (ruling C3): refuse a profile another live character already has.
    const holder = await RegistryCharacter.findOne({ where: { feed_profile_id: profileId }, attributes: ['id', 'display_name'] });
    if (holder && holder.id !== character.id) {
      return res.status(409).json({ success: false, error: `@${profile.handle} is already ${holder.display_name}'s feed profile`, holder_id: holder.id });
    }
    // A matched feed profile is their social presence (the page read it as None).
    await RegistryCharacter.update({ feed_profile_id: profileId, social_presence: true }, { where: { id: character.id } });
    return res.json({ success: true, id: character.id, feed_profile_id: profileId });
  } catch (err) {
    console.error('[Cast] PUT /characters/:id/feed-profile error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/characters/:id/restore', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id, { paranoid: false });
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    if (!character.isSoftDeleted()) return res.json({ success: true, id: character.id, restored: false });
    // One character per profile (ruling C3): not back while another now holds its profile.
    if (character.feed_profile_id != null) {
      const holder = await RegistryCharacter.findOne({ where: { feed_profile_id: character.feed_profile_id }, attributes: ['id', 'display_name'] });
      if (holder) return res.status(409).json({ success: false, error: `Its feed profile is now ${holder.display_name}'s`, holder_id: holder.id });
    }
    await character.restore();
    return res.json({ success: true, id: character.id, restored: true });
  } catch (err) {
    console.error('[Cast] POST /characters/:id/restore error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/characters/:id/permanent', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const { RegistryCharacter, sequelize } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id, { paranoid: false });
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    if (!character.isSoftDeleted()) return res.status(409).json({ success: false, error: 'Archive the character first' });
    const episodes = (await episodeUseCounts(sequelize, [character.id], { paranoid: false }))[character.id] || 0;
    if (episodes > 0) {
      return res.status(409).json({ success: false, error: `${character.display_name} is used by ${episodes} episode${episodes === 1 ? '' : 's'}`, episodes });
    }
    const linked = await cascadeRows(sequelize, character.id);
    if (Object.keys(linked).length) {
      const what = Object.entries(linked).map(([label, n]) => `${n} ${label}`).join(', ');
      return res.status(409).json({ success: false, error: `${character.display_name} still has ${what}, which would be deleted too`, linked });
    }
    await RegistryCharacter.destroy({ where: { id: character.id }, force: true });
    return res.json({ success: true, id: character.id, deleted: true });
  } catch (err) {
    console.error('[Cast] DELETE /characters/:id/permanent error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Their story trail (services/characterStoryTrail; Evoni, 2026-10-16): their
 * latest Pulse posts, and the short stories and book chapters they are in.
 */
router.get('/characters/:id/story-trail', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const { RegistryCharacter, sequelize } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id, {
      attributes: ['id', 'feed_profile_id', 'display_name', 'selected_name', 'character_key'],
    });
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    const trail = await require('../services/characterStoryTrail').storyTrailOf(sequelize, character);
    return res.json({ success: true, ...trail });
  } catch (err) {
    console.error('[Cast] GET /characters/:id/story-trail error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** The character and its feed profile, for the facts routes; null when missing. */
async function characterWithFeed(db, id) {
  const character = await db.RegistryCharacter.findByPk(id);
  if (!character) return null;
  const feedProfile = character.feed_profile_id && db.SocialProfile ? await db.SocialProfile.findByPk(character.feed_profile_id) : null;
  return { character, feedProfile };
}

/**
 * Their facts (Character Consistency Engine step 2; services/characterFacts):
 * the hard, checkable values, each from the one place it lives.
 */
router.get('/characters/:id/facts', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const db = getModels();
    const found = await characterWithFeed(db, req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'Character not found' });
    const facts = await require('../services/characterFacts').factsOf(db, found);
    return res.json({ success: true, facts });
  } catch (err) {
    console.error('[Cast] GET /characters/:id/facts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/characters/:id/facts', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const db = getModels();
    const found = await characterWithFeed(db, req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'Character not found' });
    const { setFacts, FactsError } = require('../services/characterFacts');
    try {
      const facts = await setFacts(db, { ...found, body: req.body || {}, by: String(req.user?.email || req.user?.id || 'admin').slice(0, 255) });
      return res.json({ success: true, facts });
    } catch (err) {
      if (err instanceof FactsError) return res.status(err.status).json({ success: false, error: err.message });
      throw err;
    }
  } catch (err) {
    console.error('[Cast] PUT /characters/:id/facts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Suggest facts from their profile (Evoni, 2026-10-17: "why aren't these
 * filled out when I auto generate profiles?"): a proposal for the missing
 * facts only; the fact sheet opens with it, and she saves or changes it.
 */
// GET /api/v1/cast/characters/:id/facts/history (the spec's #1; Evoni,
// 2026-10-17): when and why each fact changed, with the follower ledger,
// newest first (services/factHistory).
router.get('/characters/:id/facts/history', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const db = getModels();
    const found = await characterWithFeed(db, req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'Character not found' });
    const history = await require('../services/factHistory').factHistory(db, found);
    return res.json({ success: true, history });
  } catch (err) {
    console.error('[Cast] GET /characters/:id/facts/history error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/cast/characters/:id/pressure-test (the spec's #6; Evoni,
// 2026-10-17): hard questions answered from their own character file.
router.post('/characters/:id/pressure-test', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const db = getModels();
    const found = await characterWithFeed(db, req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'Character not found' });
    const { pressureTest, PressureError } = require('../services/characterPressure');
    try {
      return res.json({ success: true, ...(await pressureTest(db, found)) });
    } catch (err) {
      if (err instanceof PressureError) return res.status(err.status).json({ success: false, error: err.message });
      throw err;
    }
  } catch (err) {
    console.error('[Cast] POST /characters/:id/pressure-test error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/characters/:id/facts/suggest', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const db = getModels();
    const found = await characterWithFeed(db, req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'Character not found' });
    const { FactsError } = require('../services/characterFacts');
    try {
      return res.json({ success: true, ...(await require('../services/factsSuggest').suggestFacts(db, found)) });
    } catch (err) {
      if (err instanceof FactsError) return res.status(err.status).json({ success: false, error: err.message });
      throw err;
    }
  } catch (err) {
    console.error('[Cast] POST /characters/:id/facts/suggest error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * The consistency check (Character Consistency Engine step 3): every place
 * the narrator's text disagrees with their facts. Flag-only; it never edits.
 * What they post (the mask) and author-only notes are not checked.
 */
router.get('/characters/:id/check', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const db = getModels();
    const found = await characterWithFeed(db, req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'Character not found' });
    const result = await require('../services/characterConsistency').checkCharacter(db, found);
    await require('../services/flagLog').logCheck(db, found.character, result);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Cast] GET /characters/:id/check error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** Marks a flag intentional (the spec's #10), or unmarks it; the flag stays listed as intentional. */
async function markIntentional(req, res, on) {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const db = getModels();
    const character = await db.RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    const { withIntentional } = require('../services/characterConsistency');
    const id = on ? req.body?.flag_id : req.params.flagId;
    let next;
    try {
      next = withIntentional(character.canon_facts, id, { note: req.body?.note, on });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
      throw err;
    }
    await character.update({ canon_facts: next });
    await require('../services/flagLog').markIntentional(db, character.id, id, on);
    return res.json({ success: true, intentional: next.intentional });
  } catch (err) {
    console.error(`[Cast] ${on ? 'POST' : 'DELETE'} /characters/:id/check/intentional error:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
router.post('/characters/:id/check/intentional', requireAuth, authorize(['ADMIN']), (req, res) => markIntentional(req, res, true));

/**
 * Fixes one finding (Evoni, 2026-10-16: "I have no way of correcting these
 * findings"): { flag_id } puts the suggested fix in place, { flag_id, text }
 * saves her own wording as the field's whole text. Returns the check after.
 */
router.post('/characters/:id/check/fix', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const flagId = req.body?.flag_id;
    if (!/^[0-9a-f]{12}$/.test(String(flagId))) return res.status(400).json({ success: false, error: 'flag_id must be a flag id.' });
    const db = getModels();
    const found = await characterWithFeed(db, req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'Character not found' });
    const { applyFix, FixError } = require('../services/characterConsistency');
    try {
      const text = req.body && 'text' in req.body ? req.body.text : undefined;
      const result = await applyFix(db, found, flagId, { text });
      const flagLog = require('../services/flagLog');
      await flagLog.markFixed(db, found.character.id, flagId);
      await flagLog.logCheck(db, found.character, result);
      return res.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof FixError) return res.status(err.status).json({ success: false, error: err.message });
      throw err;
    }
  } catch (err) {
    console.error('[Cast] POST /characters/:id/check/fix error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
router.delete('/characters/:id/check/intentional/:flagId', requireAuth, authorize(['ADMIN']), (req, res) => markIntentional(req, res, false));

/**
 * Their typology seed (Character Consistency Engine step 6a;
 * services/characterTypology): the root their inner life grows from.
 */
const typologyOut = (typology) => {
  const { typologyLabel } = require('../services/characterTypology');
  return { typology: typology || null, label: typologyLabel(typology) || null };
};

router.get('/characters/:id/typology', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const character = await getModels().RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    return res.json({ success: true, ...typologyOut(character.typology) });
  } catch (err) {
    console.error('[Cast] GET /characters/:id/typology error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/characters/:id/typology', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const character = await getModels().RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    const { normalizeTypology, TypologyError } = require('../services/characterTypology');
    let next = null;
    if (!req.body?.clear) {
      try {
        next = normalizeTypology(req.body || {}, { by: String(req.user?.email || req.user?.id || 'admin').slice(0, 255) });
      } catch (err) {
        if (err instanceof TypologyError) return res.status(err.status).json({ success: false, error: err.message });
        throw err;
      }
    }
    await character.update({ typology: next });
    return res.json({ success: true, ...typologyOut(next) });
  } catch (err) {
    console.error('[Cast] PUT /characters/:id/typology error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/characters/:id/typology/suggest', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const db = getModels();
    const character = await db.RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    const { suggestTypology, TypologyError } = require('../services/characterTypology');
    const { factsForCharacter, factsPromptBlock } = require('../services/characterFacts');
    try {
      const suggestion = await suggestTypology(character, { factsBlock: factsPromptBlock(await factsForCharacter(db, character)) });
      return res.json({ success: true, suggestion, ...typologyOut(suggestion) });
    } catch (err) {
      if (err instanceof TypologyError) return res.status(err.status).json({ success: false, error: err.message });
      throw err;
    }
  } catch (err) {
    console.error('[Cast] POST /characters/:id/typology/suggest error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * What they are known for on The Pulse (services/characterContentType):
 * their content type, one of the Society tab's archetypes, kept on their
 * feed profile. Not their job: the two can differ (Evoni, 2026-10-17).
 */
const contentTypeError = (res, err) => {
  const { ContentTypeError } = require('../services/characterContentType');
  if (err instanceof ContentTypeError) { res.status(err.status).json({ success: false, error: err.message }); return true; }
  return false;
};

router.get('/characters/:id/content-type', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const db = getModels();
    const found = await characterWithFeed(db, req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'Character not found' });
    return res.json({ success: true, ...(await require('../services/characterContentType').contentTypeOf(db, found)) });
  } catch (err) {
    console.error('[Cast] GET /characters/:id/content-type error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/characters/:id/content-type', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const db = getModels();
    const found = await characterWithFeed(db, req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'Character not found' });
    const { setContentType, contentTypeOf } = require('../services/characterContentType');
    try {
      const body = req.body || {};
      await setContentType(db, {
        ...found,
        name: 'name' in body ? body.name : undefined,
        gap: 'gap' in body ? body.gap : undefined,
      });
    } catch (err) {
      if (contentTypeError(res, err)) return undefined;
      throw err;
    }
    return res.json({ success: true, ...(await contentTypeOf(db, found)) });
  } catch (err) {
    console.error('[Cast] PUT /characters/:id/content-type error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/characters/:id/content-type/suggest', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const db = getModels();
    const found = await characterWithFeed(db, req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'Character not found' });
    try {
      const { suggestion } = await require('../services/characterContentType').suggestContentType(db, found);
      return res.json({ success: true, suggestion });
    } catch (err) {
      if (contentTypeError(res, err)) return undefined;
      throw err;
    }
  } catch (err) {
    console.error('[Cast] POST /characters/:id/content-type/suggest error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// The Society tab's batch: suggestions for LalaVerse feed profiles with no
// content type yet. Nothing is saved until Evoni applies the ones she keeps.
router.post('/content-types/suggest-unset', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const result = await require('../services/characterContentType').suggestForUnset(getModels(), { limit: req.body?.limit, profileIds: req.body?.profile_ids });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Cast] POST /content-types/suggest-unset error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// The content mix (services/contentPillars; Evoni's idea 3, 2026-10-17):
// each content type's pillars, their shares and an example.
const pillarsError = (res, err) => {
  const { PillarsError } = require('../services/contentPillars');
  if (err instanceof PillarsError) { res.status(err.status).json({ success: false, error: err.message }); return true; }
  return false;
};

router.get('/content-pillars', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, types: await require('../services/contentPillars').listPillars(getModels()) });
  } catch (err) {
    console.error('[Cast] GET /content-pillars error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/content-pillars', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const body = req.body || {};
    try {
      const pillars = await require('../services/contentPillars').savePillars(getModels(), body.name, body.pillars === undefined ? null : body.pillars);
      return res.json({ success: true, name: body.name, pillars });
    } catch (err) {
      if (pillarsError(res, err)) return undefined;
      throw err;
    }
  } catch (err) {
    console.error('[Cast] PUT /content-pillars error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/content-pillars/suggest', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    try {
      return res.json({ success: true, ...(await require('../services/contentPillars').suggestPillars(getModels(), req.body?.name)) });
    } catch (err) {
      if (pillarsError(res, err)) return undefined;
      throw err;
    }
  } catch (err) {
    console.error('[Cast] POST /content-pillars/suggest error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/content-types/apply', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    try {
      return res.json({ success: true, ...(await require('../services/characterContentType').applyContentTypes(getModels(), req.body?.items)) });
    } catch (err) {
      if (contentTypeError(res, err)) return undefined;
      throw err;
    }
  } catch (err) {
    console.error('[Cast] POST /content-types/apply error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Generate Posts (Character Consistency Engine step 4): drafts their Pulse
 * posts from their voice, mask, facts and events. Every draft waits in
 * Review; nothing is released here.
 */
router.get('/characters/:id/posts/ideas', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const { postIdeas, PostsError } = require('../services/characterPosts');
    try {
      return res.json({ success: true, ...(await postIdeas(getModels(), req.params.id)) });
    } catch (err) {
      if (err instanceof PostsError) return res.status(err.status).json({ success: false, error: err.message });
      throw err;
    }
  } catch (err) {
    console.error('[Cast] GET /characters/:id/posts/ideas error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/characters/:id/posts/generate', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const { generatePosts, PostsError } = require('../services/characterPosts');
    const { RequestCapError } = require('../services/pulseRequests');
    try {
      const result = await generatePosts(getModels(), { characterId: req.params.id, count: req.body?.count ?? undefined, about: req.body?.about ?? null });
      return res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err instanceof PostsError) return res.status(err.status).json({ success: false, error: err.message });
      if (err instanceof RequestCapError) {
        console.error('[Cast] Generate posts refused:', err.message);
        return res.status(429).json({ success: false, error: err.message, code: err.code });
      }
      throw err;
    }
  } catch (err) {
    console.error('[Cast] POST /characters/:id/posts/generate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Where a character shows up, through its feed profile: the events it
 * hosts or is a guest of (with their episodes and Lala's goals about it),
 * its home place, and its posts. A character with no feed profile shows up
 * nowhere yet.
 */
router.get('/characters/:id/appearances', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const { RegistryCharacter, sequelize } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id, { attributes: ['id', 'feed_profile_id'] });
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    const profileId = character.feed_profile_id;
    if (profileId == null) return res.json({ success: true, linked: false, events: [], episodes: [], place: null, feed: null });

    // What each event is for comes with it (services/characterEvents).
    const events = await require('../services/characterEvents').eventsForProfile(sequelize, profileId);

    const [[profile]] = await sequelize.query(
      'SELECT id, home_location_id, lala_relationship FROM social_profiles WHERE id = :pid',
      { replacements: { pid: profileId } });
    let place = null;
    if (profile && profile.home_location_id) {
      const [[loc]] = await sequelize.query(`
        SELECT wl.id, wl.name,
               (SELECT COUNT(*)::int FROM social_profiles sp WHERE sp.home_location_id = wl.id) AS residents,
               (SELECT COUNT(*)::int FROM scene_sets ss WHERE ss.world_location_id = wl.id AND ss.deleted_at IS NULL) AS scene_sets
          FROM world_locations wl WHERE wl.id = :loc`, { replacements: { loc: profile.home_location_id } });
      place = loc || null;
    }
    const [[posts]] = await sequelize.query(
      'SELECT COUNT(*)::int AS n FROM feed_posts WHERE social_profile_id = :pid AND deleted_at IS NULL',
      { replacements: { pid: profileId } });

    const episodes = [];
    const seen = new Set();
    for (const ev of events) {
      if (ev.episode_id && !seen.has(ev.episode_id)) {
        seen.add(ev.episode_id);
        episodes.push({ id: ev.episode_id, episode_number: ev.episode_number, title: ev.episode_title });
      }
    }
    return res.json({
      success: true,
      linked: true,
      events: events.map((ev) => ({
        id: ev.id, show_id: ev.show_id, name: ev.name, role: ev.role, event_date: ev.event_date, event_time: ev.event_time,
        venue_name: ev.venue_name, venue_location_id: ev.venue_location_id,
        is_paid: Boolean(ev.is_paid), payment_amount: ev.payment_amount,
        event_type: ev.event_type || null, description: ev.description || null, theme: ev.theme || null,
        dress_code: ev.dress_code || null, stakes: ev.narrative_stakes || null, host_brand: ev.host_brand || null,
        goals: Array.isArray(ev.goals) ? ev.goals.filter((g) => g && g.label).map((g) => ({ slot: g.slot || null, label: g.label })) : [],
        episode: ev.episode_id ? { id: ev.episode_id, episode_number: ev.episode_number, title: ev.episode_title } : null,
        // Its scene set, for its photos and angles on the Places tab (2026-10-17).
        scene_set_id: ev.scene_set_id || null, scene_set_name: ev.scene_set_name || null, scene_set_version_of: ev.scene_set_version_of || null,
      })),
      episodes,
      place,
      feed: { posts: posts ? posts.n : 0, lala_relationship: profile ? profile.lala_relationship : null },
    });
  } catch (err) {
    console.error('[Cast] GET /characters/:id/appearances error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// A place error is its own status and message; anything else is a 500.
function placeError(res, err, label) {
  const { PlaceShareError, CharacterPlacesError } = require('../services/characterPlaceShare');
  if (err instanceof PlaceShareError || err instanceof CharacterPlacesError) {
    return res.status(err.status).json({ success: false, code: err.code, error: err.message });
  }
  console.error(`[cast] ${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

router.get('/characters/:id/places', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const { placesForCharacter } = require('../services/characterPlaceShare');
    return res.json({ success: true, ...(await placesForCharacter(getModels().sequelize, req.params.id)) });
  } catch (err) {
    return placeError(res, err, 'GET characters/:id/places');
  }
});

router.post('/characters/:id/places/share', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const sceneSetId = req.body?.scene_set_id;
    if (!UUID_RE.test(String(sceneSetId || ''))) return res.status(400).json({ success: false, error: 'scene_set_id must be a scene set id (UUID)' });
    const { sharePlace } = require('../services/characterPlaceShare');
    const { post } = await sharePlace(getModels(), { characterId: req.params.id, sceneSetId, caption: req.body?.caption });
    return res.status(201).json({ success: true, post });
  } catch (err) {
    return placeError(res, err, 'POST characters/:id/places/share');
  }
});

// A place's description written from their profile (Evoni, 2026-10-17):
// nothing is saved; placeDescriptionService holds what it reads.
router.post('/characters/:id/places/describe', requireAuth, aiRateLimiter, async (req, res) => {
  const { describePlace, PlaceDescriptionError } = require('../services/placeDescriptionService');
  try {
    const data = await describePlace(getModels(), { characterId: req.params.id, sceneSetId: req.body?.scene_set_id });
    return res.json({ success: true, data });
  } catch (err) {
    if (err instanceof PlaceDescriptionError) return res.status(err.status).json({ success: false, code: err.code, error: err.message });
    console.error('[cast] POST characters/:id/places/describe error:', err);
    if (err?.code === 'AI_BUDGET_EXCEEDED') return res.status(429).json({ success: false, code: err.code, error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// The events a character hosts, chosen on their Places tab (Evoni,
// 2026-10-17); characterHostedEvents holds the rules.
const hostedError = (res, err, label) => {
  const { HostedEventError } = require('../services/characterHostedEvents');
  if (err instanceof HostedEventError) return res.status(err.status).json({ success: false, code: err.code, error: err.message });
  console.error(`[cast] ${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
};

router.post('/characters/:id/hosted-events', requireAuth, async (req, res) => {
  try {
    const { hostEvent } = require('../services/characterHostedEvents');
    return res.json({ success: true, data: await hostEvent(getModels().sequelize, { characterId: req.params.id, eventId: req.body?.event_id }) });
  } catch (err) {
    return hostedError(res, err, 'POST characters/:id/hosted-events');
  }
});

router.delete('/characters/:id/hosted-events/:eventId', requireAuth, async (req, res) => {
  try {
    const { unhostEvent } = require('../services/characterHostedEvents');
    return res.json({ success: true, data: await unhostEvent(getModels().sequelize, { characterId: req.params.id, eventId: req.params.eventId }) });
  } catch (err) {
    return hostedError(res, err, 'DELETE characters/:id/hosted-events/:eventId');
  }
});

module.exports = router;
module.exports.episodeUseCounts = episodeUseCounts;
module.exports.cascadeRows = cascadeRows;
