'use strict';

/**
 * Who attended an event, by the one rule The Pulse shares (Task #3082;
 * Evoni, 2026-10-13): the event's host by default, alongside its confirmed
 * attendees, the Event Package's Guests (canon_consequences.automation.
 * guest_profiles). An invitation alone does not make someone an attendee,
 * and the older top-level guest_list column, which no screen writes, does
 * not count.
 *
 * The host is the event's creator organizer (eventCreatorOrganizer:
 * source_profile_id, else automation.host_profile_id). A brand-organized
 * event has none. Lala's own presence is each caller's rule.
 *
 * Pure; no I/O. Returns Set<number> of Feed profile ids.
 */

const { eventCreatorOrganizer } = require('./eventOrganizer');

function automationOf(event) {
  let cc = event?.canon_consequences;
  if (typeof cc === 'string') {
    try { cc = JSON.parse(cc); } catch (err) {
      console.warn('[eventAttendees] canon_consequences is not valid JSON:', err.message);
      cc = null;
    }
  }
  return cc?.automation && typeof cc.automation === 'object' ? cc.automation : {};
}

const profileIdOf = (g) => Number(typeof g === 'object' && g ? (g.profile_id ?? g.social_profile_id ?? g.id) : g);

function eventAttendees(event) {
  const ids = new Set();
  const guests = automationOf(event).guest_profiles;
  for (const g of Array.isArray(guests) ? guests : []) {
    const id = profileIdOf(g);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  const host = Number(eventCreatorOrganizer(event)?.profileId);
  if (Number.isInteger(host) && host > 0) ids.add(host);
  return ids;
}

module.exports = { eventAttendees };
