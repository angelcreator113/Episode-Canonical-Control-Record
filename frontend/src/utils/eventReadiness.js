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

// Mirrors the display logic that falls back to
// canon_consequences.automation.venue_* when the top-level venue columns
// are empty. Feed-profile events created before the worldEvents.js
// from-profile route was patched to set top-level venue_location_id
// (commit 3d4d1d26) only have venue data in JSONB, so a column-only check
// would say "Venue ⚠" while other parts of the UI already show the venue.
export function computeEventReadiness(event) {
  const ev = event || {};
  const auto = ev.canon_consequences?.automation || {};

  const hasOutfit = !!ev.outfit_set_id || (Array.isArray(ev.outfit_pieces) && ev.outfit_pieces.length > 0);
  const hasVenue = !!ev.venue_location_id || !!ev.venue_name || !!auto.venue_location_id || !!auto.venue_name;
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
