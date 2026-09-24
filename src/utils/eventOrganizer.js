'use strict';

/**
 * The event's creator organizer, for backend readers (Task #1791).
 *
 * A creator organizer has two homes (docs/EVENT_EPISODE_FLOW.md §8(p)):
 * the organizer field, `source_profile_id`, and a copy inside
 * canon_consequences.automation (`host_profile_id`, with `host_handle`,
 * `host_display_name`, `host_registry_character_id`). Choosing an
 * organizer in the Event Package writes the field and updates the copy
 * only where one already exists (buildCreatorOrganizerUpdate,
 * frontend/src/utils/eventOrganizer.js), so the field is the one that is
 * always current.
 *
 * The one rule: the creator is `source_profile_id` when it is set;
 * otherwise `automation.host_profile_id` (older events, and paths that
 * write only the copy). A brand-organized event has neither and yields
 * null. This is the same order the frontend's eventCreatorOrganizer
 * (frontend/src/utils/eventOrganizer.js) uses; resolveEventOrganizer
 * (frontend/src/utils/eventReadiness.js) already counted either home as
 * "has a creator" and decides brand-vs-creator — the brand wins there, and
 * this helper does not re-decide it.
 *
 * The copy's handle, display name and registry character are returned only
 * when the copy names the same profile. When it names someone else (or
 * there is no copy), they are null: the caller takes them from the
 * social_profiles row it queries by `profileId`, or from `event.host`.
 *
 * Pure; no I/O.
 */

function automationOf(event) {
  let cc = event?.canon_consequences;
  if (typeof cc === 'string') {
    try { cc = JSON.parse(cc); } catch (err) {
      console.warn('[eventOrganizer] canon_consequences is not valid JSON:', err.message);
      cc = null;
    }
  }
  const auto = cc?.automation;
  return auto && typeof auto === 'object' && !Array.isArray(auto) ? auto : {};
}

const present = (v) => v !== undefined && v !== null && v !== '';

/**
 * Returns { profileId, handle, displayName, registryCharacterId,
 * fromSavedCopy } or null when the event has no creator organizer.
 */
function eventCreatorOrganizer(event) {
  const auto = automationOf(event);
  const column = present(event?.source_profile_id) ? event.source_profile_id : null;
  const copyId = present(auto.host_profile_id) ? auto.host_profile_id : null;
  const profileId = column ?? copyId;
  if (profileId === null) return null;

  const copyIsSame = copyId !== null && String(copyId) === String(profileId);
  return {
    profileId,
    handle: copyIsSame ? auto.host_handle || null : null,
    displayName: copyIsSame ? auto.host_display_name || null : null,
    registryCharacterId: copyIsSame ? auto.host_registry_character_id || null : null,
    fromSavedCopy: column === null,
  };
}

/** True when `profileId` is the event's creator organizer. */
function isOrganizedByProfile(event, profileId) {
  const creator = eventCreatorOrganizer(event);
  return !!creator && present(profileId) && String(creator.profileId) === String(profileId);
}

module.exports = { eventCreatorOrganizer, isOrganizedByProfile };
