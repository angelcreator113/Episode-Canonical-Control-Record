/**
 * Event Package pre-flight readiness + difficulty.
 *
 * Single source of truth for the checks that used to live inline in
 * WorldAdmin's Events card (`computeEventReadiness`, extracted from the
 * card's own `hasOutfit`/`hasVenue`/`hasScene`/`hasInvite` block) and the
 * card's difficulty score (`calcEventDifficulty`/`eventDifficultyLabel`,
 * extracted from the same file's former top-level `calcDifficulty`/
 * `difficultyLabel`). The Events card and the Event Package page
 * (`/shows/:showId/events/:eventId`) both import from here instead of each
 * keeping their own copy.
 *
 * This does not gate anything by itself — see each consumer for how the
 * result is used (advisory chips on the Events card; the Start Episode
 * button's enabled state on the Event Package page).
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
// one fallback rule; computeEventReadiness's hasVenue check below calls
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

export function computeEventReadiness(event) {
  const ev = event || {};

  const hasOutfit = !!ev.outfit_set_id || (Array.isArray(ev.outfit_pieces) && ev.outfit_pieces.length > 0);
  const hasVenue = resolveEventVenueAndDate(ev).hasVenue;
  const hasScene = !!ev.scene_set_id;
  const hasInvite = !!ev.invitation_asset_id;

  const checks = [
    { key: 'outfit', icon: '👗', label: 'Outfit', ok: hasOutfit },
    { key: 'venue', icon: '📍', label: 'Venue', ok: hasVenue },
    { key: 'scene', icon: '🎬', label: 'Scene', ok: hasScene },
    { key: 'invite', icon: '💌', label: 'Invite', ok: hasInvite },
  ];

  return { checks, allReady: checks.every(c => c.ok) };
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

// Producer Mode → Events queue states (docs/EVENT_EPISODE_FLOW.md §8(m),
// Evoni's ruling, Task #1648). Computed client-side, no persisted value —
// world_events.status stays exactly as §4 already documents it (a free
// string, written inconsistently across five call sites). This is a
// separate, read-only view over the same fields, not a new source of truth.
export const EVENT_QUEUE_STATES = {
  needs_host:  { label: 'Needs Host',  icon: '👤', color: '#dc2626', bg: '#fef2f2', primaryAction: 'Choose Host' },
  needs_setup: { label: 'Needs Setup', icon: '🛠️', color: '#b45309', bg: '#fef3c7', primaryAction: 'Continue Setup' },
  ready:       { label: 'Ready',       icon: '✓',  color: '#16a34a', bg: '#f0fdf4', primaryAction: 'Start Episode' },
  used:        { label: 'Used',        icon: '◉',  color: '#6366f1', bg: '#eef2ff', primaryAction: 'Open Episode' },
  archived:    { label: 'Archived',    icon: '□',  color: '#94a3b8', bg: '#f1f5f9', primaryAction: 'View' },
};

// Terminal states (archived, used) are checked before host/readiness —
// an already-used or declined event stays Used/Archived regardless of
// whether it happens to lack a host or a readiness item, since neither
// is actionable once the event is done.
export function computeEventState(event) {
  const ev = event || {};

  if (ev.status === 'declined' || ev.status === 'archived') return 'archived';
  if (ev.used_in_episode_id || ev.status === 'used' || ev.status === 'filmed') return 'used';

  // Host lives in one of two places depending on which door the event
  // came through (docs/EVENT_EPISODE_FLOW.md §2 "HOST — recorded two
  // different ways"): from-profile writes the durable source_profile_id
  // column; calendar-driven writes only the JSONB copy. Both must be
  // checked, or every calendar-spawned event misreports as hostless.
  const hasHost = !!ev.source_profile_id || !!ev.canon_consequences?.automation?.host_profile_id;
  if (!hasHost) return 'needs_host';

  const { allReady } = computeEventReadiness(ev);
  return allReady ? 'ready' : 'needs_setup';
}
