'use strict';

/**
 * Lala's to-do list at a beat, and the deal checklist (Lala's Phone spec §5;
 * Task #3191; Evoni, 2026-10-14, phone phase 3 rulings 3 and 6).
 *
 * The deal is the episode's source event (utils/episodeEventSql) once its
 * terms are locked to this episode (eventTermsLock.findTermsLockEpisode).
 * Its checklist is the event's deliverables, headed with where the deal
 * happens (socialTaskSource.dealLocationLabel). An item is ticked from its
 * `[DELIVER: <deliverable id>]` line in the saved script and then reads
 * "ready to approve" until it is approved. Nothing here writes: a tick
 * never changes a deliverable's status, and approval stays manual in Money.
 *
 * The list shown at a beat (utils/scriptTodo.todoModeAt): the beat's
 * `[TODO_MODE]` cue, else the Shopping list through the closet beat, else
 * the deal checklist at a locked deal, else the Career list.
 */

const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
const { findTermsLockEpisode } = require('../utils/eventTermsLock');
const { deliverableTask, dealLocationLabel } = require('../utils/socialTaskSource');
const { scriptBeats, closetIndex } = require('../utils/scriptWear');
const { deliverCues, deliveredAt, todoModeAt } = require('../utils/scriptTodo');

/** The episode's deal: { event, label, locked, deliverables }, or null with no source event. */
async function episodeDeal(sequelize, episodeId) {
  const select = { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT };
  const [event] = await sequelize.query(
    `SELECT id, show_id, name, host, host_brand, venue_name, venue_location_id
       FROM world_events WHERE id = ${EPISODE_EVENT_ID_SQL}`,
    select
  );
  if (!event) return null;
  let venueLocationName = null;
  if (!event.venue_name && event.venue_location_id) {
    const [loc] = await sequelize.query(
      'SELECT name FROM world_locations WHERE id = :id AND deleted_at IS NULL LIMIT 1',
      { replacements: { id: event.venue_location_id }, type: sequelize.QueryTypes.SELECT }
    );
    venueLocationName = loc?.name || null;
  }
  const lockedTo = await findTermsLockEpisode(sequelize, event.id);
  const deliverables = await sequelize.query(
    `SELECT * FROM event_deliverables WHERE event_id = :eventId AND deleted_at IS NULL ORDER BY created_at ASC`,
    { replacements: { eventId: event.id }, type: sequelize.QueryTypes.SELECT }
  );
  return {
    event: { id: event.id, name: event.name, host: event.host, host_brand: event.host_brand, venue_name: event.venue_name || venueLocationName },
    label: dealLocationLabel(event, venueLocationName),
    locked: Boolean(lockedTo && String(lockedTo.id) === String(episodeId)),
    deliverables,
  };
}

/**
 * The to-do list at a beat (its number) and line (index in the beat; none
 * means the whole beat). With no beat, the whole script: the deal at a
 * locked deal, else the Career list.
 * { beat, line, beat_found, mode, mode_source, deal, flags }
 */
async function getTodoAt(episodeId, models, { beat = null, line = null } = {}) {
  const { sequelize } = models;
  const [episode] = await sequelize.query(
    'SELECT script_content FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  if (!episode) return null;
  const deal = await episodeDeal(sequelize, episodeId);
  const deliverables = deal?.deliverables || [];
  const beats = scriptBeats(episode.script_content);
  const dealLocked = Boolean(deal?.locked);
  const lineIndex = line == null ? Infinity : line;

  let at = beats.length - 1;
  let beatFound = true;
  let mode;
  if (beat == null) {
    mode = { mode: dealLocked ? 'deal' : 'career', source: 'auto' };
  } else {
    at = beats.findIndex((b) => b.number === beat);
    beatFound = at >= 0;
    if (beatFound) {
      mode = todoModeAt(beats, at, { dealLocked });
    } else {
      // A beat the script doesn't have: what came before it, and its list by number.
      at = beats.reduce((last, b, i) => (b.number < beat ? i : last), -1);
      const closet = closetIndex(beats);
      const shopping = closet >= 0 && beat <= beats[closet].number;
      mode = { mode: shopping ? 'shopping' : (dealLocked ? 'deal' : 'career'), source: 'auto' };
    }
  }
  const ticked = at >= 0 ? deliveredAt(beats, at, beatFound ? lineIndex : Infinity, deliverables) : new Set();

  const flags = deliverCues(beats, deliverables)
    .filter((c) => !c.deliverable)
    .map((c) => ({ beat: beats[c.beatIndex].number, line: c.lineIndex, id: c.id }));

  return {
    beat, line, beat_found: beatFound,
    mode: mode.mode, mode_source: mode.source,
    deal: deal && {
      event: deal.event,
      label: deal.label,
      locked: deal.locked,
      items: deliverables.map((d) => {
        const delivered = ticked.has(String(d.id));
        return {
          deliverable_id: d.id,
          label: deliverableTask(d).label || deliverableTask(d).description,
          owed_to: d.owed_to === 'brand' ? 'brand' : 'host',
          required: d.required !== false,
          status: d.status,
          delivered,
          ready_to_approve: delivered && d.status !== 'approved',
        };
      }),
    },
    flags,
  };
}

module.exports = { episodeDeal, getTodoAt };
