'use strict';

/**
 * Where a scene set is used, and moving those uses to another set (Evoni's
 * D1 and D2, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)). Her beats
 * pointed at two sets she had deleted after making new ones:
 *
 *   D1. "Deleting a scene set that episodes, beats or locations use asks for
 *   a replacement set and moves every use (episode locations, plan beats,
 *   event scene_set_id, defaults) to it; deleting without a replacement
 *   shows how many uses will be left pointing at a removed set."
 *   D2. "A scene set created while working in a show gets that show's
 *   show_id ... Also give me a one-click 'Move my beats to…' for an episode
 *   whose beats point at removed sets (choose replacements per removed set)."
 *
 * A set's uses: episode locations (scene_set_episodes), plan beats
 * (scene_plans), events (world_events.scene_set_id), show defaults
 * (shows.metadata.scene_defaults home/closet) and the beats' scene rows
 * (scenes, L12a). Not moved: the set's own angles, looks and an approved
 * base (world_locations.approved_base_scene_set_id); they are images of
 * that set.
 */

const DEFAULT_KEYS = ['home_set_id', 'closet_set_id'];

class SceneSetUsesError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const n = (rows) => Number(rows?.[0]?.n || 0);

/** Live uses of a set, counted; scoped to one episode when episodeId is given. */
async function countUses(sequelize, setId, { episodeId = null, transaction } = {}) {
  const r = { setId, episodeId };
  const ep = episodeId ? ' AND episode_id = :episodeId' : '';
  const q = async (sql) => n((await sequelize.query(sql, { replacements: r, transaction }))[0]);
  const locations = await q(`SELECT COUNT(*) n FROM scene_set_episodes WHERE scene_set_id = :setId AND deleted_at IS NULL${ep}`);
  const beats = await q(`SELECT COUNT(*) n FROM scene_plans WHERE scene_set_id = :setId AND deleted_at IS NULL${ep}`);
  const events = await q(`SELECT COUNT(*) n FROM world_events WHERE scene_set_id = :setId AND deleted_at IS NULL${episodeId ? ' AND used_in_episode_id = :episodeId' : ''}`);
  const scenes = await q(`SELECT COUNT(*) n FROM scenes WHERE scene_set_id = :setId AND deleted_at IS NULL${ep}`);
  const defaults = episodeId ? 0 : await q(
    `SELECT COUNT(*) n FROM shows s, jsonb_each_text(COALESCE(s.metadata::jsonb->'scene_defaults', '{}'::jsonb)) d
      WHERE d.key IN ('home_set_id', 'closet_set_id') AND d.value = CAST(:setId AS text)`);
  return { locations, beats, events, defaults, scenes, total: locations + beats + events + defaults + scenes };
}

async function liveSet(sequelize, id, transaction) {
  const [rows] = await sequelize.query('SELECT id, name, show_id FROM scene_sets WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id }, transaction });
  return rows[0] || null;
}

/**
 * Move a set's uses to another live set; scoped to one episode when
 * episodeId is given (then the show defaults stay). An episode already
 * linked to the replacement keeps that link, with the more specific of the
 * two roles, and the old one is removed. Returns the counts moved.
 */
async function moveUses(sequelize, fromId, toId, { episodeId = null, transaction } = {}) {
  if (!toId || toId === fromId) throw new SceneSetUsesError('Choose a different scene set as the replacement');
  if (!(await liveSet(sequelize, toId, transaction))) throw new SceneSetUsesError('The replacement scene set was not found, or it has been removed', 400, 'BAD_REPLACEMENT');
  const r = { fromId, toId, episodeId };
  const ep = episodeId ? ' AND episode_id = :episodeId' : '';
  const exec = async (sql) => {
    const [, meta] = await sequelize.query(sql, { replacements: r, transaction });
    return typeof meta?.rowCount === 'number' ? meta.rowCount : 0;
  };
  // An episode has one live location per set (scene_set_episodes_unique_pair,
  // the only unique index here that holds scene_set_id). Where it already
  // has the replacement, the two links are merged rather than the old one
  // moved onto it, which duplicated the pair (the "Move my beats" 500,
  // Evoni, 2026-10-02): the existing link is kept, with the more specific
  // role (a named role over an extra, an extra over none; between two named
  // roles, its own), an extra's name going with its role; the old link is
  // removed.
  const oldEp = ep.replace('episode_id', 'old.episode_id');
  const rank = (t) => `(CASE WHEN ${t}.role IN ('home', 'closet', 'event') THEN 2 WHEN ${t}.role = 'extra' THEN 1 ELSE 0 END)`;
  await exec(`UPDATE scene_set_episodes keep
                 SET role = CASE WHEN ${rank('old')} > ${rank('keep')} THEN old.role ELSE keep.role END,
                     role_name = CASE WHEN ${rank('old')} > ${rank('keep')} THEN old.role_name
                                      WHEN keep.role IS NOT DISTINCT FROM old.role THEN COALESCE(keep.role_name, old.role_name)
                                      ELSE keep.role_name END,
                     updated_at = NOW()
                FROM scene_set_episodes old
               WHERE keep.scene_set_id = :toId AND keep.deleted_at IS NULL
                 AND old.scene_set_id = :fromId AND old.deleted_at IS NULL
                 AND old.episode_id = keep.episode_id${oldEp}`);
  await exec(`UPDATE scene_set_episodes old SET deleted_at = NOW(), updated_at = NOW()
               WHERE old.scene_set_id = :fromId AND old.deleted_at IS NULL${oldEp}
                 AND EXISTS (SELECT 1 FROM scene_set_episodes keep
                              WHERE keep.scene_set_id = :toId AND keep.episode_id = old.episode_id AND keep.deleted_at IS NULL)`);
  const locations = await exec(`UPDATE scene_set_episodes SET scene_set_id = :toId, updated_at = NOW() WHERE scene_set_id = :fromId AND deleted_at IS NULL${ep}`);
  const beats = await exec(`UPDATE scene_plans SET scene_set_id = :toId, updated_at = NOW() WHERE scene_set_id = :fromId AND deleted_at IS NULL${ep}`);
  const events = await exec(`UPDATE world_events SET scene_set_id = :toId, updated_at = NOW() WHERE scene_set_id = :fromId AND deleted_at IS NULL${episodeId ? ' AND used_in_episode_id = :episodeId' : ''}`);
  const scenes = await exec(`UPDATE scenes SET scene_set_id = :toId, updated_at = NOW() WHERE scene_set_id = :fromId AND deleted_at IS NULL${ep}`);
  let defaults = 0;
  if (!episodeId) {
    for (const key of DEFAULT_KEYS) {
      // shows.metadata is json, not jsonb.
      defaults += await exec(`UPDATE shows SET metadata = jsonb_set(metadata::jsonb, '{scene_defaults,${key}}', to_jsonb(CAST(:toId AS text)))::json, updated_at = NOW()
                               WHERE metadata::jsonb->'scene_defaults'->>'${key}' = CAST(:fromId AS text)`);
    }
  }
  return { locations, beats, events, defaults, scenes };
}

/**
 * D2: the show a new set belongs to: the one given, else a linked
 * episode's, else its universe's when that universe has exactly one show;
 * null otherwise.
 */
async function resolveSetShowId(sequelize, { show_id: showId, episode_ids: episodeIds, universe_id: universeId } = {}, { transaction } = {}) {
  if (showId) return showId;
  const firstEpisode = Array.isArray(episodeIds) ? episodeIds.find(Boolean) : null;
  if (firstEpisode) {
    const [rows] = await sequelize.query('SELECT show_id FROM episodes WHERE id = :id AND deleted_at IS NULL', { replacements: { id: firstEpisode }, transaction });
    if (rows[0]?.show_id) return rows[0].show_id;
  }
  if (universeId) {
    const [rows] = await sequelize.query('SELECT id FROM shows WHERE universe_id = :universeId AND deleted_at IS NULL LIMIT 2', { replacements: { universeId }, transaction });
    if (rows.length === 1) return rows[0].id;
  }
  return null;
}

/** D2: the removed sets an episode's beats, locations, scenes or event still use, with the beats at each. */
async function removedSetsForEpisode(sequelize, episodeId) {
  const [rows] = await sequelize.query(
    `SELECT s.id, s.name, s.deleted_at,
            COALESCE((SELECT json_agg(p.beat_number ORDER BY p.beat_number) FROM scene_plans p
                       WHERE p.episode_id = :episodeId AND p.scene_set_id = s.id AND p.deleted_at IS NULL), '[]') AS beats
       FROM scene_sets s
      WHERE s.deleted_at IS NOT NULL
        AND s.id IN (SELECT scene_set_id FROM scene_plans WHERE episode_id = :episodeId AND deleted_at IS NULL
                     UNION SELECT scene_set_id FROM scene_set_episodes WHERE episode_id = :episodeId AND deleted_at IS NULL
                     UNION SELECT scene_set_id FROM scenes WHERE episode_id = :episodeId AND deleted_at IS NULL AND scene_set_id IS NOT NULL
                     UNION SELECT scene_set_id FROM world_events WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL AND scene_set_id IS NOT NULL)
      ORDER BY s.name`,
    { replacements: { episodeId } });
  return rows.map((r) => ({ scene_set_id: r.id, name: r.name, deleted_at: r.deleted_at, beats: (typeof r.beats === 'string' ? JSON.parse(r.beats) : r.beats) || [] }));
}

/** D2: move an episode's uses of removed sets, each to its chosen live replacement, in one transaction. */
async function moveRemovedSetsForEpisode(sequelize, episodeId, moves) {
  if (!Array.isArray(moves) || !moves.length) throw new SceneSetUsesError('moves must be a non-empty list of { from, to }');
  const removed = new Set((await removedSetsForEpisode(sequelize, episodeId)).map((s) => s.scene_set_id));
  for (const m of moves) {
    if (!m || !removed.has(m.from)) throw new SceneSetUsesError('Each "from" must be a removed scene set this episode uses');
  }
  return sequelize.transaction(async (transaction) => {
    const out = [];
    for (const m of moves) out.push({ from: m.from, to: m.to, moved: await moveUses(sequelize, m.from, m.to, { episodeId, transaction }) });
    return out;
  });
}

module.exports = {
  SceneSetUsesError,
  countUses,
  moveUses,
  resolveSetShowId,
  removedSetsForEpisode,
  moveRemovedSetsForEpisode,
};
