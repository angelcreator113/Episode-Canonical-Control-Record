'use strict';

/**
 * The events a character hosts, chosen on their Places tab (Evoni,
 * 2026-10-17: "lets add hosted events then add event photos there"). The
 * host is the event's feed profile, the rule every reader uses
 * (characterEvents HOST_ID_SQL): world_events.source_profile_id, else the
 * automation copy's host_profile_id. Hosting an event writes the
 * character's feed profile there; an event already hosted by someone else
 * is refused, naming them, so a host is never replaced by a click.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HOST_ID_SQL = `COALESCE(we.source_profile_id,
  CASE WHEN we.canon_consequences->'automation'->>'host_profile_id' ~ '^[0-9]+$'
       THEN (we.canon_consequences->'automation'->>'host_profile_id')::int END)`;

class HostedEventError extends Error {
  constructor(message, status = 400, code = 'HOSTED_EVENT_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The character, their feed profile and their show; the event of that show, with its host now. */
async function load(sequelize, characterId, eventId) {
  if (!UUID_RE.test(String(characterId || ''))) throw new HostedEventError('id must be a character id (UUID)', 400, 'BAD_ID');
  if (!UUID_RE.test(String(eventId || ''))) throw new HostedEventError('event_id must be an event id (UUID)', 400, 'BAD_ID');
  const [[character]] = await sequelize.query(
    `SELECT rc.id, COALESCE(NULLIF(rc.selected_name, ''), rc.display_name) AS name, rc.feed_profile_id, cr.show_id
       FROM registry_characters rc LEFT JOIN character_registries cr ON cr.id = rc.registry_id
      WHERE rc.id = :id AND rc.deleted_at IS NULL`,
    { replacements: { id: characterId } });
  if (!character) throw new HostedEventError('Character not found', 404, 'CHARACTER_NOT_FOUND');
  if (character.feed_profile_id == null) {
    throw new HostedEventError(`${character.name} needs a feed profile to host events. Match them to a feed person on The cast.`, 409, 'NO_FEED_PROFILE');
  }
  // A character in no show's cast hosts nothing: the show check was skipped
  // for them, and any show's event could be taken (fifth audit).
  if (!character.show_id) throw new HostedEventError(`${character.name} is not in a show's cast`, 409, 'NO_SHOW');
  const [[event]] = await sequelize.query(
    `SELECT we.id, we.name, we.show_id, we.host_brand, ${HOST_ID_SQL} AS host_profile_id, sp.display_name AS host_name,
            NULLIF(TRIM(we.canon_consequences->'automation'->>'host_profile_id'), '') AS automation_host
       FROM world_events we LEFT JOIN social_profiles sp ON sp.id = ${HOST_ID_SQL}
      WHERE we.id = :eventId AND we.deleted_at IS NULL`,
    { replacements: { eventId } });
  if (!event || String(event.show_id) !== String(character.show_id)) {
    throw new HostedEventError('That event is not one of their show\'s', 404, 'EVENT_NOT_FOUND');
  }
  return { character, event };
}

/** The character hosts the event. Refused when someone else hosts it. */
async function hostEvent(sequelize, { characterId, eventId }) {
  const { character, event } = await load(sequelize, characterId, eventId);
  const pid = Number(character.feed_profile_id);
  if (event.host_profile_id != null && Number(event.host_profile_id) !== pid) {
    throw new HostedEventError(`${event.name} is hosted by ${event.host_name || 'someone else'}`, 409, 'HOSTED_BY_ANOTHER');
  }
  // The organizer readers take a brand host first, and any automation host
  // id, numeric or not (utils/eventOrganizer): a click never replaces either
  // (fifth audit).
  if (String(event.host_brand || '').trim()) {
    throw new HostedEventError(`${event.name} is hosted by ${String(event.host_brand).trim()}`, 409, 'HOSTED_BY_BRAND');
  }
  if (event.automation_host && event.automation_host !== String(pid)) {
    throw new HostedEventError(`${event.name} already has a host`, 409, 'HOSTED_BY_ANOTHER');
  }
  // Written only while no one else hosts it: two characters adding the same
  // event at once, the second no longer replaces the first (fifth audit).
  const [updated] = await sequelize.query(
    `UPDATE world_events SET source_profile_id = :pid, updated_at = NOW()
      WHERE id = :id AND (source_profile_id IS NULL OR source_profile_id = :pid)
      RETURNING id`,
    { replacements: { pid, id: event.id } });
  if (!updated.length) throw new HostedEventError(`${event.name} was just given another host`, 409, 'HOSTED_BY_ANOTHER');
  return { event_id: event.id, host_profile_id: pid };
}

/** The character no longer hosts the event: both copies of the host are cleared when they are this character. */
async function unhostEvent(sequelize, { characterId, eventId }) {
  const { character, event } = await load(sequelize, characterId, eventId);
  const pid = Number(character.feed_profile_id);
  if (Number(event.host_profile_id) !== pid) throw new HostedEventError(`${character.name} does not host ${event.name}`, 409, 'NOT_THE_HOST');
  await sequelize.query(
    `UPDATE world_events
        SET source_profile_id = CASE WHEN source_profile_id = :pid THEN NULL ELSE source_profile_id END,
            canon_consequences = CASE
              WHEN canon_consequences->'automation'->>'host_profile_id' = CAST(:pid AS text)
              THEN canon_consequences #- '{automation,host_profile_id}' ELSE canon_consequences END,
            updated_at = NOW()
      WHERE id = :id`,
    { replacements: { pid, id: event.id } });
  return { event_id: event.id, host_profile_id: null };
}

module.exports = { HostedEventError, hostEvent, unhostEvent };
