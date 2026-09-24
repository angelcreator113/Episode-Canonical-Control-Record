/**
 * Event Package organizer (Task #1761) — what the Package shows as the
 * organizer, and exactly what it sends when Evoni chooses one.
 *
 * Interim storage (docs/EVENT_EPISODE_FLOW.md §8(p) ruling 6): a creator
 * organizer is `source_profile_id`, a brand organizer is `host_brand`
 * (free text, the chosen brand's name). Each has a second home inside
 * canon_consequences.automation: `host_profile_id` (with `host_handle`,
 * `host_display_name`, `host_registry_character_id`) for the creator,
 * `host_brand` for the brand (§8(p) observation 2).
 *
 * resolveEventOrganizer (utils/eventReadiness.js) decides which one is
 * the organizer when both are set: the brand always wins. So:
 *   - choosing a creator must clear the brand in both homes, or the brand
 *     would still be shown as the organizer;
 *   - choosing a brand clears the creator in both homes too. No field
 *     holds a "host or face" person apart from the creator organizer
 *     link, and ruling 6 gives source_profile_id to creator-hosted events
 *     only (the full argument is in the Task #1761 PR body).
 * A home that does not exist on the row is never created, and a value
 * that is already right is not re-sent. Everything is sent through
 * PUT /world/:showId/events/:eventId, whose canon_consequences merge
 * (mergeCanonConsequences, PR #1749) deletes an automation key sent as
 * null and leaves every key not sent untouched.
 *
 * Pure; no I/O.
 */
import { resolveEventOrganizer } from './eventReadiness';

// host_brand is character varying(200) (WorldEvent.js).
export const BRAND_NAME_MAX = 200;

const automationOf = (event) => {
  const auto = event?.canon_consequences?.automation;
  return auto && typeof auto === 'object' && !Array.isArray(auto) ? auto : {};
};

const hasKey = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

export const profileName = (profile) => (profile ? (profile.display_name || profile.handle || null) : null);

/**
 * What the Package shows. `sourceProfile` is the linked SocialProfile the
 * single-event GET returns; when present it names the creator, since the
 * automation copy resolveEventOrganizer prefers can be older than the link.
 */
export function describeEventOrganizer(event, sourceProfile) {
  const base = resolveEventOrganizer(event);
  const auto = automationOf(event);
  const creatorName = (event?.source_profile_id && profileName(sourceProfile)) || base.creatorName;
  const creatorHandle = (event?.source_profile_id && sourceProfile?.handle) || (base.hasCreator ? auto.host_handle || null : null);
  const kind = base.organizerKind;
  return {
    kind,
    name: kind === 'brand' ? base.brandName : kind === 'creator' ? creatorName : null,
    handle: kind === 'creator' ? creatorHandle : null,
    brandName: base.brandName,
    creatorName,
    // Rows saved before this task can hold both. The brand wins
    // (resolveEventOrganizer); the creator is shown, not relabelled.
    alsoLinkedCreator: kind === 'brand' && base.hasCreator ? (creatorName || 'a creator') : null,
    hasOrganizer: base.hasOrganizer,
  };
}

// Names the `host` column holds when it only mirrors the linked creator
// (Change Host and the from-profile route both write it that way).
function creatorMirrorNames(event, sourceProfile) {
  const auto = automationOf(event);
  return new Set([
    sourceProfile?.display_name, sourceProfile?.handle,
    auto.host_display_name, auto.host_handle,
  ].map(norm).filter(Boolean));
}

/**
 * Choose a creator (a SocialProfile row) as the organizer.
 * Returns { body, clears, unchanged }. `clears` lists what the save
 * removes, for the confirmation step; `unchanged` means there is
 * nothing to send.
 */
export function buildCreatorOrganizerUpdate(event, profile) {
  const ev = event || {};
  const auto = automationOf(ev);
  const name = profileName(profile);
  const body = {};
  const autoPatch = {};
  const clears = [];

  if (ev.source_profile_id !== profile.id) body.source_profile_id = profile.id;
  if ((ev.host || null) !== name) body.host = name;

  if (ev.host_brand) {
    body.host_brand = null;
    clears.push({ kind: 'brand', value: ev.host_brand });
  }
  if (hasKey(auto, 'host_brand')) {
    autoPatch.host_brand = null;
    if (auto.host_brand && auto.host_brand !== ev.host_brand) {
      clears.push({ kind: 'brand', value: auto.host_brand });
    }
  }

  // The creator's own saved copy, where one exists, is moved to the new
  // creator so the two homes name the same person.
  if (auto.host_profile_id && auto.host_profile_id !== profile.id) {
    autoPatch.host_profile_id = profile.id;
    autoPatch.host_handle = profile.handle || null;
    autoPatch.host_display_name = profile.display_name || null;
    if (hasKey(auto, 'host_registry_character_id')) {
      autoPatch.host_registry_character_id = profile.registry_character_id || null;
    }
  }

  if (Object.keys(autoPatch).length) body.canon_consequences = { automation: autoPatch };
  return { body, clears, unchanged: Object.keys(body).length === 0 };
}

/**
 * Choose a brand as the organizer. `brandName` is written to host_brand
 * as-is (trimmed), the same free-text shape the column already has.
 * Returns { body, clears, unchanged }, or null for an empty name.
 */
export function buildBrandOrganizerUpdate(event, brandName, sourceProfile) {
  const ev = event || {};
  const auto = automationOf(ev);
  const name = typeof brandName === 'string' ? brandName.trim().slice(0, BRAND_NAME_MAX) : '';
  if (!name) return null;

  const body = {};
  const autoPatch = {};
  const clears = [];

  if (ev.host_brand !== name) body.host_brand = name;
  if (hasKey(auto, 'host_brand') && auto.host_brand !== name) autoPatch.host_brand = name;

  const clearingCreator = !!(ev.source_profile_id || auto.host_profile_id);
  if (clearingCreator) {
    const described = describeEventOrganizer(ev, sourceProfile);
    clears.push({ kind: 'creator', value: described.creatorName || 'the linked creator' });
    const mirrors = creatorMirrorNames(ev, sourceProfile);
    if (ev.host && mirrors.has(norm(ev.host))) body.host = null;
  }
  if (ev.source_profile_id) body.source_profile_id = null;
  if (auto.host_profile_id) {
    autoPatch.host_profile_id = null;
    for (const key of ['host_handle', 'host_display_name', 'host_registry_character_id']) {
      if (hasKey(auto, key)) autoPatch[key] = null;
    }
  }

  if (Object.keys(autoPatch).length) body.canon_consequences = { automation: autoPatch };
  return { body, clears, unchanged: Object.keys(body).length === 0 };
}

const present = (v) => v !== undefined && v !== null && v !== '';

/**
 * The event's creator organizer, for readers (Task #1791). The one rule:
 * `source_profile_id` when it is set; otherwise the automation copy's
 * `host_profile_id` (older events, and paths that write only the copy).
 * A brand-organized event has neither and yields null. The backend's
 * eventCreatorOrganizer (src/utils/eventOrganizer.js) applies the same
 * rule. resolveEventOrganizer (utils/eventReadiness.js) already counts
 * either home as "has a creator" and decides brand-vs-creator; this does
 * not re-decide it.
 *
 * The copy's handle and display name are returned only when the copy
 * names the same profile; otherwise they are null and the reader falls
 * back to `event.host` (Change Organizer writes the creator's name there).
 * Returns { profileId, handle, displayName, fromSavedCopy } or null.
 */
export function eventCreatorOrganizer(event) {
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
    fromSavedCopy: column === null,
  };
}

/** True when `profileId` is the event's creator organizer. */
export function isOrganizedByProfile(event, profileId) {
  const creator = eventCreatorOrganizer(event);
  return !!creator && present(profileId) && String(creator.profileId) === String(profileId);
}

/** Brands from GET /api/v1/wardrobe-brands/brands, filtered by name. */
export function filterBrands(brands, query) {
  const list = Array.isArray(brands) ? brands.filter((b) => b && b.name) : [];
  const q = norm(query);
  return q ? list.filter((b) => norm(b.name).includes(q) || norm(b.category).includes(q)) : list;
}

/** True when a free-text host_brand exactly matches a listed brand's name. */
export function brandIsListed(brands, name) {
  if (!name || !Array.isArray(brands)) return false;
  return brands.some((b) => b && b.name === name);
}
