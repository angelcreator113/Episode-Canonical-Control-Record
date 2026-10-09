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
 * Look is the outfit locked on the episode's Wardrobe tab when `outfit`
 * (GET /wardrobe/outfit/:episodeId, its items) is given, the one the script
 * writer reads; the Overview said "Not chosen yet" over a locked outfit
 * (Evoni, 2026-10-09). Without it, the event's planned look, as before.
 *
 * Pure; no I/O.
 */
import { describeEventOrganizer } from './eventOrganizer';
import { resolveEventVenueAndDate } from './eventReadiness';

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** The Look item from the outfit locked on the Wardrobe tab. */
function lockedLook(outfit, planned) {
  if (outfit.length) {
    const names = outfit.map((p) => p?.name).filter(Boolean);
    const shown = names.slice(0, 3).join(', ');
    const more = names.length > 3 ? ` +${names.length - 3}` : '';
    return { key: 'look', label: 'Look', done: true, detail: `${outfit.length} piece${outfit.length === 1 ? '' : 's'} locked${shown ? `: ${shown}${more}` : ''}`, fix: null };
  }
  return {
    key: 'look', label: 'Look', done: false,
    detail: planned ? 'Planned in the event, not locked on the Wardrobe tab yet; Beat 8 needs it' : 'Not chosen yet; Beat 8 needs it',
    fix: 'wardrobe',
  };
}

export function episodePlanning({ episode, event, sourceProfile = null, sceneSet = null, venueLocation = null, outfit } = {}) {
  if (!event) return null;
  const organizer = describeEventOrganizer(event, sourceProfile);
  const guests = event.canon_consequences?.automation?.guest_profiles || [];
  const featured = guests.filter((g) => g && g.featured);
  const featuredNames = featured.map((g) => g.display_name || g.handle).filter(Boolean);
  // Evoni (2026-10-06): the event's place is its venue name and address
  // (Event Package → Place), with or without a linked World Location. Only
  // venue_location_id counted, so an event with a typed venue read "No
  // venue". A venue fills Location (and counts as carried); the scene set
  // is still asked for in the Event Package.
  // 2026-10-07: read through resolveEventVenueAndDate, the Place's own rule,
  // so a venue that lives only in the automation copy (calendar-spawned
  // events) counts here too; it read "No venue" while the Place showed it
  // (wiring map, docs/reads/2026-10-06-lalaverse-wiring-map.md claim d,
  // fix-list item 11).
  const place = resolveEventVenueAndDate(event);
  const venueName = venueLocation?.name || text(place.venueName) || null;
  const venueAddress = text(place.venueAddress) || null;
  const hasVenue = !!place.venueLocationId || !!venueName;
  const venueText = `${venueName || 'Venue'}${venueAddress ? `, ${venueAddress}` : ''}`;
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
      key: 'location', label: 'Location', done: hasVenue,
      detail: hasVenue
        ? (hasSet ? `${venueText} · ${sceneSet?.name || 'scene set chosen'}` : `${venueText} · no scene set yet`)
        : 'No venue',
      fix: hasVenue && !hasSet ? 'package' : null,
    },
    Array.isArray(outfit) ? lockedLook(outfit, hasLook) : {
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
