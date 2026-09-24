/**
 * Event Package field resolvers + difficulty.
 *
 * resolveEventVenueAndDate / resolveEventOrganizer resolve the fields that
 * have two homes; calcEventDifficulty/eventDifficultyLabel are the card's
 * difficulty score (extracted from WorldAdmin's former top-level
 * `calcDifficulty`/`difficultyLabel`).
 *
 * Readiness itself lives in eventReadinessSections.js (Task #1775):
 * computeEventPackageReadiness reports each Event Package section, and
 * SECTION_GATES there says which sections block Start Episode. The old
 * flat computeEventReadiness (outfit / venue / scene / invite) was
 * replaced by it; those four checks are now the Look, Place and
 * Invitation sections, and they are still the only gates.
 */

// Resolves an event's venue and date/time fields, top-level column first
// then the canon_consequences.automation copy (Task #1656). Events created
// before #1647 declared venue_location_id/venue_name/venue_address/
// event_date/event_time on the WorldEvent model had those fields silently
// dropped by Sequelize's .create() (undeclared attributes are never
// persisted, the same mechanism #1644/#1645 fixed for venue lookup) even
// though the code writing them — eventAutomationService.js's calendar-spawn
// path — always also nested the same values inside canon_consequences,
// a column that was declared from the start. So for those older events,
// the automation copy is the only place the value survived. This is the
// one fallback rule; the Place section's venue check (eventReadinessSections.js) calls
// into it rather than keeping its own separate OR-chain.
export function resolveEventVenueAndDate(event) {
  const ev = event || {};
  const auto = ev.canon_consequences?.automation || {};

  const field = (topKey, autoKey = topKey) => {
    const value = ev[topKey] ?? null;
    if (value) return { value, fromSavedCopy: false };
    const autoValue = auto[autoKey] ?? null;
    return { value: autoValue, fromSavedCopy: !!autoValue };
  };

  const venueName = field('venue_name');
  const venueAddress = field('venue_address');
  const venueLocationId = field('venue_location_id');
  const eventDate = field('event_date');
  const eventTime = field('event_time');

  return {
    venueName: venueName.value, venueNameFromSavedCopy: venueName.fromSavedCopy,
    venueAddress: venueAddress.value, venueAddressFromSavedCopy: venueAddress.fromSavedCopy,
    venueLocationId: venueLocationId.value, venueLocationIdFromSavedCopy: venueLocationId.fromSavedCopy,
    eventDate: eventDate.value, eventDateFromSavedCopy: eventDate.fromSavedCopy,
    eventTime: eventTime.value, eventTimeFromSavedCopy: eventTime.fromSavedCopy,
    hasVenue: !!(venueLocationId.value || venueName.value),
  };
}

// Resolves an event's organizer — a creator or a brand
// (docs/EVENT_EPISODE_FLOW.md §8(p), Evoni's organizer ruling 2, Task
// #1676/#1681). Checks both homes for each, the same two-homes pattern
// already used above for venue/date: creator via the durable
// source_profile_id column or the automation.host_profile_id copy
// (§2 "HOST — recorded two different ways"); brand via the top-level
// host_brand column or its own automation.host_brand copy (§8(p) ruling
// 6/observation). Per ruling 2/3, the brand is the organizer whenever one
// is set — a creator alongside it is the HOST/FACE (ruling 1), not a
// co-equal organizer, so organizerKind never reports 'creator' when a
// brand is also present.
export function resolveEventOrganizer(event) {
  const ev = event || {};
  const auto = ev.canon_consequences?.automation || {};

  const creatorName = ev.source_profile_id || auto.host_profile_id
    ? (auto.host_display_name || ev.host || auto.host_handle || null)
    : null;
  const hasCreator = !!(ev.source_profile_id || auto.host_profile_id);

  const brandName = ev.host_brand || auto.host_brand || null;
  const hasBrand = !!brandName;

  return {
    hasCreator, creatorName,
    hasBrand, brandName,
    hasOrganizer: hasCreator || hasBrand,
    organizerKind: hasBrand ? 'brand' : (hasCreator ? 'creator' : null),
  };
}

export function calcEventDifficulty(event) {
  const ev = event || {};
  const p = ev.prestige || 5;
  const s = ev.strictness || 5;
  const dressComplexity = (ev.dress_code_keywords?.length || 0) * 0.5;
  const deadlineWeight = { none: 0, low: 1, medium: 2, high: 3, tonight: 4, urgent: 5 }[ev.deadline_type] || 2;
  const raw = (p * 0.35) + (s * 0.3) + (deadlineWeight * 0.2) + (dressComplexity * 0.15);
  return Math.min(10, Math.max(1, Math.round(raw * 10) / 10));
}

export function eventDifficultyLabel(score) {
  if (score <= 3) return { text: 'Easy', color: '#16a34a', bg: '#f0fdf4' };
  if (score <= 5) return { text: 'Medium', color: '#b45309', bg: '#fef3c7' };
  if (score <= 7) return { text: 'Hard', color: '#dc2626', bg: '#fef2f2' };
  return { text: 'Extreme', color: '#7c3aed', bg: '#faf5ff' };
}

// EVENT_QUEUE_STATES and computeEventState moved to eventReadinessSections.js
// (Task #1775), next to the section gate declaration they now read.
