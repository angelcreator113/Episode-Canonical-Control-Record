/**
 * The Script page's "What the script will use" (Evoni's Episode mock,
 * 2026-10-05): what generation reads, each lavender when it is there or
 * amber when the script will fill the gap and flag it. Pure; reads the
 * brief (GET /episode-brief/:id) and the source event's planning items
 * (utils/episodePlanning.js).
 *
 * Look is the outfit locked on the Wardrobe tab (GET /wardrobe/outfit/
 * :episodeId), the one the script writer reads (services/
 * episodeScriptWriterService, "LOCKED OUTFIT"); it read the event's
 * planned look, so a locked outfit still said "not chosen" (Evoni,
 * 2026-10-08). A look planned in the event but not locked is amber: the
 * script does not use it until it is locked.
 */
import { briefState } from './episodeOverview';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The Look row: the locked outfit, else what is planned, else nothing. `outfit` is null while unread or unreadable. */
export function lookInput(outfit, planned) {
  if (Array.isArray(outfit) && outfit.length > 0) {
    const names = outfit.map((p) => p?.name).filter(Boolean);
    const shown = names.slice(0, 3).join(', ');
    const more = names.length > 3 ? ` +${names.length - 3}` : '';
    return { detail: `${plural(outfit.length, 'piece')} locked${shown ? `: ${shown}${more}` : ''}`, ok: true };
  }
  if (outfit === null) return { detail: 'the locked outfit could not be read', ok: false };
  if (planned?.done) return { detail: 'planned in the event, not locked on the Wardrobe tab yet', ok: false };
  return { detail: 'not locked on the Wardrobe tab yet', ok: false };
}

export function scriptInputs({ brief = null, plan = null, outfit = [] } = {}) {
  const b = briefState(brief);
  const item = (key) => plan?.items?.find((i) => i.key === key) || null;
  const event = item('event');
  const place = item('location');
  const stakes = item('stakes');
  const cast = item('cast');
  const look = item('look');
  return [
    {
      key: 'brief', label: 'Brief',
      detail: !b ? 'not read yet' : (b.complete ? 'archetype, intent, purpose, hook' : `missing ${b.missing.map((m) => m.label.toLowerCase()).join(', ')}`),
      ok: !!b?.complete,
    },
    { key: 'event', label: 'Event', detail: event ? event.detail.split(' · ')[0] : 'no source event', ok: !!event },
    { key: 'place', label: 'Place', detail: place ? place.detail.split(' · ')[0] : 'no venue', ok: !!place && place.detail !== 'No venue' },
    { key: 'stakes', label: 'Stakes', detail: stakes?.done ? stakes.detail : 'not set', ok: !!stakes?.done },
    { key: 'cast', label: 'Cast', detail: cast?.done ? cast.detail : 'full guest list (none featured)', ok: !!cast?.done },
    { key: 'look', label: 'Look', ...lookInput(outfit, look), fix: 'wardrobe' },
  ];
}
