'use strict';

/**
 * The cast's review of the old system (the Characters page, Evoni's mock,
 * 2026-10-08; frontend pages/CharacterRegistryPage). Its own file, not
 * routes/characterRegistry.js (F-Reg-2): each write here is one row.
 *
 *   GET    /api/v1/cast/review?registry_id=        live characters' review state and
 *                                                  feed link, the archived ones, and
 *                                                  how many episodes use each
 *   POST   /api/v1/cast/characters/:id/keep         { kept: true|false }
 *   PUT    /api/v1/cast/characters/:id/feed-profile { feed_profile_id }: Match to feed person
 *   POST   /api/v1/cast/characters/:id/restore      bring an archived character back
 *   DELETE /api/v1/cast/characters/:id/permanent    delete an archived one for good
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
const { requireAuth } = require('../middleware/auth');

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
    await RegistryCharacter.update({ feed_profile_id: profileId }, { where: { id: character.id } });
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

module.exports = router;
module.exports.episodeUseCounts = episodeUseCounts;
module.exports.cascadeRows = cascadeRows;
