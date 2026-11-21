/**
 * Where an episode sits in its show, from what the episode itself stores
 * (Evoni, 2026-11-15, Producer Mode navigation). Pure: nothing here fetches.
 *
 * The source is episodes.season_context, the snapshot Start Episode writes
 * (services/seasonSlotService snapshotEpisode; a bonus or special:
 * services/seasonSpecials). A weekly
 * episode's snapshot carries its slot_number; a special's carries
 * slot_number null and `special` ({ id, label, after_slot_number }). Nothing
 * is worked out from the episode's own number or from dates: an episode
 * with no snapshot is simply in no slot.
 *
 *   seasonContextOf(episode)       the snapshot as an object, or null
 *   episodeSeasonNumber(episode)   the season it was placed in (1 to 999), or null
 *   episodeSeasonHref(showId, episode, tab)   the Season page, in its season
 *   episodeSlotLink(showId, episode)          { href, label, kind } or null
 */
import { seasonPageHref } from './seasonPage';

const asSeason = (value) => (/^[1-9]\d{0,2}$/.test(String(value ?? '')) ? Number(value) : null);
const asSlot = (value) => (Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 1000 ? Number(value) : null);

/** The episode's stored season snapshot, or null (absent, or not readable). */
export function seasonContextOf(episode) {
  const sc = episode?.season_context;
  if (!sc) return null;
  if (typeof sc === 'object') return Array.isArray(sc) ? null : sc;
  try {
    const parsed = JSON.parse(sc);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.error('[episodePlace] season_context is not JSON:', err);
    return null;
  }
}

/**
 * The season the episode was placed in: its snapshot's, or null. The
 * episodes.season_number column is not used: it is set on episodes no
 * season ever placed, and the Season page answers "This show has no Season
 * N" (GET .../arc?season=N, 404) for a season that was never set up. With
 * null the link opens the season in progress, as it did before.
 */
export function episodeSeasonNumber(episode) {
  return asSeason(seasonContextOf(episode)?.season_number);
}

/** The Season page on `tab`, opened on the episode's season when it has one. */
export function episodeSeasonHref(showId, episode, tab) {
  return seasonPageHref(showId, tab, { season: episodeSeasonNumber(episode) });
}

/**
 * The episode's place on the Roadmap: its slot (opened there), or for a
 * bonus or special the Roadmap of its season (a special is in no slot, and
 * none is guessed for it). Null when the episode stores no place.
 */
export function episodeSlotLink(showId, episode) {
  const sc = seasonContextOf(episode);
  if (!showId || !sc) return null;
  const season = episodeSeasonNumber(episode);
  const slot = asSlot(sc.slot_number);
  if (slot) {
    return { kind: 'slot', slot, season, label: sc.label || `E${slot}`, href: seasonPageHref(showId, 'roadmap', { season, slot }) };
  }
  if (sc.special && sc.special.id) {
    return { kind: 'special', slot: null, season, label: sc.label || sc.special.label || 'Special', href: seasonPageHref(showId, 'roadmap', { season }) };
  }
  return null;
}
