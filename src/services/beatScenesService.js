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
 * syncBeatScenes runs where the beats are made or changed (Start Episode
 * and its resume, generate-plan, a beat's save) and at export. Neither the
 * plan's own read (GET /episode-brief/:episodeId/plan, Evoni 2026-11-22) nor
 * the scenes list (GET /episodes/:id/scenes, Evoni 2026-11-25) runs it: both
 * write nothing. The Timeline's own edits (duration, characters, overlays,
 * dialogue) are kept.
 *
 * ── S1-A, Evoni's preservation rules (2026-11-25) ───────────────────────────
 * The sync creates and brings up to date. It never takes anything away:
 *
 *  - It soft-deletes nothing. A beat that loses its set, and a beat that no
 *    longer exists, both leave their scene exactly as it is, with its
 *    scene_plan_id intact so the orphan adoption below can still find it.
 *  - It never modifies, replaces or soft-deletes a locked scene.
 *  - It never writes scene_number onto an existing row: renumbering is
 *    sceneController's (deleteScene, reorderScenes), and a saved standalone
 *    scene an operator moved from 50 to 4 must stay where they put it.
 *  - A scene that was removed before is never recreated. The beat is held
 *    and reported, with the stronger code when live production rows still
 *    point at the removed scene. Live scene_assets and episode_wardrobe rows
 *    say that production work is linked to a previously removed scene; they
 *    do NOT prove the scene is required in the final episode, and nothing
 *    here infers why it was removed, or by whom.
 *  - It never creates a reference to an already-removed Scene Set.
 *  - On an INSERT the available background is assigned normally. On an
 *    UPDATE it is assigned only while the stored background_url IS NULL:
 *    Scene Studio's editing is authoritative and is never overwritten.
 *
 * One bounded transaction: lockEpisodes first (episode-first, the same order
 * deleteScene and reorderScenes take), then the plan read, then the
 * episode's live scenes FOR UPDATE. No partial commits, and no set-row locks
 * are taken at all.
 *
 * The classification is a pure function of rows the sync already reads, so
 * the plan's read can report the same outcome without writing anything and
 * without a second readiness engine: `collect` reads, `classify` decides,
 * `syncBeatScenes` is the only one that writes.
 */

const { planWithAngles } = require('./planLocationsService');
const { inTransaction, lockEpisodes, isLockConflict, RetryableConflictError } = require('../utils/episodeLocks');

/** The one sentence a held beat is reported with. It says nothing about manual versus automatic. */
const SCENE_REMOVED_PREVIOUSLY_TEXT = 'A scene associated with this beat was removed previously. '
  + 'Automatic synchronization will not recreate it. Review the beat if a scene is expected.';

/** The reason codes a read may report. Computed per call; nothing is stored. */
const REASON_CODES = Object.freeze([
  'beat_no_location',
  'beat_removed_set',
  'beat_scene_set_incomplete',
  'scene_removed_previously_ambiguous',
  'scene_removed_previously_with_linked_work',
  'required_scene_missing',
  'scene_number_conflict',
  'sync_failed_retryable',
  'sync_failed_material',
]);

/** complete / held / unresolved / retryable / failed. Held is never a failure. */
const OUTCOMES = Object.freeze(['complete', 'held', 'unresolved', 'retryable', 'failed']);

/** The beat's background: its angle's image; no angle asked: the look, else the set's base. */
function beatBackground(row) {
  const loc = row.location || {};
  if (loc.angle) return loc.angle.still_image_url || null;
  if (loc.missing) return null;
  return loc.look?.image_url || row.set_base_still_url || null;
}

/**
 * Everything the classification needs, read in one place. With
 * `lock: true` the episode's live scenes are taken FOR UPDATE in
 * lockLiveScenes' exact order; without it nothing is locked and nothing is
 * written, which is what a read needs.
 */
async function collect(sequelize, episodeId, { transaction = null, lock = false } = {}) {
  const [plans] = await sequelize.query(
    `SELECT p.id, p.episode_id, p.beat_number, p.beat_name, p.scene_set_id, p.angle_label,
            s.name AS set_name, s.base_still_url AS set_base_still_url
       FROM scene_plans p
       LEFT JOIN scene_sets s ON s.id = p.scene_set_id AND s.deleted_at IS NULL
      WHERE p.episode_id = :episodeId AND p.deleted_at IS NULL
      ORDER BY p.beat_number ASC`,
    { replacements: { episodeId }, transaction });
  // The sets' and angles' own state is read without locking them: this sync
  // takes no set-row locks (S1-A).
  const beats = await planWithAngles(sequelize, plans);

  // Every live scene of the episode, in sceneController.lockLiveScenes'
  // exact order — that function (src/controllers/sceneController.js) is the
  // canonical scenes lock order for an episode; it is re-spelled here rather
  // than imported because it is module-local there. Untied scenes are read
  // too: their numbers are what a beat's INSERT must not collide with.
  const [live] = await sequelize.query(
    `SELECT id, scene_plan_id, scene_number, background_url, scene_set_id, scene_angle_id, is_locked
       FROM scenes
      WHERE episode_id = :episodeId AND deleted_at IS NULL
      ORDER BY scene_number ASC NULLS LAST, created_at ASC, id ASC${lock ? '\n      FOR UPDATE' : ''}`,
    { replacements: { episodeId }, transaction });

  // The episode's removed scenes, read (never locked, never written): a beat
  // whose scene was removed before is held, not recreated.
  const [tombstones] = await sequelize.query(
    `SELECT id, scene_plan_id, scene_number FROM scenes
      WHERE episode_id = :episodeId AND deleted_at IS NOT NULL
      ORDER BY scene_number ASC NULLS LAST, created_at ASC, id ASC`,
    { replacements: { episodeId }, transaction });

  // The independent-evidence signal set is exactly two: live scene_assets
  // rows and live episode_wardrobe.scene_id rows. raw_footage.intended_scene_id
  // has no writer anywhere in the repository, and scene_footage_links holds a
  // footage id in its scene_id (src/routes/sceneLinks.js:24-27), so neither
  // is evidence of anything.
  const linked = new Set();
  if (tombstones.length) {
    const ids = tombstones.map((t) => t.id);
    const [assets] = await sequelize.query(
      `SELECT DISTINCT scene_id FROM scene_assets WHERE scene_id IN (:ids) AND deleted_at IS NULL`,
      { replacements: { ids }, transaction });
    const [worn] = await sequelize.query(
      `SELECT DISTINCT scene_id FROM episode_wardrobe WHERE scene_id IN (:ids) AND deleted_at IS NULL`,
      { replacements: { ids }, transaction });
    for (const r of [...assets, ...worn]) linked.add(r.scene_id);
  }
  return { beats, live, tombstones, linked };
}

/**
 * What each beat needs, and why — a pure function of the collected rows.
 * Returns { steps, warnings, outcome, held }, where each step is one of:
 *   hold    nothing is written for this beat, and it is reported
 *   same    its scene is already what the beat says, or it is locked
 *   update  its existing scene's link, set, angle and (only while the
 *           stored one is null) background are brought up to date
 *   insert  it has no scene, no tombstone and a free number
 *   conflict another live scene of the episode holds the beat's number
 */
function classify({ beats, live, tombstones, linked }) {
  const planIds = new Set(beats.map((b) => b.id));
  const tied = live.filter((s) => s.scene_plan_id);
  const byPlan = new Map(tied.filter((s) => planIds.has(s.scene_plan_id)).map((s) => [s.scene_plan_id, s]));
  // Scenes whose plan row a re-plan replaced, by their beat number.
  const orphans = new Map();
  for (const s of tied) {
    if (!planIds.has(s.scene_plan_id) && !orphans.has(Number(s.scene_number))) orphans.set(Number(s.scene_number), s);
  }
  // A tombstone belongs to a beat by its plan link, or — once a re-plan has
  // given that beat a new plan row — by its scene number.
  const tombFor = (beat) => tombstones.find((t) => t.scene_plan_id === beat.id)
    || tombstones.find((t) => !planIds.has(t.scene_plan_id) && Number(t.scene_number) === Number(beat.beat_number))
    || null;
  const numbers = new Map(live.map((s) => [Number(s.scene_number), s]));

  const steps = [];
  const warnings = [];
  const claimed = new Set();
  let held = 0;
  let unresolved = 0;
  const warn = (beat, code, extra = {}) => warnings.push({
    beat_number: beat.beat_number, beat_name: beat.beat_name || null, code, ...extra,
  });

  for (const beat of beats) {
    let scene = byPlan.get(beat.id) || null;
    if (!scene && orphans.has(Number(beat.beat_number))) {
      scene = orphans.get(Number(beat.beat_number));
      orphans.delete(Number(beat.beat_number));
    }

    // A beat with no location: nothing to derive, and its scene — if it has
    // one — stays exactly as it is, scene_plan_id included.
    if (!beat.scene_set_id) {
      warn(beat, 'beat_no_location');
      held += 1;
      steps.push({ beat, action: 'hold' });
      continue;
    }
    // An already-removed Scene Set is never referenced by a write of this
    // sync, so the beat is held whether or not it has a scene already.
    if (beat.sceneSet?.removed) {
      warn(beat, 'beat_removed_set');
      held += 1;
      steps.push({ beat, action: 'hold' });
      continue;
    }
    if (Boolean(beat.location?.missing) || (!beat.location?.angle && !beat.sceneSet?.base_still_url)) {
      // L5, Q21: a missing view is flagged, never blocking. The scene is
      // still made or kept; only the report carries the gap.
      warn(beat, 'beat_scene_set_incomplete');
    }

    const want = {
      scene_plan_id: beat.id,
      background_url: beatBackground(beat),
      scene_set_id: beat.scene_set_id,
      scene_angle_id: beat.location?.angle?.id || null,
    };

    if (scene) {
      // Never modify, replace or soft-delete a locked scene.
      if (scene.is_locked) { steps.push({ beat, scene, action: 'same' }); continue; }
      // Scene Studio is authoritative: a stored background is never replaced.
      const background = (scene.background_url === null || scene.background_url === undefined)
        ? want.background_url : scene.background_url;
      const same = scene.scene_plan_id === want.scene_plan_id
        && (scene.background_url || null) === (background || null)
        && scene.scene_set_id === want.scene_set_id
        && (scene.scene_angle_id || null) === want.scene_angle_id;
      steps.push({ beat, scene, action: same ? 'same' : 'update', want: { ...want, background_url: background || null } });
      continue;
    }

    // No live scene for this beat.
    const tomb = tombFor(beat);
    if (tomb) {
      claimed.add(tomb.id);
      warn(beat, linked.has(tomb.id) ? 'scene_removed_previously_with_linked_work' : 'scene_removed_previously_ambiguous',
        { text: SCENE_REMOVED_PREVIOUSLY_TEXT });
      held += 1;
      steps.push({ beat, action: 'hold' });
      continue;
    }
    // Another live scene of this episode already holds the beat's number.
    // Writing it would need that row renumbered, which is not this sync's to
    // do, so the beat is reported instead — the same outcome on a shape with
    // the partial unique index and on one without it.
    const holder = numbers.get(Number(beat.beat_number));
    if (holder && holder.scene_plan_id !== beat.id) {
      warn(beat, 'scene_number_conflict', { scene_number: beat.beat_number });
      unresolved += 1;
      steps.push({ beat, action: 'conflict' });
      continue;
    }
    steps.push({ beat, action: 'insert', want });
  }

  // The episode's other removed scenes: no current beat needs them, so they
  // hold nothing up. They are reported for review, never recreated.
  for (const t of tombstones) {
    if (claimed.has(t.id)) continue;
    warnings.push({
      beat_number: null, scope: 'episode', scene_number: t.scene_number === null ? null : Number(t.scene_number),
      code: linked.has(t.id) ? 'scene_removed_previously_with_linked_work' : 'scene_removed_previously_ambiguous',
    });
  }

  // Unresolved wins over held; held is never a failure, and complete is
  // never claimed while required current-plan work is missing.
  const outcome = unresolved ? 'unresolved' : (held ? 'held' : 'complete');
  return { steps, warnings, outcome, held, unresolved };
}

async function syncBeatScenes(sequelize, episodeId, { transaction: outer } = {}) {
  if (!episodeId) return { created: 0, updated: 0, removed: 0, held: 0, outcome: 'complete', warnings: [] };
  return inTransaction(sequelize, outer, async (transaction) => {
    // The episode first, as every writer of an episode's rows locks
    // (utils/episodeLocks; the order deleteScene and reorderScenes take).
    await lockEpisodes(sequelize, [episodeId], { transaction });
    const collected = await collect(sequelize, episodeId, { transaction, lock: true });
    const plan = classify(collected);

    const out = { created: 0, updated: 0, removed: 0, held: plan.held, outcome: plan.outcome, warnings: [...plan.warnings] };
    let unresolved = plan.unresolved;

    for (const step of plan.steps) {
      if (step.action === 'hold' || step.action === 'same' || step.action === 'conflict') continue;
      if (step.action === 'update') {
        // Guarded, and scene_number is not among the columns: a row that was
        // removed or locked since the locked read is a lost race, never an
        // INSERT (which would replace the operator's scene with a new one).
        const [changed] = await sequelize.query(
          `UPDATE scenes SET scene_plan_id = :scene_plan_id, background_url = :background_url,
                  scene_set_id = :scene_set_id, scene_angle_id = :scene_angle_id, updated_at = NOW()
            WHERE id = :id AND deleted_at IS NULL AND is_locked IS NOT TRUE
            RETURNING id`,
          { replacements: { id: step.scene.id, ...step.want }, transaction });
        if (!changed.length) throw new RetryableConflictError();
        out.updated += 1;
        continue;
      }
      // A concurrent sync cannot be here: this transaction holds the
      // episode's lock. ON CONFLICT stays as the last word of the unique
      // index (it infers by column and predicate, never by index name).
      // Production's scenes table has no `status` column (production_status
      // is the scene's status), so the row names only columns both schemas
      // have.
      const [created] = await sequelize.query(
        `INSERT INTO scenes (id, episode_id, scene_plan_id, scene_number, title, location, background_url, scene_set_id, scene_angle_id,
                             duration_seconds, characters, ui_elements, dialogue_clips, scene_type, production_status, created_at, updated_at)
         VALUES (gen_random_uuid(), :episodeId, :scene_plan_id, :scene_number, :title, :location, :background_url, :scene_set_id, :scene_angle_id,
                 5.0, '[]', '[]', '[]', 'main', 'draft', NOW(), NOW())
         ON CONFLICT (scene_plan_id) WHERE deleted_at IS NULL AND scene_plan_id IS NOT NULL DO NOTHING
         RETURNING id`,
        { replacements: { episodeId, ...step.want, scene_number: step.beat.beat_number,
          title: step.beat.beat_name || `Beat ${step.beat.beat_number}`, location: step.beat.set_name || null },
        transaction });
      if (created.length) out.created += 1;
      else {
        out.warnings.push({ beat_number: step.beat.beat_number, beat_name: step.beat.beat_name || null, code: 'required_scene_missing' });
        unresolved += 1;
      }
    }
    out.outcome = unresolved ? 'unresolved' : plan.outcome;
    return out;
  });
}

/**
 * syncBeatScenes for a caller that must not be blocked by it: a failure is
 * logged and null is returned, as before.
 */
async function syncBeatScenesQuietly(sequelize, episodeId, where) {
  try {
    return await syncBeatScenes(sequelize, episodeId);
  } catch (err) {
    console.error(`[BeatScenes] sync for ${where} failed:`, err.message);
    return null;
  }
}

/**
 * The outcome to record for a caller whose sync reported nothing: a lock
 * conflict is a retryable failure (nothing was written), anything else is a
 * material one. Never a claim that a committed write was rolled back.
 */
function failedSyncOutcome(err = null) {
  const retryable = err instanceof RetryableConflictError || isLockConflict(err);
  return {
    created: 0, updated: 0, removed: 0, held: 0,
    outcome: retryable ? 'retryable' : 'failed',
    warnings: [{ beat_number: null, scope: 'episode', code: retryable ? 'sync_failed_retryable' : 'sync_failed_material' }],
  };
}

/**
 * The same outcome and warnings, read only: no transaction, no lock, no
 * write. For a read that wants to say what the last sync held
 * (GET /episode-brief/:episodeId/plan). Computed per call; nothing is stored.
 */
async function beatSyncReport(sequelize, episodeId) {
  if (!episodeId) return { outcome: 'complete', warnings: [] };
  const plan = classify(await collect(sequelize, episodeId, { lock: false }));
  return { outcome: plan.outcome, warnings: plan.warnings };
}

/** The beats' scene ids: Map<scene_plan_id, scene_id>. */
async function beatSceneIds(sequelize, episodeId) {
  const [rows] = await sequelize.query(
    `SELECT id, scene_plan_id FROM scenes
      WHERE episode_id = :episodeId AND deleted_at IS NULL AND scene_plan_id IS NOT NULL`,
    { replacements: { episodeId } });
  return new Map(rows.map((r) => [r.scene_plan_id, r.id]));
}

module.exports = {
  beatBackground,
  syncBeatScenes,
  syncBeatScenesQuietly,
  failedSyncOutcome,
  beatSyncReport,
  beatSceneIds,
  SCENE_REMOVED_PREVIOUSLY_TEXT,
  REASON_CODES,
  OUTCOMES,
};
