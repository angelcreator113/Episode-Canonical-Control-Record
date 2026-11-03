/**
 * The episode's existing scene work as the editor sees it (Prepare From
 * Existing Work, phase B1; docs/reads/2026-11-03-editor-sources-and-prepare-from-existing-work.md).
 * Reads only: it writes nothing and names no edit table.
 *
 * For each live scene-plan row (`scene_plans`: the beat's set and angle the
 * producer or the planner chose) it says which angle the beat uses, by the
 * planner's own rule (planLocationsService.rowAngleStatus: the row's angle
 * label, else the angle of the kinds its beat asks for), and whether the
 * editor can place it. It does not call planWithAngles, whose look reads can
 * write (dressedAngleService.lookAngles settles stale generations): this read
 * writes nothing. Dressed looks are therefore not shown; the editor places
 * the plain angle anyway.
 *
 *   ready        the angle is in a set linked to the episode and has a still or a video
 *   not_linked   the set is chosen in the plan but not linked to the episode,
 *                so the editor (which places only linked angles) can't use it
 *   no_set       the beat has no set chosen
 *   set_removed  the chosen set was deleted
 *   missing      the plan names an angle the set doesn't have, or one with no image yet
 *   set_picture  the beat uses the set's own picture (no angle), which is not a clip
 *   unread       the angles could not be read (the answer also carries `error`)
 *
 * The plan's own order (beat, then sort_order) is kept. Nothing is placed here.
 */
'use strict';

const STATUS_TEXT = {
  ready: 'Ready to place',
  not_linked: "This set isn't linked to the episode, so the editor can't place it. Link it on the episode's Overview.",
  no_set: 'No set chosen for this beat in the scene plan.',
  set_removed: 'The set chosen for this beat was deleted.',
  missing: null, // the planner's own words (location.missing.text)
  set_picture: "The plan uses the set's main picture here, not an angle, so there is no clip to place.",
  unread: 'The angle chosen for this beat could not be read. Reload to try again.',
};

const notFound = () => {
  const { EditError } = require('./episodeEditService');
  return new EditError(404, 'NOT_FOUND', 'Episode not found');
};

async function rows(sequelize, sql, replacements) {
  const [out] = await sequelize.query(sql, { replacements });
  return out;
}

/**
 * GET /episodes/:id/edit/sources → { plan: [...], summary }.
 * Each plan item: { id, beat_number, sort_order, beat_name, chosen_by_user, locked,
 *   scene_set: { id, name } | null, angle_label, angle: { id, label, name, still_image_url,
 *   video_clip_url } | null, status, text, place: { still, video } | null }.
 */
async function existingWork(sequelize, { episodeId }) {
  if (!/^[0-9a-f-]{36}$/i.test(String(episodeId || ''))) {
    throw notFound();
  }
  const [ep] = await rows(sequelize, 'SELECT id, deleted_at FROM episodes WHERE id = :episodeId', { episodeId });
  if (!ep || ep.deleted_at) throw notFound();

  const planRows = await rows(sequelize, `SELECT id, episode_id, beat_number, beat_name, scene_set_id, angle_label,
      locked, chosen_by_user, sort_order
    FROM scene_plans WHERE episode_id = :episodeId AND deleted_at IS NULL
    ORDER BY beat_number ASC, sort_order ASC, created_at ASC`, { episodeId });
  const linked = new Set((await rows(sequelize, `SELECT scene_set_id FROM scene_set_episodes
    WHERE episode_id = :episodeId AND deleted_at IS NULL`, { episodeId })).map((r) => r.scene_set_id));

  let located = planRows.map((r) => ({ ...r, location: null, sceneSet: null }));
  let locateError = null;
  if (planRows.length) {
    try {
      const { loadSetAngles, rowAngleStatus } = require('./planLocationsService');
      const setIds = [...new Set(planRows.map((r) => r.scene_set_id).filter(Boolean))];
      const anglesBySet = await loadSetAngles(sequelize, setIds);
      const sets = new Map(setIds.length ? (await rows(sequelize, 'SELECT id, name, deleted_at FROM scene_sets WHERE id IN (:setIds)', { setIds }))
        .map((x) => [x.id, x]) : []);
      located = planRows.map((r) => {
        const set = r.scene_set_id ? sets.get(r.scene_set_id) || null : null;
        return { ...r, location: rowAngleStatus(r, anglesBySet, null), sceneSet: set ? { id: set.id, name: set.name, removed: Boolean(set.deleted_at) } : null };
      });
    } catch (err) {
      console.error('[editSources] reading the plan angles failed:', err.message);
      locateError = 'The angles of the scene plan could not be read.';
    }
  }
  const angleIds = [...new Set(located.map((r) => r.location?.angle?.id).filter(Boolean))];
  const media = new Map(angleIds.length ? (await rows(sequelize, `SELECT id, still_image_url, video_clip_url, deleted_at
    FROM scene_angles WHERE id IN (:angleIds)`, { angleIds })).map((a) => [a.id, a]) : []);

  const plan = located.map((r) => {
    const loc = r.location || {};
    const set = r.sceneSet ? { id: r.sceneSet.id, name: r.sceneSet.name || null } : null;
    const a = loc.angle ? media.get(loc.angle.id) : null;
    const angle = loc.angle ? {
      id: loc.angle.id, label: loc.angle.label || null, name: loc.angle.name || null,
      // The angle's own still (what the editor places), not a dressed look's picture.
      still_image_url: a && !a.deleted_at ? a.still_image_url || null : null,
      video_clip_url: a && !a.deleted_at ? a.video_clip_url || null : null,
    } : null;
    let status;
    if (!r.scene_set_id) status = 'no_set';
    else if (!r.location) status = 'unread';
    else if (!set || r.sceneSet?.removed) status = 'set_removed';
    else if (loc.missing) status = 'missing';
    else if (!angle) status = 'set_picture';
    else if (!angle.still_image_url && !angle.video_clip_url) status = 'missing';
    else if (!linked.has(r.scene_set_id)) status = 'not_linked';
    else status = 'ready';
    const text = status === 'missing' ? (loc.missing?.text || 'This angle has no image or video yet.') : STATUS_TEXT[status];
    return {
      id: r.id, beat_number: r.beat_number, sort_order: r.sort_order, beat_name: r.beat_name || null,
      chosen_by_user: Boolean(r.chosen_by_user), locked: Boolean(r.locked),
      scene_set: set, linked: Boolean(r.scene_set_id && linked.has(r.scene_set_id)),
      angle_label: r.angle_label || null, angle, status, text,
      place: status === 'ready' ? { still: Boolean(angle.still_image_url), video: Boolean(angle.video_clip_url) } : null,
    };
  });

  const count = (s) => plan.filter((p) => p.status === s).length;
  return {
    plan,
    summary: {
      plan_rows: plan.length,
      beats_planned: new Set(plan.map((p) => p.beat_number)).size,
      ready: count('ready'),
      not_linked: count('not_linked'),
      missing: count('missing'),
      no_set: count('no_set'),
      set_removed: count('set_removed'),
      set_picture: count('set_picture'),
    },
    ...(locateError ? { error: locateError } : {}),
  };
}

module.exports = { existingWork, STATUS_TEXT };
