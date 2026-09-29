'use strict';

/**
 * Feed moment persistence (docs/EVENT_EPISODE_FLOW.md §8(w) P5).
 *
 * One place for the three things the generator, the plan route and the
 * Scenes-tab retry share:
 *   - saveBeatFeedMoment: write one beat's moment onto its scene_plans row
 *     (the generator's step 3b, Task #2213);
 *   - recordFeedMomentSave / missingFeedMomentBeats: the save outcome kept on
 *     the brief as event_metadata.feed_moment_save, and the beats it names
 *     that still have no moment (Task #2216);
 *   - retryMissingFeedMoments: re-run the save for those beats only
 *     (Task #2220).
 *
 * Moments are rolled per beat, so an empty scene_plans.feed_moment means
 * nothing by itself; the brief record says which beats should have one.
 */

// Writes by row id; throws when the row is gone so a caller can report it.
async function saveBeatFeedMoment(sequelize, rowId, moment, { transaction } = {}) {
  const setLines = moment.script_lines ? ', script_lines = CAST(:scriptLines AS jsonb)' : '';
  const [updated] = await sequelize.query(
    `UPDATE scene_plans SET feed_moment = CAST(:feedMoment AS jsonb)${setLines}, updated_at = NOW() WHERE id = :id RETURNING id`,
    {
      replacements: { id: rowId, feedMoment: JSON.stringify(moment), scriptLines: JSON.stringify(moment.script_lines || null) },
      transaction,
    }
  );
  if (!Array.isArray(updated) || updated.length === 0) throw new Error(`scene_plans row ${rowId} not found`);
}

async function recordFeedMomentSave(sequelize, briefId, save, { transaction } = {}) {
  await sequelize.query(
    `UPDATE episode_briefs
        SET event_metadata = jsonb_set(COALESCE(event_metadata, '{}'::jsonb), '{feed_moment_save}', CAST(:save AS jsonb)),
            updated_at = NOW()
      WHERE id = :id`,
    { replacements: { id: briefId, save: JSON.stringify(save) }, transaction }
  );
}

const failedBeatNumbers = (record) => [...new Set(
  (record?.failed || []).map((f) => Number(f?.beat_number)).filter(Number.isInteger)
)];

// Of `beats`, those whose live scene_plans row has no feed moment (or no row).
async function beatsWithoutMoment(sequelize, episodeId, beats, { transaction } = {}) {
  if (beats.length === 0) return [];
  const saved = await sequelize.query(
    `SELECT beat_number FROM scene_plans
      WHERE episode_id = :episodeId AND deleted_at IS NULL AND feed_moment IS NOT NULL AND beat_number IN (:beats)`,
    { replacements: { episodeId, beats }, type: sequelize.QueryTypes.SELECT, transaction }
  );
  const savedBeats = new Set(saved.map((r) => Number(r.beat_number)));
  return beats.filter((b) => !savedBeats.has(b)).sort((a, b) => a - b);
}

async function missingFeedMomentBeats(models, episodeId) {
  const brief = await models.EpisodeBrief.findOne({ where: { episode_id: episodeId }, attributes: ['id', 'event_metadata'] });
  return beatsWithoutMoment(models.sequelize, episodeId, failedBeatNumbers(brief?.event_metadata?.feed_moment_save));
}

function retryError(message, status) {
  return Object.assign(new Error(message), { status });
}

/**
 * Re-run the feed moment save for the beats the brief records as failed and
 * that still have no moment. Only those beats are generated (their likelihood
 * is not rolled again) and written; every other beat, the episode and its
 * event link are untouched. Runs under a lock on the brief row, so two
 * retries of one episode run one after the other.
 *
 * Returns { attempted, saved, failed: [{ beat_number, error }] }.
 */
async function retryMissingFeedMoments(models, episodeId) {
  const { sequelize } = models;
  const { generateFeedMoments } = require('./feedMomentsService');
  const { BEAT_TEMPLATES } = require('./episodeGeneratorService');

  return sequelize.transaction(async (transaction) => {
    const [brief] = await sequelize.query(
      `SELECT id, event_id, event_metadata FROM episode_briefs
        WHERE episode_id = :episodeId AND deleted_at IS NULL
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT, transaction }
    );
    if (!brief) throw retryError('This episode has no brief, so there is no feed moment record to retry.', 404);

    const record = brief.event_metadata?.feed_moment_save || null;
    const missing = await beatsWithoutMoment(sequelize, episodeId, failedBeatNumbers(record), { transaction });
    if (missing.length === 0) return { attempted: 0, saved: 0, failed: [] };

    const [event] = brief.event_id ? await sequelize.query(
      `SELECT * FROM world_events WHERE id = :eventId AND deleted_at IS NULL`,
      { replacements: { eventId: brief.event_id }, type: sequelize.QueryTypes.SELECT, transaction }
    ) : [];
    if (!event) throw retryError("This episode's source event is gone, so its feed moments cannot be generated again.", 409);

    const automation = (typeof event.canon_consequences === 'string'
      ? JSON.parse(event.canon_consequences)
      : event.canon_consequences)?.automation || {};
    const moments = await generateFeedMoments(event, BEAT_TEMPLATES, automation.guest_profiles || [], models, {
      showType: 'styling_adventures',
      onlyBeats: missing,
    });

    const rows = await sequelize.query(
      `SELECT DISTINCT ON (beat_number) id, beat_number FROM scene_plans
        WHERE episode_id = :episodeId AND deleted_at IS NULL AND beat_number IN (:beats)
        ORDER BY beat_number, created_at DESC`,
      { replacements: { episodeId, beats: missing }, type: sequelize.QueryTypes.SELECT, transaction }
    );
    const rowByBeat = new Map(rows.map((r) => [Number(r.beat_number), r.id]));

    const result = { attempted: missing.length, saved: 0, failed: [] };
    for (const beat of missing) {
      try {
        const moment = moments[beat];
        if (!moment) throw new Error(`no feed moment is defined for beat ${beat}`);
        const rowId = rowByBeat.get(beat);
        if (!rowId) throw new Error(`beat ${beat} has no scene plan row`);
        // A savepoint per beat: one failed write leaves the rest of the retry usable.
        await sequelize.transaction({ transaction }, (savepoint) =>
          saveBeatFeedMoment(sequelize, rowId, moment, { transaction: savepoint }));
        result.saved++;
      } catch (err) {
        console.error(`[FeedMomentSave] Retry failed for episode ${episodeId} beat ${beat}:`, err.message);
        result.failed.push({ beat_number: beat, error: err.message });
      }
    }

    // Beats no longer failing leave the record; a beat that failed again keeps its new error.
    await recordFeedMomentSave(sequelize, brief.id, {
      ...(record || {}),
      saved: (Number(record?.saved) || 0) + result.saved,
      failed: result.failed,
      retried_at: new Date().toISOString(),
    }, { transaction });

    return result;
  });
}

module.exports = {
  saveBeatFeedMoment,
  recordFeedMomentSave,
  missingFeedMomentBeats,
  retryMissingFeedMoments,
};
