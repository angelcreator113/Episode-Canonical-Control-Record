/**
 * Each beat's scene row (Evoni's ruling L12 and answer L12a, 2026-10-02;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)):
 *
 *   L12. "A beat with a chosen angle is that beat's scene for the timeline:
 *   no separate 'Use in Episode' step and no separate Episode Scenes list."
 *   L12a. "every beat with a set and angle gets its scene row automatically
 *   (scene_plan_id link, background = the beat's angle image, the dressed
 *   one after L10, scene number from the beat's position, default 5s),
 *   created or updated whenever the beat changes."
 *
 * A beat "with a set and angle" is a plan row with a set: its angle is the
 * one planWithAngles resolves, and a beat that asks for no angle is shot on
 * its set's base image (Q21), so it gets a scene too. Its background is the
 * angle's image (the dressed one at the look's set, L10); a beat that asks
 * for no angle uses the event's look on its set, else the set's base image;
 * an angle with no image yet leaves the background empty until it has one.
 *
 * syncBeatScenes runs where the beats are read or changed (the plan, the
 * scenes list the Timeline and the Scenes tab load, a beat's save, export),
 * so a finished image reaches its scene the next time either is opened.
 * The Timeline's own edits (duration, characters, overlays, dialogue) are
 * kept; the sync writes only the background, set, angle and scene number.
 * A re-plan replaces plan rows: a tied scene whose row is gone moves to the
 * new row of its beat (its scene number is its beat number), so its
 * Timeline edits survive. A scene whose beat has no set, or no longer
 * exists, is soft-deleted.
 */

const { planWithAngles } = require('./planLocationsService');

/** The beat's background: its angle's image; no angle asked: the look, else the set's base. */
function beatBackground(row) {
  const loc = row.location || {};
  if (loc.angle) return loc.angle.still_image_url || null;
  if (loc.missing) return null;
  return loc.look?.image_url || row.set_base_still_url || null;
}

async function syncBeatScenes(sequelize, episodeId) {
  if (!episodeId) return { created: 0, updated: 0, removed: 0 };
  const [plans] = await sequelize.query(
    `SELECT p.id, p.episode_id, p.beat_number, p.beat_name, p.scene_set_id, p.angle_label,
            s.name AS set_name, s.base_still_url AS set_base_still_url
       FROM scene_plans p
       LEFT JOIN scene_sets s ON s.id = p.scene_set_id AND s.deleted_at IS NULL
      WHERE p.episode_id = :episodeId AND p.deleted_at IS NULL
      ORDER BY p.beat_number ASC`,
    { replacements: { episodeId } });
  const beats = await planWithAngles(sequelize, plans);
  const [tied] = await sequelize.query(
    `SELECT id, scene_plan_id, scene_number, background_url, scene_set_id, scene_angle_id FROM scenes
      WHERE episode_id = :episodeId AND deleted_at IS NULL AND scene_plan_id IS NOT NULL`,
    { replacements: { episodeId } });

  const planIds = new Set(beats.map((b) => b.id));
  const byPlan = new Map(tied.filter((s) => planIds.has(s.scene_plan_id)).map((s) => [s.scene_plan_id, s]));
  // Scenes whose plan row a re-plan replaced, by their beat number.
  const orphans = new Map();
  for (const s of tied) {
    if (!planIds.has(s.scene_plan_id) && !orphans.has(Number(s.scene_number))) orphans.set(Number(s.scene_number), s);
  }
  const used = new Set();
  const out = { created: 0, updated: 0, removed: 0 };

  for (const beat of beats) {
    let scene = byPlan.get(beat.id) || null;
    if (!scene && orphans.has(Number(beat.beat_number))) {
      scene = orphans.get(Number(beat.beat_number));
      orphans.delete(Number(beat.beat_number));
    }
    if (!beat.scene_set_id) {
      if (scene) {
        await sequelize.query('UPDATE scenes SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', { replacements: { id: scene.id } });
        out.removed += 1;
        used.add(scene.id);
      }
      continue;
    }
    const want = {
      scene_plan_id: beat.id,
      scene_number: beat.beat_number,
      background_url: beatBackground(beat),
      scene_set_id: beat.scene_set_id,
      scene_angle_id: beat.location?.angle?.id || null,
    };
    if (scene) {
      used.add(scene.id);
      const same = scene.scene_plan_id === want.scene_plan_id && Number(scene.scene_number) === want.scene_number
        && (scene.background_url || null) === want.background_url && scene.scene_set_id === want.scene_set_id
        && (scene.scene_angle_id || null) === want.scene_angle_id;
      if (same) continue;
      await sequelize.query(
        `UPDATE scenes SET scene_plan_id = :scene_plan_id, scene_number = :scene_number, background_url = :background_url,
                scene_set_id = :scene_set_id, scene_angle_id = :scene_angle_id, updated_at = NOW()
          WHERE id = :id`,
        { replacements: { id: scene.id, ...want } });
      out.updated += 1;
      continue;
    }
    // A concurrent sync may have made it: one live scene per beat (unique index).
    const [created] = await sequelize.query(
      `INSERT INTO scenes (id, episode_id, scene_plan_id, scene_number, title, location, background_url, scene_set_id, scene_angle_id,
                           duration_seconds, characters, ui_elements, dialogue_clips, scene_type, status, production_status, created_at, updated_at)
       VALUES (gen_random_uuid(), :episodeId, :scene_plan_id, :scene_number, :title, :location, :background_url, :scene_set_id, :scene_angle_id,
               5.0, '[]', '[]', '[]', 'main', 'draft', 'draft', NOW(), NOW())
       ON CONFLICT (scene_plan_id) WHERE deleted_at IS NULL AND scene_plan_id IS NOT NULL DO NOTHING
       RETURNING id`,
      { replacements: { episodeId, ...want, title: beat.beat_name || `Beat ${beat.beat_number}`, location: beat.set_name || null } });
    if (created.length) out.created += 1;
  }

  // Beats that no longer exist: their scenes go.
  for (const s of tied) {
    if (used.has(s.id) || planIds.has(s.scene_plan_id)) continue;
    await sequelize.query('UPDATE scenes SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', { replacements: { id: s.id } });
    out.removed += 1;
  }
  return out;
}

/** syncBeatScenes for a read: a failure is logged, never blocks the read. */
async function syncBeatScenesQuietly(sequelize, episodeId, where) {
  try {
    return await syncBeatScenes(sequelize, episodeId);
  } catch (err) {
    console.error(`[BeatScenes] sync for ${where} failed:`, err.message);
    return null;
  }
}

/** The beats' scene ids: Map<scene_plan_id, scene_id>. */
async function beatSceneIds(sequelize, episodeId) {
  const [rows] = await sequelize.query(
    `SELECT id, scene_plan_id FROM scenes
      WHERE episode_id = :episodeId AND deleted_at IS NULL AND scene_plan_id IS NOT NULL`,
    { replacements: { episodeId } });
  return new Map(rows.map((r) => [r.scene_plan_id, r.id]));
}

module.exports = { beatBackground, syncBeatScenes, syncBeatScenesQuietly, beatSceneIds };
