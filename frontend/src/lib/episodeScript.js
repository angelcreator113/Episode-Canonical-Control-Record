/**
 * The Script page's "What the script will use" (Evoni's Episode mock,
 * 2026-10-05): what generation reads, each lavender when it is there or
 * amber when the script will fill the gap and flag it. Pure; reads the
 * brief (GET /episode-brief/:id) and the source event's planning items
 * (utils/episodePlanning.js).
 */
import { briefState } from './episodeOverview';

export function scriptInputs({ brief = null, plan = null } = {}) {
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
    { key: 'look', label: 'Look', detail: look?.done ? look.detail : 'not chosen', ok: !!look?.done },
  ];
}
