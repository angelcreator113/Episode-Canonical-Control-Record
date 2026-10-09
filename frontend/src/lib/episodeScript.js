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
 *
 * Career is the source event's deal, what Lala owes for it (its
 * deliverables, GET /world/:showId/events/:eventId/deliverables) and her
 * goals there; the script writer pins each to its beats
 * (services/scriptCareerService, "LALA'S CAREER IN THIS EPISODE"; Evoni,
 * 2026-10-09: "in the script i dont see career opportunities").
 */
import { briefState } from './episodeOverview';
import { dealLabelFor, relationshipGoalsOf } from '../utils/eventTerms';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The Career row: the deal and who pays it, the deliverables owed, the
 * goals. `deliverables` is null while unread or unreadable.
 */
export function careerInput(event, deliverables) {
  if (!event) return { detail: 'no source event', ok: false };
  const to = event.show_id && event.id ? `/shows/${event.show_id}/events/${event.id}` : null;
  const label = dealLabelFor(event);
  const payer = event.host_brand || event.host || null;
  const parts = [];
  if (label) parts.push(payer && label !== 'Self-funded' ? `${label} from ${payer}` : label);
  else if (event.is_paid && event.payment_amount > 0) parts.push(`paid ${event.payment_amount} coins`);
  if (deliverables?.length) parts.push(`${plural(deliverables.length, 'deliverable')} owed`);
  const goals = relationshipGoalsOf(event).length;
  if (goals) parts.push(plural(goals, 'goal'));
  if (!parts.length) return { detail: 'no deal, deliverables or goals on the event', ok: false, fix: 'event', to };
  if (deliverables === null) parts.push('deliverables could not be read');
  return { detail: parts.join(' · '), ok: true };
}

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

export function scriptInputs({ brief = null, plan = null, outfit = [], event = null, deliverables = [] } = {}) {
  const b = briefState(brief);
  const item = (key) => plan?.items?.find((i) => i.key === key) || null;
  const planned = item('event');
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
    { key: 'event', label: 'Event', detail: planned ? planned.detail.split(' · ')[0] : 'no source event', ok: !!planned },
    { key: 'place', label: 'Place', detail: place ? place.detail.split(' · ')[0] : 'no venue', ok: !!place && place.detail !== 'No venue' },
    { key: 'stakes', label: 'Stakes', detail: stakes?.done ? stakes.detail : 'not set', ok: !!stakes?.done },
    { key: 'cast', label: 'Cast', detail: cast?.done ? cast.detail : 'full guest list (none featured)', ok: !!cast?.done },
    { key: 'look', label: 'Look', ...lookInput(outfit, look), fix: 'wardrobe' },
    { key: 'career', label: 'Career', ...careerInput(event, deliverables) },
  ];
}
