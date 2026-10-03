/**
 * Episode planning (Evoni, 2026-10-03, episode creation step 2): after
 * Start Episode, the episode opens on what it inherited from its event and
 * the one next decision, instead of a production tab.
 *
 * Reads only what Start Episode already carried: the source event (the
 * brief's event_id, §8(w) P2) and the episode's own script. Five items, in
 * the order the Event Package set them: Event, Cast, Location, Look,
 * Stakes. Each is { key, label, done, detail, fix }, where fix names where
 * to finish it ('package': the Event Package, whose scene set stays
 * editable until the episode is accepted; 'wardrobe': the episode's
 * Wardrobe tab) or is null when nothing on this side can set it.
 *
 * Pure; no I/O.
 */
import { describeEventOrganizer } from './eventOrganizer';

const text = (v) => (typeof v === 'string' ? v.trim() : '');

export function episodePlanning({ episode, event, sourceProfile = null, sceneSet = null, venueLocation = null } = {}) {
  if (!event) return null;
  const organizer = describeEventOrganizer(event, sourceProfile);
  const guests = event.canon_consequences?.automation?.guest_profiles || [];
  const featured = guests.filter((g) => g && g.featured);
  const featuredNames = featured.map((g) => g.display_name || g.handle).filter(Boolean);
  const venueName = venueLocation?.name || text(event.venue_name) || null;
  const hasVenue = !!event.venue_location_id;
  const hasSet = !!event.scene_set_id;
  const pieces = Array.isArray(event.outfit_pieces) ? event.outfit_pieces : [];
  const hasLook = pieces.length > 0 || !!event.outfit_set_id;
  const stakes = text(event.narrative_stakes) || text(event.fail_consequence);

  const items = [
    {
      key: 'event', label: 'Event', done: true,
      detail: organizer.name ? `${event.name} · organized by ${organizer.name}` : event.name,
      fix: null,
    },
    {
      key: 'cast', label: 'Cast', done: featured.length > 0,
      detail: featured.length
        ? `${featured.length} featured${featuredNames.length ? `: ${featuredNames.slice(0, 3).join(', ')}${featuredNames.length > 3 ? ` +${featuredNames.length - 3}` : ''}` : ''}`
        : (guests.length ? `${guests.length} invited, none featured; the script draws on the full guest list` : 'No guests'),
      fix: null,
    },
    {
      key: 'location', label: 'Location', done: hasVenue && hasSet,
      detail: hasVenue
        ? (hasSet ? `${venueName || 'Venue'} · ${sceneSet?.name || 'scene set chosen'}` : `${venueName || 'Venue'} · no scene set yet`)
        : 'No venue',
      fix: hasVenue && !hasSet ? 'package' : null,
    },
    {
      key: 'look', label: 'Look', done: hasLook,
      detail: hasLook
        ? (pieces.length ? `${pieces.length} piece${pieces.length === 1 ? '' : 's'} chosen` : 'Outfit set chosen')
        : 'Not chosen yet; Beat 8 needs it',
      fix: hasLook ? null : 'wardrobe',
    },
    {
      key: 'stakes', label: 'Stakes', done: !!stakes,
      detail: stakes || 'Not set; the script will have no stated story stakes',
      fix: null,
    },
  ];

  const hasScript = !!text(episode?.script_content);
  return {
    items,
    done: items.filter((i) => i.done).length,
    total: items.length,
    hasScript,
    next: hasScript
      ? { key: 'production', label: 'Production checklist', tab: 'checklist' }
      : { key: 'script', label: 'Generate Script', tab: 'scripts' },
  };
}
